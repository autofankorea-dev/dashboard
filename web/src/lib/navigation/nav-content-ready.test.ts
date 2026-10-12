import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  getLastNavContentReadyAt,
  signalNavContentReadyAfterPaint,
} from "./nav-content-ready";

describe("signalNavContentReadyAfterPaint", () => {
  it("fires after two animation frames", () => {
    const queued: FrameRequestCallback[] = [];
    const prevWindow = globalThis.window;
    const fakeWindow = {
      requestAnimationFrame(cb: FrameRequestCallback) {
        queued.push(cb);
        return queued.length;
      },
      cancelAnimationFrame() {},
      dispatchEvent() {
        return true;
      },
    };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: fakeWindow,
    });
    try {
      const before = getLastNavContentReadyAt();
      signalNavContentReadyAfterPaint();
      assert.equal(queued.length, 1);
      queued[0]!(0);
      assert.equal(queued.length, 2);
      queued[1]!(0);
      assert.ok(getLastNavContentReadyAt() >= before);
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: prevWindow,
      });
    }
  });
});
