import type { FarmKey } from "@/lib/domain/farm-key";

/** 농장명 최대 길이 (말하기·UI) — 클라이언트/서버 공용 */
export const FARM_NAME_MAX_CHARS = 40;

export type FarmLocationRow = {
  farmKey: FarmKey;
  /** 사용자 지정 농장 이름 (ARIA·UI). null이면 short label */
  farmName: string | null;
  sido: string;
  sigungu: string;
  addressDetail: string | null;
  addressText: string;
  lat: number;
  lng: number;
  geocodeSource: string;
  updatedAt: string;
  updatedBy: string | null;
};

export type SaveFarmLocationInput = {
  farmKey: FarmKey;
  /** region_lookup path */
  sido?: string;
  sigungu?: string;
  addressDetail?: string;
  /** geocode path */
  addressText?: string;
  lat?: number;
  lng?: number;
  geocodeSource?: string;
  /** 지정 시 upsert에 포함. 빈 문자열이면 null 저장 */
  farmName?: string | null;
};

export type FarmLocationSaveResult =
  | { ok: true }
  | { ok: false; error: string; farmKey?: FarmKey };

export type FarmLocationBatchResult = {
  ok: boolean;
  saved: number;
  failed: { farmKey: FarmKey; error: string }[];
};

export type EditableFarmOption = {
  farmKey: FarmKey;
  label: string;
  location: FarmLocationRow | null;
  hasLiveData: boolean;
};
