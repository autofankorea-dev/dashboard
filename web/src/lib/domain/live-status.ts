import type { ControllerStatus } from "@/lib/data/iot";

/** 수신 신선도 임계(분) — 이 이하면 normal */
export const RECV_NORMAL_MIN = 15;
/** 수신 신선도 임계(분) — 이 이하면 caution, 초과면 offline */
export const RECV_CAUTION_MIN = 60;
/**
 * 측정 정체 임계(분).
 * 희소 게이팅 하트비트(안정 시 ~30분)보다 넉넉히 잡아 오탐을 피한다.
 * 수신은 최신인데 측정시각이 이 값을 넘게 정체하면 replay/장비 시계정지로 본다.
 */
export const MESURE_STALE_MIN = 60;

/**
 * `mesure_dt`(타임존 없는 KST wall-clock 텍스트 "YYYY-MM-DD HH:mm:ss")를
 * UTC epoch(ms)로 변환한다. 파싱 실패 시 null.
 * tz가 이미 포함된 문자열이면 그대로 해석한다.
 */
export function parseKstWallClockMs(
  mesureDt: string | null | undefined,
): number | null {
  if (!mesureDt) return null;
  const s = mesureDt.trim();
  if (!s) return null;
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s);
  const iso = s.replace(" ", "T") + (hasTz ? "" : "+09:00");
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * 컨트롤러 신선도 상태. 수신시각(received_at)과 측정시각(mesure_dt)을 함께 본다.
 *
 * - 수신 신선도: ≤15m normal · ≤60m caution · 그 외 offline
 * - 측정 신선도: 수신이 최신(normal)이라도 측정시각이 {@link MESURE_STALE_MIN}분을
 *   넘게 정체하면(=버퍼 replay·장비 시계정지) normal → caution으로 강등한다.
 *
 * mesureDt를 주지 않으면 수신 신선도만으로 판정(기존 동작).
 */
export function statusFromAge(
  receivedAt: string,
  mesureDt?: string | null,
  now: number = Date.now(),
): ControllerStatus {
  const recvAgeMin = (now - new Date(receivedAt).getTime()) / 60000;
  let status: ControllerStatus =
    recvAgeMin <= RECV_NORMAL_MIN
      ? "normal"
      : recvAgeMin <= RECV_CAUTION_MIN
        ? "caution"
        : "offline";

  if (status === "normal") {
    const mesureMs = parseKstWallClockMs(mesureDt);
    if (mesureMs != null) {
      const mesureAgeMin = (now - mesureMs) / 60000;
      if (mesureAgeMin > MESURE_STALE_MIN) status = "caution";
    }
  }

  return status;
}
