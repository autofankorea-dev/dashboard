/**
 * 실행: npx tsx src/lib/onboarding/tour-steps.test.ts
 */
import assert from "node:assert/strict";
import { getTourStepsForScope } from "./tour-steps";

{
  const overview = getTourStepsForScope("chart").find((s) => s.id === "c-overview");
  assert.equal(overview?.selector, '[data-tour-id="farm-chart-view"]');
  assert.match(overview?.title ?? "", /차트/);
  assert.doesNotMatch(overview?.title ?? "", /비교/);
  assert.match(overview?.body ?? "", /축사유형/);
  assert.match(overview?.body ?? "", /컨트롤러/);
  assert.match(overview?.body ?? "", /비교 선택/);
  assert.doesNotMatch(overview?.body ?? "", /컨트롤러 그래프가 겹쳐/);
  const graph = getTourStepsForScope("field").find((s) => s.id === "f-graph");
  assert.match(graph?.mobileBody ?? "", /펼쳐/);
  assert.doesNotMatch(graph?.mobileBody ?? "", /비교/);
  const layers = getTourStepsForScope("chart").find((s) => s.id === "c-layers");
  assert.match(layers?.body ?? "", /펼쳐진 카드/);
  const control = getTourStepsForScope("chart").find((s) => s.id === "c-control");
  assert.match(control?.body ?? "", /알람 아이콘/);
  const brush = getTourStepsForScope("chart").find((s) => s.id === "c-brush");
  assert.equal(brush?.selector, '[data-tour-id="farm-chart-unified-trend"]');
  assert.match(brush?.body ?? "", /24시간/);
  assert.match(brush?.body ?? "", /30일/);
  const delin = getTourStepsForScope("field").find((s) => s.id === "f-delin");
  assert.match(delin?.body ?? "", /일령별 권장/);
  assert.doesNotMatch(delin?.body ?? "", /물을 수/);
  assert.equal(
    getTourStepsForScope("chart").some((s) => s.id === "c-delin"),
    false,
  );
  console.log("tour-steps.test.ts: ok");
}
