"use client";

import { useEffect, useRef } from "react";
import { renderDailyReportBriefingPreview } from "@/lib/report/build-daily-report-pdf";
import { dailyReportContentPreviewPayload } from "@/lib/report/daily-report-content-preview-fixture";

const CAPTIONS = [
  "1 · 농장 30일 — 1시간 그래프, 축사유형 표, 수치 문장",
  "유형 페이지 — 같은 형식. 실제 다운로드도 유형마다 1장",
  "마지막 · 권장구간 이탈 — 30일 중 가장 긴 구간만 확대",
];

export default function DailyReportBriefingPreviewPage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.replaceChildren();
    const canvases = renderDailyReportBriefingPreview(
      dailyReportContentPreviewPayload(),
    );
    canvases.forEach((canvas, i) => {
      const block = document.createElement("figure");
      block.style.margin = "0";
      const cap = document.createElement("figcaption");
      const last = canvases.length - 1;
      cap.textContent =
        i === 0
          ? CAPTIONS[0]!
          : i === last
            ? CAPTIONS[2]!
            : `${i + 1} · 축사유형`;
      cap.style.fontSize = "13px";
      cap.style.fontWeight = "600";
      cap.style.marginBottom = "8px";
      cap.style.color = "#111827";
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      canvas.style.display = "block";
      canvas.style.background = "#fff";
      canvas.style.border = "1px solid #e5e7eb";
      block.append(cap, canvas);
      host.appendChild(block);
    });
  }, []);

  return (
    <main className="min-h-full bg-zinc-100 px-6 py-8 text-zinc-900">
      <header className="mx-auto mb-8 max-w-3xl">
        <p className="text-xs font-medium tracking-wide text-zinc-500">
          오늘의 리포트 · 브리핑 시안
        </p>
        <h1 className="mt-1 text-2xl font-semibold">
          30일 브리핑 + 권장구간 이탈
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          표지(농장 30일 · 1시간) → 축사유형 1장 → 마지막에 한 달 중 가장 긴 이탈
          구간. 그래프는 온도·습도·채널을 각각 한 행으로 키웠고, 권장(또는
          가이드) 상·하한과 그 그래프의 최저·최고를 함께 표시합니다. 헤더
          오늘의 리포트 다운로드도 이 구성을 씁니다.
        </p>
      </header>
      <div ref={ref} className="mx-auto flex max-w-3xl flex-col gap-8" />
    </main>
  );
}
