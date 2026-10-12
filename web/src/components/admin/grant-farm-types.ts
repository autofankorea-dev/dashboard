import type { FarmKey } from "@/lib/domain/farm-key";

/** 운영 디렉터리·권한 UI에서 쓰는 농장 옵션. */
export type GrantFarmOption = {
  farmKey: FarmKey;
  label: string;
};
