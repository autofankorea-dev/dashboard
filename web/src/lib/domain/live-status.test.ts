import assert from "node:assert/strict";
import {
  MESURE_STALE_MIN,
  parseKstWallClockMs,
  statusFromAge,
} from "@/lib/domain/live-status";

const now = Date.parse("2026-09-01T09:12:00+09:00");
const recvAgoIso = (min: number) => new Date(now - min * 60000).toISOString();

// parseKstWallClockMs: tz 없는 KST 텍스트를 +09:00으로 해석
assert.equal(
  parseKstWallClockMs("2026-08-31 08:01:00"),
  Date.parse("2026-08-31T08:01:00+09:00"),
);
// 이미 tz 포함이면 그대로
assert.equal(
  parseKstWallClockMs("2026-08-31T08:01:00+09:00"),
  Date.parse("2026-08-31T08:01:00+09:00"),
);
assert.equal(parseKstWallClockMs(null), null);
assert.equal(parseKstWallClockMs(""), null);
assert.equal(parseKstWallClockMs("not-a-date"), null);

// 수신만: mesureDt 없으면 기존 동작 유지
assert.equal(statusFromAge(recvAgoIso(1), undefined, now), "normal");
assert.equal(statusFromAge(recvAgoIso(30), undefined, now), "caution");
assert.equal(statusFromAge(recvAgoIso(120), undefined, now), "offline");

// 수신 최신 + 측정 최신 → normal
assert.equal(
  statusFromAge(recvAgoIso(1), "2026-09-01 09:07:00", now),
  "normal",
);

// 수신 최신 + 측정 정체(>60m, FARM02 replay) → caution 강등
assert.equal(
  statusFromAge(recvAgoIso(1), "2026-08-31 08:01:00", now),
  "caution",
);

// 측정 정체가 임계 근방: 경계값 확인
assert.equal(
  statusFromAge(recvAgoIso(1), new Date(now - (MESURE_STALE_MIN - 1) * 60000)
    .toISOString(), now),
  "normal",
);
assert.equal(
  statusFromAge(recvAgoIso(1), new Date(now - (MESURE_STALE_MIN + 1) * 60000)
    .toISOString(), now),
  "caution",
);

// 수신이 이미 offline이면 측정 신선도와 무관하게 offline
assert.equal(
  statusFromAge(recvAgoIso(120), "2026-09-01 09:11:00", now),
  "offline",
);

console.log("live-status.test.ts: ok");
