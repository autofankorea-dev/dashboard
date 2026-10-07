"use client";

// Synthetic UI states only; never invokes a device command action.
import { useEffect, useMemo, useState } from "react";
import { useControllerPanel } from "@/components/controllers/use-controller-panel";
import { ControllerEnvCover } from "@/components/farm/controller-env-cover";
import { ControllerPanelFeedback } from "@/components/farm/controller-panel-feedback";
import { SettingsGlanceStrip } from "@/components/farm/settings-glance-strip";
import { controllerEnvCoverLevel } from "@/lib/farm/controller-env-cover";
import type { BarnReading } from "@/lib/data/iot";
import type { ThermoCommand } from "@/lib/data/commands";
import type { PanelChannelContext } from "@/lib/controllers/controller-panel-draft";

const base: BarnReading = {
  key: "fixture", farmKey: { lsindRegistNo: "TEST", itemCode: "P00" }, moduleUid: 1,
  controllerKey: "SP07:1:1", stallTyCode: "SP07", stallNo: "1", eqpmnNo: "1", label: "test",
  tempC: 25.3, humidityPct: 55, fanSupply: null, fanExhaust: null, fanIntake: null,
  fanSupplySeries: [], fanExhaustSeries: [], fanIntakeSeries: [],
  receivedAt: "2026-10-06T00:00:00Z", mesureDt: "2026-10-06T00:00:00Z",
  packetMode: "live", wireVer: 12, status: "normal",
};
const old = { setpointTemp: 24, tempDeviation: 2, minVentPct: 20, maxVentPct: 80 };
const submitted = { ...old, setpointTemp: 26 };
type Stage = "idle" | "pending" | "failed" | "applied";

function PanelProbe({ stage, slot }: { stage: Stage; slot: "A" | "B" }) {
  const command = useMemo((): ThermoCommand | null => stage === "idle" ? null : ({
    ...submitted, id: "mock", channel: "A", status: stage,
    createdAt: "2026-10-06T01:00:00Z", sentAt: null, appliedAt: null,
    farmKey: base.farmKey, moduleUid: 1, controllerKey: base.controllerKey,
    stallTyCode: "SP07", stallNo: "1", eqpmnNo: "1", note: null, errorMsg: null,
  }), [stage]);
  const contexts = useMemo((): PanelChannelContext[] => ["A", "B"].map((channel) => {
    const live = stage === "applied" && channel === "A" ? submitted : old;
    return { slot: channel as "A" | "B", eqpmnCode: "EC02", liveBaseline: live,
      knownSettings: { ...(stage !== "idle" && channel === "A" ? submitted : live),
        source: stage === "pending" && channel === "A" ? "pending" : "live", updatedAt: base.receivedAt },
      command: channel === "A" ? command : null };
  }), [stage, command]);
  const active = contexts.find((ctx) => ctx.slot === slot)!;
  const panel = useControllerPanel(base, active.knownSettings, true, slot, "EC02",
    undefined, active.liveBaseline, contexts, undefined, active.command);
  return <section>
    <p data-panel-value="">{panel.sliderValues.setpoint}</p>
    <p data-panel-current="">{panel.currentValues?.setpoint}</p>
    <p data-panel-dirty="">{String(panel.hasChanges)}</p>
    <button onClick={() => panel.setField("setpoint", 28)}>입력 28</button>
    <p data-panel-channel-a="">{panel.channelGlanceRows[0].values?.setpointTemp}</p>
    <p data-panel-channel-b="">{panel.channelGlanceRows[1].values?.setpointTemp}</p>
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
    ["empty", { ...base, tempC: null, humidityPct: null }],
  ];
  return <main data-fixture-ready={ready} className="p-4">
    <div className="flex flex-wrap gap-2">
      {(["idle", "pending", "failed", "applied"] as Stage[]).map((value) =>
        <button key={value} onClick={() => setStage(value)}>{value}</button>)}
      <button onClick={() => setSlot(slot === "A" ? "B" : "A")}>채널 전환</button>
      <button onClick={() => setMount((value) => value + 1)}>패널 재진입</button>
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
