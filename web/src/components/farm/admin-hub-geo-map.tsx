"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { getKakaoJsKeyAction } from "@/lib/actions/kakao-maps-actions";
import { type FarmKey } from "@/lib/data/farm-key";
import { type AdminHubFarmRow } from "@/lib/farm/admin-hub-farm-status";

const mapSkeleton = (
  <div className="min-h-[18rem] w-full md:min-h-[22rem] lg:min-h-[28rem]" aria-busy />
);

const AdminHubKakaoMap = dynamic(
  () =>
    import("@/components/farm/admin-hub-kakao-map").then(
      (m) => m.AdminHubKakaoMap,
    ),
  { ssr: false, loading: () => mapSkeleton },
);

const AdminHubLeafletMap = dynamic(
  () =>
    import("@/components/farm/admin-hub-leaflet-map").then(
      (m) => m.AdminHubLeafletMap,
    ),
  { ssr: false, loading: () => mapSkeleton },
);

type Props = {
  rows: AdminHubFarmRow[];
  activeId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (farmKey: FarmKey) => void;
};

export function AdminHubGeoMap(props: Props) {
  const [kakaoKey, setKakaoKey] = useState<string | null | undefined>(
    undefined,
  );
  const [kakaoFailed, setKakaoFailed] = useState(false);
  const onFail = useCallback(() => setKakaoFailed(true), []);

  useEffect(() => {
    void getKakaoJsKeyAction().then(setKakaoKey);
  }, []);

  if (kakaoKey === undefined) return mapSkeleton;
  if (kakaoKey && !kakaoFailed) {
    return <AdminHubKakaoMap appKey={kakaoKey} onFail={onFail} {...props} />;
  }
  return <AdminHubLeafletMap {...props} />;
}
