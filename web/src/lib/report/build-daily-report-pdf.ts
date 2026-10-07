"use client";

import { jsPDF } from "jspdf";
import { CHANNEL_SLOT_LABELS } from "@/lib/data/iot-channel";
import {
  buildDailyReportBriefing,
  farmBriefingFacts,
  typeBriefingFacts,
  type DailyReportBriefing,
  type DailyReportTypeBrief,
} from "@/lib/report/daily-report-briefing";
import {
  dailyReportPdfFilename,
  type DailyReportPayload,
} from "@/lib/report/daily-report-payload";
import {
  type DailyReportPdfTheme,
} from "@/lib/report/daily-report-pdf-theme";
import {
  ALARM_GUIDE_LEGEND,
  CONTENT_BOTTOM,
  DEFAULT_THEME,
  FONT,
  INK,
  KPI_TONE,
  KpiTone,
  MARGIN,
  MUTED,
  PAGE_W,
  averageFarmSeries,
  collectAttentionRows,
  farmAlarmGuides,
  fmt,
  severityLabel,
  situationSourceLabel,
  statusLabel,
  toneFromControllerStatus,
  toneFromJudge,
} from "@/lib/report/build-daily-report-pdf-base";
import {
  addCanvasPage,
  createPageCanvas,
  footer,
  headerBand,
  kpiBox,
  periodRow,
  periodStack,
  tableHeaderBar,
} from "@/lib/report/build-daily-report-pdf-draw";

export type DailyReportProgress = {
  phase: "fetch" | "render" | "done" | "error";
  current: number;
  total: number;
  message: string;
};

async function yieldFrame() {
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
}

function paintCoverPage(
  ctx: CanvasRenderingContext2D,
  payload: DailyReportPayload,
  pageNo: number,
  totalPages: number,
  theme: DailyReportPdfTheme,
) {
  headerBand(
    ctx,
    "스마트축사 일보",
    [
      payload.farmLabel,
      `보고일 ${payload.reportDate}`,
      `생성 ${payload.generatedAt}`,
    ],
    theme,
  );

  let y = MARGIN + 48;
  const boxW = (PAGE_W - MARGIN * 2 - 18) / 4;
  const ov = payload.overview;
  const kpis: [string, string, KpiTone?][] = [
    [String(ov.barnCount), "축사"],
    [String(ov.controllerCount), "컨트롤러"],
    [String(ov.onlineCount), "온라인", "ok"],
    [
      String(ov.alarmCount),
      "이상상황",
      ov.alarmCount > 0 ? "danger" : "ok",
    ],
  ];
  kpis.forEach(([v, l, tone], i) => {
    kpiBox(ctx, MARGIN + i * (boxW + 6), y, boxW, v, l, 34, tone);
  });
  y += 44;

  const farm24 = averageFarmSeries(payload.barns, "24h");
  y = periodRow(
    ctx,
    y,
    "농장 24시간 요약 · 온도 / 습도 / 채널",
    farm24,
    64,
    theme,
  );

  ctx.fillStyle = INK;
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillText("축사 인덱스", MARGIN, y);
  y += 12;

  const indexCols = [
    MARGIN + 6,
    MARGIN + 130,
    MARGIN + 180,
    MARGIN + 250,
    MARGIN + 320,
  ];
  tableHeaderBar(
    ctx,
    y,
    ["축사", "대수", "온도", "습도", "판정"],
    indexCols,
    theme,
  );
  y += 12;

  ctx.fillStyle = INK;
  ctx.font = `9px ${FONT}`;
  for (const b of payload.barns) {
    if (y > CONTENT_BOTTOM - 120) break;
    ctx.fillStyle = INK;
    ctx.fillText(`${b.stallLabel} ${b.stallNo}`, indexCols[0]!, y);
    ctx.fillText(String(b.kpi.total), indexCols[1]!, y);
    ctx.fillText(fmt(b.kpi.tempNow, 1, "℃"), indexCols[2]!, y);
    ctx.fillText(fmt(b.kpi.humNow, 1, "%"), indexCols[3]!, y);
    ctx.fillStyle = KPI_TONE[toneFromJudge(b.kpi.judge)].value;
    ctx.fillText(b.kpi.judge, indexCols[4]!, y);
    y += 13;
  }
  y += 10;

  if (y + 40 < CONTENT_BOTTOM) {
    const attention = collectAttentionRows(payload.barns);
    ctx.fillStyle = INK;
    ctx.font = `bold 11px ${FONT}`;
    ctx.fillText(
      attention.length
        ? `수신 지연·통신 두절 (${attention.length})`
        : "수신 지연·통신 두절",
      MARGIN,
      y,
    );
    y += 12;

    if (attention.length === 0) {
      ctx.fillStyle = MUTED;
      ctx.font = `9px ${FONT}`;
      ctx.fillText(
        "해당 없음 — 수신 지연·통신 두절 장치가 없습니다.",
        MARGIN,
        y,
      );
      y += 14;
    } else {
      const aCols = [
        MARGIN + 4,
        MARGIN + 140,
        MARGIN + 200,
        MARGIN + 280,
        MARGIN + 360,
      ];
      tableHeaderBar(
        ctx,
        y,
        ["축사", "번호", "상태", "온도", "습도"],
        aCols,
        theme,
      );
      y += 12;
      ctx.font = `8px ${FONT}`;
      for (let i = 0; i < attention.length; i++) {
        if (y > CONTENT_BOTTOM - 8) break;
        const row = attention[i]!;
        if (i % 2 === 1) {
          ctx.fillStyle = "#F9FAFB";
          ctx.fillRect(MARGIN, y - 9, PAGE_W - MARGIN * 2, 12);
        }
        ctx.fillStyle = INK;
        ctx.fillText(row.barn, aCols[0]!, y);
        ctx.fillText(row.eqpmnNo, aCols[1]!, y);
        ctx.fillStyle =
          row.status === "offline" ? "#B91C1C" : "#B45309";
        ctx.fillText(statusLabel(row.status), aCols[2]!, y);
        ctx.fillStyle = INK;
        ctx.fillText(fmt(row.tempC, 1, "℃"), aCols[3]!, y);
        ctx.fillText(fmt(row.humidityPct, 1, "%"), aCols[4]!, y);
        y += 12;
      }
    }
  }

  if (y + 40 < CONTENT_BOTTOM) {
    const alarms = payload.alarms;
    ctx.fillStyle = INK;
    ctx.font = `bold 11px ${FONT}`;
    ctx.fillText(
      alarms.length
        ? `이상상황 · 모듈 에러·통신 두절 (${alarms.length})`
        : "이상상황 · 모듈 에러·통신 두절",
      MARGIN,
      y,
    );
    y += 12;

    if (alarms.length === 0) {
      ctx.fillStyle = MUTED;
      ctx.font = `9px ${FONT}`;
      ctx.fillText(
        "이상 없음 — 모듈 에러·통신 두절이 없습니다.",
        MARGIN,
        y,
      );
    } else {
      const maxRows = 8;
      const shown = alarms.slice(0, maxRows);
      const aCols = [
        MARGIN + 4,
        MARGIN + 80,
        MARGIN + 115,
        MARGIN + 175,
        MARGIN + 230,
        MARGIN + 280,
        MARGIN + 340,
      ];
      tableHeaderBar(
        ctx,
        y,
        ["축사", "번호", "출처", "유형", "심각도", "상세"],
        aCols,
        theme,
      );
      y += 12;
      ctx.font = `8px ${FONT}`;
      for (let i = 0; i < shown.length; i++) {
        if (y > CONTENT_BOTTOM - 8) break;
        const row = shown[i]!;
        if (i % 2 === 1) {
          ctx.fillStyle = "#F9FAFB";
          ctx.fillRect(MARGIN, y - 9, PAGE_W - MARGIN * 2, 12);
        }
        ctx.fillStyle = INK;
        ctx.fillText(`${row.stallLabel} ${row.stallNo}`, aCols[0]!, y);
        ctx.fillText(row.eqpmnNo, aCols[1]!, y);
        ctx.fillText(situationSourceLabel(row.source), aCols[2]!, y);
        ctx.fillText(row.alarmType.slice(0, 10), aCols[3]!, y);
        ctx.fillStyle = row.severity === "critical" ? "#B91C1C" : "#B45309";
        ctx.fillText(severityLabel(row.severity), aCols[4]!, y);
        ctx.fillStyle = INK;
        ctx.fillText(row.detail.slice(0, 24), aCols[5]!, y);
        y += 12;
      }
    }
  }

  footer(ctx, pageNo, totalPages, theme);
}

function paintOverviewKpis(
  ctx: CanvasRenderingContext2D,
  y: number,
  payload: DailyReportPayload,
): number {
  const boxW = (PAGE_W - MARGIN * 2 - 18) / 4;
  const ov = payload.overview;
  const kpis: [string, string, KpiTone?][] = [
    [String(ov.barnCount), "축사"],
    [String(ov.controllerCount), "컨트롤러"],
    [String(ov.onlineCount), "온라인", "ok"],
    [
      String(ov.alarmCount),
      "이상상황",
      ov.alarmCount > 0 ? "danger" : "ok",
    ],
  ];
  kpis.forEach(([v, l, tone], i) => {
    kpiBox(ctx, MARGIN + i * (boxW + 6), y, boxW, v, l, 34, tone);
  });
  return y + 44;
}

function paintTodayBanner(
  ctx: CanvasRenderingContext2D,
  y: number,
  payload: DailyReportPayload,
): number {
  const ov = payload.overview;
  const ok = ov.alarmCount === 0 && ov.offlineCount === 0;
  const tone = ok ? KPI_TONE.ok : KPI_TONE.danger;
  ctx.fillStyle = tone.bg;
  ctx.fillRect(MARGIN, y, PAGE_W - MARGIN * 2, 28);
  ctx.strokeStyle = tone.border;
  ctx.strokeRect(MARGIN, y, PAGE_W - MARGIN * 2, 28);
  ctx.fillStyle = tone.value;
  ctx.font = `bold 10px ${FONT}`;
  const line = ok
    ? "오늘 모듈 에러·통신 두절 없음"
    : `오늘 이상상황 ${ov.alarmCount}건 · 통신 두절 ${ov.offlineCount}대`;
  ctx.fillText(line, MARGIN + 10, y + 18);
  return y + 36;
}

function paintBarnIndex(
  ctx: CanvasRenderingContext2D,
  y: number,
  payload: DailyReportPayload,
  theme: DailyReportPdfTheme,
): number {
  ctx.fillStyle = INK;
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillText("축사 인덱스", MARGIN, y);
  y += 12;
  const indexCols = [
    MARGIN + 6,
    MARGIN + 130,
    MARGIN + 180,
    MARGIN + 250,
    MARGIN + 320,
  ];
  tableHeaderBar(
    ctx,
    y,
    ["축사", "대수", "온도", "습도", "판정"],
    indexCols,
    theme,
  );
  y += 12;
  ctx.font = `9px ${FONT}`;
  for (const b of payload.barns) {
    if (y > CONTENT_BOTTOM - 80) break;
    ctx.fillStyle = INK;
    ctx.fillText(`${b.stallLabel} ${b.stallNo}`, indexCols[0]!, y);
    ctx.fillText(String(b.kpi.total), indexCols[1]!, y);
    ctx.fillText(fmt(b.kpi.tempNow, 1, "℃"), indexCols[2]!, y);
    ctx.fillText(fmt(b.kpi.humNow, 1, "%"), indexCols[3]!, y);
    ctx.fillStyle = KPI_TONE[toneFromJudge(b.kpi.judge)].value;
    ctx.fillText(b.kpi.judge, indexCols[4]!, y);
    y += 13;
  }
  return y + 10;
}

function paintAlarmsBlock(
  ctx: CanvasRenderingContext2D,
  y: number,
  payload: DailyReportPayload,
  theme: DailyReportPdfTheme,
): number {
  const alarms = payload.alarms;
  ctx.fillStyle = INK;
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillText(
    alarms.length
      ? `이상상황 (${alarms.length})`
      : "이상상황",
    MARGIN,
    y,
  );
  y += 12;
  if (alarms.length === 0) {
    ctx.fillStyle = MUTED;
    ctx.font = `9px ${FONT}`;
    ctx.fillText("모듈 에러·통신 두절 없음", MARGIN, y);
    return y + 14;
  }
  const aCols = [
    MARGIN + 4,
    MARGIN + 90,
    MARGIN + 150,
    MARGIN + 210,
    MARGIN + 280,
  ];
  tableHeaderBar(
    ctx,
    y,
    ["축사", "번호", "출처", "심각도", "상세"],
    aCols,
    theme,
  );
  y += 12;
  ctx.font = `8px ${FONT}`;
  for (let i = 0; i < Math.min(alarms.length, 8); i++) {
    const row = alarms[i]!;
    ctx.fillStyle = INK;
    ctx.fillText(`${row.stallLabel} ${row.stallNo}`, aCols[0]!, y);
    ctx.fillText(row.eqpmnNo, aCols[1]!, y);
    ctx.fillText(situationSourceLabel(row.source), aCols[2]!, y);
    ctx.fillStyle = row.severity === "critical" ? "#B91C1C" : "#B45309";
    ctx.fillText(severityLabel(row.severity), aCols[3]!, y);
    ctx.fillStyle = INK;
    ctx.fillText(row.detail.slice(0, 22), aCols[4]!, y);
    y += 12;
  }
  return y + 8;
}

function paintControllerTable(
  ctx: CanvasRenderingContext2D,
  y: number,
  controllers: DailyReportPayload["barns"][number]["controllers"],
  theme: DailyReportPdfTheme,
): number {
  ctx.fillStyle = INK;
  ctx.font = `bold 10px ${FONT}`;
  ctx.fillText("컨트롤러 현황", MARGIN, y);
  y += 12;
  const heads = ["번호", "상태", "온도", "습도", "A%", "B%", "C%"];
  const cols = [
    MARGIN + 4,
    MARGIN + 70,
    MARGIN + 140,
    MARGIN + 210,
    MARGIN + 280,
    MARGIN + 340,
    MARGIN + 400,
  ];
  tableHeaderBar(ctx, y, heads, cols, theme);
  y += 12;
  ctx.font = `8px ${FONT}`;
  for (let rowIdx = 0; rowIdx < controllers.length; rowIdx++) {
    if (y > CONTENT_BOTTOM - 28) break;
    const c = controllers[rowIdx]!;
    if (rowIdx % 2 === 1) {
      ctx.fillStyle = "#F9FAFB";
      ctx.fillRect(MARGIN, y - 9, PAGE_W - MARGIN * 2, 12);
    }
    ctx.fillStyle = INK;
    ctx.fillText(c.eqpmnNo, cols[0]!, y);
    ctx.fillStyle = KPI_TONE[toneFromControllerStatus(c.status)].value;
    ctx.fillText(statusLabel(c.status), cols[1]!, y);
    ctx.fillStyle = INK;
    ctx.fillText(fmt(c.tempC, 1, "℃"), cols[2]!, y);
    ctx.fillText(fmt(c.humidityPct, 1, "%"), cols[3]!, y);
    ctx.fillText(c.motorA == null ? "—" : fmt(c.motorA, 0), cols[4]!, y);
    ctx.fillText(c.motorB == null ? "—" : fmt(c.motorB, 0), cols[5]!, y);
    ctx.fillText(c.motorC == null ? "—" : fmt(c.motorC, 0), cols[6]!, y);
    y += 12;
  }
  return y + 8;
}

function paintBarnKpiRow(
  ctx: CanvasRenderingContext2D,
  y: number,
  barn: DailyReportPayload["barns"][number],
  compact: boolean,
): number {
  const kpiItems: [string, string, KpiTone?][] = compact
    ? [
        [fmt(barn.kpi.tempNow, 1, "℃"), "온도"],
        [fmt(barn.kpi.humNow, 1, "%"), "습도"],
        [
          barn.kpi.motorA == null ? "—" : fmt(barn.kpi.motorA, 0, "%"),
          CHANNEL_SLOT_LABELS.A,
        ],
        [
          barn.kpi.motorB == null ? "—" : fmt(barn.kpi.motorB, 0, "%"),
          CHANNEL_SLOT_LABELS.B,
        ],
        [
          barn.kpi.motorC == null ? "—" : fmt(barn.kpi.motorC, 0, "%"),
          CHANNEL_SLOT_LABELS.C,
        ],
        [barn.kpi.judge, "판정", toneFromJudge(barn.kpi.judge)],
      ]
    : [
        [fmt(barn.kpi.tempNow, 1, "℃"), "온도"],
        [fmt(barn.kpi.humNow, 1, "%"), "습도"],
        [
          barn.kpi.motorA == null ? "—" : fmt(barn.kpi.motorA, 0, "%"),
          CHANNEL_SLOT_LABELS.A,
        ],
        [
          barn.kpi.motorB == null ? "—" : fmt(barn.kpi.motorB, 0, "%"),
          CHANNEL_SLOT_LABELS.B,
        ],
        [
          barn.kpi.motorC == null ? "—" : fmt(barn.kpi.motorC, 0, "%"),
          CHANNEL_SLOT_LABELS.C,
        ],
        [`${fmt(barn.kpi.tMin24)}~${fmt(barn.kpi.tMax24)}℃`, "24h 온도"],
        [`${barn.kpi.online}/${barn.kpi.total}`, "온라인"],
        [barn.kpi.judge, "판정", toneFromJudge(barn.kpi.judge)],
      ];
  const kpiGap = 4;
  const kpiW =
    (PAGE_W - MARGIN * 2 - kpiGap * (kpiItems.length - 1)) / kpiItems.length;
  kpiItems.forEach(([v, l, tone], i) => {
    kpiBox(ctx, MARGIN + i * (kpiW + kpiGap), y, kpiW, v, l, 32, tone);
  });
  return y + 40;
}

function paintCoverBrief(
  ctx: CanvasRenderingContext2D,
  payload: DailyReportPayload,
  theme: DailyReportPdfTheme,
) {
  headerBand(
    ctx,
    "스마트축사 일보",
    [payload.farmLabel, `보고일 ${payload.reportDate}`, "오늘 브리프"],
    theme,
  );
  let y = paintOverviewKpis(ctx, MARGIN + 48, payload);
  y = paintTodayBanner(ctx, y, payload);
  y = paintBarnIndex(ctx, y, payload, theme);
  paintAlarmsBlock(ctx, y, payload, theme);
  footer(ctx, 1, 1 + payload.barns.length, theme);
}

function paintCoverOps(
  ctx: CanvasRenderingContext2D,
  payload: DailyReportPayload,
  theme: DailyReportPdfTheme,
) {
  headerBand(
    ctx,
    "스마트축사 일보",
    [payload.farmLabel, `보고일 ${payload.reportDate}`, "운영 브리핑"],
    theme,
  );
  let y = paintOverviewKpis(ctx, MARGIN + 48, payload);
  y = periodRow(
    ctx,
    y,
    "농장 24시간 · 온도 / 습도 / 채널",
    averageFarmSeries(payload.barns, "24h"),
    72,
    theme,
  );
  paintAlarmsBlock(ctx, y, payload, theme);
  const extra = collectAttentionRows(payload.barns).length;
  footer(ctx, 1, 1 + payload.barns.length + extra, theme);
}

function paintBarnBrief(
  ctx: CanvasRenderingContext2D,
  payload: DailyReportPayload,
  barn: DailyReportPayload["barns"][number],
  theme: DailyReportPdfTheme,
) {
  headerBand(
    ctx,
    `${barn.stallLabel} ${barn.stallNo}`,
    [payload.farmLabel, `컨트롤러 ${barn.kpi.total}대`, "오늘 24시간"],
    theme,
  );
  let y = paintBarnKpiRow(ctx, MARGIN + 46, barn, true);
  y = periodRow(
    ctx,
    y,
    "24시간 · 온도 / 습도 / 채널",
    barn.periods["24h"],
    78,
    theme,
  );
  paintControllerTable(ctx, y, barn.controllers, theme);
  footer(ctx, 2, 1 + payload.barns.length, theme);
}

function paintBarnOps(
  ctx: CanvasRenderingContext2D,
  payload: DailyReportPayload,
  barn: DailyReportPayload["barns"][number],
  theme: DailyReportPdfTheme,
) {
  headerBand(
    ctx,
    `${barn.stallLabel} ${barn.stallNo}`,
    [payload.farmLabel, `컨트롤러 ${barn.kpi.total}대`, "24시간 · 7일"],
    theme,
  );
  let y = paintBarnKpiRow(ctx, MARGIN + 46, barn, false);
  y = periodRow(
    ctx,
    y,
    "24시간 · 온도 / 습도 / 채널",
    barn.periods["24h"],
    58,
    theme,
  );
  y = periodRow(
    ctx,
    y,
    "7일 · 온도 / 습도 / 채널",
    barn.periods["7d"],
    46,
    theme,
  );
  paintControllerTable(ctx, y, barn.controllers, theme);
  const extra = collectAttentionRows(payload.barns).length;
  footer(ctx, 2, 1 + payload.barns.length + extra, theme);
}

function paintBarnArchive(
  ctx: CanvasRenderingContext2D,
  payload: DailyReportPayload,
  barn: DailyReportPayload["barns"][number],
  theme: DailyReportPdfTheme,
) {
  headerBand(
    ctx,
    `${barn.stallLabel} ${barn.stallNo}`,
    [payload.farmLabel, `컨트롤러 ${barn.kpi.total}대`, "24시간 · 7일 · 30일"],
    theme,
  );
  let y = paintBarnKpiRow(ctx, MARGIN + 46, barn, false);
  for (const p of [
    { id: "24h" as const, label: "24시간", h: 48 },
    { id: "7d" as const, label: "7일", h: 40 },
    { id: "30d" as const, label: "30일", h: 40 },
  ]) {
    y = periodRow(
      ctx,
      y,
      `${p.label} · 온도 / 습도 / 채널`,
      barn.periods[p.id],
      p.h,
      theme,
    );
  }
  const total = 1 + payload.barns.length + payload.barns.reduce((n, b) => n + b.controllers.length, 0);
  footer(ctx, 2, total, theme);
}

function paintAppendixSample(
  ctx: CanvasRenderingContext2D,
  payload: DailyReportPayload,
  theme: DailyReportPdfTheme,
  caption: string,
) {
  const hit =
    payload.barns.flatMap((b) =>
      b.controllers
        .filter((c) => c.status === "offline" || c.status === "caution")
        .map((ctrl) => ({ barn: b, ctrl })),
    )[0] ?? {
      barn: payload.barns[0]!,
      ctrl: payload.barns[0]!.controllers[0]!,
    };
  headerBand(
    ctx,
    `${hit.barn.stallLabel} ${hit.barn.stallNo} · ${hit.ctrl.eqpmnNo}번`,
    [payload.farmLabel, caption],
    theme,
  );
  let y = MARGIN + 46;
  const kpiW = (PAGE_W - MARGIN * 2 - 20) / 6;
  const kpis: [string, string, KpiTone?][] = [
    [fmt(hit.ctrl.tempC, 1, "℃"), "온도"],
    [fmt(hit.ctrl.humidityPct, 1, "%"), "습도"],
    [
      hit.ctrl.motorA == null ? "—" : fmt(hit.ctrl.motorA, 0, "%"),
      CHANNEL_SLOT_LABELS.A,
    ],
    [
      hit.ctrl.motorB == null ? "—" : fmt(hit.ctrl.motorB, 0, "%"),
      CHANNEL_SLOT_LABELS.B,
    ],
    [
      hit.ctrl.motorC == null ? "—" : fmt(hit.ctrl.motorC, 0, "%"),
      CHANNEL_SLOT_LABELS.C,
    ],
    [
      statusLabel(hit.ctrl.status),
      "상태",
      toneFromControllerStatus(hit.ctrl.status),
    ],
  ];
  kpis.forEach(([v, l, tone], i) => {
    kpiBox(ctx, MARGIN + i * (kpiW + 4), y, kpiW, v, l, 32, tone);
  });
  y += 40;
  y = periodRow(
    ctx,
    y,
    "24시간 · 온도 / 습도 / 채널",
    hit.barn.periods["24h"],
    64,
    theme,
  );
  footer(ctx, 3, 3, theme);
}

export type DailyReportContentLayoutId = "brief" | "ops" | "archive";

export function renderDailyReportContentPreview(
  layout: DailyReportContentLayoutId,
  payload: DailyReportPayload,
): HTMLCanvasElement[] {
  const theme = DEFAULT_THEME;
  const barn = payload.barns[0];
  if (!barn) return [];
  const pages: HTMLCanvasElement[] = [];
  const cover = createPageCanvas();
  const barnPage = createPageCanvas();
  if (layout === "brief") {
    paintCoverBrief(cover.ctx, payload, theme);
    paintBarnBrief(barnPage.ctx, payload, barn, theme);
    pages.push(cover.canvas, barnPage.canvas);
  } else if (layout === "ops") {
    paintCoverOps(cover.ctx, payload, theme);
    paintBarnOps(barnPage.ctx, payload, barn, theme);
    const extra = createPageCanvas();
    paintAppendixSample(extra.ctx, payload, theme, "문제 장치만 첨부");
    pages.push(cover.canvas, barnPage.canvas, extra.canvas);
  } else {
    paintCoverPage(cover.ctx, payload, 1, 3, theme);
    paintBarnArchive(barnPage.ctx, payload, barn, theme);
    const extra = createPageCanvas();
    paintAppendixSample(extra.ctx, payload, theme, "컨트롤러 전부 첨부");
    pages.push(cover.canvas, barnPage.canvas, extra.canvas);
  }
  return pages;
}

function wrapBriefLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const chars = [...text];
  const lines: string[] = [];
  let cur = "";
  for (const ch of chars) {
    const next = cur + ch;
    if (ctx.measureText(next).width > maxWidth && cur) {
      lines.push(cur);
      cur = ch;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function paintBriefParagraphs(
  ctx: CanvasRenderingContext2D,
  y: number,
  title: string,
  paragraphs: string[],
): number {
  ctx.fillStyle = INK;
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillText(title, MARGIN, y);
  y += 14;
  ctx.font = `9px ${FONT}`;
  const maxW = PAGE_W - MARGIN * 2;
  for (const p of paragraphs) {
    for (const line of wrapBriefLines(ctx, p, maxW)) {
      if (y > CONTENT_BOTTOM - 20) return y;
      ctx.fillStyle = INK;
      ctx.fillText(line, MARGIN, y);
      y += 13;
    }
    y += 4;
  }
  return y;
}

function paintCoverWeeklyBriefing(
  ctx: CanvasRenderingContext2D,
  payload: DailyReportPayload,
  briefing: DailyReportBriefing,
  theme: DailyReportPdfTheme,
  totalPages: number,
) {
  headerBand(
    ctx,
    "스마트축사 일보",
    [payload.farmLabel, `보고일 ${payload.reportDate}`, "30일 브리핑"],
    theme,
  );
  let y = paintOverviewKpis(ctx, MARGIN + 48, payload);
  const alarmGuides = farmAlarmGuides(payload);
  y = periodStack(
    ctx,
    y,
    "농장 30일 · 1시간",
    briefing.farm30d,
    theme,
    alarmGuides,
    92,
    "기록 부족",
    ALARM_GUIDE_LEGEND,
  );

  ctx.fillStyle = INK;
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillText("축사유형", MARGIN, y);
  y += 12;
  const cols = [
    MARGIN + 6,
    MARGIN + 100,
    MARGIN + 150,
    MARGIN + 220,
    MARGIN + 300,
  ];
  tableHeaderBar(
    ctx,
    y,
    ["유형", "동", "평균 온도", "평균 습도", "수신"],
    cols,
    theme,
  );
  y += 12;
  ctx.font = `9px ${FONT}`;
  for (const type of briefing.types) {
    if (y > CONTENT_BOTTOM - 90) break;
    ctx.fillStyle = INK;
    ctx.fillText(type.stallLabel, cols[0]!, y);
    ctx.fillText(String(type.barnCount), cols[1]!, y);
    ctx.fillText(fmt(type.avgTemp30d, 1, "℃"), cols[2]!, y);
    ctx.fillText(fmt(type.avgHum30d, 0, "%"), cols[3]!, y);
    ctx.fillText(
      type.judge,
      cols[4]!,
      y,
    );
    y += 13;
  }
  y += 12;
  paintBriefParagraphs(
    ctx,
    y,
    "브리핑",
    farmBriefingFacts(briefing, payload),
  );
  footer(ctx, 1, totalPages, theme);
}

function paintStallTypeBriefing(
  ctx: CanvasRenderingContext2D,
  payload: DailyReportPayload,
  type: DailyReportTypeBrief,
  theme: DailyReportPdfTheme,
  pageNo: number,
  totalPages: number,
) {
  headerBand(
    ctx,
    type.stallLabel,
    [payload.farmLabel, `축사유형 ${type.barnCount}동`, "30일 브리핑"],
    theme,
  );
  let y = MARGIN + 48;
  const kpis: [string, string, KpiTone?][] = [
    [fmt(type.avgTemp30d, 1, "℃"), "30일 온도"],
    [fmt(type.avgHum30d, 0, "%"), "30일 습도"],
    [`${type.online}/${type.controllerTotal}`, "온라인"],
    [type.judge, "수신", toneFromJudge(type.judge)],
  ];
  const gap = 4;
  const w = (PAGE_W - MARGIN * 2 - gap * 3) / 4;
  kpis.forEach(([v, l, tone], i) => {
    kpiBox(ctx, MARGIN + i * (w + gap), y, w, v, l, 34, tone);
  });
  y += 44;
  y = periodStack(
    ctx,
    y,
    `${type.stallLabel} 30일 · 1시간`,
    type.series30d,
    theme,
    farmAlarmGuides(payload),
    86,
    "기록 부족",
    ALARM_GUIDE_LEGEND,
  );

  ctx.fillStyle = INK;
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillText("축사", MARGIN, y);
  y += 12;
  const cols = [
    MARGIN + 6,
    MARGIN + 100,
    MARGIN + 160,
    MARGIN + 230,
    MARGIN + 310,
  ];
  tableHeaderBar(
    ctx,
    y,
    ["축사", "대수", "온도", "습도", "판정"],
    cols,
    theme,
  );
  y += 12;
  ctx.font = `9px ${FONT}`;
  for (const row of type.barns) {
    if (y > CONTENT_BOTTOM - 70) break;
    ctx.fillStyle = INK;
    ctx.fillText(`${row.stallLabel} ${row.stallNo}`, cols[0]!, y);
    ctx.fillText(String(row.total), cols[1]!, y);
    ctx.fillText(fmt(row.tempNow, 1, "℃"), cols[2]!, y);
    ctx.fillText(fmt(row.humNow, 1, "%"), cols[3]!, y);
    ctx.fillStyle = KPI_TONE[toneFromJudge(row.judge)].value;
    ctx.fillText(row.judge, cols[4]!, y);
    y += 13;
  }
  y += 12;
  paintBriefParagraphs(ctx, y, "브리핑", typeBriefingFacts(type));
  footer(ctx, pageNo, totalPages, theme);
}

function briefingPageCount(typeCount: number): number {
  return 1 + typeCount;
}

export function renderDailyReportBriefingPreview(
  payload: DailyReportPayload,
): HTMLCanvasElement[] {
  const theme = DEFAULT_THEME;
  const briefing = buildDailyReportBriefing(payload);
  const totalPages = briefingPageCount(briefing.types.length);
  const pages: HTMLCanvasElement[] = [];
  const cover = createPageCanvas();
  paintCoverWeeklyBriefing(cover.ctx, payload, briefing, theme, totalPages);
  pages.push(cover.canvas);
  briefing.types.forEach((type, i) => {
    const page = createPageCanvas();
    paintStallTypeBriefing(
      page.ctx,
      payload,
      type,
      theme,
      i + 2,
      totalPages,
    );
    pages.push(page.canvas);
  });
  return pages;
}

export async function buildAndDownloadDailyReportPdf(
  payload: DailyReportPayload,
  onProgress?: (p: DailyReportProgress) => void,
): Promise<void> {
  const briefing = buildDailyReportBriefing(payload);
  const totalPages = briefingPageCount(briefing.types.length);
  let pageNo = 0;

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  let first = true;
  const theme = DEFAULT_THEME;

  const reportProgress = (message: string) => {
    onProgress?.({
      phase: "render",
      current: pageNo,
      total: totalPages,
      message,
    });
  };

  {
    pageNo += 1;
    reportProgress("농장 30일 브리핑");
    const { canvas, ctx } = createPageCanvas();
    paintCoverWeeklyBriefing(ctx, payload, briefing, theme, totalPages);
    addCanvasPage(pdf, canvas, first);
    first = false;
    await yieldFrame();
  }

  for (const type of briefing.types) {
    pageNo += 1;
    reportProgress(`${type.stallLabel} 30일 브리핑`);
    const { canvas, ctx } = createPageCanvas();
    paintStallTypeBriefing(ctx, payload, type, theme, pageNo, totalPages);
    addCanvasPage(pdf, canvas, first);
    first = false;
    await yieldFrame();
  }

  const filename = dailyReportPdfFilename(payload);
  pdf.save(filename);
  onProgress?.({
    phase: "done",
    current: totalPages,
    total: totalPages,
    message: "다운로드 완료",
  });
}
