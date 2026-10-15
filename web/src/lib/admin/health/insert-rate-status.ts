import type { HealthStatus } from "@/lib/admin/health/types";

/** 최근 2개 버킷의 raw INSERT 수로 수집 상태를 판정한다. 버킷이 없으면 미관측. */
export function insertRateStatus(buckets: { count: number }[]): HealthStatus {
  const recent = buckets.slice(-2);
  if (recent.length === 0) return "unknown";
  if (recent.every((b) => b.count === 0)) return "critical";
  if (recent.some((b) => b.count === 0)) return "warn";
  return "ok";
}

/** raw INSERT를 읽지 못한 unknown을 장애로 바꾸지 않는다. */
export function statusFromInsertRate(rsStatus: HealthStatus): HealthStatus {
  if (rsStatus === "ok" || rsStatus === "warn" || rsStatus === "unknown") {
    return rsStatus;
  }
  return "critical";
}
