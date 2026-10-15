export type MotorDisplay = "number" | "bar";
export type SheetLocale = "ko" | "en";

export type ProfileSheetPrefs = {
  motorDisplay: MotorDisplay;
  envCover: boolean;
  locale: SheetLocale;
};

export const DEFAULT_PROFILE_SHEET_PREFS: ProfileSheetPrefs = {
  motorDisplay: "number",
  envCover: true,
  locale: "ko",
};

export function parseProfileSheetPrefs(uiConfig: unknown): ProfileSheetPrefs {
  const raw =
    uiConfig && typeof uiConfig === "object" && !Array.isArray(uiConfig)
      ? (uiConfig as Record<string, unknown>)
      : {};
  return {
    motorDisplay: raw.motorDisplay === "bar" ? "bar" : "number",
    envCover: raw.envCover === false ? false : true,
    locale: raw.locale === "en" ? "en" : "ko",
  };
}
