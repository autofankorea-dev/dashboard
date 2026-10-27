import { describe, expect, it } from "vitest";
import { parseCommandEqpmnNo } from "@/lib/domain/controller-key";
import { encodeCommandWireHex } from "@/lib/farm/command-wire";

const base = {
  stallTyCode: "SP07", stallNo: "01", channel: "A", eqpmnCode: "EC15",
  setpointTemp: 24, tempDeviation: 3.5, minVentPct: 25, maxVentPct: 100,
  channels: [{ channel: "A" as const, eqpmnCode: "EC15", setpointTemp: 24,
    tempDeviation: 3.5, minVentPct: 25, maxVentPct: 100 }],
};

describe("downlink controller addresses", () => {
  for (const action of ["SET_CTRL_THERMO", "SET_CHANNEL_THERMO", "SET_CHANNELS_THERMO", "SET_CONTROLLER_SETTINGS"]) {
    it(`${action} addresses every controller 01..48 without truncation`, () => {
      for (let number = 1; number <= 48; number++) {
        const eqpmnNo = String(number).padStart(2, "0");
        expect(parseCommandEqpmnNo(eqpmnNo)).toBe(eqpmnNo);
        const hex = encodeCommandWireHex({ ...base, action, eqpmnNo });
        expect(hex).not.toBeNull();
        expect(Buffer.from(hex!, "hex")[4]).toBe(number);
      }
    });
    it(`${action} rejects addresses outside the shared range`, () => {
      for (const eqpmnNo of ["00", "49", "50", "99", "256", "14x", "14.5", "", "abc"]) {
        expect(encodeCommandWireHex({ ...base, action, eqpmnNo })).toBeNull();
      }
    });
  }
  it("does not coerce malformed targets to controller 01", () => {
    for (const raw of [null, undefined, true, false, {}, NaN, 1.5, -1, "1e1", "0x0e", "014"]) {
      expect(parseCommandEqpmnNo(raw)).toBeNull();
    }
    expect(parseCommandEqpmnNo(14)).toBe("14");
    expect(parseCommandEqpmnNo(" 1 ")).toBe("01");
  });
});
