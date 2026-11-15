import assert from "node:assert/strict";
import { test } from "node:test";
import { propertyCreateError, unitCreateError } from "../lib/api/portfolio-errors.ts";

test("maps the backend unit quota conflict to a clear read-only message", async () => {
  const response = new Response(JSON.stringify({ title: "Birim kotası doldu." }), { status: 409 });
  assert.equal(await propertyCreateError(response), "Birim kotası doldu. Mevcut kayıtları görüntüleyebilirsiniz.");
  assert.equal(await unitCreateError(response), "Birim kotası doldu. Mevcut kayıtları görüntüleyebilirsiniz.");
});

test("does not label unrelated conflicts as quota errors", async () => {
  const response = new Response(JSON.stringify({ title: "Başka bir çakışma." }), { status: 409 });
  assert.equal(await unitCreateError(response), "Bu mülke birim eklenemedi.");
});
