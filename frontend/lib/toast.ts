// İşlem sonuçları için küçük bir dış depo. React'e bağlı değildir; Toaster bileşeni useSyncExternalStore ile okur.
export type ToastKind = "success" | "error" | "info";
export type ToastAction =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never };
export type ToastOptions = { action?: ToastAction; duration?: number };
export type ToastItem = {
  id: string;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
  duration: number;
  closing: boolean;
};

export const toastLimit = 3;
export const toastDurations: Record<ToastKind, number> = { success: 4500, info: 4500, error: 9000 };
// Çıkış animasyonu bitene kadar kayıt listede kalır; azaltılmış harekette de aynı kısa süre kullanılır.
export const toastExitMs = 180;

type Timer = { handle: ReturnType<typeof setTimeout> | null; deadline: number; remaining: number };

let items: ToastItem[] = [];
let sequence = 0;
const timers = new Map<string, Timer>();
const listeners = new Set<() => void>();

function publish(next: ToastItem[]) {
  items = next;
  listeners.forEach((listener) => listener());
}

function clearTimer(id: string) {
  const timer = timers.get(id);
  if (timer?.handle) clearTimeout(timer.handle);
  timers.delete(id);
}

function schedule(id: string, ms: number) {
  const timer: Timer = { handle: null, deadline: Date.now() + ms, remaining: ms };
  timer.handle = setTimeout(() => dismiss(id), ms);
  timers.set(id, timer);
}

function remove(id: string) {
  clearTimer(id);
  publish(items.filter((item) => item.id !== id));
}

export function dismiss(id?: string) {
  const targets = id ? items.filter((item) => item.id === id && !item.closing) : items.filter((item) => !item.closing);
  if (!targets.length) return;
  const ids = new Set(targets.map((item) => item.id));
  ids.forEach(clearTimer);
  publish(items.map((item) => (ids.has(item.id) ? { ...item, closing: true } : item)));
  ids.forEach((target) => setTimeout(() => remove(target), toastExitMs));
}

function show(kind: ToastKind, message: string, options: ToastOptions = {}) {
  // Aynı mesaj üst üste gelirse yığın büyümez; eski kopya kapanır, yenisi sona eklenir.
  items.filter((item) => !item.closing && item.kind === kind && item.message === message).forEach((item) => dismiss(item.id));
  const id = `toast-${++sequence}`;
  const duration = options.duration ?? toastDurations[kind];
  const next: ToastItem = { id, kind, message, action: options.action, duration, closing: false };
  const open = items.filter((item) => !item.closing);
  // Sınır aşılırsa en eski mesaj önce gider.
  if (open.length >= toastLimit) open.slice(0, open.length - toastLimit + 1).forEach((item) => dismiss(item.id));
  publish([...items, next]);
  schedule(id, duration);
  return id;
}

export function pause(id: string) {
  const timer = timers.get(id);
  if (!timer?.handle) return;
  clearTimeout(timer.handle);
  timer.handle = null;
  timer.remaining = Math.max(0, timer.deadline - Date.now());
}

export function resume(id: string) {
  const timer = timers.get(id);
  if (!timer || timer.handle) return;
  timers.delete(id);
  schedule(id, timer.remaining);
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts() {
  return items;
}

const emptyServerSnapshot: ToastItem[] = [];
export function getServerToasts() {
  return emptyServerSnapshot;
}

// Testler ve oturum değişimi için tüm mesajları ve sayaçları anında temizler.
export function resetToasts() {
  [...timers.keys()].forEach(clearTimer);
  publish([]);
}

export const toast = {
  success: (message: string, options?: ToastOptions) => show("success", message, options),
  error: (message: string, options?: ToastOptions) => show("error", message, options),
  info: (message: string, options?: ToastOptions) => show("info", message, options),
  dismiss,
  pause,
  resume,
};
