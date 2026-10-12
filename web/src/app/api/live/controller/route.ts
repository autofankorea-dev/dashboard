import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { fetchLiveReadingDetail } from "@/lib/data/iot-live-fetch";
import type { FarmKey } from "@/lib/domain/farm-key";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const lsindRegistNo = url.searchParams.get("lsind")?.trim() ?? "";
  const itemCode = url.searchParams.get("item")?.trim() ?? "";
  const moduleUid = Number(url.searchParams.get("module_uid"));
  const controllerKey = url.searchParams.get("controller_key")?.trim() ?? "";

  if (
    !lsindRegistNo ||
    !itemCode ||
    !Number.isInteger(moduleUid) ||
    !controllerKey
  ) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const farmKey: FarmKey = { lsindRegistNo, itemCode };
  const reading = await fetchLiveReadingDetail(
    farmKey,
    moduleUid,
    controllerKey,
  );

  if (!reading) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(reading);
}
