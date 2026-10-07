"use client";

import { useEffect, useRef } from "react";
import { renderDailyReportBriefingPreview } from "@/lib/report/build-daily-report-pdf";
import { dailyReportContentPreviewPayload } from "@/lib/report/daily-report-content-preview-fixture";

const CAPTIONS = [
  "1 · 농장 30일 — 1시간 그래프, 축사유형 표, 수치 문장",
  "유형 페이지 — 같은 형식. 실제 다운로드도 유형마다 1장",
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
      cap.textContent =
        i === 0
          ? CAPTIONS[0]!
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
          30일 실측 브리핑
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          표지(농장 30일 · 1시간)와 축사유형별 페이지로 구성됩니다.
          온도·습도·채널의 실측 추이와 수신 현황을 표시하며,
          공통 장비 경보값이 있을 때 현재 기준을 참고선으로 표시합니다.
          헤더 오늘의 리포트 다운로드도 이 구성을 씁니다.
        </p>
      </header>
      <div ref={ref} className="mx-auto flex max-w-3xl flex-col gap-8" />
    </main>
  );
}
