/**
 * 일보 콘텐츠 시안용 더미 페이로드 — 화면 표시명만 사용.
 */
import { DEFAULT_ALARM_THRESHOLDS } from "@/lib/data/alarms";
import type {
  DailyReportPayload,
  DailyReportSeries,
} from "@/lib/report/daily-report-payload";

function series(
  len: number,
  kind: "hour" | "day",
  seed: number,
): DailyReportSeries {
  const categories = Array.from({ length: len }, (_, i) => {
    if (kind === "hour") {
      const h = String(Math.floor(i / 4)).padStart(2, "0");
      const m = String((i % 4) * 15).padStart(2, "0");
      return `${h}:${m}`;
    }
    const d = 1 + Math.floor(i / 24);
    const h = i % 24;
    return `${d}일 ${String(h).padStart(2, "0")}시`;
  });
  const wave = (amp: number, base: number, i: number, phase: number) =>
    base + amp * Math.sin((i / len) * Math.PI * 2 + phase + seed);
  return {
    categories,
    temp: Array.from({ length: len }, (_, i) =>
      Number(wave(2.4, 24.2, i, 0.2).toFixed(1)),
    ),
    humidity: Array.from({ length: len }, (_, i) =>
      Number(wave(8, 62, i, 1.1).toFixed(1)),
    ),
    motorA: Array.from({ length: len }, (_, i) =>
      Math.round(Math.max(0, Math.min(100, wave(18, 42, i, 0.4)))),
    ),
    motorB: Array.from({ length: len }, (_, i) =>
      Math.round(Math.max(0, Math.min(100, wave(14, 35, i, 1.7)))),
    ),
    motorC: Array.from({ length: len }, (_, i) =>
      Math.round(Math.max(0, Math.min(100, wave(10, 22, i, 2.4)))),
    ),
  };
}

const s24 = series(96, "hour", 0.3);
const s7 = series(48, "day", 0.8);
const s30 = series(720, "day", 1.4);
const periods = { "24h": s24, "7d": s7, "30d": s30 };

export function dailyReportContentPreviewPayload(): DailyReportPayload {
  return {
    farmKey: { lsindRegistNo: "preview", itemCode: "demo" },
    farmLabel: "햇살농장",
    reportDate: "2026-08-19",
    generatedAt: "2026. 08. 19. 14:30",
    overview: {
      barnCount: 4,
      controllerCount: 18,
      onlineCount: 17,
      offlineCount: 1,
      alarmCount: 1,
    },
    barns: [
      {
        stallTyCode: "SP02",
        stallLabel: "임신사",
        stallNo: "1",
        kpi: {
          tempNow: 24.8,
          humNow: 61.2,
          motorA: 41,
          motorB: 33,
          motorC: 18,
          tMin24: 22.1,
          tMax24: 26.4,
          online: 4,
          total: 4,
          judge: "정상",
        },
        controllers: [
          {
            controllerKey: "p1",
            eqpmnNo: "01",
            tempC: 24.6,
            humidityPct: 60.1,
            motorA: 40,
            motorB: 32,
            motorC: 17,
            status: "normal",
          },
          {
            controllerKey: "p2",
            eqpmnNo: "02",
            tempC: 25.0,
            humidityPct: 62.4,
            motorA: 42,
            motorB: 34,
            motorC: 19,
            status: "normal",
          },
        ],
        periods,
        detailRows: [
          {
            label: "00:00",
            temp: 23.1,
            humidity: 64,
            motorA: 38,
            motorB: 30,
            motorC: 16,
          },
          {
            label: "12:00",
            temp: 26.1,
            humidity: 55,
            motorA: 52,
            motorB: 41,
            motorC: 24,
          },
        ],
      },
      {
        stallTyCode: "SP03",
        stallLabel: "분만사",
        stallNo: "2",
        kpi: {
          tempNow: 26.9,
          humNow: 58.0,
          motorA: 55,
          motorB: 40,
          motorC: 21,
          tMin24: 24.0,
          tMax24: 27.2,
          online: 3,
          total: 4,
          judge: "통신 두절",
        },
        controllers: [
          {
            controllerKey: "off",
            eqpmnNo: "04",
            tempC: null,
            humidityPct: null,
            motorA: null,
            motorB: null,
            motorC: null,
            status: "offline",
          },
        ],
        periods,
        detailRows: [],
      },
    ],
    alarms: [
      {
        stallLabel: "분만사",
        stallNo: "2",
        stallTyCode: null,
        eqpmnNo: "04",
        controllerKey: "off",
        alarmType: "통신 두절",
        severity: "critical",
        detail: "최근 수신 없음",
        source: "offline",
      },
    ],
    alarmGuide: { ...DEFAULT_ALARM_THRESHOLDS },
  };
}
