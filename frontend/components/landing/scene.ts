import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

export type SceneElements = {
  canvas: HTMLCanvasElement;
  labels: HTMLElement;
  tip: HTMLElement;
  tipTitle: HTMLElement;
  tipPill: HTMLElement;
  tipRow: HTMLElement;
  classes: Record<string, string>;
  reduce: boolean;
};

type Cell = {
  x: number; y: number; z: number; lobby: boolean; occupied: boolean; warmth: number;
  status: "common" | "empty" | "paid" | "partial" | "late"; delay: number; jit: number; rent: number; diag: number;
  code: string; bar: [number, number] | null;
};
type Hood = { x: number; z: number; w: number; d: number; fl: number; h: number; lr: boolean; pf: boolean; delay: number; tint: number; cz: number; cx: number };

// Bina: her cam kutu bir bağımsız bölüm; 5 x 3 x 10 = 150 daire. Sahne yalnız süstür ve sayfa metninden bağımsızdır.
export function startScene(el: SceneElements): { measure: () => void; dispose: () => void } {
  const { canvas, reduce } = el;
  const fine = matchMedia("(pointer: fine)").matches;
  // Düşük güç: dar ekran veya az çekirdek; gölge, bloom ve kenar yumuşatma kapanır.
  const low = innerWidth < 860 || (navigator.hardwareConcurrency || 8) <= 4;
  const shadows = !low;
  // Masaüstünde 1x ekranda hafif süper örnekleme: titreşen ince ayrıntıyı yumuşatır.
  const DPR = low ? Math.min(devicePixelRatio || 1, 1.25) : Math.max(1.25, Math.min(devicePixelRatio || 1, 1.75));
  const fx = !low;
  const css = getComputedStyle(document.documentElement);
  const token = (n: string) => new THREE.Color(css.getPropertyValue(n).trim());

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, powerPreference: "high-performance" });
  renderer.setPixelRatio(DPR);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x020306);
  if (shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Sahne yalnız katman/hover değişince hareket eder; gölge haritası gerektiğinde yenilenir.
    renderer.shadowMap.autoUpdate = false;
  }

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x020306, 52, 135);
  const fog = scene.fog as THREE.Fog;
  const FOG0 = [52, 135];
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 220);

  const hemi = new THREE.HemisphereLight(0xc9dbff, 0x07090e, 0.35);
  scene.add(hemi);
  // Gece/gündüz: dayT hedef (html data-theme), dayK yumuşak geçiş değeri.
  const NIGHT_BG = new THREE.Color(0x020306), DAY_BG = new THREE.Color(0xbfcddd), BG = new THREE.Color();
  const NIGHT_GROUND = new THREE.Color(0x0f1622), DAY_GROUND = new THREE.Color(0x6f7a8a);
  const isDay = () => (document.documentElement.dataset.theme === "light" ? 1 : 0);
  let dayT = isDay(), dayK = dayT, dayApplied = -1;
  // Güneş: tek gölge kaynağı; sol-önden gelir, gölge binanın sağ-arkasına düşer.
  const sun = new THREE.DirectionalLight(0xfff1de, 2.1);
  sun.position.set(-9, 16, 12);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(3072, 3072);
    const sc = sun.shadow.camera;
    sc.left = -32; sc.right = 32; sc.top = 28; sc.bottom = -28; sc.near = 4; sc.far = 80;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.05; sun.shadow.radius = 4;
  }
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x5f8cff, 1.6);
  rim.position.set(-12, 8, -10);
  scene.add(rim);

  const orbs: THREE.Mesh[] = [];
  ([["--orb-1", 5, [18, 15, -40]], ["--orb-2", 6.5, [-26, 4, -46]], ["--orb-3", 2.6, [12, -3, -30]], ["--orb-4", 7, [30, -10, -50]], ["--orb-2", 1.8, [-14, 14, -34]]] as Array<[string, number, [number, number, number]]>)
    .forEach(([c, r, p], i) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28), new THREE.MeshStandardMaterial({ color: token(c), roughness: 0.42, metalness: 0.0 }));
      m.position.set(...p);
      m.userData = { bx: p[0], by: p[1], bz: p[2], speed: 0.12 + i * 0.03, phase: i * 1.7 };
      scene.add(m);
      orbs.push(m);
    });

  const NX = 5, NZ = 3, NY = 10, FH = 1.0;
  const N = NX * NZ * NY;
  const glow = { value: low ? 2.0 : 1.7 };
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a101c, roughness: 0.32, metalness: 0.35, envMapIntensity: 0.3 });
  // Ortam yansıması kısılsın diye harita malzemeye açıkça verilir (sahne ortamı envMapIntensity dinlemez).
  glass.envMap = scene.environment;
  // Örnek rengi yüzeyi boyamaz, içeriden gelen ışık olur; çerçeve ve orta denk ekran türevine göre yumuşatılır, uzakta düz parıltıya döner.
  glass.onBeforeCompile = (sh) => {
    sh.uniforms.uGlow = glow;
    sh.fragmentShader = "uniform float uGlow;\n" + sh.fragmentShader
      .replace("#include <color_fragment>", "")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n#ifdef USE_COLOR\n float fxw = fwidth(vUv.x) + 1e-4, fyw = fwidth(vUv.y) + 1e-4;\n float wx = smoothstep(0.1 - fxw, 0.1 + fxw, vUv.x) * smoothstep(0.1 - fxw, 0.1 + fxw, 1.0 - vUv.x);\n float wy = smoothstep(0.135 - fyw, 0.135 + fyw, vUv.y) * smoothstep(0.135 - fyw, 0.135 + fyw, 1.0 - vUv.y);\n float farK = smoothstep(0.06, 0.2, max(fxw, fyw));\n float wm = mix(wx * wy, 0.66, farK);\n totalEmissiveRadiance += vColor * uGlow * wm * mix(0.6, 1.2, vUv.y);\n#endif");
    (sh as unknown as { defines: Record<string, string> }).defines = { ...((sh as unknown as { defines?: Record<string, string> }).defines ?? {}), USE_UV: "" };
  };
  const units = new THREE.InstancedMesh(new RoundedBoxGeometry(0.9, 0.8, 0.9, 2, 0.05), glass, N);
  units.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  units.castShadow = true;
  units.receiveShadow = false; // kendi üstüne gölge düşürmez: akne ve sürünme olmaz
  // Sabit sınır küresi: örnekler uçuşurken kırpma ve ışın testi yanlış sonuç vermesin.
  units.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 5, 0), 30);
  units.setColorAt(0, new THREE.Color());
  scene.add(units);

  const mat = (c: number, r = 0.6, m = 0.1) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const concrete = mat(0x6f7889, 0.6, 0.1);
  const slabs: THREE.Mesh[] = [];
  for (let f = 0; f <= NY; f++) {
    const m = new THREE.Mesh(new RoundedBoxGeometry(NX + 0.35, 0.1, NZ + 0.35, 2, 0.03), concrete);
    m.position.y = f * FH - 0.46; m.castShadow = true; m.receiveShadow = false;
    scene.add(m); slabs.push(m);
  }
  const columns: THREE.Mesh[] = [];
  ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as Array<[number, number]>).forEach(([sx, sz]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, NY * FH, 0.22), concrete);
    m.position.set(sx * (NX / 2 + 0.11), NY * FH / 2 - 0.46, sz * (NZ / 2 + 0.11));
    m.castShadow = true; scene.add(m); columns.push(m);
  });

  const TMPC = new THREE.Color();
  const PLAZA_TOP = -0.53;
  // Mahalle: merkezdeki bina kahraman nesne kalır; çevre, sokak ızgarası ve alçak yapılarla okunur kılınır.
  const GY = PLAZA_TOP + 0.04; // kaldırım üst yüzeyi: komşu bina tabanları buradan başlar
  const hood = new THREE.Group();
  scene.add(hood);
  // Sokak lambası başları: gece yanar, gündüz söner.
  const LAMP_ON = new THREE.Color(1.0, 0.82, 0.55).multiplyScalar(2.4), LAMP_OFF = new THREE.Color(0x3a4252);
  const LAMP_MAT = new THREE.MeshBasicMaterial({ color: LAMP_ON.clone() });
  const ground = new THREE.Mesh(new THREE.BoxGeometry(130, 0.3, 100), mat(0x0f1622, 0.92, 0.0));
  ground.position.y = PLAZA_TOP - 0.15; ground.receiveShadow = true;
  scene.add(ground);
  const boxG = (w: number, h: number, d: number, x: number, y: number, z: number) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
  const HX = 15.5, HZ = 11.5, RW = 3;
  const MARK_Y = PLAZA_TOP + 0.02;
  {
    // Yollar ve kaldırım plakaları birleştirilmiş geometridir: tek çizim çağrısı.
    const road = new THREE.Mesh(mergeGeometries([
      boxG(84, 0.03, RW, 0, PLAZA_TOP, HZ), boxG(84, 0.03, RW, 0, PLAZA_TOP, -HZ),
      boxG(RW, 0.03, 66, HX, PLAZA_TOP, 0), boxG(RW, 0.03, 66, -HX, PLAZA_TOP, 0)]), mat(0x080b11, 0.85, 0.0));
    const pad = new THREE.Mesh(mergeGeometries([
      boxG(28, 0.06, 20, 0, PLAZA_TOP + 0.01, 0), boxG(19, 0.06, 20, 26.5, PLAZA_TOP + 0.01, 0), boxG(19, 0.06, 20, -26.5, PLAZA_TOP + 0.01, 0)]), mat(0x2a3446, 0.8, 0.0));
    const park = new THREE.Mesh(boxG(4, 0.03, 4, 4.6, PLAZA_TOP + 0.045, 5.4), mat(0x1c4332, 0.95, 0.0));
    const walk = new THREE.Mesh(boxG(1.7, 0.04, 8.1, 0, PLAZA_TOP + 0.05, 5.95), mat(0x3a465c, 0.7, 0.0));
    [road, pad, park, walk].forEach((m) => { m.receiveShadow = true; hood.add(m); });
  }
  const D = new THREE.Object3D();
  // items: [x, y, z, sx, sy, sz, rotY]
  function place(mesh: THREE.InstancedMesh, items: number[][]) {
    items.forEach((it, i) => {
      D.position.set(it[0], it[1], it[2]); D.scale.set(it[3] ?? 1, it[4] ?? 1, it[5] ?? 1); D.rotation.set(0, it[6] ?? 0, 0);
      D.updateMatrix(); mesh.setMatrixAt(i, D.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; hood.add(mesh);
    return mesh;
  }
  {
    // Yol çizgileri: kavşaklarda kesilir, yaya geçitleri kavşağın iki yanındadır.
    const zebra: number[][] = [];
    // Kesik çizgiler mipmap'li dokuyla çizilir: uzakta titreyen ince geometri yerine yumuşak bir iz kalır.
    const dashC = document.createElement("canvas");
    dashC.width = 64; dashC.height = 8;
    { const g = dashC.getContext("2d"); if (g) { g.fillStyle = "#fff"; g.fillRect(0, 0, 32, 8); } }
    const dashTex = new THREE.CanvasTexture(dashC);
    dashTex.wrapS = THREE.RepeatWrapping; dashTex.colorSpace = THREE.SRGBColorSpace;
    dashTex.anisotropy = renderer.capabilities.getMaxAnisotropy(); dashTex.generateMipmaps = true; dashTex.minFilter = THREE.LinearMipmapLinearFilter;
    const dashMat = new THREE.MeshStandardMaterial({ color: 0x8d95a5, roughness: 0.7, map: dashTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const strip = (a: number, b: number, fixed: number, alongX: boolean) => {
      const len = b - a, geo = new THREE.PlaneGeometry(len, 0.18).rotateX(-Math.PI / 2);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 2);
      if (!alongX) geo.rotateY(Math.PI / 2);
      const m = new THREE.Mesh(geo, dashMat);
      m.position.set(alongX ? (a + b) / 2 : fixed, MARK_Y + 0.008, alongX ? fixed : (a + b) / 2);
      m.receiveShadow = true; hood.add(m);
    };
    for (const zf of [HZ, -HZ]) for (const [a, b] of [[-42, -HX - 3.4], [-HX + 3.4, HX - 3.4], [HX + 3.4, 42]]) strip(a, b, zf, true);
    for (const xf of [HX, -HX]) for (const [a, b] of [[-33, -HZ - 3.4], [-HZ + 3.4, HZ - 3.4], [HZ + 3.4, 33]]) strip(a, b, xf, false);
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) for (const o of [-1, 1]) {
      const xc = sx * HX + o * 2.7, zc = sz * HZ + o * 2.7;
      for (let k = 0; k < 5; k++) { zebra.push([xc + (k - 2) * 0.55, MARK_Y, sz * HZ, 0.28, 1, RW - 0.7]); zebra.push([sx * HX, MARK_Y, zc + (k - 2) * 0.55, RW - 0.7, 1, 0.28]); }
    }
    const markGeo = new THREE.BoxGeometry(1, 0.012, 1);
    place(new THREE.InstancedMesh(markGeo, mat(0xb4bccb, 0.7, 0.0), zebra.length), zebra).receiveShadow = true;

    const jointsM = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, 0.045, 0.08), mat(0x4d5a73, 0.7, 0.0), 8);
    place(jointsM, Array.from({ length: 8 }, (_, i) => [0, PLAZA_TOP + 0.07, 2.4 + i, 1, 1, 1])).receiveShadow = true;

    // Ağaçlar: kaldırım kenarları, park ve ana binanın çevresi.
    const treeAt: Array<[number, number]> = [[-4.8, 3.2], [5.0, 0.8], [-5.0, -3.2], [3.6, 4.4], [5.6, 6.6], [3.8, 6.8], [5.8, 4.2]];
    [-9, -3, 3, 9].forEach((x) => treeAt.push([x, 9.0], [x, -9.0]));
    [-3, 3].forEach((z) => treeAt.push([13.2, z], [-13.2, z]));
    [-7, -2, 3, 8].forEach((z) => treeAt.push([17.4, z], [-17.4, z]));
    const trees = low ? treeAt.filter((_, i) => i % 2 === 0) : treeAt;
    const T = trees.length;
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.1, 0.6, 6), mat(0x4a3a2c, 0.9, 0), T);
    const leafA = new THREE.InstancedMesh(new THREE.ConeGeometry(0.6, 1.1, 7), new THREE.MeshStandardMaterial({ color: 0x1d6a4b, roughness: 0.85, flatShading: true }), T);
    const leafB = new THREE.InstancedMesh(new THREE.ConeGeometry(0.42, 0.9, 7), new THREE.MeshStandardMaterial({ color: 0x2c8a60, roughness: 0.85, flatShading: true }), T);
    const tItems = (dy: number, hh: number) => trees.map(([x, z], i) => { const s = 0.95 + ((i * 37) % 10) / 22; return [x, PLAZA_TOP + 0.05 + (dy + hh) * s, z, s, s, s, i * 1.3]; });
    place(trunk, tItems(0, 0.3)); place(leafA, tItems(0.6, 0.5)); place(leafB, tItems(0.6, 1.15));
    [trunk, leafA, leafB].forEach((m) => { m.castShadow = true; });

    // Sokak lambaları: yaya yolu, blok kenarları.
    const lampAt: Array<[number, number]> = [[-1.6, 4.0], [1.6, 4.0], [-1.6, 8.2], [1.6, 8.2]];
    [-12, -6, 6, 12].forEach((x) => lampAt.push([x, 9.5], [x, -9.5]));
    [-6, 0, 6].forEach((z) => lampAt.push([13.5, z], [-13.5, z]));
    const lamps = low ? lampAt.filter((_, i) => i % 2 === 0) : lampAt;
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.05, 2.0, 8), mat(0x1a2130, 0.5, 0.6), lamps.length);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 12, 8), LAMP_MAT, lamps.length);
    place(pole, lamps.map(([x, z]) => [x, PLAZA_TOP + 1.05, z])); place(head, lamps.map(([x, z]) => [x, PLAZA_TOP + 2.1, z]));
    pole.castShadow = true;

    // Park halindeki arabalar: sönük renkler, ana binadan dikkat çalmasın.
    const carAt: Array<[number, number, number]> = [[-11, 10.8, 0], [-7, 10.8, 0], [-2.5, 10.8, 0], [5, 10.8, 0], [9.5, 10.8, 0], [-10, -10.8, 0], [-4, -10.8, 0], [2, -10.8, 0], [8, -10.8, 0], [12, -10.8, 0],
      [14.75, -6, Math.PI / 2], [14.75, 2.5, Math.PI / 2], [14.75, 5, Math.PI / 2], [-14.75, -2, Math.PI / 2], [-14.75, 4.5, Math.PI / 2]];
    const cars = low ? carAt.filter((_, i) => i % 2 === 0) : carAt;
    const carCols = [0x6b7a8f, 0x8a6f5f, 0x5f7a6b, 0x7d7d86, 0x9a8a6a, 0x4a5568];
    const carBody = new THREE.InstancedMesh(new RoundedBoxGeometry(1.5, 0.38, 0.74, 2, 0.1), mat(0xffffff, 0.45, 0.35), cars.length);
    const carTop = new THREE.InstancedMesh(new RoundedBoxGeometry(0.8, 0.3, 0.66, 2, 0.08), mat(0x10151f, 0.2, 0.6), cars.length);
    place(carBody, cars.map(([x, z, r]) => [x, PLAZA_TOP + 0.25, z, 1, 1, 1, r]));
    place(carTop, cars.map(([x, z, r]) => [x + Math.cos(r) * -0.12, PLAZA_TOP + 0.5, z + Math.sin(r) * 0.12, 1, 1, 1, r]));
    cars.forEach((_, i) => carBody.setColorAt(i, TMPC.set(carCols[i % carCols.length])));
    [carBody, carTop].forEach((m) => { m.castShadow = true; });
  }

  // Komşu binalar: tek InstancedMesh; pencere deseni gölgelendiricide üretilir, her bina kendi kat/sütun sayısını taşır.
  const NB_ALL: Array<[number, number, number, number, number, number]> = [[-8.2, -1.2, 4.2, 3.4, 5, 0], [8.6, -2.2, 4.4, 3.6, 6, 0], [-3.8, -6.6, 4.6, 2.8, 7, 0], [3.6, -6.6, 3.8, 2.8, 8, 0],
    [-9.2, 5.6, 3.4, 2.8, 3, 1], [8.8, 6.2, 3.6, 3.0, 3, 1], [-20, 2, 4.2, 3.4, 5, 0], [20.5, -2, 4.6, 3.6, 6, 0], [21, 6.5, 3.4, 3.0, 3, 1]];
  const aptTints = [0x8791a6, 0x7d8799, 0x939aab, 0x76809a], lowTints = [0xa39a90, 0x9a9488, 0xa8a090];
  // Düşük güçte daha az bina; portföy binaları (ilk iki) her zaman vardır.
  const nbSel = low ? [0, 1, 2, 4, 5] : NB_ALL.map((_, i) => i);
  const NB: Hood[] = nbSel.map((si, i) => {
    const [x, z, w, d, fl, lr] = NB_ALL[si];
    return { x, z, w, d, fl, h: fl * 0.9, lr: !!lr, pf: si < 2, delay: 0.25 + i * 0.05,
      tint: (lr ? lowTints : aptTints)[si % (lr ? lowTints.length : aptTints.length)],
      cz: Math.max(2, Math.round(w / 0.85)), cx: Math.max(2, Math.round(d / 0.85)) };
  });
  const NN = NB.length;
  const nbGeo = new THREE.BoxGeometry(1, 1, 1);
  nbGeo.translate(0, 0.5, 0);
  const nbInfo = new Float32Array(NN * 4), nbGlowArr = new Float32Array(NN);
  NB.forEach((n, i) => { nbInfo.set([n.fl, n.cz, n.cx, i + 1], i * 4); });
  nbGeo.setAttribute("aInfo", new THREE.InstancedBufferAttribute(nbInfo, 4));
  const nbGlowAttr = new THREE.InstancedBufferAttribute(nbGlowArr, 1);
  nbGlowAttr.setUsage(THREE.DynamicDrawUsage);
  nbGeo.setAttribute("aGlow", nbGlowAttr);
  // Komşu pencereleri tek bir 8x8 pencere dokusundan gelir; mipmap uzaktaki pencereleri kendiliğinden ortalar, titreme olmaz.
  const winTex = (() => {
    const S = 512, c = document.createElement("canvas");
    c.width = c.height = S;
    const x = c.getContext("2d");
    const cell = S / 8;
    let seed = 7;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    if (x) {
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
        const lit = r() < 0.5, warm = r();
        const k = lit ? 0.6 + 0.4 * r() : 0;
        x.fillStyle = lit ? `rgb(${Math.round(255 * k)},${Math.round((168 + 46 * warm) * k)},${Math.round((90 + 60 * warm) * k)})` : "rgb(6,8,12)";
        x.fillRect(i * cell + cell * 0.21, j * cell + cell * 0.24, cell * 0.58, cell * 0.48);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  })();
  const nbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0.05 });
  nbMat.onBeforeCompile = (sh) => {
    sh.vertexShader = "attribute vec4 aInfo;\nattribute float aGlow;\nvarying vec3 vON;\nvarying vec4 vInfo;\nvarying float vGlow;\n" + sh.vertexShader
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n vON = normal; vInfo = aInfo; vGlow = aGlow;");
    sh.uniforms.uWin = { value: winTex };
    sh.fragmentShader = "uniform sampler2D uWin;\n" + "varying vec3 vON;\nvarying vec4 vInfo;\nvarying float vGlow;\n" + sh.fragmentShader
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + [
        " float side = 1.0 - step(0.5, abs(vON.y));",
        " bool xf = abs(vON.x) > 0.5;",
        " vec2 g = vec2(vUv.x * (xf ? vInfo.z : vInfo.y), vUv.y * vInfo.x);",
        " float bid = floor(vInfo.w + 0.5); vec2 off = vec2(bid * 3.0, bid * 5.0) + (xf ? vec2(3.0, 5.0) : vec2(0.0));",
        " vec4 wt = texture2D(uWin, (g + off) / 8.0) * side;",
        " diffuseColor.rgb *= mix(1.0, 0.2, wt.a);",
        " totalEmissiveRadiance += wt.rgb * 1.5 * vGlow;"].join("\n"));
    (sh as unknown as { defines: Record<string, string> }).defines = { ...((sh as unknown as { defines?: Record<string, string> }).defines ?? {}), USE_UV: "" };
  };
  const nbBody = new THREE.InstancedMesh(nbGeo, nbMat, NN);
  const nbRoof = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.16, 1).translate(0, 0.08, 0), mat(0x2b3342, 0.7, 0.1), NN);
  const nbCap = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), mat(0x39435a, 0.6, 0.2), NN);
  [nbBody, nbRoof, nbCap].forEach((m) => m.instanceMatrix.setUsage(THREE.DynamicDrawUsage));
  for (let i = 0; i < NN; i++) nbBody.setColorAt(i, TMPC.set(NB[i].tint));
  [nbBody, nbRoof, nbCap].forEach((m) => { m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false; hood.add(m); });

  // Portföy halkaları: ana bina ile iki komşu binanın tabanında yumuşak birincil renk parıltısı.
  const ringTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    if (g) {
      const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      r.addColorStop(0, "rgba(255,255,255,0)"); r.addColorStop(0.55, "rgba(255,255,255,0.05)");
      r.addColorStop(0.8, "rgba(255,255,255,0.9)"); r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r; g.fillRect(0, 0, 256, 256);
    }
    return new THREE.CanvasTexture(c);
  })();
  const ringMat = new THREE.MeshBasicMaterial({ map: ringTex, color: token("--brand").multiplyScalar(1.6), transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const rings = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), ringMat, 3);
  {
    const RY = GY + 0.015;
    const r0: number[][] = [[0, RY, 0, NX + 0.35 + 3.6, 1, NZ + 0.35 + 3.6]];
    NB.filter((n) => n.pf).forEach((n) => r0.push([n.x, RY, n.z, n.w + 3.2, 1, n.d + 3.2]));
    place(rings, r0);
    rings.visible = false;
  }

  const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
  const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), SC = new THREE.Vector3(), P = new THREE.Vector3(), COL = new THREE.Color(), TMP = new THREE.Color();
  const NB_PF = NB.map((n) => n.pf);
  // Mahalle durumu faza bağlı saf bir fonksiyondur: geri kaydırınca aynı yolu tersine izler.
  function hoodUpdate(p: number, intro: number) {
    const hb = intro * 1.4;
    const pf = ease((p - 0.45) / 0.6) * (1 - ease((p - 1.7) / 0.7));
    const calm = ease((p - 1.7) / 0.7);
    const rap = ease((p - 3.35) / 0.85) * (1 - ease((p - 5.4) / 0.6));
    for (let i = 0; i < NN; i++) {
      const n = NB[i], a = ease((hb - n.delay) / 0.45) * (1 - ease((p - 2.6 - (i % 10) * 0.05) / 0.7));
      const k = NB_PF[i] ? 1 + 0.55 * pf : 1 - 0.5 * pf;
      const dim = k * (1 - 0.3 * calm) * (1 - 0.7 * rap);
      Q.identity();
      P.set(n.x, GY, n.z); SC.set(n.w, Math.max(1e-4, n.h * a), n.d); M.compose(P, Q, SC); nbBody.setMatrixAt(i, M);
      P.set(n.x, GY + n.h * a, n.z); SC.set(n.w + 0.16, a > 0.01 ? 1 : 1e-4, n.d + 0.16); M.compose(P, Q, SC); nbRoof.setMatrixAt(i, M);
      const cap = n.lr ? 1e-4 : a;
      P.set(n.x - n.w * 0.1, GY + n.h * a + 0.16, n.z); SC.set(n.w * 0.34, Math.max(1e-4, 0.55 * cap), n.d * 0.4); M.compose(P, Q, SC); nbCap.setMatrixAt(i, M);
      nbGlowArr[i] = a * a * dim * (1 - dayK);
      COL.set(n.tint); const lum = COL.r * 0.3 + COL.g * 0.59 + COL.b * 0.11; COL.lerp(TMP.setRGB(lum, lum, lum), 0.65 * rap).multiplyScalar(dim); nbBody.setColorAt(i, COL);
    }
    nbBody.instanceMatrix.needsUpdate = nbRoof.instanceMatrix.needsUpdate = nbCap.instanceMatrix.needsUpdate = true;
    if (nbBody.instanceColor) nbBody.instanceColor.needsUpdate = true;
    nbGlowAttr.needsUpdate = true;
    ringMat.opacity = 0.8 * pf; rings.visible = pf > 0.01;
    glow.value = (low ? 2.0 : 1.7) * (1 + 0.1 * pf) * (1 - 0.6 * dayK);
    // Sayfanın yarısından sonra mahalle (yollar, ağaçlar, binalar) zeminin altına iner.
    hood.position.y = -9 * ease((p - 2.6) / 0.9);
    // Rapor aşamasında mahalle yerinde kalır, yalnız soluklaşır ve sisle uzaklaşır; son bölümde tamamen geri gelir.
    fog.near = FOG0[0] - 14 * rap; fog.far = FOG0[1] - 40 * rap;
  }

  // Düşük güçte gerçek gölge yok; yumuşak sahte gölge yerine geçer.
  const blob = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    if (g) {
      const r = g.createRadialGradient(128, 128, 8, 128, 128, 128);
      r.addColorStop(0, "rgba(0,0,0,.8)"); r.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = r; g.fillRect(0, 0, 256, 256);
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(20, 14), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = PLAZA_TOP + 0.005; m.visible = !shadows;
    return m;
  })();
  scene.add(blob);

  // Balkonlar: ön cephede (+z) dönüşümlü katlarda, cam korkuluklu.
  const balc: Array<[number, number]> = [];
  for (let y = 1; y < NY; y++) for (let x = 0; x < NX; x++) if ((x + y) % 2 === 0) balc.push([x, y]);
  const BZ = (NZ + 0.35) / 2;
  const balSlab = new THREE.InstancedMesh(new THREE.BoxGeometry(0.82, 0.06, 0.5), concrete, balc.length);
  const balRail = new THREE.InstancedMesh(new THREE.BoxGeometry(0.82, 0.3, 0.06), new THREE.MeshStandardMaterial({ color: 0x9cc4ff, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.28 }), balc.length);
  balSlab.castShadow = true; balSlab.receiveShadow = false;
  balSlab.frustumCulled = balRail.frustumCulled = false;
  scene.add(balSlab, balRail);

  // Çatı: korkuluk duvarı, 2 klima kutusu, su deposu.
  const roof = new THREE.Group();
  roof.position.y = NY * FH - 0.46 + 0.05;
  scene.add(roof);
  {
    const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; roof.add(o); return o; };
    const hx = (NX + 0.35) / 2, hz = (NZ + 0.35) / 2;
    add(new THREE.BoxGeometry(NX + 0.35, 0.3, 0.1), concrete, 0, 0.15, hz - 0.05);
    add(new THREE.BoxGeometry(NX + 0.35, 0.3, 0.1), concrete, 0, 0.15, -hz + 0.05);
    add(new THREE.BoxGeometry(0.1, 0.3, NZ + 0.35 - 0.2), concrete, hx - 0.05, 0.15, 0);
    add(new THREE.BoxGeometry(0.1, 0.3, NZ + 0.35 - 0.2), concrete, -hx + 0.05, 0.15, 0);
    const hvac = mat(0x8c96a8, 0.45, 0.55), fan = mat(0x161c28, 0.6, 0.3);
    ([[-1.3, -0.45], [0.2, 0.35]] as Array<[number, number]>).forEach(([x, z]) => {
      add(new THREE.BoxGeometry(0.95, 0.45, 0.7), hvac, x, 0.225, z);
      add(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 20), fan, x, 0.465, z);
    });
    add(new THREE.BoxGeometry(0.6, 0.22, 0.6), concrete, 1.6, 0.11, -0.6);
    add(new THREE.CylinderGeometry(0.4, 0.4, 0.7, 20), mat(0x5d6a82, 0.5, 0.4), 1.6, 0.57, -0.6);
    add(new THREE.CylinderGeometry(0.1, 0.4, 0.14, 20), mat(0x5d6a82, 0.5, 0.4), 1.6, 0.99, -0.6);
  }

  // Sabit tohumlu rastgelelik: her açılışta aynı görüntü.
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const cells: Cell[] = [];
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) for (let z = 0; z < NZ; z++) {
    const lobby = y === 0;
    const occupied = lobby || rnd() > 0.14;
    const r = rnd();
    cells.push({ x, y, z, lobby, occupied, warmth: 0.55 + rnd() * 0.45,
      status: lobby ? "common" : !occupied ? "empty" : r < 0.7 ? "paid" : r < 0.87 ? "partial" : "late",
      delay: y * 0.075 + rnd() * 0.1, jit: rnd() * 0.2, rent: 9000 + Math.round(rnd() * 38) * 500,
      diag: (x / (NX - 1)) * 0.4 + (y / (NY - 1)) * 0.6, code: "D-" + (y + 1) + String(x * NZ + z + 1).padStart(2, "0"), bar: null });
  }
  const months = [5, 6, 6, 7, 6, 8, 9, 8, 10, 9, 11, 12];
  const MONTHS_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const slots: Array<[number, number]> = [];
  months.forEach((h, m) => { for (let k = 0; k < h; k++) slots.push([m, k]); });
  cells.forEach((c, i) => { c.bar = slots[i] ?? null; });

  const C = { day: new THREE.Color(0x9fb2c9), off: new THREE.Color(0x0b1a33).multiplyScalar(0.18), lit: new THREE.Color(0xffb766).multiplyScalar(0.95),
    paid: token("--paid").multiplyScalar(0.8), partial: token("--partial").multiplyScalar(0.8), late: token("--late").multiplyScalar(0.9), primary: token("--brand").multiplyScalar(0.75) };
  const ox = (NX - 1) / 2, oz = (NZ - 1) / 2;
  const hoverK = new Float32Array(N);
  let hoverIdx = -1;
  const S = { build: 0, pay: 0, chart: 0 };
  let dirty = true;

  function layout(p: number, intro: number) {
    const build = intro * 1.4;
    const pay = ease((p - 2.35) / 0.75);
    const chart = ease((p - 3.3) / 0.8) * (1 - ease((p - 5.3) / 0.6));
    const wv = clamp01((p - 1.15) / 1.1) * 1.6;
    // Son bölüm: bina tek başına kalır, bütün daireler aşağıdan yukarı "ödendi" yeşiline döner.
    const fin = ease((p - 5.45) / 0.55) * 1.5;
    S.build = build; S.pay = pay; S.chart = chart;
    for (let i = 0; i < N; i++) {
      const c = cells[i];
      const appear = ease((build - c.delay) / 0.3);
      let x = c.x - ox, y = c.y * FH + (1 - appear) * 5, z = c.z - oz, s = appear;
      if (chart > 0) {
        const k = ease((chart - (c.bar ? c.bar[0] * 0.025 : 0)) / 0.7);
        if (c.bar) { x += ((c.bar[0] - 5.5) * 1.1 - x) * k; y += (c.bar[1] * 0.62 - y) * k; z += (0 - z) * k; s *= 1 - 0.3 * k; }
        else s *= 1 - k;
      }
      const hk = hoverK[i];
      if (hk > 0.001) s *= 1 + 0.08 * hk;
      P.set(x, y, z); SC.setScalar(Math.max(1e-4, s)); M.compose(P, Q, SC); units.setMatrixAt(i, M);

      // Pencereler köşegen bir dalga halinde yanar; lobi her zaman sıcak ışıklıdır.
      COL.copy(C.off);
      if (c.lobby) COL.lerp(TMP.copy(C.lit), 0.95);
      else if (c.occupied) COL.lerp(TMP.copy(C.lit).multiplyScalar(c.warmth), 0.2 + 0.6 * ease((wv - c.diag - c.jit * 0.3) / 0.5));
      if (dayK > 0) COL.lerp(C.day, dayK); // gündüz pencereler ışıksız ama açık cam rengindedir
      if (pay > 0 && c.occupied && !c.lobby && c.status !== "common" && c.status !== "empty") COL.lerp(C[c.status], pay);
      if (chart > 0) COL.lerp(C.primary, ease(chart * 1.3) * 0.9);
      if (fin > 0 && !c.lobby) COL.lerp(C.paid, ease((fin - c.y / NY) / 0.5));
      if (hk > 0.001) COL.multiplyScalar(1 + 0.8 * hk);
      units.setColorAt(i, COL);
    }
    units.instanceMatrix.needsUpdate = true;
    if (units.instanceColor) units.instanceColor.needsUpdate = true;

    for (let f = 0; f < slabs.length; f++) { const m = slabs[f]; const a = ease((build - f * 0.075) / 0.3) * (1 - chart); m.scale.set(Math.max(1e-4, a), 1, Math.max(1e-4, a)); m.visible = a > 0.001; }
    const ca = ease(build - 0.2) * (1 - chart);
    for (let i = 0; i < columns.length; i++) { const m = columns[i]; m.scale.y = Math.max(1e-4, ca); m.position.y = (NY * FH / 2 - 0.46) * ca; m.visible = ca > 0.001; }

    for (let i = 0; i < balc.length; i++) {
      const b = balc[i], a = ease((build - b[1] * 0.075 - 0.1) / 0.3) * (1 - chart), off = (1 - a) * 5;
      SC.setScalar(Math.max(1e-4, a));
      P.set(b[0] - ox, b[1] * FH - 0.46 + off, BZ + 0.2); M.compose(P, Q, SC); balSlab.setMatrixAt(i, M);
      P.set(b[0] - ox, b[1] * FH - 0.26 + off, BZ + 0.44); M.compose(P, Q, SC); balRail.setMatrixAt(i, M);
    }
    balSlab.instanceMatrix.needsUpdate = true; balRail.instanceMatrix.needsUpdate = true;

    const ra = ease((build - 1.05) / 0.3) * (1 - chart);
    roof.scale.setScalar(Math.max(1e-4, ra)); roof.visible = ra > 0.001;
    hoodUpdate(p, intro);
    if (shadows) renderer.shadowMap.needsUpdate = true;
  }

  // Rapor ayrıntısı: sütun tepelerinden geçen çizgi, ay noktaları ve ay etiketleri.
  const tops = months.map((h, m) => new THREE.Vector3((m - 5.5) * 1.1, (h - 1) * 0.62 + 0.28 + 0.4, 0.55));
  const tubeGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tops, false, "centripetal"), 160, 0.07, 8, false);
  const tubeIdx = tubeGeo.index ? tubeGeo.index.count : 0;
  const tube = new THREE.Mesh(tubeGeo, new THREE.MeshBasicMaterial({ color: token("--primary-soft").multiplyScalar(1.4) }));
  tube.visible = false; tube.frustumCulled = false;
  scene.add(tube);
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.2) }), 12);
  dots.visible = false; dots.frustumCulled = false;
  scene.add(dots);
  const labelRenderer = new CSS2DRenderer({ element: el.labels });
  months.forEach((_, m) => {
    const label = document.createElement("div");
    label.className = el.classes.mlabel;
    label.textContent = MONTHS_TR[m];
    const o = new CSS2DObject(label);
    o.position.set((m - 5.5) * 1.1, PLAZA_TOP, 1.15);
    scene.add(o);
  });
  let curveP = -1;
  function updateCurve(cp: number) {
    if (Math.abs(cp - curveP) < 1e-4) return;
    curveP = cp;
    tube.visible = dots.visible = cp > 0.001;
    tubeGeo.setDrawRange(0, Math.floor((cp * tubeIdx) / 3) * 3);
    Q.identity();
    for (let m = 0; m < 12; m++) {
      const s = ease((cp * 11.5 - m) / 0.5);
      SC.setScalar(Math.max(1e-4, s)); M.compose(tops[m], Q, SC); dots.setMatrixAt(m, M);
    }
    dots.instanceMatrix.needsUpdate = true;
  }

  let composer: EffectComposer | null = null;
  let bloom: UnrealBloomPass | null = null;
  if (fx) {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(DPR);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.4, 0.92);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-phase]"));
  const secTop = new Float32Array(sections.length), secH = new Float32Array(sections.length);
  function measure() { sections.forEach((s, i) => { const r = s.getBoundingClientRect(); secTop[i] = r.top + scrollY; secH[i] = r.height; }); }
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    if (composer && bloom) { composer.setSize(w, h); bloom.setSize(w * DPR * 0.5, h * DPR * 0.5); }
    labelRenderer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix(); measure(); dirty = true;
  }
  function scrollPhase() {
    const mid = scrollY + innerHeight * 0.55;
    let p = 0;
    for (let i = 0; i < secTop.length; i++) if (secTop[i] < mid) p = i - 0.55 + Math.min(1, (mid - secTop[i]) / secH[i]);
    return p < 0 ? 0 : p > 6 ? 6 : p;
  }

  // Üzerine gelince birim bilgisi (yalnız ince imleçte).
  const { tip, tipTitle: tipT, tipPill: tipP, tipRow: tipR, classes } = el;
  const STATUS_TR: Record<string, string> = { paid: "Ödendi", partial: "Kısmi ödendi", late: "Gecikti" };
  const fmt = new Intl.NumberFormat("tr-TR");
  const ptr = { x: -1, y: -1, over: false, moved: false };
  let tipKey = "", tipW = 200;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e: PointerEvent) => {
    pointer.tx = e.clientX / innerWidth - 0.5; pointer.ty = e.clientY / innerHeight - 0.5;
    if (!fine) return;
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.moved = true;
    ptr.over = e.target instanceof Element && !!e.target.closest("[data-ui]");
    if (hoverIdx >= 0) placeTip();
  };
  const onLeave = () => { ptr.x = -1; ptr.moved = true; };
  addEventListener("pointermove", onMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  function placeTip() {
    const x = ptr.x + 18 + tipW > innerWidth ? ptr.x - 18 - tipW : ptr.x + 18;
    tip.style.transform = "translate3d(" + x + "px," + (ptr.y + 18) + "px,0)";
  }
  function setHover(i: number) {
    if (i === hoverIdx && i < 0) return;
    hoverIdx = i; dirty = true;
    if (i < 0) { tip.classList.remove(classes.tipOn); tipKey = ""; return; }
    const c = cells[i];
    const st: [string, string] = c.lobby ? ["common", "Ortak alan"] : !c.occupied ? ["empty", "Boş"] : S.pay > 0.5 ? [c.status, STATUS_TR[c.status]] : ["active", "Etkin sözleşme"];
    const key = i + st[0];
    if (key !== tipKey) {
      tipKey = key;
      tipT.textContent = (c.lobby ? "Zemin kat" : "Kat " + (c.y + 1)) + " · " + (c.lobby ? "L-" + (c.x * NZ + c.z + 1) : c.code);
      tipP.className = classes.pill + " " + classes[st[0]]; tipP.textContent = st[1];
      tipR.textContent = c.lobby ? "Ortak alan kiraya verilmez · Örnek" : "Aylık kira " + fmt.format(c.rent) + " ₺ · Örnek";
      tipW = tip.offsetWidth || tipW;
    }
    placeTip(); tip.classList.add(classes.tipOn);
  }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let lastPick = 0;
  function pick(now: number, phase: number) {
    const ok = fine && ptr.x >= 0 && !ptr.over && S.build >= 1.3 && S.chart < 0.02 && phase < 5.2;
    if (!ok) { if (hoverIdx >= 0) setHover(-1); ptr.moved = false; return; }
    if (now - lastPick < 45) return;
    lastPick = now; ptr.moved = false;
    ndc.set((ptr.x / innerWidth) * 2 - 1, -(ptr.y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(units, false)[0];
    const id = hit && hit.instanceId !== undefined ? hit.instanceId : -1;
    if (id !== hoverIdx) setHover(id);
  }

  addEventListener("resize", resize);
  resize();
  const dotEls = Array.from(document.querySelectorAll<HTMLElement>("[data-progress] a"));
  const SIDE = [-1, 1, -1, 1, -0.55, 0, 0];
  const DUSK_SUN = new THREE.Color(0xffc48a), DAY_SUN = new THREE.Color(0xfff1de);
  // Bölüm başına kamera değerleri: bölümler arası smoothstep ile sürekli geçiş (Math.round yok).
  const DIST = [46, 39, 33, 31, 32, 34, 46], HGT = [13.5, 11, 8.8, 8, 8, 8.5, 12], LOOK = [3.4, 4.2, 4.6, 4.6, 4.6, 4.6, 2.2];
  const tab = (a: number[], p: number) => { const i = Math.min(a.length - 2, Math.floor(p)); return a[i] + (a[i + 1] - a[i]) * ease(p - i); };
  // Kritik sönümlü yumuşatma (smoothDamp): hızlı kaydırma sahneyi koparmasın diye azami hız sınırlıdır.
  let phaseVel = 0;
  function smoothDamp(cur: number, target: number, smoothTime: number, maxSpeed: number, dt: number) {
    const om = 2 / smoothTime, x = om * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = Math.max(-maxSpeed * smoothTime, Math.min(maxSpeed * smoothTime, cur - target));
    const tg = cur - change, temp = (phaseVel + om * change) * dt;
    phaseVel = (phaseVel - om * temp) * e;
    let out = tg + (change + temp) * e;
    if ((target - cur > 0) === (out > target)) { out = target; phaseVel = 0; }
    return out;
  }
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(), wantPos = new THREE.Vector3(), wantTgt = new THREE.Vector3();
  let camInit = false;
  let phase = reduce ? 3 : 0, last = performance.now(), raf = 0, lastOp = -1, lastLab = -1, lastDot = -1, lastPhase = -1;
  const start = last + 250;
  let disposed = false;

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.max(1e-3, Math.min(0.05, (now - last) / 1000));
    last = now;
    const target = reduce ? 3 : scrollPhase();
    if (reduce) phase = target; else phase = smoothDamp(phase, target, 0.55, 3.2, dt);
    if (Math.abs(target - phase) < 1e-4) { phase = target; phaseVel = 0; }
    const pk = 1 - Math.exp(-dt / 0.25);
    pointer.x += (pointer.tx - pointer.x) * pk; pointer.y += (pointer.ty - pointer.y) * pk;
    const t = now / 1000, intro = reduce ? 1 : Math.min(1, Math.max(0, (now - start) / 1900));

    // Hover ölçeği yumuşak geçer; yalnız geçişte olan birimler yeniden hesaplanır.
    const hr = 1 - Math.exp(-dt * 16);
    for (let i = 0; i < N; i++) {
      const tg = i === hoverIdx ? 1 : 0, d = tg - hoverK[i];
      if (d !== 0) { hoverK[i] = Math.abs(d) < 0.003 ? tg : hoverK[i] + d * hr; dirty = true; }
    }
    dayT = isDay();
    if (dayK !== dayT || dayApplied !== dayK) {
      if (dayK !== dayT) { dayK += (dayT - dayK) * (1 - Math.exp(-dt / 0.3)); if (Math.abs(dayT - dayK) < 2e-3) dayK = dayT; }
      dayApplied = dayK;
      BG.copy(NIGHT_BG).lerp(DAY_BG, dayK); renderer.setClearColor(BG); fog.color.copy(BG);
      (ground.material as THREE.MeshStandardMaterial).color.copy(NIGHT_GROUND).lerp(DAY_GROUND, dayK);
      hemi.intensity = 0.35 + 1.1 * dayK; LAMP_MAT.color.copy(LAMP_ON).lerp(LAMP_OFF, dayK); dirty = true;
    }
    if (phase !== lastPhase || intro < 1) dirty = true;
    if (dirty) { layout(phase, intro); dirty = false; }
    if (phase !== lastPhase) { lastPhase = phase; if (fine) ptr.moved = true; }
    if (ptr.moved) pick(now, phase);

    const mobile = innerWidth < 860, chart = S.chart;
    const op = (1 - 0.3 * ease((phase - 4.3) / 0.6) - 0.3 * ease((phase - 5.4) / 0.6) + 0.4 * ease((phase - 5.5) / 0.5)) * (mobile ? 0.5 + 0.5 * ease(phase / 0.8) : 1);
    if (Math.abs(op - lastOp) > 0.004) { lastOp = op; canvas.style.opacity = op.toFixed(3); }
    const spread = Math.min(8, 3.4 * camera.aspect);
    const side = mobile ? 0 : tab(SIDE, phase) * spread;
    const dist = tab(DIST, phase) + (mobile ? 14 : 0) + chart * 3;
    const ang = 0.7 + phase * 0.2 + pointer.x * 0.22 - chart * 0.7;
    wantPos.set(Math.sin(ang) * dist + side, tab(HGT, phase) - pointer.y * 2 - chart * 4 + (mobile ? 1 : 0), Math.cos(ang) * dist);
    wantTgt.set(side * 0.85, tab(LOOK, phase) - chart * 2.2 - (mobile ? 2.6 : 0), 0);
    // Kamera, kare hızından bağımsız üstel sönümle hedefe yaklaşır.
    const kc = camInit ? 1 - Math.exp(-dt / 0.8) : 1;
    camInit = true;
    camPos.lerp(wantPos, kc); camTgt.lerp(wantTgt, kc);
    camera.position.copy(camPos); camera.lookAt(camTgt);

    if (!reduce) for (let i = 0; i < orbs.length; i++) { const o = orbs[i], u = o.userData as { bx: number; by: number; bz: number; speed: number; phase: number }; o.position.set(u.bx + Math.sin(t * u.speed + u.phase) * 1.4, u.by + Math.cos(t * u.speed * 1.3 + u.phase) * 1.0, u.bz); }

    { const dk = ease((phase - 5.3) / 0.7) * (1 - dayK); renderer.toneMappingExposure = 1 - 0.12 * dk + 0.08 * dayK; sun.intensity = (2.1 - 0.5 * dk) * (1 + 0.5 * dayK); sun.color.copy(DAY_SUN).lerp(DUSK_SUN, dk); }
    updateCurve(ease((phase - 3.7) / 0.5) * (1 - ease((phase - 5.2) / 0.4)));
    const lab = ease((phase - 3.75) / 0.25) * (1 - ease((phase - 5.2) / 0.3)) * op;
    if (Math.abs(lab - lastLab) > 0.004) { lastLab = lab; el.labels.style.opacity = lab.toFixed(3); }
    const dot = Math.round(Math.min(5, phase));
    if (dot !== lastDot) { lastDot = dot; for (let i = 0; i < dotEls.length; i++) dotEls[i].classList.toggle(classes.on, i === dot); }

    if (composer) composer.render(); else renderer.render(scene, camera);
    if (lab > 0.004) labelRenderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);
  // Sekme gizliyken çizim döngüsü durur.
  const onVisibility = () => {
    if (disposed) return;
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  };
  document.addEventListener("visibilitychange", onVisibility);

  return {
    measure,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
      removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose?.();
      });
      winTex.dispose(); ringTex.dispose();
      composer?.dispose();
      pmrem.dispose();
      renderer.dispose();
      el.labels.replaceChildren();
    },
  };
}
