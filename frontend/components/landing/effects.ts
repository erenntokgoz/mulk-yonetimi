import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

const q = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(selector));

// Kaydırma, açılış ve kart animasyonları. Hareket azaltılmışsa hiçbir şey kurulmaz ve içerik olduğu gibi görünür.
export function startEffects(opts: { onRefresh?: () => void; reduce: boolean }): () => void {
  const html = document.documentElement;
  (window as unknown as { __ready?: boolean }).__ready = true;
  if (opts.reduce) {
    html.classList.remove("anim");
    return () => undefined;
  }

  gsap.registerPlugin(ScrollTrigger);
  const lenis = new Lenis({ lerp: 0, duration: 1.4, wheelMultiplier: 0.8, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  const tick = (t: number) => lenis.raf(t * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  const anchorHandlers: Array<[HTMLAnchorElement, (e: Event) => void]> = [];
  q<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    const h = a.getAttribute("href") ?? "";
    if (h.length < 2) return;
    const handler = (e: Event) => {
      const target = document.querySelector<HTMLElement>(h);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { duration: 2.4 });
    };
    a.addEventListener("click", handler);
    anchorHandlers.push([a, handler]);
  });
  if (opts.onRefresh) ScrollTrigger.addEventListener("refresh", opts.onRefresh);

  const ctx = gsap.context(() => {
    gsap
      .timeline({ delay: 0.25, defaults: { ease: "power4.out" } })
      .fromTo('[data-fx="ln"]', { yPercent: 115, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.15, stagger: 0.12 })
      .fromTo('[data-fx="rv"]', { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.1 }, "-=0.7");

    q('[data-fx="card"]').forEach((card) => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: card, start: "top 82%", once: true } });
      tl.from(card, { autoAlpha: 0, y: 48, duration: 0.9, ease: "power3.out" }).from(
        card.children,
        { autoAlpha: 0, y: 22, duration: 0.7, stagger: 0.09, ease: "power3.out" },
        "-=0.6",
      );
      const rows = q('[data-fx="row"]', card);
      if (rows.length) tl.from(rows, { autoAlpha: 0, x: -12, duration: 0.5, stagger: 0.09, ease: "power2.out" }, "-=0.2");
      const grow = q("[data-grow]", card);
      if (grow.length) tl.from(grow, { scaleX: 0, transformOrigin: "0 50%", duration: 1.2, stagger: 0.14, ease: "power2.out" }, "<");
      gsap.fromTo(
        card,
        { yPercent: 4 },
        { yPercent: -4, ease: "none", scrollTrigger: { trigger: card.closest("section") ?? card, start: "top bottom", end: "bottom top", scrub: 1.2 } },
      );
    });
    gsap.from('[data-fx="assure-head"] > *', { autoAlpha: 0, y: 26, stagger: 0.1, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: '[data-fx="assure-head"]', start: "top 85%", once: true } });
    gsap.from('[data-fx="tile"]', { autoAlpha: 0, y: 40, stagger: 0.12, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: '[data-fx="tiles"]', start: "top 85%", once: true } });
    gsap.from('[data-fx="final"] > *', { autoAlpha: 0, y: 30, stagger: 0.1, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: '[data-fx="final"]', start: "top 80%", once: true } });
  });
  void document.fonts.ready.then(() => ScrollTrigger.refresh());

  const sheen = q('[data-fx="tile"]').map((tile) => {
    const handler = (e: Event) => {
      const event = e as PointerEvent;
      const r = tile.getBoundingClientRect();
      tile.style.setProperty("--mx", `${event.clientX - r.left}px`);
      tile.style.setProperty("--my", `${event.clientY - r.top}px`);
    };
    tile.addEventListener("pointermove", handler, { passive: true });
    return [tile, handler] as const;
  });

  return () => {
    sheen.forEach(([tile, handler]) => tile.removeEventListener("pointermove", handler));
    anchorHandlers.forEach(([a, handler]) => a.removeEventListener("click", handler));
    if (opts.onRefresh) ScrollTrigger.removeEventListener("refresh", opts.onRefresh);
    ctx.revert();
    gsap.ticker.remove(tick);
    lenis.destroy();
    html.classList.remove("anim");
  };
}
