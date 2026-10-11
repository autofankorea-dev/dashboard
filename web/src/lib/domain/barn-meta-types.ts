/**
 * 축사 메타(지도 카드 1장 = 축사 1) 도메인 타입. 서버 로더(`lib/data/barn-meta.ts`)와
 * 순수 모듈이 공유한다. React·Next·Supabase 의존 없음.
 */
import type { FarmKey } from "@/lib/domain/farm-key";

export type BarnMetaType = "barn" | "office";

export type BarnMeta = {
  id: string;
  farmKey: FarmKey;
  moduleUid: number;
  /** 통신박스 전송 축사(칸) 식별자 (decoded_json.stallNo) */
  stallNo: string;
  name: string;
  grid: { col: number; row: number };
  type?: BarnMetaType;
};

export type BarnLayoutPrefs = {
  layouts: Record<string, { col: number; row: number }>;
  aliases: Record<string, string>;
};
