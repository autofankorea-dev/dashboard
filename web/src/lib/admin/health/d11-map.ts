import type { D11Hint, HealthPoint, ModuleHealthRow } from "@/lib/admin/health/types";

const D11_CATALOG: Record<string, { title: string; summary: string }> = {
  S1: {
    title: "측정이 안 옴",
    summary: "다른 농장에 새 데이터가 오는지 확인 → R2 vs R3 분기",
  },
  S2: {
    title: "화면에 안 보임",
    summary: "live View·ctrl 상한·decode 오류 확인 (R4)",
  },
  S3: {
    title: "오래된 값만 보임",
    summary: "마지막 측정 시각·모듈 주기(D9) 확인",
  },
  S4: {
    title: "명령이 안 먹음",
    summary: "uplink 정상 후 명령 대기열 pending/sent 확인",
  },
  S5: {
    title: "일부만 끊김",
    summary: "단일 모듈·장비만 이상 — R1/R2 drill-down",
  },
  "S6-A": {
    title: "외부 FTP 미구현",
    summary: "snapshot·View까지 정상이면 전송 단계 미지원 (D10)",
  },
  "S6-B": {
    title: "외부 snapshot/View",
    summary: "연계 스냅샷·View 행·freshness 점검",
  },
  S7: {
    title: "로그인·권한",
    summary: "역할·농장 허용(user_access) 확인",
  },
};

export const HEALTH_SCOPE_LABEL: Record<string, string> = {
  R1: "이 모듈 일부 장비",
  R2: "이 농장만",
  R3: "여러 농장",
};

function humanizeHealthCopy(text: string): string {
  return text
    .replace(/R1\/R2/g, "모듈 또는 농장")
    .replace(/R2 vs R3/g, "이 농장만인지 여러 농장인지")
    .replace(/\bR1\b/g, "이 모듈 일부")
    .replace(/\bR2\b/g, "이 농장")
    .replace(/\bR3\b/g, "여러 농장")
    .replace(/drill-down/gi, "확인")
    .replace(/모듈 주기\(D9\)/g, "모듈 주기")
    .replace(/\s*\((?:R4|D10)\)/g, "")
    .trim();
}

export const HEALTH_ERROR_TYPES = [
  "Receive down",
  "Partial outage",
  "Stale",
  "Display / storage",
  "Command",
] as const;

export type HealthErrorType = (typeof HEALTH_ERROR_TYPES)[number];

export type HealthErrorAction = {
  type: HealthErrorType;
  action: string;
  codeTitle: string;
};

const CORE_ACTION: Record<HealthErrorType, string> = {
  "Receive down": "Check collector and MQTT first",
  "Partial outage": "Check that farm module and power only",
  Stale: "Check last seen and interval only",
  "Display / storage": "Connection → decode → LIVE cap",
  Command: "Check pending, sent, and failures only",
};

const PIPELINE_RECEIVE_NODES = new Set([
  "collector",
  "collector-rs",
  "collector-mqtt",
]);

/** 다섯 타입 + 핵심조치. S6·S7은 패널 에러가 아님. */
export function classifyHealthError(
  hint: string,
  scope?: string | null,
  nodeId?: string | null,
): HealthErrorAction | null {
  if (!hint || hint === "—") return null;
  if (hint === "S6-A" || hint === "S6-B" || hint === "S7") return null;

  let type: HealthErrorType | null = null;
  if (hint === "S4") type = "Command";
  else if (hint === "S2") type = "Display / storage";
  else if (hint === "S3") type = "Stale";
  else if (hint === "S5") type = "Partial outage";
  else if (hint === "S1") {
    type =
      (nodeId && PIPELINE_RECEIVE_NODES.has(nodeId)) || scope === "R3"
        ? "Receive down"
        : "Partial outage";
  }
  if (!type) return null;

  const codes = [hint, scope && scope !== "—" ? scope : null].filter(Boolean);
  return { type, action: CORE_ACTION[type], codeTitle: codes.join(" · ") };
}

/** 증상 → 범위 → 다음 확인. 코드(S1/R2)는 줄이지 않고 경로로 푼다. */
export function buildModuleActionPath(
  hint: string,
  scope: string,
): { steps: string[]; codeTitle: string } | null {
  if (!hint || hint === "—") return null;
  const meta = D11_CATALOG[hint];
  const symptom = meta?.title ?? hint;
  const scopeStep = HEALTH_SCOPE_LABEL[scope] ?? null;
  const follow = (meta?.summary ?? "")
    .split(/→|—/)
    .map((part) => humanizeHealthCopy(part.trim()))
    .filter(Boolean);
  const steps = [symptom, scopeStep, ...follow].filter(
    (step, i, all): step is string =>
      Boolean(step) && all.indexOf(step) === i,
  );
  const codes = [hint, scope !== "—" ? scope : null].filter(Boolean);
  return { steps, codeTitle: codes.join(" · ") };
}

export function d11HintFromId(id: string): D11Hint {
  const meta = D11_CATALOG[id] ?? { title: id, summary: "목록에 없는 점검 항목" };
  return { id, title: meta.title, summary: meta.summary };
}

function collectD11Hints(ids: Iterable<string>): D11Hint[] {
  const seen = new Set<string>();
  const out: D11Hint[] = [];
  for (const id of ids) {
    if (!id || id === "—" || seen.has(id)) continue;
    seen.add(id);
    out.push(d11HintFromId(id));
  }
  return out;
}

export function hintsFromPoints(points: HealthPoint[]): D11Hint[] {
  return collectD11Hints(
    points.map((p) => p.d11Hint).filter((h): h is string => Boolean(h))
  );
}

export function hintsFromModules(modules: ModuleHealthRow[]): D11Hint[] {
  return collectD11Hints(modules.map((m) => m.d11Hint).filter((h) => h !== "—"));
}

export function d11HintForInsertRate(recentZero: boolean): string | undefined {
  return recentZero ? "S1" : undefined;
}

export function d11HintForLiveCap(liveCount: number, limit: number): string | undefined {
  const moduleEstimate = Math.ceil(liveCount / 50);
  if (moduleEstimate > limit / 50) return "S2";
  return undefined;
}

export function scopeFromModules(modules: ModuleHealthRow[]): string | null {
  const bad = modules.filter((m) => m.status === "critical" || m.status === "warn");
  if (bad.length === 0) return null;
  const farms = new Set(bad.map((m) => m.farmId));
  if (bad.length === 1 && farms.size === 1) return "R2";
  if (farms.size === 1) return "R2";
  if (bad.length >= modules.length * 0.5) return "R3";
  return "R2";
}
