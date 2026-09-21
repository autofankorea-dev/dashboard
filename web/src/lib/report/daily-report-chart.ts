/**
 * 일보 PDF 인쇄용 시리즈 — 허브 통합 추이(split-Y·브러시)를 복제하지 않음.
 * 공식 그래프는 30일 1시간(720점). A4 폭에 맞춰 LTTB만 적용.
 */
import {
  downsampleByIndices,
  pickLttbIndices,
} from "@/lib/farm/trend-display-buckets";
import type { DailyReportSeries } from "@/lib/report/daily-report-payload";

/** 미니차트(~170pt) 인쇄 점 상한. 24h 96은 그대로, 30d 720은 축소. */
export const PDF_PRINT_MAX_POINTS = 96;

function firstFiniteColumn(
  series: DailyReportSeries,
): (number | null)[] {
  const cols: (number | null)[][] = [
    series.temp,
    series.humidity,
    series.motorA,
    series.motorB,
    series.motorC,
  ];
  for (const col of cols) {
    if (col.some((v) => v != null && Number.isFinite(v))) return col;
  }
  return series.temp;
}

export function downsampleDailyReportSeriesForPrint(
  series: DailyReportSeries,
  maxPoints = PDF_PRINT_MAX_POINTS,
): DailyReportSeries {
  const n = series.categories.length;
  if (n <= maxPoints) return series;
  const idx = pickLttbIndices(firstFiniteColumn(series), maxPoints);
  return {
    categories: downsampleByIndices(series.categories, idx),
    temp: downsampleByIndices(series.temp, idx),
    humidity: downsampleByIndices(series.humidity, idx),
    motorA: downsampleByIndices(series.motorA, idx),
    motorB: downsampleByIndices(series.motorB, idx),
    motorC: downsampleByIndices(series.motorC, idx),
  };
}
