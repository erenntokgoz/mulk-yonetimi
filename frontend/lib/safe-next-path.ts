const DEFAULT_NEXT = "/panel";
const BASE = "https://mulkum.invalid";

// Giriş sonrası yalnız aynı kökenli yollara dönülür. "//host" ve "/\host" dış adrese gider; tarayıcı URL içindeki
// sekme ve satır sonlarını sildiği için "/\t/host" da aynı sonuca varır, bu yüzden denetim karakterleri ve ters
// eğik çizgi hiç kabul edilmez ve yol son olarak URL ayrıştırıcısıyla aynı kökende kaldığı doğrulanır.
export function safeNextPath(next: string | null | undefined): string {
  if (!next || next.length > 2048 || !next.startsWith("/") || next.startsWith("//")) return DEFAULT_NEXT;
  for (let index = 0; index < next.length; index++) {
    const code = next.charCodeAt(index);
    if (code < 0x20 || code === 0x7f || code === 0x5c) return DEFAULT_NEXT;
  }
  try {
    if (new URL(next, BASE).origin !== BASE) return DEFAULT_NEXT;
  } catch {
    return DEFAULT_NEXT;
  }
  return next;
}
