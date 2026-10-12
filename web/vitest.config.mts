import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * 유닛 테스트. `node:assert` 파일은 모듈을 불러올 때 단언이 실행되고,
 * 파일 끝의 `test("module asserts")`가 그 스위트를 등록한다.
 * `describe`/`it` 파일은 vitest에서 바로 가져온다.
 * 커버리지는 `npm run test:coverage` (v8). CI의 `npm test`는 리포트 없이 실행만 한다.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "supabase/functions/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.ts"],
    },
  },
});
