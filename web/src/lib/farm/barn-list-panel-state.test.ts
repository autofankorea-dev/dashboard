import { test } from "vitest";
/**
 * 실행: npx vitest run src/lib/farm/barn-list-panel-state.test.ts
 */
import assert from "node:assert/strict";
import {
  closeBarnListSettingsForKey,
  isBarnListMobileSheetOpen,
  isBarnListMobileToolbarSheetMode,
  isBarnListSettingsExpanded,
  panelForBarnListKey,
  toggleBarnListSettings,
  type BarnListPanelSets,
} from "./barn-list-panel-state";

const empty: BarnListPanelSets = {
  settingsKeys: new Set(),
};

function withSettings(key: string): BarnListPanelSets {
  return { settingsKeys: new Set([key]) };
}

{
  const key = "c1";
  assert.equal(
    isBarnListSettingsExpanded(key, "controller", withSettings(key)),
    true,
    "카드별 설정이 열리면 설정 펼침",
  );
  assert.equal(
    isBarnListSettingsExpanded(key, "controller", empty),
    false,
    "컨트롤러 모드 · 카드 설정 없음 → 접힘",
  );
  assert.equal(
    isBarnListSettingsExpanded(key, "settings", empty),
    true,
    "설정 전역 모드 → 모든 카드 설정 펼침",
  );
}

{
  const key = "c1";
  const opened = toggleBarnListSettings(empty, key);
  assert.ok(opened.settingsKeys.has(key));
  const closed = toggleBarnListSettings(opened, key);
  assert.equal(closed.settingsKeys.has(key), false);
}

{
  const key = "c1";
  assert.equal(isBarnListMobileSheetOpen(key, withSettings(key)), true);
  assert.equal(isBarnListMobileSheetOpen(key, empty), false);
}

{
  const key = "c1";
  assert.equal(panelForBarnListKey(key, withSettings(key)), "settings");
  assert.equal(panelForBarnListKey(key, empty), "none");
}

{
  // 그래프 모드 은퇴 → 모바일 toolbar sheet는 설정에서만 활성
  assert.equal(isBarnListMobileToolbarSheetMode("settings", true, false), true);
  assert.equal(isBarnListMobileToolbarSheetMode("controller", true, false), false);
  assert.equal(isBarnListMobileToolbarSheetMode("settings", false, false), false);
  assert.equal(isBarnListMobileToolbarSheetMode("settings", true, true), false);
}

{
  const key = "c1";
  const closed = closeBarnListSettingsForKey(
    { settingsKeys: new Set([key, "other"]) },
    key,
  );
  assert.equal(closed.settingsKeys.has(key), false);
  assert.ok(closed.settingsKeys.has("other"));
}

console.log("barn-list-panel-state.test.ts: ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
