import type { FarmKey } from "@/lib/domain/farm-key";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";

/** Admin hub 첫 paint용 배치 크기 — 나머지는 클라이언트 tail hydrate */
export const ADMIN_HUB_GRID_BATCH_SIZE = 4;

export type AdminFarmGridPanel = {
  farmKey: FarmKey;
  readings: BarnReading[];
  barnSnapshots: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
};
