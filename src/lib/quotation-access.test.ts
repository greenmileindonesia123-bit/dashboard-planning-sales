import assert from "node:assert/strict";
import test from "node:test";
import { canReadQuotation, isQuotationReviewer } from "./quotation-access.ts";

test("only Puput, Ilya, and Diah Ayu review every quotation", () => {
  assert.equal(isQuotationReviewer({ email: "operasionalgreenmileindonesia@gmail.com" }), true);
  assert.equal(isQuotationReviewer({ email: "EstimatorGreenMileIndonesia@gmail.com" }), true);
  assert.equal(isQuotationReviewer({ email: "halogreenmile@gmail.com" }), true);
  assert.equal(isQuotationReviewer({ email: "sales002.gmi@gmail.com" }), false);
  assert.equal(isQuotationReviewer({ email: "greenmilesales2@gmail.com" }), false);
  const request = { salesEmail: "sales002.gmi@gmail.com" };
  assert.equal(canReadQuotation({ email: "halogreenmile@gmail.com" }, request), true);
  assert.equal(canReadQuotation({ email: "sales002.gmi@gmail.com" }, request), true);
  assert.equal(canReadQuotation({ email: "greenmilesales2@gmail.com" }, request), false);
});
