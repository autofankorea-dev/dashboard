import assert from "node:assert/strict";
import { commandChannelViews, parseCommandChannels, type CommandChannelValues } from "./combined-channel-command";
import { encodeCommandWireHex } from "@/lib/farm/command-wire";
import { latestPanelCommand } from "./controller-panel-draft";
import { buildThermoSettingsMap } from "./controller-settings";
import { commandLiveConfirmed } from "@/lib/farm/command-hit";
import type { ThermoCommand } from "@/lib/data/commands";

const channels: CommandChannelValues[] = [
  { channel: "A", eqpmnCode: "EC01", setpointTemp: 25, tempDeviation: 2, minVentPct: 10, maxVentPct: 100 },
  { channel: "B", eqpmnCode: "EC02", setpointTemp: 24, tempDeviation: 1.5, minVentPct: 20, maxVentPct: 80 },
  { channel: "C", eqpmnCode: "EC03", setpointTemp: 23.5, tempDeviation: 3, minVentPct: 30, maxVentPct: 90 },
];
const cmd: ThermoCommand = { ...channels[0]!, channel: undefined, channels, action: "SET_CHANNELS_THERMO",
  id: "one-packet", createdAt: "2026-10-07T00:00:00Z", sentAt: null, appliedAt: null,
  farmKey: { lsindRegistNo: "TEST", itemCode: "P00" }, moduleUid: 1, controllerKey: "SP01:01:03",
  stallTyCode: "SP01", stallNo: "01", eqpmnNo: "03", status: "sent", note: null, errorMsg: null };
assert.equal(encodeCommandWireHex(cmd), "0d000101030701fa0014000a6402f0000f00145003eb001e001e5a4116");
assert.equal(encodeCommandWireHex({ ...cmd, channels: [channels[1]!] })?.slice(0, 26), "0d0001010302ffffffffffffff");
assert.equal(encodeCommandWireHex({ ...cmd, channels: [] }), null);
assert.equal(parseCommandChannels([channels[0], channels[0]]), null);
assert.equal(parseCommandChannels([{ ...channels[0], setpointTemp: NaN }]), null);
assert.equal(parseCommandChannels([{ ...channels[0], tempDeviation: 20 }]), null);
assert.equal(parseCommandChannels([{ ...channels[0], minVentPct: 101 }]), null);
assert.equal(parseCommandChannels([{ ...channels[0], setpointTemp: 24.55 }]), null);
assert.equal(commandChannelViews(cmd).length, 3);
assert.ok(commandChannelViews(cmd).every((c) => c.id === cmd.id));
assert.equal(latestPanelCommand([cmd], "C")?.setpointTemp, 23.5);
assert.equal(Object.keys(buildThermoSettingsMap([cmd])).length, 3);
const reading = { farmKey: cmd.farmKey, moduleUid: 1, controllerKey: cmd.controllerKey,
  channels: channels.map((c) => ({ channel: c.channel, thermo: c })) };
assert.equal(commandLiveConfirmed(cmd, [reading]), true);
assert.equal(commandLiveConfirmed(cmd, [{ ...reading, channels: reading.channels.slice(0, 2) }]), false);
assert.equal(commandLiveConfirmed(cmd, [{ ...reading, channels: reading.channels.map((c) =>
  c.channel === "C" ? { ...c, thermo: { ...c.thermo, setpointTemp: 20 } } : c) }]), false);
