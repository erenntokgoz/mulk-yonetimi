import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { getToasts, resetToasts, subscribe, toast, toastExitMs } from "../lib/toast.ts";

const open = () => getToasts().filter((item) => !item.closing);

beforeEach(() => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  resetToasts();
});

afterEach(() => {
  resetToasts();
  mock.timers.reset();
});

test("keeps at most three toasts and lets the oldest go first", () => {
  toast.success("Bir.");
  toast.success("İki.");
  toast.info("Üç.");
  toast.error("Dört.");
  assert.deepEqual(open().map((item) => item.message), ["İki.", "Üç.", "Dört."]);
  mock.timers.tick(toastExitMs);
  assert.deepEqual(getToasts().map((item) => item.message), ["İki.", "Üç.", "Dört."]);
});

test("success and info close after 4.5 seconds, errors after 9 seconds", () => {
  toast.success("Kaydedildi.");
  toast.info("Bilgi.");
  toast.error("Hata.");
  mock.timers.tick(4499);
  assert.equal(open().length, 3);
  mock.timers.tick(1);
  assert.deepEqual(open().map((item) => item.kind), ["error"]);
  mock.timers.tick(4500);
  assert.equal(open().length, 0);
  mock.timers.tick(toastExitMs);
  assert.equal(getToasts().length, 0);
});

test("pause keeps the remaining time and resume continues from it", () => {
  const id = toast.success("Kaydedildi.");
  mock.timers.tick(3000);
  toast.pause(id);
  mock.timers.tick(60_000);
  assert.equal(open().length, 1);
  toast.resume(id);
  mock.timers.tick(1499);
  assert.equal(open().length, 1);
  mock.timers.tick(1);
  assert.equal(open().length, 0);
});

test("dismiss marks the toast closing, then removes it after the exit animation", () => {
  const id = toast.error("Hata.", { action: { label: "Tekrar dene", onClick: () => undefined } });
  toast.dismiss(id);
  assert.equal(getToasts()[0]?.closing, true);
  mock.timers.tick(toastExitMs);
  assert.equal(getToasts().length, 0);
  mock.timers.tick(10_000);
  assert.equal(getToasts().length, 0);
});

test("a repeated message replaces the visible copy and listeners hear every change", () => {
  let calls = 0;
  const stop = subscribe(() => calls++);
  toast.success("Kaydedildi.");
  toast.success("Kaydedildi.");
  assert.equal(open().length, 1);
  assert.ok(calls >= 2);
  stop();
  const before = calls;
  toast.info("Başka.");
  assert.equal(calls, before);
});

test("custom duration and link action are kept on the toast", () => {
  toast.success("Mülk eklendi.", { duration: 1000, action: { label: "Sonraki adım", href: "/portfoy?yeni=bolum" } });
  assert.deepEqual(open()[0]?.action, { label: "Sonraki adım", href: "/portfoy?yeni=bolum" });
  mock.timers.tick(1000);
  assert.equal(open().length, 0);
});
