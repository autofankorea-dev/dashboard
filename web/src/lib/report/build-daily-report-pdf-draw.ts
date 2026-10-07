import { jsPDF } from "jspdf";
import { CHANNEL_SLOT_LABELS } from "@/lib/data/iot-channel";
import { TREND_CHART_COLORS_PRINT } from "@/lib/farm/trend-chart-series";
import { downsampleDailyReportSeriesForPrint } from "@/lib/report/daily-report-chart";
import type { DailyReportSeries } from "@/lib/report/daily-report-payload";
import {
  type DailyReportPdfTheme,
} from "@/lib/report/daily-report-pdf-theme";
import {
  ChartGuide,
  DEFAULT_THEME,
  FONT,
  INK,
  KPI_TONE,
  KpiTone,
  MARGIN,
  MUTED,
  PAGE_H,
  PAGE_W,
  ALARM_GUIDE_LEGEND,
  RULE,
  countSeriesPoints,
  finiteExtent,
  printMotorSeries,
  stackedMetricTitle,
} from "@/lib/report/build-daily-report-pdf-base";

/**
 * 일일 리포트 PDF 캔버스/페이지 드로잉 프리미티브.
 *
 * `build-daily-report-pdf.ts`에서 분리(동작 보존). paint* 섹션 조립은
 * 본체에 두고, 차트·행·헤더/푸터·캔버스 페이지 유틸만 모은다.
 */

export function drawLegend(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  items: { color: string; label: string }[],
) {
  let lx = x;
  ctx.font = `8px ${FONT}`;
  for (const it of items) {
    ctx.fillStyle = it.color;
    ctx.fillRect(lx, y - 6, 8, 8);
    ctx.fillStyle = MUTED;
    ctx.fillText(it.label, lx + 11, y);
    lx += 11 + ctx.measureText(it.label).width + 12;
  }
}

export function drawLineChart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  categories: string[],
  series: { values: (number | null)[]; color: string; label: string }[],
  options?: {
    emptyHint?: string;
    unit?: string;
    guide?: ChartGuide;
    yAxis?: boolean;
    yFixed?: { min: number; max: number };
  },
) {
  ctx.save();
  const points = countSeriesPoints(series);
  const empty = points < 1 || categories.length < 1;
  const yAxis = Boolean(options?.yAxis || options?.guide);

  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  if (empty) {
    ctx.fillStyle = MUTED;
    ctx.font = `10px ${FONT}`;
    const hint = options?.emptyHint ?? "기록 부족";
    ctx.fillText(hint, x + 8, y + Math.max(14, h / 2));
    ctx.restore();
    return;
  }

  const nums = series.flatMap((s) =>
    s.values.filter((v): v is number => v != null && !Number.isNaN(v)),
  );
  let dataMin = Math.min(...nums);
  let dataMax = Math.max(...nums);
  if (dataMin === dataMax) {
    dataMin -= 1;
    dataMax += 1;
  }

  let min = options?.yFixed?.min ?? dataMin;
  let max = options?.yFixed?.max ?? dataMax;
  const guide = options?.guide;
  if (guide) {
    min = Math.min(min, guide.lo);
    max = Math.max(max, guide.hi);
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }
  if (!options?.yFixed) {
    const pad = (max - min) * 0.08;
    min -= pad;
    max += pad;
  }

  const axisW = yAxis ? 34 : 6;
  const innerX = x + axisW;
  const innerW = w - axisW - 8;
  const innerY = y + 6;
  const innerH = Math.max(8, h - 22);

  const pyAt = (v: number) =>
    innerY + innerH - ((v - min) / (max - min)) * innerH;

  if (yAxis && guide) {
    const top = pyAt(guide.hi);
    const bot = pyAt(guide.lo);
    ctx.fillStyle = "rgba(16, 185, 129, 0.10)";
    ctx.fillRect(innerX, top, innerW, Math.max(1, bot - top));
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = "#B45309";
    ctx.lineWidth = 1;
    for (const gv of [guide.lo, guide.hi]) {
      const gy = pyAt(gv);
      ctx.beginPath();
      ctx.moveTo(innerX, gy);
      ctx.lineTo(innerX + innerW, gy);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  if (yAxis) {
    ctx.setLineDash([1, 3]);
    ctx.strokeStyle = "#9CA3AF";
    ctx.lineWidth = 1;
    for (const gv of [dataMin, dataMax]) {
      if (gv < min || gv > max) continue;
      if (guide && (Math.abs(gv - guide.lo) < 0.15 || Math.abs(gv - guide.hi) < 0.15)) {
        continue;
      }
      const gy = pyAt(gv);
      ctx.beginPath();
      ctx.moveTo(innerX, gy);
      ctx.lineTo(innerX + innerW, gy);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(innerX, innerY, innerW, innerH);
  ctx.clip();
  for (const s of series) {
    ctx.beginPath();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 1.7;
    let started = false;
    for (let i = 0; i < s.values.length; i++) {
      const v = s.values[i];
      if (v == null || Number.isNaN(v)) {
        started = false;
        continue;
      }
      const px = innerX + (i / Math.max(1, s.values.length - 1)) * innerW;
      const py = pyAt(v);
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();

    if (s.values.length <= 40) {
      ctx.fillStyle = s.color;
      for (let i = 0; i < s.values.length; i++) {
        const v = s.values[i];
        if (v == null || Number.isNaN(v)) continue;
        const px = innerX + (i / Math.max(1, s.values.length - 1)) * innerW;
        ctx.beginPath();
        ctx.arc(px, pyAt(v), 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();

  const fmtTick = (n: number) =>
    Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1);
  const span = max - min;
  const tooClose = (a: number, b: number) => Math.abs(a - b) < span * 0.08;

  ctx.fillStyle = MUTED;
  ctx.font = `7px ${FONT}`;
  if (yAxis) {
    const ticks: number[] = options?.yFixed
      ? [
          options.yFixed.max,
          (options.yFixed.min + options.yFixed.max) / 2,
          options.yFixed.min,
        ]
      : guide
        ? [guide.hi, guide.lo]
        : [dataMax, (dataMin + dataMax) / 2, dataMin];
    if (!options?.yFixed) {
      for (const extra of [dataMax, dataMin]) {
        if (ticks.every((t) => !tooClose(t, extra))) ticks.push(extra);
      }
    }
    const seen: number[] = [];
    for (const t of ticks) {
      if (seen.some((s) => tooClose(s, t))) continue;
      seen.push(t);
      ctx.fillText(fmtTick(t), x + 3, pyAt(t) + 3);
    }

    ctx.textAlign = "right";
    if (guide) {
      ctx.fillStyle = "#B45309";
      ctx.fillText(
        `${guide.name} ${fmtTick(guide.hi)}`,
        innerX + innerW - 3,
        Math.max(innerY + 8, pyAt(guide.hi) - 3),
      );
      ctx.fillText(
        `${guide.name} ${fmtTick(guide.lo)}`,
        innerX + innerW - 3,
        Math.min(innerY + innerH - 2, pyAt(guide.lo) + 9),
      );
    }
    ctx.fillStyle = MUTED;
    if (!guide || !tooClose(dataMax, guide.hi)) {
      ctx.fillText(
        `그래프 ${fmtTick(dataMax)}`,
        innerX + innerW - 3,
        pyAt(dataMax) - 3,
      );
    }
    if (!guide || !tooClose(dataMin, guide.lo)) {
      ctx.fillText(
        `그래프 ${fmtTick(dataMin)}`,
        innerX + innerW - 3,
        pyAt(dataMin) + 9,
      );
    }
    ctx.textAlign = "left";
  }

  ctx.fillStyle = MUTED;
  ctx.font = `8px ${FONT}`;
  const tickIdx = [
    0,
    Math.floor((categories.length - 1) / 2),
    categories.length - 1,
  ];
  for (const i of tickIdx) {
    const label = categories[i] ?? "";
    const px = innerX + (i / Math.max(1, categories.length - 1)) * innerW;
    ctx.fillText(label, Math.max(x, px - 12), y + h - 4);
  }
  ctx.restore();
}

export function chartHeightFor(
  seriesList: { values: (number | null)[] }[],
  full: number,
) {
  return countSeriesPoints(seriesList) >= 1 ? full : Math.min(22, full);
}

/** 기간 1행 — 온도/습도/채널 3열 (인쇄 밀도. 허브 split-Y·브러시 없음) */
export function periodRow(
  ctx: CanvasRenderingContext2D,
  yStart: number,
  periodLabel: string,
  series: DailyReportSeries,
  chartH = 58,
  theme: DailyReportPdfTheme = DEFAULT_THEME,
): number {
  const print = downsampleDailyReportSeriesForPrint(series);
  let y = yStart;
  ctx.fillStyle = theme.section;
  ctx.font = `bold 10px ${FONT}`;
  ctx.fillText(periodLabel, MARGIN, y);
  y += 6;

  const gap = 8;
  const chartW = (PAGE_W - MARGIN * 2 - gap * 2) / 3;
  const motorSeries = [
    {
      values: print.motorA,
      color: TREND_CHART_COLORS_PRINT.fanIntake,
      label: CHANNEL_SLOT_LABELS.A,
    },
    {
      values: print.motorB,
      color: TREND_CHART_COLORS_PRINT.fanExhaust,
      label: CHANNEL_SLOT_LABELS.B,
    },
    {
      values: print.motorC,
      color: TREND_CHART_COLORS_PRINT.fanSupply,
      label: CHANNEL_SLOT_LABELS.C,
    },
  ].filter((s) => s.values.some((v) => v != null && !Number.isNaN(v)));
  const metrics: {
    title: string;
    series: { values: (number | null)[]; color: string; label: string }[];
    legend?: { color: string; label: string }[];
  }[] = [
    {
      title: "온도",
      series: [
        { values: print.temp, color: TREND_CHART_COLORS_PRINT.temp, label: "온도" },
      ],
    },
    {
      title: "습도",
      series: [
        {
          values: print.humidity,
          color: TREND_CHART_COLORS_PRINT.humidity,
          label: "습도",
        },
      ],
    },
    {
      title: "채널",
      series: motorSeries,
      legend: motorSeries.map((s) => ({ color: s.color, label: s.label })),
    },
  ];

  metrics.forEach((m, i) => {
    const x = MARGIN + i * (chartW + gap);
    ctx.fillStyle = INK;
    ctx.font = `8px ${FONT}`;
    ctx.fillText(m.title, x, y + 8);
    if (m.legend && m.legend.length > 0) {
      drawLegend(ctx, x + 22, y + 8, m.legend);
    }
    const list =
      m.series.length > 0
        ? m.series
        : [
            {
              values: print.motorA,
              color: TREND_CHART_COLORS_PRINT.fanIntake,
              label: CHANNEL_SLOT_LABELS.A,
            },
          ];
    const h = chartHeightFor(list, chartH);
    drawLineChart(ctx, x, y + 11, chartW, h, print.categories, list, {
      emptyHint: "기록 부족",
    });
  });

  return y + 11 + chartH + 10;
}

/** 허브 차트와 같이 지표마다 고유 행 · 풀폭. 장비 경보 가이드와 그래프 최저·최고를 함께 표기. */
export function periodStack(
  ctx: CanvasRenderingContext2D,
  yStart: number,
  heading: string,
  series: DailyReportSeries,
  theme: DailyReportPdfTheme,
  guides: { temp?: ChartGuide; humidity?: ChartGuide },
  chartH = 96,
  emptyHint = "기록 부족",
  guideLegend = ALARM_GUIDE_LEGEND,
): number {
  const print = downsampleDailyReportSeriesForPrint(series);
  let y = yStart;
  ctx.fillStyle = theme.section;
  ctx.font = `bold 10px ${FONT}`;
  ctx.fillText(heading, MARGIN, y);
  y += 12;
  ctx.fillStyle = MUTED;
  ctx.font = `8px ${FONT}`;
  ctx.fillText(guideLegend, MARGIN, y);
  y += 10;

  const chartW = PAGE_W - MARGIN * 2;
  const motorSeries = printMotorSeries(print);
  const rows: {
    title: string;
    list: { values: (number | null)[]; color: string; label: string }[];
    legend?: { color: string; label: string }[];
    guide?: ChartGuide;
    yFixed?: { min: number; max: number };
  }[] = [
    {
      title: stackedMetricTitle(
        "온도",
        guides.temp,
        finiteExtent([print.temp]),
        "℃",
        1,
      ),
      list: [
        { values: print.temp, color: TREND_CHART_COLORS_PRINT.temp, label: "온도" },
      ],
      guide: guides.temp,
    },
    {
      title: stackedMetricTitle(
        "습도",
        guides.humidity,
        finiteExtent([print.humidity]),
        "%",
        0,
      ),
      list: [
        {
          values: print.humidity,
          color: TREND_CHART_COLORS_PRINT.humidity,
          label: "습도",
        },
      ],
      guide: guides.humidity,
    },
    {
      title: stackedMetricTitle(
        "채널",
        undefined,
        finiteExtent([print.motorA, print.motorB, print.motorC]),
        "%",
        0,
        "축 0~100%",
      ),
      list:
        motorSeries.length > 0
          ? motorSeries
          : [
              {
                values: print.motorA,
                color: TREND_CHART_COLORS_PRINT.fanIntake,
                label: CHANNEL_SLOT_LABELS.A,
              },
            ],
      legend: motorSeries.map((s) => ({ color: s.color, label: s.label })),
      yFixed: { min: 0, max: 100 },
    },
  ];

  for (const row of rows) {
    ctx.fillStyle = INK;
    ctx.font = `8px ${FONT}`;
    ctx.fillText(row.title, MARGIN, y + 8);
    if (row.legend && row.legend.length > 0) {
      const tw = ctx.measureText(row.title).width;
      drawLegend(ctx, MARGIN + tw + 14, y + 8, row.legend);
    }
    const h = chartHeightFor(row.list, chartH);
    drawLineChart(ctx, MARGIN, y + 11, chartW, h, print.categories, row.list, {
      emptyHint,
      yAxis: true,
      guide: row.guide,
      yFixed: row.yFixed,
    });
    y += 11 + h + 10;
  }
  return y;
}

export function createPageCanvas(): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scale: number;
} {
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(PAGE_W * scale);
  canvas.height = Math.round(PAGE_H * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  return { canvas, ctx, scale };
}

export function footer(
  ctx: CanvasRenderingContext2D,
  page: number,
  total: number,
  theme: DailyReportPdfTheme = DEFAULT_THEME,
) {
  if (theme.footer === "bar") {
    ctx.fillStyle = theme.footerBg;
    ctx.fillRect(0, PAGE_H - 28, PAGE_W, 28);
    ctx.fillStyle = theme.footerMuted;
    ctx.font = `9px ${FONT}`;
    ctx.fillText(
      "SUNG-IL IoT · 스마트축사 일보 · 축사 단위",
      MARGIN,
      PAGE_H - 11,
    );
    ctx.textAlign = "right";
    ctx.fillStyle = theme.footerFg;
    ctx.fillText(`${page} / ${total}`, PAGE_W - MARGIN, PAGE_H - 11);
    ctx.textAlign = "left";
    return;
  }
  ctx.strokeStyle = RULE;
  ctx.beginPath();
  ctx.moveTo(MARGIN, PAGE_H - 28);
  ctx.lineTo(PAGE_W - MARGIN, PAGE_H - 28);
  ctx.stroke();
  ctx.fillStyle = theme.footerMuted;
  ctx.font = `9px ${FONT}`;
  ctx.fillText("SUNG-IL IoT · 스마트축사 일보 · 축사 단위", MARGIN, PAGE_H - 14);
  ctx.textAlign = "right";
  ctx.fillStyle = INK;
  ctx.fillText(`${page} / ${total}`, PAGE_W - MARGIN, PAGE_H - 14);
  ctx.textAlign = "left";
}

export function headerBand(
  ctx: CanvasRenderingContext2D,
  title: string,
  lines: string[],
  theme: DailyReportPdfTheme = DEFAULT_THEME,
) {
  if (theme.header === "letterhead") {
    ctx.fillStyle = theme.letterheadBg;
    ctx.fillRect(0, 0, PAGE_W, MARGIN + 40);
    ctx.fillStyle = theme.letterheadMuted;
    ctx.font = `8px ${FONT}`;
    ctx.fillText("SUNG-IL IoT BOARD", MARGIN, MARGIN + 8);
    ctx.fillStyle = theme.letterheadFg;
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText(title, MARGIN, MARGIN + 28);
    ctx.fillStyle = theme.letterheadMuted;
    ctx.font = `9px ${FONT}`;
    let ly = MARGIN + 10;
    ctx.textAlign = "right";
    for (const line of lines) {
      ctx.fillText(line, PAGE_W - MARGIN, ly);
      ly += 12;
    }
    ctx.textAlign = "left";
    return;
  }

  ctx.fillStyle = theme.wordmark;
  ctx.font = `8px ${FONT}`;
  ctx.fillText("SUNG-IL IoT BOARD", MARGIN, MARGIN + 6);
  ctx.fillStyle = theme.title;
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillText(title, MARGIN, MARGIN + 26);
  ctx.fillStyle = theme.meta;
  ctx.font = `9px ${FONT}`;
  let ly = MARGIN + 10;
  ctx.textAlign = "right";
  for (const line of lines) {
    ctx.fillText(line, PAGE_W - MARGIN, ly);
    ly += 12;
  }
  ctx.textAlign = "left";
  ctx.strokeStyle = theme.rule;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN, MARGIN + 36);
  ctx.lineTo(PAGE_W - MARGIN, MARGIN + 36);
  ctx.stroke();
  ctx.lineWidth = 1;
}

export function kpiBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  value: string,
  label: string,
  h = 36,
  tone: KpiTone = "neutral",
) {
  const t = KPI_TONE[tone];
  ctx.fillStyle = t.bg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = t.border;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = t.value;
  ctx.font = `bold 12px ${FONT}`;
  ctx.fillText(value, x + 6, y + 15);
  ctx.fillStyle = MUTED;
  ctx.font = `8px ${FONT}`;
  ctx.fillText(label, x + 6, y + h - 7);
}

export function tableHeaderBar(
  ctx: CanvasRenderingContext2D,
  y: number,
  headers: string[],
  cols: number[],
  theme: DailyReportPdfTheme = DEFAULT_THEME,
) {
  ctx.fillStyle = theme.tableHeadBg;
  ctx.fillRect(MARGIN, y - 11, PAGE_W - MARGIN * 2, 16);
  ctx.fillStyle = theme.tableHeadFg;
  ctx.font = `bold 8px ${FONT}`;
  headers.forEach((h, i) => ctx.fillText(h, cols[i]!, y));
}

export function addCanvasPage(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  isFirst: boolean,
) {
  const img = canvas.toDataURL("image/jpeg", 0.92);
  if (!isFirst) pdf.addPage();
  pdf.addImage(img, "JPEG", 0, 0, PAGE_W, PAGE_H);
}
