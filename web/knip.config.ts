import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: [
    "src/app/**/*.{ts,tsx}",
    "src/**/*.test.ts",
    "scripts/*.{mjs,ts}",
  ],
  project: ["src/**/*.{ts,tsx}"],
  ignore: [
    "src/components/ui/**",
    "src/lib/farm/build-farm-unified-trend-raw.ts",
    // 디자인 헬퍼 — 토큰 소비 예정, 현재 미import (docs/UI_MOTION.md · UI_DENSITY.md)
    "src/lib/ui/layout-breakpoints.ts",
    "src/lib/ui/motion-preset.ts",
    "src/lib/ui/use-container-compact.ts",
    "src/lib/ui/use-scroll-active-tab.ts",
    // 필드 적용 진행은 채널 스트립으로 대체. 도크 UI는 보관만.
    "src/components/farm/apply-queue-dock.tsx",
    // 알람 폼은 alarm-threshold-form 사용. 숫자 필드 그룹은 보관만.
    "src/components/settings/alarm-threshold-fields.tsx",
  ],
  ignoreExportsUsedInFile: true,
  ignoreDependencies: [
    "shadcn",
    "tw-animate-css",
    "tailwindcss",
    // webpack/브라우저 Buffer 폴리필 (src/lib/supabase/browser.ts)
    "buffer",
  ],
};

export default config;
