import type { HealthStatus } from "@/lib/admin/health/types";

/** 운영 UI용 한글 라벨 (내부 코드 D9/D11/R3 등 대체) */
export const HEALTH_UI = {
  systemTitle: "시스템 상태",
  systemDesc: "민감정보 없음 · 5분 주기 스냅샷",
  dataPath: "데이터 경로",
  dataPathDesc: "현장 → 수집 → DB → 대시보드. 노드 클릭 시 상세.",
  nodeSummary: "노드 상태 요약",
  activeAlerts: "인프라 이상",
  activeAlertsDesc: "수집·저장·화면 · 모듈은 아래 테이블",
  moduleSummary: "모듈 현황",
  collectorGroups: "수집 서버 그룹",
  collectorGroupsDesc:
    "RS uplink 경로별 농장 묶음 · A/B는 env 미설정 시 농장 목록 반분 · HEALTH_COLLECTOR_GROUPS로 실제 매핑",
  insertRate: "raw 수신량",
  insertRateDesc: "5분 버킷 · 0 구간은 수집 중단 후보",
  moduleAge: "모듈별 최근 수신",
  moduleAgeDesc: "last seen 경과 시간",
  liveCap: "Live 조회 한도",
  liveCapDesc: "관리 화면 전역 live 뷰 상한",
  liveShort: "실시간",
  farmModules: "농장 · 모듈",
  farmModulesDesc: "worst rollup · 상태·경과시간 순",
  actionHint: "ERROR TYPE · RECOMMEND",
  downlink: "명령(downlink)",
  downlinkDesc: "C 프로세스 · uplink rollup 제외",
  externalLink: "외부 연계",
  externalDesc: "비활성화 · rollup 제외",
} as const;

const STATUS_PRIORITY: HealthStatus[] = [
  "critical",
  "warn",
  "unknown",
  "not_implemented",
  "ok",
];

export function worstHealthStatus(
  counts: Record<HealthStatus, number>
): HealthStatus {
  for (const s of STATUS_PRIORITY) {
    if (s === "ok") continue;
    if (counts[s] > 0) return s;
  }
  return "ok";
}

export const SEVERITY_ORDER: Record<HealthStatus, number> = {
  critical: 0,
  warn: 1,
  unknown: 2,
  not_implemented: 3,
  ok: 4,
};

const HEALTH_NODE_TITLES: Record<string, string> = {
  collector: "수집 서버 · 5세분",
  "collector-rs": "RS 수신",
  "collector-mqtt": "Mosquitto",
  "collector-c": "C 명령",
  "collector-ekape": "Ekape job",
  "collector-ftp": "FTP Worker",
  storage: "데이터 저장소",
  dashboard: "관리 화면",
  external: "외부 연계",
  "field-module": "통신 모듈",
  "field-controller": "환경 컨트롤러",
};

export function healthNodeTitle(nodeId: string): string {
  return HEALTH_NODE_TITLES[nodeId] ?? nodeId;
}

export function countHealthStatuses<T extends { status: HealthStatus }>(
  items: readonly T[]
): Record<HealthStatus, number> {
  const counts: Record<HealthStatus, number> = {
    ok: 0,
    warn: 0,
    critical: 0,
    unknown: 0,
    not_implemented: 0,
  };
  for (const item of items) {
    counts[item.status] += 1;
  }
  return counts;
}
