import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";
import { AccountMenuHub } from "./account-menu-hub";

test("sheet header shows avatar, name, and logout only", () => {
  const html = renderToStaticMarkup(
    createElement(AccountMenuHub, {
      name: "김운영",
      avatarUrl: null,
      trailing: createElement("button", { type: "button" }, "로그아웃"),
    }),
  );

  assert.match(html, /id="account-menu-sheet-title"/);
  assert.match(html, /김운영/);
  assert.match(html, /로그아웃/);
  assert.doesNotMatch(html, /admin@test\.com/);
  assert.doesNotMatch(html, /관리자|운영자|뷰어|권한 없음/);
});

test("account menu does not pass email or role into the sheet header", () => {
  const source = readFileSync(new URL("./account-menu.tsx", import.meta.url), "utf8");
  assert.match(source, /<AccountMenuHub/);
  assert.doesNotMatch(source, /email=\{user\.email\}/);
  assert.doesNotMatch(source, /roleLabel=\{/);
  assert.match(source, /header\.logout/);
  assert.match(source, /RecentActivityMenuSection/);
  assert.match(source, /AccountMenuSplitBody/);
});
