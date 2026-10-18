import { expect, test } from "vitest";
import { controllerErrorHex } from "./controller-error-hex";

test.each([[0,"0x0000"],[1,"0x0001"],[0x11,"0x0011"],[0x01ff,"0x01FF"],
  [0x1234,"0x1234"],[0xabcd,"0xABCD"],[0xffff,"0xFFFF"]] as const)("formats raw uint16 %i", (value, hex) => {
  expect(controllerErrorHex(value)).toBe(hex);
});
test.each([null, undefined, -1, 65536, 1.5, NaN])("does not invent a code for missing/invalid value %s", value => {
  expect(controllerErrorHex(value)).toBe("—");
});
