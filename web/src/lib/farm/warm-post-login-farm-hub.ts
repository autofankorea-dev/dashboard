"use client";

import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import { fetchFarmPanelEnrichShared } from "@/lib/farm/fetch-farm-panel-enrich";
import { setFarmPanelCache } from "@/lib/farm/farm-panel-cache";
import { prefetchFarmControllerTrend } from "@/lib/farm/use-farm-controller-trend";

/**
 * 로그인 스플래시와 겹쳐 필드 패널·24시간 추이를 미리 받는다.
 * 실패해도 /farm SSR·bootstrap이 이어 받는다.
 */
export function warmPostLoginFarmHub(farmKey: FarmKey): void {
  void fetchFarmPanelEnrichShared(farmKey)
    .then((data) => {
      setFarmPanelCache(farmKeyId(farmKey), data);
    })
    .catch(() => {
      /* /farm bootstrap */
    });
  void prefetchFarmControllerTrend(farmKey).catch(() => {
    /* 필드 24시간. 차트 탭·idle 이 30일을 이어 받는다 */
  });
}
