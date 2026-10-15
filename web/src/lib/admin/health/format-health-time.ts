/** KST HH:mm — server/client 동일 출력 (hydration-safe). */
export function formatHealthTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

/** 모듈 last seen. 2995분 대신 2일. locale 기본은 한국어. */
export function formatHealthAgeMin(
  ageMin: number | null,
  locale: "ko" | "en" = "ko",
): string | null {
  if (ageMin == null || !Number.isFinite(ageMin) || ageMin < 0) return null;
  if (locale === "en") {
    if (ageMin < 1) return "just now";
    if (ageMin < 60) return `${Math.round(ageMin)} min`;
    if (ageMin < 24 * 60) return `${Math.round(ageMin / 60)} h`;
    return `${Math.round(ageMin / (24 * 60))} d`;
  }
  if (ageMin < 1) return "방금";
  if (ageMin < 60) return `${Math.round(ageMin)}분`;
  if (ageMin < 24 * 60) return `${Math.round(ageMin / 60)}시간`;
  return `${Math.round(ageMin / (24 * 60))}일`;
}
