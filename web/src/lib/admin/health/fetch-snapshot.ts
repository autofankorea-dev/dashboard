import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { insertRateStatus, statusFromInsertRate } from "@/lib/admin/health/insert-rate-status";
import { createAdminClient, readServiceRoleKey, type OpsDbClient } from "@/lib/supabase/admin";
import { createOpsReadClient } from "@/lib/supabase/ops-client";
import {
  DECODE_LAG_CRITICAL,
  DECODE_LAG_WARN,
  GLOBAL_LIVE_ROW_LIMIT,
  INSERT_BUCKET_COUNT,
  INSERT_BUCKET_MINUTES,
  HEALTH_REVALIDATE_SEC,
} from "@/lib/admin/health/constants";
import {
  d11HintForInsertRate,
  d11HintForLiveCap,
  hintsFromModules,
  scopeFromModules,
} from "@/lib/admin/health/d11-map";
import {
  aggregateControllers,
  aggregateModulesFromLive,
  mapDecodedLatestDbRowsToLiveHealth,
  rollupFieldStatus,
  type DbDecodedLatestRow,
} from "@/lib/admin/health/aggregate-controllers";
import {
  aggregateCollectorGroups,
} from "@/lib/admin/health/aggregate-collector-groups";
import {
  resolveCollectorGroups,
} from "@/lib/admin/health/collector-groups";
import { fetchCommandHealth } from "@/lib/admin/health/fetch-command-health";
import {
  fetchInstanceHealth,
  summarizeInstanceHealth,
  type InstanceHealthSummary,
} from "@/lib/admin/health/fetch-instance-health";
import { collectorNodeHint } from "@/lib/admin/health/instance-health-map";
import {
  buildHealthAlerts,
} from "@/lib/admin/health/health-events";
import {
  fetchEkapeHealth,
  ftpPoints,
  mqttPoints,
} from "@/lib/admin/health/fetch-ekape-health";
import { formatHealthTime } from "@/lib/admin/health/format-health-time";
import { adminOpsHealthHref } from "@/lib/admin/health/health-routes";
import { worstStatus } from "@/lib/admin/health/staleness";
import type {
  CollectorNodeState,
  CommandFailureItem,
  CommandTimelineItem,
  ControllerHealthRow,
  D11Hint,
  HealthPoint,
  HealthSnapshot,
  HealthStatus,
  InsertBucket,
  ModuleHealthRow,
  PipelineNodeState,
} from "@/lib/admin/health/types";

/** COL rollup: uplink only (MQTT → RS). C·Ekape·FTP는 별도 노드. */
const COLLECTOR_ROLLUP_IDS = new Set([
  "collector-mqtt",
  "collector-rs",
]);

function formatBucketLabel(iso: string): string {
  return formatHealthTime(iso);
}

async function countRawBetween(
  admin: ReturnType<typeof createAdminClient>,
  startIso: string,
  endIso: string
): Promise<number> {
  const { count, error } = await admin
    .from("iot_room_state_raw")
    .select("id", { count: "exact", head: true })
    .gte("received_at", startIso)
    .lt("received_at", endIso);

  if (error) return 0;
  return count ?? 0;
}

async function fetchInsertBuckets(
  admin: ReturnType<typeof createAdminClient>,
  nowMs: number
): Promise<InsertBucket[]> {
  const bucketDefs = Array.from({ length: INSERT_BUCKET_COUNT }, (_, idx) => {
    const i = INSERT_BUCKET_COUNT - 1 - idx;
    const endMs = nowMs - i * INSERT_BUCKET_MINUTES * 60 * 1000;
    const startMs = endMs - INSERT_BUCKET_MINUTES * 60 * 1000;
    return {
      startIso: new Date(startMs).toISOString(),
      endIso: new Date(endMs).toISOString(),
      label: formatBucketLabel(new Date(startMs).toISOString()),
    };
  });

  const counts = await Promise.all(
    bucketDefs.map((def) =>
      countRawBetween(admin, def.startIso, def.endIso)
    )
  );

  return bucketDefs.map((def, idx) => ({
    label: def.label,
    count: counts[idx] ?? 0,
  }));
}

function fieldModulePoints(modules: ModuleHealthRow[]): HealthPoint[] {
  if (modules.length === 0) {
    return [
      {
        id: "mod.uplink.activity",
        label: "모듈 uplink",
        value: "데이터 없음",
        status: "unknown",
        d11Hint: "S1",
      },
    ];
  }

  const worst = worstStatus(modules.map((m) => m.status));
  const lowCoverage = modules.filter(
    (m) => (m.coveragePct ?? 100) < 80
  ).length;

  return [
    {
      id: "mod.uplink.activity",
      label: "모듈 uplink (worst)",
      value: `${modules.length} modules · worst ${worst}`,
      status: worst,
      d11Hint: worst === "critical" ? "S1" : worst === "warn" ? "S3" : undefined,
    },
    {
      id: "mod.device.coverage",
      label: "coverage < 80%",
      value: `${lowCoverage} / ${modules.length} modules`,
      status: lowCoverage > 0 ? "warn" : "ok",
      d11Hint: lowCoverage > 0 ? "S5" : undefined,
    },
    {
      id: "mod.staleness.worst",
      label: "worst last seen",
      value: `${modules[0]?.ageMin?.toFixed(1) ?? "—"} min`,
      status: modules[0]?.status ?? "unknown",
    },
  ];
}

function fieldControllerPoints(controllers: ControllerHealthRow[]): HealthPoint[] {
  if (controllers.length === 0) {
    return [
      {
        id: "ctrl.raw.latest",
        label: "장비 last seen",
        value: "데이터 없음",
        status: "unknown",
        d11Hint: "S1",
      },
    ];
  }

  const worst = worstStatus(controllers.map((c) => c.status));
  const criticalCount = controllers.filter((c) => c.status === "critical").length;

  return [
    {
      id: "ctrl.raw.latest",
      label: "장비 last seen (worst)",
      value: `${controllers.length} ctrl · ${criticalCount} critical`,
      status: worst,
      d11Hint:
        criticalCount === 1
          ? "S5"
          : worst === "critical"
            ? "S1"
            : worst === "warn"
              ? "S3"
              : undefined,
    },
    {
      id: "ctrl.decode.live",
      label: "Edge decode (LIVE)",
      value: "v_iot_decoded_latest",
      status: worst === "critical" ? "warn" : "ok",
    },
    {
      id: "ctrl.identity",
      label: "D3 키 필드",
      value: "lsind·item·module·controller_key",
      status: "ok",
    },
  ];
}

function rsPoints(buckets: InsertBucket[]): HealthPoint[] {
  const recent = buckets.slice(-2);
  const rateStatus = insertRateStatus(buckets);
  return [
    {
      id: "rs.raw.insert_rate",
      label: "원본 INSERT rate (5m)",
      value: `${recent[recent.length - 1]?.count ?? 0} rows / 5m`,
      status: rateStatus,
      d11Hint: d11HintForInsertRate(recent.every((b) => b.count === 0)),
    },
    {
      id: "rs.raw.latency",
      label: "received_at skew",
      value: "패시브 추정",
      status: rateStatus === "ok" ? "ok" : "warn",
    },
    {
      id: "rs.topic.integrity",
      label: "topic·농장키 null",
      value: "—",
      status: "unknown",
    },
  ];
}

function decodeLagStatus(lag: number, failedCount: number): HealthStatus {
  if (failedCount > 0) return "warn";
  if (lag >= DECODE_LAG_CRITICAL) return "critical";
  if (lag >= DECODE_LAG_WARN) return "warn";
  return "ok";
}

type DecodeHealthMetrics = {
  lag: number;
  failedCount: number;
  cursorUpdatedAt: string | null;
};

async function fetchDecodeMetrics(
  admin: ReturnType<typeof createAdminClient>,
): Promise<DecodeHealthMetrics> {
  const [cursorRes, maxRawRes, failedRes] = await Promise.all([
    admin
      .from("iot_decode_cursor")
      .select("last_raw_id, updated_at")
      .eq("id", 1)
      .maybeSingle(),
    admin
      .from("iot_room_state_raw")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("iot_room_state_decode_failed")
      .select("id", { count: "exact", head: true }),
  ]);

  const lastRawId = cursorRes.data?.last_raw_id ?? 0;
  const maxRawId = maxRawRes.data?.id ?? lastRawId;

  return {
    lag: Math.max(0, maxRawId - lastRawId),
    failedCount: failedRes.count ?? 0,
    cursorUpdatedAt: cursorRes.data?.updated_at ?? null,
  };
}

function storagePoints(
  dbOk: boolean,
  decode: DecodeHealthMetrics,
): HealthPoint[] {
  const lagStatus = decodeLagStatus(decode.lag, decode.failedCount);

  return [
    {
      id: "db.connectivity",
      label: "DB 연결",
      value: dbOk ? "success" : "fail",
      status: dbOk ? "ok" : "critical",
      d11Hint: dbOk ? undefined : "S2",
    },
    {
      id: "db.views.decoded_latest",
      label: "v_iot_decoded_latest",
      value: dbOk ? "accessible" : "—",
      status: dbOk ? "ok" : "critical",
    },
    {
      id: "db.decode.lag",
      label: "decode backlog (raw id)",
      value: `${decode.lag} rows`,
      status: lagStatus,
      d11Hint: lagStatus !== "ok" ? "S2" : undefined,
    },
    {
      id: "db.decode.failed",
      label: "decode failed queue",
      value: String(decode.failedCount),
      status: decode.failedCount > 0 ? "warn" : "ok",
      d11Hint: decode.failedCount > 0 ? "S2" : undefined,
    },
  ];
}

function dashboardPoints(liveCount: number, dbOk: boolean): HealthPoint[] {
  const capHint = d11HintForLiveCap(liveCount, GLOBAL_LIVE_ROW_LIMIT);
  const capStatus: HealthStatus =
    liveCount >= GLOBAL_LIVE_ROW_LIMIT * 0.9
      ? "warn"
      : dbOk
        ? "ok"
        : "critical";

  return [
    {
      id: "ui.live.query",
      label: "live snapshot 조회",
      value: dbOk ? "ok" : "fail",
      status: dbOk ? "ok" : "critical",
      d11Hint: dbOk ? undefined : "S2",
    },
    {
      id: "ui.global.limit",
      label: "전역 ctrl 상한",
      value: `${liveCount} / ${GLOBAL_LIVE_ROW_LIMIT} ctrl`,
      status: capStatus,
      d11Hint: capHint,
    },
  ];
}

function dedupeHints(hints: D11Hint[]): D11Hint[] {
  const seen = new Set<string>();
  return hints.filter((h) => {
    if (seen.has(h.id)) return false;
    seen.add(h.id);
    return true;
  });
}

export const HEALTH_SNAPSHOT_CACHE_TAG = "health-snapshot";

/** 캐시 우회 — Ops soft refresh / 주기 패치용 */
export async function computeHealthSnapshot(options?: {
  admin?: OpsDbClient;
  /** service_role만 iot_room_state_raw를 읽는다. 관리자 세션은 RLS로 0건이 된다. */
  canReadRaw?: boolean;
}): Promise<HealthSnapshot> {
  const nowMs = Date.now();
  const fetchedAt = new Date(nowMs).toISOString();

  let dbOk = false;
  let liveRowCount = 0;
  let decodeMetrics: DecodeHealthMetrics = {
    lag: 0,
    failedCount: 0,
    cursorUpdatedAt: null,
  };
  let insertBuckets: InsertBucket[] = [];
  let modules: ModuleHealthRow[] = [];
  let controllers: ControllerHealthRow[] = [];
  let commandHealth = {
    status: "unknown" as HealthStatus,
    points: [] as HealthPoint[],
    activeFailures: [] as CommandFailureItem[],
    checkpointCount: 0,
    timeline: [] as CommandTimelineItem[],
  };
  let instanceHealth: InstanceHealthSummary = summarizeInstanceHealth(null, nowMs);
  const ekapeHealth = await fetchEkapeHealth();

  const canReadRaw = options?.canReadRaw ?? true;

  try {
    const admin = options?.admin ?? createAdminClient();

    const [buckets, liveCountRes, liveRowsRes, decodeRes, cmdHealth, instanceRes] =
      await Promise.all([
      canReadRaw ? fetchInsertBuckets(admin, nowMs) : Promise.resolve([]),
      admin
        .from("v_iot_decoded_latest")
        .select("controller_key", { count: "exact", head: true }),
      admin
        .from("v_iot_dashboard_list")
        .select(
          "lsind_regist_no, item_code, module_uid, controller_key, packet_mode, received_at",
        )
        .order("received_at", { ascending: false })
        .limit(GLOBAL_LIVE_ROW_LIMIT),
      canReadRaw
        ? fetchDecodeMetrics(admin)
        : Promise.resolve({
            lag: 0,
            failedCount: 0,
            cursorUpdatedAt: null,
          }),
      fetchCommandHealth(nowMs, admin),
      fetchInstanceHealth(admin, nowMs),
    ]);

    insertBuckets = buckets;
    decodeMetrics = decodeRes;
    dbOk = !liveCountRes.error && !liveRowsRes.error;
    liveRowCount = liveCountRes.count ?? 0;
    commandHealth = cmdHealth;
    instanceHealth = instanceRes;

    if (liveRowsRes.data) {
      const liveRows = mapDecodedLatestDbRowsToLiveHealth(
        liveRowsRes.data as DbDecodedLatestRow[],
      );
      modules = aggregateModulesFromLive(liveRows, nowMs);
      controllers = aggregateControllers(liveRows, nowMs);
    }
  } catch {
    dbOk = false;
  }

  const rsStatus = insertRateStatus(insertBuckets);

  const groupDefs = resolveCollectorGroups(modules);
  // B2 — 그룹별 raw count(그룹×버킷)는 스냅샷 경로에서 생략.
  // 그룹 상태는 모듈 rollup으로 유지, insertBuckets는 비움(rsStatus=unknown).
  const groupBuckets = new Map<string, InsertBucket[]>();
  const collectorGroups = aggregateCollectorGroups(
    groupDefs,
    modules,
    groupBuckets
  );

  const mqttStatus = statusFromInsertRate(rsStatus);
  const rawFlowBad = rsStatus === "warn" || rsStatus === "critical";

  // instance_health_current(rsd-healthcheck)가 신선하면 수집단 노드 색을
  // 서버가 직접 보고한 per-service 상태로 확정하고, 지연/미적재 시 기존 추정으로 폴백.
  const useInstance = instanceHealth.trustPerService;
  const mqttNodeStatus = useInstance ? instanceHealth.mqttStatus : mqttStatus;
  const rsNodeStatus = useInstance ? instanceHealth.rsStatus : rsStatus;
  const cNodeStatus = useInstance ? instanceHealth.cStatus : commandHealth.status;

  const fieldStatus = rollupFieldStatus(modules, controllers);

  const storageStatus = worstStatus([
    dbOk ? "ok" : "critical",
    decodeLagStatus(decodeMetrics.lag, decodeMetrics.failedCount),
  ]);
  const dashboardStatus = worstStatus([
    dbOk ? "ok" : "critical",
    liveRowCount >= GLOBAL_LIVE_ROW_LIMIT * 0.9 ? "warn" : "ok",
  ]);

  // 노드 힌트: 인스턴스 실측을 신뢰하면 서버가 실제 장애(critical/명령 warn)일 때만
  // 수집/명령 힌트를 붙인다. 서버 정상 + 장비 두절(rsStatus 데이터흐름 나쁨) 상황에서
  // 초록 노드에 "수집/MQTT 점검" 오안내가 붙는 것을 막는다. 자원 warn은 드릴다운 포인트(S2)만.
  const mqttHints = collectorNodeHint(useInstance, mqttNodeStatus, rawFlowBad, "S1");
  const rsHints = collectorNodeHint(useInstance, rsNodeStatus, rawFlowBad, "S1");
  const cHints = collectorNodeHint(
    useInstance,
    cNodeStatus,
    commandHealth.status !== "ok",
    "S4",
    { warnCounts: true },
  );

  const collectorSub: CollectorNodeState[] = [
    {
      id: "collector-mqtt",
      label: "Mosquitto",
      short: "MQTT",
      status: mqttNodeStatus,
      d11Hints: mqttHints,
    },
    {
      id: "collector-rs",
      label: "RS 수신",
      short: "RS",
      status: rsNodeStatus,
      d11Hints: rsHints,
    },
    {
      id: "collector-c",
      label: "C 명령",
      short: "C",
      status: cNodeStatus,
      d11Hints: cHints,
    },
    {
      id: "collector-ekape",
      label: "Ekape job",
      short: "EK",
      status: "not_implemented",
      d11Hints: [],
    },
    {
      id: "collector-ftp",
      label: "FTP Worker",
      short: "FTP",
      status: "not_implemented",
      d11Hints: [],
    },
  ];

  const collectorRollup = worstStatus(
    collectorSub
      .filter((n) => COLLECTOR_ROLLUP_IDS.has(n.id))
      .map((n) => n.status)
  );

  const pipeline: PipelineNodeState[] = [
    {
      id: "field-controller",
      label: "환경 컨트롤러",
      short: "CTRL",
      status: fieldStatus,
      d11Hints: fieldStatus !== "ok" ? ["S3", "S5"] : [],
      href: adminOpsHealthHref({ node: "field-controller" }),
    },
    {
      id: "field-module",
      label: "통신 모듈",
      short: "MOD",
      status: fieldStatus,
      d11Hints: fieldStatus === "critical" ? ["S1"] : ["S5"],
      href: adminOpsHealthHref({ node: "field-module" }),
    },
    {
      id: "collector",
      label: "수집 서버",
      short: "COL",
      status: collectorRollup,
      d11Hints: collectorRollup !== "ok" ? ["S1"] : [],
      href: adminOpsHealthHref({ node: "collector" }),
    },
    {
      id: "storage",
      label: "데이터 저장소",
      short: "DB",
      status: storageStatus,
      d11Hints: storageStatus !== "ok" ? ["S2"] : [],
      href: adminOpsHealthHref({ node: "storage" }),
    },
    {
      id: "dashboard",
      label: "관리 화면",
      short: "UI",
      status: dashboardStatus,
      d11Hints: dashboardStatus !== "ok" ? ["S2"] : [],
      href: adminOpsHealthHref({ node: "dashboard" }),
    },
    {
      id: "external",
      label: "외부 연계",
      short: "EXT",
      status: "not_implemented",
      d11Hints: [],
      href: adminOpsHealthHref({ node: "external" }),
    },
  ];

  const statusCounts: Record<HealthStatus, number> = {
    ok: 0,
    warn: 0,
    critical: 0,
    unknown: 0,
    not_implemented: 0,
  };
  for (const n of pipeline) {
    statusCounts[n.status] += 1;
  }
  statusCounts.not_implemented += 1;

  const d11Hints = hintsFromModules(modules);
  if (rawFlowBad) {
    d11Hints.unshift({
      id: "S1",
      title: "측정이 안 옴",
      summary: "다른 농장에 새 데이터가 오는지 확인 → R2 vs R3 분기",
    });
  }
  if (dashboardStatus === "warn") {
    d11Hints.push({
      id: "S2",
      title: "화면에 안 보임",
      summary:
        "v_iot_decoded_latest·ctrl 상한(1500)·decode backlog(lag) 확인 (R4)",
    });
  }
  if (decodeMetrics.lag >= DECODE_LAG_WARN || decodeMetrics.failedCount > 0) {
    d11Hints.push({
      id: "S2",
      title: "decode 지연",
      summary: `raw backlog ${decodeMetrics.lag} rows · failed ${decodeMetrics.failedCount} — Edge decode-batch·cursor 확인`,
    });
  }

  if (
    commandHealth.activeFailures.length > 0 &&
    commandHealth.status !== "ok" &&
    commandHealth.status !== "unknown"
  ) {
    d11Hints.push({
      id: "S4",
      title: "명령이 안 먹음",
      summary: "uplink 정상 후 명령 대기열 pending/sent 확인 · 체크포인트로 검토 완료 표시 가능",
    });
  }
  if (instanceHealth.row && !useInstance) {
    d11Hints.push({
      id: "S2",
      title: "인스턴스 헬스 지연",
      summary:
        "rsd-healthcheck 보고(checked_at)가 오래됨 — 수집단 상태는 추정으로 폴백 · updater/timer 확인",
    });
  }
  const impactScope = scopeFromModules(modules);

  const snapshotBody = {
    fetchedAt,
    insertBuckets,
    liveRowCount,
    liveRowLimit: GLOBAL_LIVE_ROW_LIMIT,
    dbOk,
    modules,
    controllers,
    collectorGroups,
    pipeline,
    collectorSub,
    statusCounts,
    d11Hints: dedupeHints(d11Hints),
    impactScope,
    commandFailures: commandHealth.activeFailures,
    commandCheckpointCount: commandHealth.checkpointCount,
    commandTimeline: commandHealth.timeline,
    pointsByNode: {
      "field-controller": fieldControllerPoints(controllers),
      "field-module": fieldModulePoints(modules),
      "collector-mqtt": useInstance ? instanceHealth.points.mqtt : mqttPoints(rsStatus),
      "collector-rs": useInstance ? instanceHealth.points.rs : rsPoints(insertBuckets),
      "collector-c": useInstance
        ? [...instanceHealth.points.c, ...commandHealth.points]
        : commandHealth.points,
      "collector-ekape": ekapeHealth.points,
      "collector-ftp": ftpPoints(),
      external: ekapeHealth.externalPoints,
      storage: storagePoints(dbOk, decodeMetrics),
      dashboard: dashboardPoints(liveRowCount, dbOk),
    },
  };

  return {
    ...snapshotBody,
    activeAlerts: buildHealthAlerts({
      ...snapshotBody,
      activeAlerts: [],
    }),
  };
}

export const fetchHealthSnapshot = cache(async (): Promise<HealthSnapshot> => {
  if (!readServiceRoleKey()) {
    const admin = await createOpsReadClient();
    return computeHealthSnapshot({ admin, canReadRaw: false });
  }
  return unstable_cache(
    computeHealthSnapshot,
    ["health-snapshot-v2-lean-buckets"],
    {
      revalidate: HEALTH_REVALIDATE_SEC,
      tags: [HEALTH_SNAPSHOT_CACHE_TAG],
    },
  )();
});
