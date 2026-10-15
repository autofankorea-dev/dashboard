"use server";

import { mergeProfileUiConfig } from "@/lib/data/profile-ui-config";
import {
  type MotorDisplay,
  type MotorFocus,
  type SheetLocale,
} from "@/lib/ui/profile-sheet-prefs";

export async function saveMotorDisplayAction(value: MotorDisplay) {
  const motorDisplay: MotorDisplay = value === "bar" ? "bar" : "number";
  return mergeProfileUiConfig((prev) => ({ ...prev, motorDisplay }));
}

export async function saveMotorFocusAction(value: MotorFocus) {
  const motorFocus: MotorFocus = value === "setpoint" ? "setpoint" : "fan";
  return mergeProfileUiConfig((prev) => ({ ...prev, motorFocus }));
}

export async function saveEnvCoverAction(value: boolean) {
  return mergeProfileUiConfig((prev) => ({ ...prev, envCover: value }));
}

export async function saveSheetLocaleAction(value: SheetLocale) {
  const locale: SheetLocale = value === "en" ? "en" : "ko";
  return mergeProfileUiConfig((prev) => ({ ...prev, locale }));
}
