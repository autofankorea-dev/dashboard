import type { TourStepDef } from "@/lib/onboarding/tour-steps";
import type { SheetLocale } from "@/lib/ui/profile-sheet-prefs";
import { SHEET_COPY, sheetCopy, type SheetCopyKey } from "@/lib/ui/sheet-copy";

const TOUR_COPY_PREFIX: Record<string, string> = {
  "f-header": "tour.fHeader",
  "f-tabs": "tour.fTabs",
  "f-status": "tour.fStatus",
  "f-status-card": "tour.fStatusCard",
  "f-toolbar": "tour.fToolbar",
  "f-controller": "tour.fController",
  "f-graph": "tour.fGraph",
  "f-settings": "tour.fSettings",
  "f-end": "tour.fEnd",
  "c-overview": "tour.cOverview",
  "c-layers": "tour.cLayers",
  "c-control": "tour.cControl",
  "c-brush": "tour.cBrush",
};

function tourText(locale: SheetLocale, key: string): string | null {
  if (!(key in SHEET_COPY)) return null;
  return sheetCopy(locale, key as SheetCopyKey);
}

export function tourStepTitle(
  step: TourStepDef,
  locale: SheetLocale,
  mobile: boolean,
): string {
  const source = mobile && step.mobileTitle ? step.mobileTitle : step.title;
  const prefix = TOUR_COPY_PREFIX[step.id];
  if (!prefix || locale !== "en") return source;
  if (mobile) {
    return (
      tourText(locale, `${prefix}.mobileTitle`) ??
      tourText(locale, `${prefix}.title`) ??
      source
    );
  }
  return tourText(locale, `${prefix}.title`) ?? source;
}

export function tourStepBody(
  step: TourStepDef,
  locale: SheetLocale,
  mobile: boolean,
): string {
  const source = mobile && step.mobileBody ? step.mobileBody : step.body;
  const prefix = TOUR_COPY_PREFIX[step.id];
  if (!prefix || locale !== "en") return source;
  if (mobile) {
    return (
      tourText(locale, `${prefix}.mobileBody`) ??
      tourText(locale, `${prefix}.body`) ??
      source
    );
  }
  return tourText(locale, `${prefix}.body`) ?? source;
}

export function tourStepBullets(
  step: TourStepDef,
  locale: SheetLocale,
  mobile: boolean,
): string[] | undefined {
  const source = mobile && step.mobileBullets ? step.mobileBullets : step.bullets;
  const prefix = TOUR_COPY_PREFIX[step.id];
  if (!source || !prefix || locale !== "en") return source;
  const key =
    mobile && step.mobileBullets
      ? `${prefix}.mobileBullets`
      : `${prefix}.bullets`;
  const text = tourText(locale, key);
  if (!text) return source;
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.length > 0 ? lines : source;
}
