export type GridPos = { col: number; row: number };
type WithGrid = { grid: GridPos };

export const GRID_COLS_DEFAULT = 4;
export const GRID_ROWS_DEFAULT = 4;

export function resolveGridDimensions(barnCount: number): {
  cols: number;
  rows: number;
} {
  if (barnCount <= 12) return { cols: 4, rows: 4 };
  if (barnCount <= 24) return { cols: 6, rows: 4 };
  if (barnCount <= 36) return { cols: 6, rows: 6 };
  return { cols: 8, rows: 6 };
}

/** 저장된 좌표가 잘리지 않도록 그리드 최소 크기 보장 */
export function resolveGridDimensionsWithLayouts(
  barnCount: number,
  layouts: Record<string, { col: number; row: number }>
): { cols: number; rows: number } {
  const base = resolveGridDimensions(barnCount);
  let cols = base.cols;
  let rows = base.rows;
  for (const g of Object.values(layouts)) {
    cols = Math.max(cols, g.col);
    rows = Math.max(rows, g.row);
  }
  return { cols, rows };
}

export function gridKey(col: number, row: number): string {
  return `${col},${row}`;
}

/** 행 우선(좌→우, 상→하) 슬롯 — SP01~ 순서와 지도 읽기 방향 일치 */
export function buildGridSlots(cols: number, rows: number): GridPos[] {
  const slots: GridPos[] = [];
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= cols; col++) {
      slots.push({ col, row });
    }
  }
  return slots;
}

export function pickNextGridSlot(
  existing: WithGrid[],
  cols = GRID_COLS_DEFAULT,
  rows = GRID_ROWS_DEFAULT
): GridPos {
  const used = new Set(existing.map((b) => gridKey(b.grid.col, b.grid.row)));
  const slots = buildGridSlots(cols, rows);
  for (const slot of slots) {
    if (!used.has(gridKey(slot.col, slot.row))) return slot;
  }
  return slots[existing.length % slots.length] ?? { col: 1, row: 2 };
}

export function resolveBarnGridCollisions<T extends WithGrid>(
  barns: T[],
  cols = GRID_COLS_DEFAULT,
  rows = GRID_ROWS_DEFAULT
): T[] {
  const placed: T[] = [];
  for (const barn of barns) {
    const key = gridKey(barn.grid.col, barn.grid.row);
    const occupied = new Set(placed.map((b) => gridKey(b.grid.col, b.grid.row)));
    const invalid = barn.grid.col > cols || barn.grid.row > rows;
    const grid =
      invalid || occupied.has(key)
        ? pickNextGridSlot(placed, cols, rows)
        : barn.grid;
    placed.push({ ...barn, grid });
  }
  return placed;
}
