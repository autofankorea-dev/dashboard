import { NextResponse } from "next/server";
import { canReadFarm } from "@/lib/auth/farm-access";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getFarmControllerTrend30dDayCompact } from "@/lib/data/farm-trend-history";
import type { FarmKey } from "@/lib/domain/farm-key";
import { trendDayWindowError } from "@/lib/domain/farm-trend-types";

export const dynamic = "force-dynamic";

type Body = {
  lsind?: unknown;
  item?: unknown;
  axisToMs?: unknown;
  scanFromMs?: unknown;
  scanToMs?: unknown;
};

/** 차트 30일 하루 조각. 서버 액션 큐 밖에 두어 개발 서버 전환이 클릭을 붙잡지 않게 한다. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const lsindRegistNo = typeof body.lsind === "string" ? body.lsind.trim() : "";
  const itemCode = typeof body.item === "string" ? body.item.trim() : "";
  const axisToMs = Number(body.axisToMs);
  const scanFromMs = Number(body.scanFromMs);
  const scanToMs = Number(body.scanToMs);
  if (!lsindRegistNo || !itemCode || trendDayWindowError(axisToMs, scanFromMs, scanToMs)) {
    return NextResponse.json({ error: "invalid_window" }, { status: 400 });
  }

  const farmKey: FarmKey = { lsindRegistNo, itemCode };
  if (!canReadFarm(user, farmKey)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const period = await getFarmControllerTrend30dDayCompact({
    farmKey,
    axisToMs,
    scanFromMs,
    scanToMs,
  });
  return NextResponse.json(period);
}
