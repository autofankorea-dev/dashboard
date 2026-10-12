"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveAlarmSettings } from "@/lib/data/alarm-settings";
import { validateAlarmThresholds, type AlarmSettings } from "@/lib/domain/alarms";
import {
  saveFarmLocation,
  saveFarmLocationsBatch,
  type SaveFarmLocationInput,
} from "@/lib/data/farm-location";
import { geocodeFarmAddress } from "@/lib/geo/geocode-farm-address";
import {
  devicesAlarmSettingsHref,
  devicesPanelHref,
} from "@/lib/monitoring/devices-panel";

function revalidateFarmPaths() {
  revalidatePath("/farm");
}

export async function geocodeFarmAddressAction(
  address: string
): Promise<
  | {
      ok: true;
      lat: number;
      lng: number;
      addressText: string;
      sido: string;
      sigungu: string;
      addressDetail: string | null;
      geocodeSource: string;
    }
  | { ok: false; error: string }
> {
  const result = await geocodeFarmAddress(address);
  if (!result.ok) return result;
  return {
    ok: true,
    lat: result.lat,
    lng: result.lng,
    addressText: result.addressText,
    sido: result.sido,
    sigungu: result.sigungu,
    addressDetail: result.addressDetail,
    geocodeSource: result.geocodeSource,
  };
}

export async function saveFarmAddressAction(input: {
  lsindRegistNo: string;
  itemCode: string;
  address: string;
}): Promise<{ ok: boolean; error?: string }> {
  const farmKey = {
    lsindRegistNo: input.lsindRegistNo.trim(),
    itemCode: input.itemCode.trim(),
  };
  if (!farmKey.lsindRegistNo || !farmKey.itemCode) {
    return { ok: false, error: "invalid" };
  }

  const geocoded = await geocodeFarmAddress(input.address);
  if (!geocoded.ok) {
    return { ok: false, error: geocoded.error };
  }

  const result = await saveFarmLocation({
    farmKey,
    lat: geocoded.lat,
    lng: geocoded.lng,
    sido: geocoded.sido,
    sigungu: geocoded.sigungu,
    addressDetail: geocoded.addressDetail ?? undefined,
    addressText: geocoded.addressText,
    geocodeSource: geocoded.geocodeSource,
  });

  if (result.ok) revalidateFarmPaths();
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function saveFarmLocationInlineAction(
  input: SaveFarmLocationInput
): Promise<{ ok: boolean; error?: string }> {
  const result = await saveFarmLocation(input);
  if (result.ok) revalidateFarmPaths();
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function saveFarmLocationsBatchInlineAction(
  inputs: SaveFarmLocationInput[]
): Promise<{
  ok: boolean;
  saved: number;
  failed: { lsindRegistNo: string; itemCode: string; error: string }[];
}> {
  const result = await saveFarmLocationsBatch(inputs);
  if (result.saved > 0) revalidateFarmPaths();
  return {
    ok: result.ok,
    saved: result.saved,
    failed: result.failed.map((f) => ({
      lsindRegistNo: f.farmKey.lsindRegistNo,
      itemCode: f.farmKey.itemCode,
      error: f.error,
    })),
  };
}

export async function saveFarmLocationAction(formData: FormData) {
  const lsind = String(formData.get("lsind") ?? "").trim();
  const item = String(formData.get("item") ?? "").trim();
  const sido = String(formData.get("sido") ?? "").trim();
  const sigungu = String(formData.get("sigungu") ?? "").trim();
  const addressDetail = String(formData.get("address_detail") ?? "").trim();
  const addressText = String(formData.get("address_text") ?? "").trim();
  const latRaw = String(formData.get("lat") ?? "").trim();
  const lngRaw = String(formData.get("lng") ?? "").trim();
  const geocodeSource = String(formData.get("geocode_source") ?? "").trim();
  const farmKey = lsind && item ? { lsindRegistNo: lsind, itemCode: item } : undefined;

  if (!lsind || !item) {
    redirect(`${devicesPanelHref(undefined, farmKey)}&error=invalid`);
  }

  const lat = latRaw ? Number(latRaw) : undefined;
  const lng = lngRaw ? Number(lngRaw) : undefined;
  const hasCoords = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

  if (!hasCoords && (!sido || !sigungu)) {
    redirect(`${devicesPanelHref(undefined, farmKey)}&error=invalid`);
  }

  const result = await saveFarmLocation(
    hasCoords
      ? {
          farmKey: { lsindRegistNo: lsind, itemCode: item },
          lat,
          lng,
          sido: sido || undefined,
          sigungu: sigungu || undefined,
          addressDetail: addressDetail || undefined,
          addressText: addressText || undefined,
          geocodeSource: geocodeSource || undefined,
        }
      : {
          farmKey: { lsindRegistNo: lsind, itemCode: item },
          sido,
          sigungu,
          addressDetail: addressDetail || undefined,
        }
  );

  if (!result.ok) {
    if (result.error === "invalid_region") {
      redirect(`${devicesPanelHref(undefined, farmKey)}&error=invalid`);
    }
    if (result.error === "forbidden") {
      redirect(`${devicesPanelHref(undefined, farmKey)}&error=forbidden`);
    }
    redirect(`${devicesPanelHref(undefined, farmKey)}&error=save`);
  }

  revalidateFarmPaths();
  redirect(`${devicesPanelHref(undefined, farmKey)}&ok=saved`);
}

function parseAlarmSettingsFormData(formData: FormData):
  | { ok: true; settings: AlarmSettings }
  | { ok: false; error: "invalid" | "save" } {
  const raw = String(formData.get("settings_json") ?? "{}");
  let settings: AlarmSettings;
  try {
    settings = JSON.parse(raw) as AlarmSettings;
    if (!settings.global) throw new Error("invalid");
  } catch {
    return { ok: false, error: "invalid" };
  }

  const validationErr =
    validateAlarmThresholds(settings.global) ??
    Object.values(settings.byStallTyCode ?? {})
      .map(validateAlarmThresholds)
      .find(Boolean) ??
    Object.values(settings.byScope ?? {})
      .map(validateAlarmThresholds)
      .find(Boolean);
  if (validationErr) {
    return { ok: false, error: "invalid" };
  }

  return { ok: true, settings };
}

export async function saveAlarmSettingsInlineAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const parsed = parseAlarmSettingsFormData(formData);
  if (!parsed.ok) {
    return {
      ok: false,
      error: parsed.error === "invalid" ? "입력값이 올바르지 않습니다." : "저장 실패",
    };
  }

  const result = await saveAlarmSettings(parsed.settings);
  if (!result.ok) {
    return { ok: false, error: "저장 실패" };
  }

  // embedded 농장 UI — patchAlarmSettings로 클라이언트 반영. revalidate는
  // server action POST 후 /farm SSR(farm-overview timeout)을 유발함.
  return { ok: true };
}

export async function saveAlarmSettingsAction(formData: FormData) {
  const parsed = parseAlarmSettingsFormData(formData);
  if (!parsed.ok) {
    redirect(`${devicesAlarmSettingsHref()}&error=${parsed.error}`);
  }

  const result = await saveAlarmSettings(parsed.settings);
  if (!result.ok) {
    redirect(`${devicesAlarmSettingsHref()}&error=save`);
  }

  revalidatePath("/alarms");
  revalidatePath("/farm");
  redirect(`${devicesAlarmSettingsHref()}&ok=saved`);
}
