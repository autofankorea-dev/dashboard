import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/** className / 문자열 리터럴 — 임의 duration·transition-all 금지 (motion L2) */
const motionRestrictedSyntax = [
  {
    selector:
      "Literal[value=/(?:^|[\\s\"'`])transition-all(?:$|[\\s\"'`])/]",
    message:
      "transition-all 금지 — motionClass.microInteractive / transitionOpacity / transitionLayout 등 속성 명시 프리셋 사용 (docs/UI_MOTION.md)",
  },
  {
    selector:
      "TemplateElement[value.raw=/(?:^|[\\s\"'`])transition-all(?:$|[\\s\"'`])/]",
    message:
      "transition-all 금지 — motionClass 프리셋 사용 (docs/UI_MOTION.md)",
  },
  {
    selector:
      "Literal[value=/(?:^|[\\s\"'`])duration-(?!motion-)\\d+(?:$|[\\s\"'`])/]",
    message:
      "임의 duration-N 금지 — duration-motion-fast|normal|moderate|emphasis|exit|view 사용 (docs/UI_MOTION.md)",
  },
  {
    selector:
      "TemplateElement[value.raw=/(?:^|[\\s\"'`])duration-(?!motion-)\\d+(?:$|[\\s\"'`])/]",
    message:
      "임의 duration-N 금지 — duration-motion-* 토큰 사용 (docs/UI_MOTION.md)",
  },
];

/** Tailwind sky/rose — channel-* / primary / status 토큰 사용 (T5) */
const colorRestrictedSyntax = [
  {
    selector:
      "Literal[value=/(?:^|[\\s\"'`:[])(?:bg|text|border|ring|stroke|fill|from|to|via|outline|decoration|accent|caret|divide|shadow)-?(?:sky|rose)-\\d/]",
    message:
      "sky-* / rose-* 금지 — channel-temp|hum|motor|info 또는 primary / status 토큰 사용 (docs/UI_MOTION.md T5)",
  },
  {
    selector:
      "TemplateElement[value.raw=/(?:^|[\\s\"'`:[])(?:bg|text|border|ring|stroke|fill|from|to|via|outline|decoration|accent|caret|divide|shadow)-?(?:sky|rose)-\\d/]",
    message:
      "sky-* / rose-* 금지 — channel-* / primary / status 토큰 사용 (docs/UI_MOTION.md T5)",
  },
];

/**
 * 레이어 경계 (docs/CODE_CONVENTIONS.md)
 * app → components → lib. lib는 components/app를 모른다.
 * lib/domain은 순수(React·Next·Supabase·server-only 금지). Supabase 접근은 lib/data·lib/auth·lib/supabase만.
 */
const layerBoundaries = [
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/*"],
              message:
                "lib → components 금지. 컴포넌트를 쓰는 hook/헬퍼는 components/<feature>/ 로 옮긴다 (docs/CODE_CONVENTIONS.md)",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/domain/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "lib/domain은 React 없음 — hook은 components/, cache는 lib/data" },
            { name: "react-dom", message: "lib/domain은 React 없음" },
            { name: "server-only", message: "lib/domain은 서버/클라 공용 — server-only는 lib/data" },
          ],
          patterns: [
            { group: ["next", "next/*"], message: "lib/domain은 Next 런타임 의존 금지" },
            {
              group: ["@/lib/supabase/*"],
              message: "Supabase 접근은 lib/data 에서만",
            },
            {
              group: ["@/lib/data/*"],
              allowTypeImports: true,
              message:
                "lib/domain → lib/data 값 import 금지 (타입만 허용 — iot.ts 타입 분리는 P2)",
            },
            { group: ["@/components/*", "@/app/*"], message: "lib/domain은 UI·라우팅을 모른다" },
          ],
        },
      ],
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/supabase/*"],
              message:
                "컴포넌트에서 Supabase 직접 호출 금지 — lib/data/browser/* (클라) 또는 server action/lib/data (서버) 사용",
            },
          ],
        },
      ],
    },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...layerBoundaries,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    ignores: [".next/**", "out/**", "build/**", "node_modules/**", "scripts/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...motionRestrictedSyntax,
        ...colorRestrictedSyntax,
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Capacitor Android project + generated bridge (not app source)
    "android/**",
    // 로컬 측정·스크래치 스크립트 (앱 소스 린트 대상 아님)
    "scripts/**",
  ]),
]);

export default eslintConfig;
