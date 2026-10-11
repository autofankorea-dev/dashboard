import regionsJson from "@/lib/geo/korea-regions.json";
import { farmKeyId, type FarmKey } from "@/lib/domain/farm-key";

export type KoreaRegion = {
  sido: string;
  sigungu: string;
  lat: number;
  lng: number;
};

export const KOREA_REGIONS: KoreaRegion[] = regionsJson as KoreaRegion[];

export function regionsBySido(): Map<string, KoreaRegion[]> {
  const map = new Map<string, KoreaRegion[]>();
  for (const r of KOREA_REGIONS) {
    const list = map.get(r.sido) ?? [];
    list.push(r);
    map.set(r.sido, list);
  }
  return map;
}

export const SIDO_LIST = [...new Set(KOREA_REGIONS.map((r) => r.sido))].sort(
  (a, b) => a.localeCompare(b, "ko")
);

/** 구 명칭 → 공식 시·도 (catalog·geocode 입력 정규화) */
export const SIDO_ALIASES: Record<string, string> = {
  강원도: "강원특별자치도",
  전라북도: "전북특별자치도",
};

export function canonicalSido(sido: string): string {
  return SIDO_ALIASES[sido.trim()] ?? sido.trim();
}

/** 주소 문자열 앞부분에서 시·도 접두사 매칭 (긴 이름 우선) */
export function matchSidoPrefix(address: string): {
  sido: string;
  rest: string;
} | null {
  const trimmed = address.trim();
  const candidates = [
    ...SIDO_LIST,
    ...Object.keys(SIDO_ALIASES),
  ].sort((a, b) => b.length - a.length);

  for (const raw of candidates) {
    if (!trimmed.startsWith(raw)) continue;
    return {
      sido: canonicalSido(raw),
      rest: trimmed.slice(raw.length).trim(),
    };
  }
  return null;
}

export function findRegion(
  sido: string,
  sigungu: string
): KoreaRegion | undefined {
  const canon = canonicalSido(sido);
  return KOREA_REGIONS.find(
    (r) => r.sido === canon && r.sigungu === sigungu.trim()
  );
}

/** farm 번호 기준 결정적 랜덤 (시드·목업용) */
export function pickRegionForFarmNo(farmNo: number): KoreaRegion {
  const idx = (farmNo * 7919 + 42) % KOREA_REGIONS.length;
  return KOREA_REGIONS[idx]!;
}

export function formatAddressText(
  sido: string,
  sigungu: string,
  detail?: string | null
): string {
  const base = `${sido} ${sigungu}`;
  const d = detail?.trim();
  return d ? `${base} ${d}` : base;
}

export function jitterCoord(value: number, farmNo: number, axis: "lat" | "lng"): number {
  const sign = axis === "lat" ? 1 : -1;
  const delta = ((farmNo * 17) % 100) / 10000 * sign;
  return value + delta;
}

/** lsind+itemCode 기준 결정적 지터 — 동일 lsind 다른 축종 좌표 분리 */
export function jitterCoordForFarmKey(
  value: number,
  farmKey: FarmKey,
  axis: "lat" | "lng"
): number {
  const id = farmKeyId(farmKey);
  let seed = 0;
  for (let i = 0; i < id.length; i++) {
    seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
  }
  const sign = axis === "lat" ? 1 : -1;
  const slot = (seed * 17 + (axis === "lat" ? 0 : 53)) % 360;
  const delta = ((slot - 180) / 10000) * sign;
  return value + delta;
}

export function farmNoFromLsind(lsindRegistNo: string): number | null {
  const m = /^FARM(\d+)$/i.exec(lsindRegistNo.trim());
  return m ? Number(m[1]) : null;
}

export function locationKey(fk: FarmKey): string {
  return `${fk.lsindRegistNo}/${fk.itemCode}`;
}
