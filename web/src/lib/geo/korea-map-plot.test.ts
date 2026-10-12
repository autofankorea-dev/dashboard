import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { projectKoreaLatLng } from "./korea-map-plot";

describe("projectKoreaLatLng", () => {
  it("places north-west higher and lefter than south-east", () => {
    const seoul = projectKoreaLatLng(37.57, 126.98);
    const busan = projectKoreaLatLng(35.18, 129.08);
    assert.ok(seoul.y < busan.y);
    assert.ok(seoul.x < busan.x);
  });

  it("keeps projected points inside the padded view", () => {
    const p = projectKoreaLatLng(36.5, 127.8);
    assert.ok(p.x > 0 && p.x < 100);
    assert.ok(p.y > 0 && p.y < 100);
  });
});
