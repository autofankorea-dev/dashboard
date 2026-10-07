"use client";

// Synthetic UI states only; never invokes a device command action.
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlarmThresholdForm, type AlarmThresholdHeaderState } from "@/components/settings/alarm-threshold-form";
import { DEFAULT_ALARM_SETTINGS } from "@/lib/data/alarms";
import type { DeviceSettingsTarget, SendBulkThermoCommandResult } from "@/app/(dashboard)/controllers/actions";
import { useControllerPanel } from "@/components/controllers/use-controller-panel";
import { ControllerEnvCover } from "@/components/farm/controller-env-cover";
import { ControllerPanelFeedback } from "@/components/farm/controller-panel-feedback";
import { SettingsAllChannelGrid } from "@/components/farm/settings-all-channel-grid";
import { SettingsGlanceStrip } from "@/components/farm/settings-glance-strip";
import { BarnListAccordionPanel } from "@/components/farm/barn-list-accordion-panel";
import { CoverChannelApplyStrip } from "@/components/farm/cover-channel-apply-strip";
import { controllerEnvCoverLevel } from "@/lib/farm/controller-env-cover";
import type { BarnReading } from "@/lib/data/iot";
import type { ThermoCommand } from "@/lib/data/commands";
import type { PanelChannelContext } from "@/lib/controllers/controller-panel-draft";

const base: BarnReading = {
  key: "fixture", farmKey: { lsindRegistNo: "TEST", itemCode: "P00" }, moduleUid: 1,
  controllerKey: "SP07:1:1", stallTyCode: "SP07", stallNo: "1", eqpmnNo: "1", label: "test",
  alarmLowTempC: 10, alarmHighTempC: 35,
  tempC: 25.3, humidityPct: 55, fanSupply: null, fanExhaust: null, fanIntake: null,
  fanSupplySeries: [], fanExhaustSeries: [], fanIntakeSeries: [],
  receivedAt: "2026-10-06T00:00:00Z", mesureDt: "2026-10-06T00:00:00Z",
  packetMode: "live", wireVer: 12, status: "normal",
};
const old = { setpointTemp: 24, tempDeviation: 2, minVentPct: 20, maxVentPct: 80 };
const submitted = { ...old, setpointTemp: 26 };
const unifiedReading: BarnReading = { ...base, key: "unified-fixture", channels: (["A", "B", "C"] as const).map((channel, index) => ({
  channel, eqpmnCode: `EC0${index + 1}`, tempC: 25, humidityPct: 55, fanPct: 40, fanSeries: [], thermo: old,
})) };
type Stage = "idle" | "pending" | "failed" | "applied";

function PanelProbe({ stage, slot }: { stage: Stage; slot: "A" | "B" }) {
  const [rawSetpoint, setRawSetpoint] = useState(24);
  const command = useMemo((): ThermoCommand | null => stage === "idle" ? null : ({
    ...submitted, id: "mock", channel: "A", status: stage,
    createdAt: "2026-10-06T01:00:00Z", sentAt: null, appliedAt: null,
    farmKey: base.farmKey, moduleUid: 1, controllerKey: base.controllerKey,
    stallTyCode: "SP07", stallNo: "1", eqpmnNo: "1", note: null, errorMsg: null,
  }), [stage]);
  const contexts = useMemo((): PanelChannelContext[] => ["A", "B"].map((channel) => {
    const live = stage === "applied" && channel === "A" ? submitted : channel === "A" ? { ...old, setpointTemp: rawSetpoint } : old;
    return { slot: channel as "A" | "B", eqpmnCode: "EC02", liveBaseline: live,
      knownSettings: { ...(stage !== "idle" && channel === "A" ? submitted : live),
        source: stage === "pending" && channel === "A" ? "pending" : "live", updatedAt: base.receivedAt },
      command: channel === "A" ? command : null };
  }), [stage, command, rawSetpoint]);
  const active = contexts.find((ctx) => ctx.slot === slot)!;
  const panel = useControllerPanel(base, active.knownSettings, true, slot, "EC02",
    undefined, active.liveBaseline, contexts, undefined, active.command);
  return <section>
    <p data-panel-value="">{panel.sliderValues.setpoint}</p>
    <p data-panel-current="">{panel.currentValues?.setpoint}</p>
    <p data-panel-dirty="">{String(panel.hasChanges)}</p>
    <button onClick={() => panel.setField("setpoint", 28)}>입력 28</button>
    <button onClick={() => setRawSetpoint(27)}>최신 raw 수신 테스트</button>
    <p data-panel-channel-a="">{panel.channelGlanceRows[0].values?.setpointTemp}</p>
    <p data-panel-channel-b="">{panel.channelGlanceRows[1].values?.setpointTemp}</p>
    <SettingsAllChannelGrid rows={panel.channelGlanceRows} onChange={panel.setChannelField} />
    <SettingsGlanceStrip hasChannels rows={panel.channelGlanceRows}
      ctrlValues={null} ctrlDirty={false} alarmCells={{ temp: "25", tempDev: "+2", humidity: "55" }}
      alarmSummary="테스트" alarmDirty={false} focus={null} onFocus={() => {}}
      applyItems={stage === "idle" ? [] : [{ id: "mock", slot: "A",
        stage: stage === "pending" ? "접수" : stage === "failed" ? "실패" : "확인", filled: 1 }]} />
    <ControllerPanelFeedback visible={stage !== "idle"}
      phase={stage === "pending" ? "loading" : stage === "failed" ? "error" : "success"}
      title={stage === "failed" ? "전송 실패" : "확인 완료"} detail="패널 안의 안내" />
  </section>;
}

function AlarmProbe() {
  const [submittedTargets, setSubmittedTargets] = useState<DeviceSettingsTarget[]>([]);
  const [rawHigh, setRawHigh] = useState(35);
  const reading = useMemo(() => ({...base, alarmHighTempC: rawHigh}), [rawHigh]);
  const [header, setHeader] = useState<AlarmThresholdHeaderState | null>(null);
  const [command, setCommand] = useState<ThermoCommand | null>(null);
  const [mount, setMount] = useState(0);
  const submit = useCallback(async (targets: DeviceSettingsTarget[]): Promise<SendBulkThermoCommandResult> => {
    setSubmittedTargets(targets);
    const t = targets[0]!;
    const c: ThermoCommand = { id: "alarm-mock", createdAt: "2026-10-07T00:00:00Z", sentAt: null, appliedAt: null,
      farmKey: base.farmKey, moduleUid: base.moduleUid, controllerKey: base.controllerKey, stallTyCode: "SP07", stallNo: "01", eqpmnNo: "01",
      ...old, status: "pending", note: null, errorMsg: null, action: "SET_CONTROLLER_SETTINGS", alarmSettings: t.alarmSettings };
    return { ok: true, sent: 1, failed: [], sentItems: [{ key: base.key, id: c.id, command: c }] };
  }, []);
  return <section data-alarm-probe className="max-w-md rounded-lg border p-3">
    <AlarmThresholdForm key={mount} initialSettings={DEFAULT_ALARM_SETTINGS} readings={[reading]} fixedScope={{ farmId: "TEST", spCode: "SP07", stallKey: "1", readingKey: base.key }}
      commands={command ? [command] : []} onHeaderState={setHeader} submitCommands={submit} onCommandQueued={setCommand} />
    <button disabled={!header?.hasChanges || header.pending || Boolean(header.validationError)} onClick={() => header?.onSave()}>경보 적용 테스트</button>
    <button onClick={() => setMount(n => n+1)}>경보 재진입 테스트</button>
    <button onClick={() => setCommand(c => c ? {...c,status:"sent"} : c)}>경보 전송 테스트</button>
    <button onClick={() => setCommand(c => c ? {...c,status:"failed"} : c)}>경보 실패 테스트</button>
    <button onClick={() => setRawHigh(36)}>경보 raw 수신 테스트</button>
    <button onClick={() => header?.onSave([{channel:"B",eqpmnCode:"EC02",...old,setpointTemp:24.1}])}>통합 전송 테스트</button>
    <p data-submitted-targets className="break-all">{JSON.stringify(submittedTargets)}</p>
  </section>;
}

export default function ControllerStateFixture() {
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [slot, setSlot] = useState<"A" | "B">("A");
  const [mount, setMount] = useState(0);
  useEffect(() => { setReady(true); }, []);
  const covers: [string, BarnReading][] = [
    ["normal", base], ["alarm", { ...base, tempC: 60 }],
    ["env-caution", { ...base, stallTyCode: "SP05", tempC: 34 }],
    ["caution", { ...base, status: "caution" }], ["offline", { ...base, status: "offline" }],
    ["stale-alarm", { ...base, status: "caution", tempC: 60 }],
    ["missing-alarm", { ...base, alarmLowTempC: null, alarmHighTempC: null }],
    ["empty", { ...base, tempC: null, humidityPct: null }],
  ];
  return <main data-fixture-ready={ready} className="p-4">
    <div className="flex flex-wrap gap-2">
      {(["idle", "pending", "failed", "applied"] as Stage[]).map((value) =>
        <button key={value} onClick={() => setStage(value)}>{value}</button>)}
      <button onClick={() => setSlot(slot === "A" ? "B" : "A")}>채널 전환</button>
      <button onClick={() => setMount((value) => value + 1)}>패널 재진입</button>
    </div>
    <AlarmProbe />
    <div data-unified-probe className="max-w-md">
      <BarnListAccordionPanel key={stage} reading={unifiedReading} readings={[unifiedReading]} thermoSettings={{}} canCommand
        commands={stage === "failed" ? [{ ...submitted, id:"unified-failed", createdAt:"2026-10-08T00:00:00Z", sentAt:null, appliedAt:null,
          status:"failed", farmKey:base.farmKey, moduleUid:1, controllerKey:base.controllerKey, stallTyCode:"SP07",stallNo:"01",eqpmnNo:"01",
          note:null,errorMsg:"ack timeout after 2 attempt(s)",action:"SET_CONTROLLER_SETTINGS",
          channels:[{...submitted,channel:"A",eqpmnCode:"EC01"}],alarmSettings:{lowTempC:12,highTempC:40} }] : []} />
      <span data-alarm-strip-probe><CoverChannelApplyStrip items={[{id:"alarm-label",slot:null,stage:"접수",filled:1}]} /></span>
    </div>
    <PanelProbe key={mount} stage={stage} slot={slot} />
    <div className="flex flex-wrap gap-4">
      {covers.map(([id, reading]) => <div key={id} data-fixture-cover={id}
        className="relative h-72 w-72 overflow-hidden rounded-xl border">
        <ControllerEnvCover reading={reading} level={controllerEnvCoverLevel(reading)} onOpen={() => {}} />
      </div>)}
    </div>
  </main>;
}
