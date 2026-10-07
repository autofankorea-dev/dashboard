/**
 * 실행: npx tsx src/lib/farm/controller-env-cover.test.ts
 */
import assert from "node:assert/strict";
import { dashboardChroma } from "../ui/dashboard-page-ui";
import {
  CONTROLLER_PANEL_INTERACTIVE_SELECTOR,
  controllerEnvCoverFillClass,
  controllerEnvCoverInkClass,
  controllerEnvCoverLabel,
  controllerEnvCoverStatus,
  controllerEnvCoverReceivedLabel,
  controllerEnvCoverLevel,
  controllerEnvCoverReason,
  controllerEnvCoverRingClass,
  controllerEnvCanvasTextClass,
  controllerEnvMetricTextClass,
  worstControllerEnvCoverLevel,
} from "./controller-env-cover";

{
  const fresh = { alarmLowTempC: 10, alarmHighTempC: 35, status: "normal" as const, tempC: 25.3, humidityPct: 55, stallTyCode: "SP07" };
  assert.deepEqual(controllerEnvCoverStatus(fresh), { environment: "환경 정상", communication: "통신 정상", stale: false });
  assert.equal(controllerEnvCoverStatus({ ...fresh, tempC: 60 }).environment, "환경 경고");
  assert.equal(controllerEnvCoverStatus({ ...fresh, status: "caution" }).environment, "환경 확인 필요");
  assert.equal(controllerEnvCoverStatus({ ...fresh, status: "caution" }).communication, "통신 주의");
  assert.equal(controllerEnvCoverStatus({ ...fresh, status: "offline" }).communication, "통신 경고");
  assert.equal(controllerEnvCoverStatus({ ...fresh, tempC: null, humidityPct: null }).environment, "환경 확인 필요");
  assert.equal(controllerEnvCoverStatus({ ...fresh, tempC: NaN, humidityPct: NaN }).environment, "환경 확인 필요");
  assert.equal(controllerEnvCoverReceivedLabel("invalid"), "마지막 수신 확인 불가");
  assert.ok(controllerEnvCoverReceivedLabel("2026-10-06T00:00:00Z").includes("09:00"), "last reception is shown in KST");
}

{
  assert.equal(controllerEnvCoverLabel("ok"), "정상");
  assert.equal(controllerEnvCoverLabel("warn"), "주의");
  assert.equal(controllerEnvCoverLabel("danger"), "위험");
  assert.equal(controllerEnvCoverLabel("offline"), "연결 끊김");
}

{
  assert.equal(
    controllerEnvCoverLevel({
      alarmLowTempC: 10, alarmHighTempC: 35,
      status: "offline",
      tempC: 24,
      humidityPct: 55,
      stallTyCode: "SP02",
    }),
    "offline",
  );
}

{
  const level = controllerEnvCoverLevel({
    alarmLowTempC: 10, alarmHighTempC: 35,
    status: "normal",
    tempC: 36.5,
    humidityPct: 93,
    stallTyCode: "SP02",
  });
  assert.equal(level, "danger");
}

{
  // 알람 구간 안이어도 측정 정체(caution)면 덮개 「주의」
  assert.equal(
    controllerEnvCoverLevel({
      alarmLowTempC: 10, alarmHighTempC: 35,
      status: "caution",
      tempC: 25.3,
      humidityPct: 55,
      stallTyCode: "SP07",
    }),
    "warn",
  );
  // 이미 알람 위험이면 caution으로 완화하지 않음
  assert.equal(
    controllerEnvCoverLevel({
      alarmLowTempC: 10, alarmHighTempC: 35,
      status: "caution",
      tempC: 36.5,
      humidityPct: 93,
      stallTyCode: "SP02",
    }),
    "danger",
  );
}

{
  const level = controllerEnvCoverLevel({
    alarmLowTempC: 10, alarmHighTempC: 35,
    status: "normal",
    tempC: 34,
    humidityPct: 55,
    stallTyCode: "SP05",
  });
  assert.equal(level, "warn");
}

{
  assert.equal(
    worstControllerEnvCoverLevel([
      {
        alarmLowTempC: 10, alarmHighTempC: 35,
        status: "normal",
        tempC: 20,
        humidityPct: 60,
        stallTyCode: "SP05",
      },
      {
        alarmLowTempC: 10, alarmHighTempC: 35,
        status: "normal",
        tempC: 36,
        humidityPct: 55,
        stallTyCode: "SP05",
      },
    ]),
    "danger",
  );
  assert.equal(
    worstControllerEnvCoverLevel([
      {
        alarmLowTempC: 10, alarmHighTempC: 35,
        status: "offline",
        tempC: 20,
        humidityPct: 60,
        stallTyCode: "SP05",
      },
      {
        alarmLowTempC: 10, alarmHighTempC: 35,
        status: "normal",
        tempC: 20,
        humidityPct: 60,
        stallTyCode: "SP05",
      },
    ]),
    "ok",
  );
  assert.equal(
    worstControllerEnvCoverLevel([
      {
        alarmLowTempC: 10, alarmHighTempC: 35,
        status: "offline",
        tempC: 20,
        humidityPct: 60,
        stallTyCode: "SP05",
      },
    ]),
    "offline",
  );
}

{
  assert.equal(controllerEnvCoverFillClass("ok"), "bg-[var(--status-ok)]");
  assert.equal(controllerEnvCoverFillClass("warn"), "bg-[var(--status-warn)]");
  assert.equal(controllerEnvCoverFillClass("danger"), "bg-[var(--status-danger)]");
  assert.equal(controllerEnvCoverFillClass("offline"), "bg-muted-foreground");
  assert.equal(
    controllerEnvCoverInkClass("ok"),
    "text-[var(--status-ok-ink)]",
  );
  assert.equal(
    controllerEnvCoverInkClass("warn"),
    "text-[var(--status-warn-ink)]",
  );
  assert.equal(
    controllerEnvCoverInkClass("danger"),
    "text-[var(--status-danger-ink)]",
  );
  assert.equal(controllerEnvCoverInkClass("offline"), "text-[var(--status-offline-ink)]");
  assert.match(controllerEnvCoverRingClass("danger"), /--status-danger/);
  assert.match(controllerEnvCoverRingClass("ok"), /--status-ok/);
  assert.equal(dashboardChroma.statusFilmGlassRim, "status-film-glass-rim");
  assert.equal(
    controllerEnvMetricTextClass("ok", "text-channel-temp"),
    "text-channel-temp",
  );
  assert.equal(
    controllerEnvCanvasTextClass("warn"),
    "text-[var(--status-warn-on-canvas)]",
  );
  assert.equal(
    controllerEnvCanvasTextClass("danger"),
    "text-[var(--status-danger-on-canvas)]",
  );
  assert.equal(
    controllerEnvMetricTextClass("warn", "text-channel-temp"),
    "text-[var(--status-warn-on-canvas)]",
  );
  assert.equal(
    controllerEnvMetricTextClass("danger", "text-channel-temp"),
    "text-[var(--status-danger-on-canvas)]",
  );
  assert.equal(
    controllerEnvMetricTextClass("offline", "text-channel-temp"),
    "text-[var(--status-offline-ink)]",
  );
}

{
  const offline = controllerEnvCoverReason({
    alarmLowTempC: 10, alarmHighTempC: 35,
    status: "offline",
    tempC: 24,
    humidityPct: 55,
    stallTyCode: "SP02",
  });
  assert.equal(offline.valueLabel, null);
  assert.equal(offline.bandLabel, null);
}

{
  const tempFirst = controllerEnvCoverReason({
    alarmLowTempC: 10, alarmHighTempC: 35,
    status: "normal",
    tempC: 36.5,
    humidityPct: 93,
    stallTyCode: "SP02",
  });
  assert.equal(tempFirst.valueLabel, "36.5℃");
  assert.equal(tempFirst.bandLabel, "장비 경보 10~35℃");
}

{
  const humidityOnly = controllerEnvCoverReason({
    alarmLowTempC: 10, alarmHighTempC: 35,
    status: "normal",
    tempC: 18,
    humidityPct: 93,
    stallTyCode: "SP02",
  });
  assert.equal(humidityOnly.valueLabel, "18.0℃");
  assert.equal(humidityOnly.bandLabel, "장비 경보 10~35℃");
}

{
  const okTemp = controllerEnvCoverReason({
    alarmLowTempC: 10, alarmHighTempC: 35,
    status: "normal",
    tempC: 20,
    humidityPct: 60,
    stallTyCode: "SP05",
  });
  assert.equal(okTemp.valueLabel, "20.0℃");
  assert.equal(okTemp.bandLabel, "장비 경보 10~35℃");
}

{
  assert.match(CONTROLLER_PANEL_INTERACTIVE_SELECTOR, /\bbutton\b/);
  assert.match(CONTROLLER_PANEL_INTERACTIVE_SELECTOR, /\ba\b/);
  assert.match(CONTROLLER_PANEL_INTERACTIVE_SELECTOR, /\blabel\b/);
  assert.doesNotMatch(CONTROLLER_PANEL_INTERACTIVE_SELECTOR, /role='img'/);
}

console.log("controller-env-cover.test.ts: ok");
