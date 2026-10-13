#!/usr/bin/env node
/**
 * UI color regression guards (T5)
 * - Tailwind sky-* / rose-* utilities 금지 → channel-* / primary / status
 * - 차트·상태 레거시 hex 금지 (allowlist 제외)
 *
 * Usage: node scripts/verify-ui-colors.mjs
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { dirname, join, relative } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(root, "src");

/** Tailwind channel 회귀 — sky/rose/violet/orange → channel|primary|status */
const BAN_LEGACY_HUE =
  /(?:^|[\s"'`:[])(?:bg|text|border|ring|stroke|fill|from|to|via|outline|decoration|accent|caret|divide|shadow)-?(?:sky|rose|violet|orange)-\d/;

/** 차트·브랜드 레거시 hex (소문자 정규화 후 비교) */
const BAN_HEX = [
  { hex: "#ef4444", hint: "use var(--channel-temp) / var(--status-danger) / TREND_CHART_COLORS" },
  { hex: "#0ea5e9", hint: "use var(--channel-hum) / TREND_CHART_COLORS.humidity" },
  { hex: "#10b981", hint: "use var(--primary) / var(--status-ok)" },
  { hex: "#22c55e", hint: "use var(--primary)" },
];

/**
 * hex 스캔 허용 — 보간·벤더 고정색 등
 * (경로: src 기준 posix)
 */
const HEX_ALLOWLIST = new Set([
  "components/login/oauth-buttons.tsx", // 카카오 브랜드 #FEE500
]);

/** 1-A: 허브 알람·뱃지·계정·농장전환은 status/well/channel 토큰만 */
const HUB_STATUS_TOKEN_FILES = [
  "lib/ui/dashboard-page-ui.ts",
  "lib/ui/account-menu-layout.ts",
  "components/common/status-badge.tsx",
  "components/account/account-menu-split.tsx",
  "components/account/account-menu-alarm-panel.tsx",
  "components/layout/farm-switcher.tsx",
  "components/layout/daily-report-button.tsx",
];
const BAN_HUB_STATUS_HUE =
  /(?:^|[\s"'`:[])(?:bg|text|border|ring|stroke|fill|from|to|via|outline|shadow)-?(?:red|amber|emerald|slate)-\d/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p, out);
    } else if (/\.(tsx?|jsx?)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

function stripLineComment(line) {
  const idx = line.indexOf("//");
  if (idx === -1) return line;
  if (/https?:\/\//.test(line.slice(0, idx + 8))) return line;
  return line.slice(0, idx);
}

const files = walk(srcRoot);
const errors = [];

for (const file of files) {
  const rel = relative(srcRoot, file).replace(/\\/g, "/");
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  const allowHex = HEX_ALLOWLIST.has(rel);

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (/^\s*\/\*\*?|^\s*\*|^\s*\*\//.test(raw) && /금지|forbid|legacy|allowlist/i.test(raw)) {
      continue;
    }
    const line = stripLineComment(raw);

    if (BAN_LEGACY_HUE.test(line)) {
      errors.push({
        file: relative(root, file),
        line: i + 1,
        kind: "legacy-hue-utility",
        text: raw.trim().slice(0, 120),
        hint: "use channel-temp|hum|motor|info or primary/status (docs/UI_MOTION.md); amber=warn only",
      });
    }

    if (HUB_STATUS_TOKEN_FILES.includes(rel) && BAN_HUB_STATUS_HUE.test(line)) {
      errors.push({
        file: relative(root, file),
        line: i + 1,
        kind: "hub-status-hue-utility",
        text: raw.trim().slice(0, 120),
        hint: "1-A: use --status-ok|warn|danger, --surface-well, or channel-info",
      });
    }

    if (!allowHex) {
      const lower = line.toLowerCase();
      for (const { hex, hint } of BAN_HEX) {
        if (lower.includes(hex)) {
          errors.push({
            file: relative(root, file),
            line: i + 1,
            kind: "legacy-hex",
            text: raw.trim().slice(0, 120),
            hint,
          });
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error("verify-ui-colors: FAILED\n");
  for (const e of errors) {
    console.error(`  ${e.file}:${e.line} [${e.kind}] ${e.text}`);
    console.error(`    → ${e.hint}`);
  }
  console.error(`\n${errors.length} issue(s). See docs/UI_MOTION.md (T5).`);
  process.exit(1);
}

const globalsCss = readFileSync(join(root, "src/app/globals.css"), "utf8");
const darkBlock = globalsCss.split(".dark {")[1] ?? "";
const darkNeedles = [
  ["--status-ok-on-canvas: var(--status-ok)", "dark on-canvas ok"],
  [
    "--status-warn-on-canvas: oklch(from var(--status-warn) 0.78 c h)",
    "dark on-canvas warn",
  ],
  [
    "--status-danger-on-canvas: oklch(from var(--status-danger) 0.82 c h)",
    "dark on-canvas danger",
  ],
  ["--status-offline:", "offline fill token"],
  ["--mix-lift:", "mix lift"],
  ["--heatmap-sev-faint: 0.34", "dark heatmap faint opacity"],
];
const missingDark = darkNeedles.filter(([needle]) => !darkBlock.includes(needle));
if (missingDark.length > 0) {
  console.error("verify-ui-colors: FAILED dark tokens\n");
  for (const [needle, hint] of missingDark) {
    console.error(`  globals.css .dark missing ${needle} (${hint})`);
  }
  process.exit(1);
}

/** 다크 상태색은 라이트 hex를 복제하지 않고 oklch로 명도만 재계산 */
const LIGHT_STATUS_HEX = ["#6f9e8a", "#f59e0b", "#e11d2a"];
const darkStatusTokens = ["--status-ok", "--status-warn", "--status-danger"].map((name) => {
  const m = darkBlock.match(new RegExp(`${name}:\\s*([^;]+)`));
  return { name, value: m?.[1]?.trim() ?? "" };
});
const badDarkStatus = darkStatusTokens.filter(({ value }) => {
  const lower = value.toLowerCase();
  return !value.startsWith("oklch(") || LIGHT_STATUS_HEX.some((hex) => lower.includes(hex));
});
if (badDarkStatus.length > 0) {
  console.error("verify-ui-colors: FAILED dark status tokens\n");
  for (const { name, value } of badDarkStatus) {
    console.error(`  .dark ${name}: ${value || "(missing)"}`);
    console.error("    → use oklch with light hue/chroma; do not copy light hex (docs/UI_CHROMA.md)");
  }
  process.exit(1);
}

const labelNeedles = [
  ["--tertiary-foreground:", "tertiary label"],
  ["--quaternary-foreground:", "quaternary label"],
  [
    "--color-tertiary-foreground: var(--tertiary-foreground)",
    "theme tertiary",
  ],
  [
    "--color-quaternary-foreground: var(--quaternary-foreground)",
    "theme quaternary",
  ],
];
const missingLabel = labelNeedles.filter(([needle]) => !globalsCss.includes(needle));
if (missingLabel.length > 0) {
  console.error("verify-ui-colors: FAILED label tokens\n");
  for (const [needle, hint] of missingLabel) {
    console.error(`  globals.css missing ${needle} (${hint})`);
  }
  process.exit(1);
}

const SECONDARY_MIX =
  "--secondary: color-mix(in oklch, var(--muted) 90%, var(--foreground))";
if (!globalsCss.includes(SECONDARY_MIX)) {
  console.error("verify-ui-colors: FAILED secondary fill\n");
  console.error(`  globals.css missing ${SECONDARY_MIX}`);
  console.error("    → --secondary is the gray control fill; do not copy --muted (docs/UI_SURFACES.md)");
  process.exit(1);
}
if (/--secondary:\s*oklch\(/.test(darkBlock)) {
  console.error("verify-ui-colors: FAILED secondary fill\n");
  console.error("  .dark overrides --secondary with oklch; inherit the :root muted+foreground mix");
  process.exit(1);
}

if (!globalsCss.includes("--destructive: var(--status-danger)")) {
  console.error("verify-ui-colors: FAILED systemRed alias\n");
  console.error("  globals.css missing --destructive: var(--status-danger)");
  console.error("    → form/delete red must equal status-danger (docs/UI_SURFACES.md)");
  process.exit(1);
}
if (/--destructive:\s*oklch\(/.test(darkBlock)) {
  console.error("verify-ui-colors: FAILED systemRed alias\n");
  console.error("  .dark overrides --destructive with oklch; inherit var(--status-danger)");
  process.exit(1);
}

const CONTROL_IDLE =
  "--control: color-mix(in oklch, var(--primary) 12%, var(--secondary))";
const CONTROL_ACTIVE =
  "--control-active: color-mix(in oklch, var(--primary) 22%, var(--secondary))";
if (!globalsCss.includes(CONTROL_IDLE) || !globalsCss.includes(CONTROL_ACTIVE)) {
  console.error("verify-ui-colors: FAILED control fill\n");
  console.error(`  globals.css missing ${CONTROL_IDLE} or ${CONTROL_ACTIVE}`);
  console.error("    → idle tools use tinted --control, not well/card (docs/UI_AFFORDANCE.md)");
  process.exit(1);
}
if (!globalsCss.includes("--color-control: var(--control)")) {
  console.error("verify-ui-colors: FAILED control fill\n");
  console.error("  theme missing --color-control: var(--control)");
  process.exit(1);
}
if (/--control(?:-active|-foreground|-border)?:\s*oklch\(/.test(darkBlock)) {
  console.error("verify-ui-colors: FAILED control fill\n");
  console.error("  .dark overrides --control* with oklch; inherit the :root primary+secondary mix");
  process.exit(1);
}

console.log(
  `verify-ui-colors: ok (${files.length} files; sky/rose/violet/orange + legacy hex + dark tokens + status oklch + label 3/4 + secondary≠muted + destructive=status-danger + control tinted)`,
);
