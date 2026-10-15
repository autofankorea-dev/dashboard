export type MotorDisplay = "number" | "bar";
/** 차수 칸에서 크게 둘 값. fan = 휀 %, setpoint = 설정온도·편차 */
export type MotorFocus = "fan" | "setpoint";
export type SheetLocale = "ko" | "en";

export type ProfileSheetPrefs = {
  motorDisplay: MotorDisplay;
  motorFocus: MotorFocus;
  envCover: boolean;
  locale: SheetLocale;
};

export const DEFAULT_PROFILE_SHEET_PREFS: ProfileSheetPrefs = {
  motorDisplay: "number",
  motorFocus: "fan",
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
    motorFocus: raw.motorFocus === "setpoint" ? "setpoint" : "fan",
    envCover: raw.envCover === false ? false : true,
    locale: raw.locale === "en" ? "en" : "ko",
  };
}
