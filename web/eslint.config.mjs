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

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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
