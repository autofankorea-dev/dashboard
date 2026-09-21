"use client";

import type { ReactNode } from "react";

/**
 * 허브 본문은 항상 셸 남은 높이를 쓸 수 있게 flex-1.
 * overflow-hidden 으로 높이를 가두고, 필드 격자는 안쪽 슬롯에서만 세로 스크롤한다.
 * 차트는 그래프가 내용 높이로 줄어들지 않게 같은 가둠을 쓴다.
 */
export function FarmPageViewport({
  children,
}: {
  children: ReactNode;
  /** 호환용. 스크롤 가둠은 탭과 무관하게 항상 적용. */
  initialView?: string | null;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden space-y-4 md:space-y-5">
      {children}
    </div>
  );
}
