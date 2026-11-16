// Ortak görüntü biçimleri. Tutarlar API'den ondalık metin olarak gelir; kayan nokta yuvarlamasına girmemek için metin üzerinde biçimlenir.
export function formatMoney(value: number | string) {
  const raw = String(value).trim();
  const negative = raw.startsWith("-");
  const [integer, fraction = ""] = raw.replace(/^-/, "").split(".");
  return `${negative ? "-" : ""}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction.padEnd(2, "0").slice(0, 2)} ₺`;
}

// API iş tarihleri saat dilimi taşımayan "yyyy-mm-dd" metinleridir; Date'e çevirmeden gün.ay.yıl olarak yazılır.
export function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return day && month && year ? `${day}.${month}.${year}` : value;
}

const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export function formatPeriod(value: string) {
  const [year, month] = value.split("-");
  const name = months[Number(month) - 1];
  return name ? `${name} ${year}` : value;
}

export function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function formatFileSize(bytes: number | string) {
  const size = Number(bytes);
  if (size < 1024 * 1024) return `${Math.max(1, Math.ceil(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
}

export function fileKind(contentType: string) {
  if (contentType === "application/pdf") return "PDF";
  if (contentType === "image/jpeg") return "JPEG";
  if (contentType === "image/png") return "PNG";
  return contentType;
}
