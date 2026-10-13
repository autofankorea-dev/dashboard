import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "vitest";
import {
  LIVE_LIST_MEMBERSHIP_INTERVAL,
  LIVE_LIST_MEMBERSHIP_MIN,
  RECV_CAUTION_MIN,
} from "@/lib/domain/live-status";

function migrationsDir(): string {
  const candidates = [
    join(process.cwd(), "supabase/migrations"),
    join(process.cwd(), "web/supabase/migrations"),
  ];
  for (const dir of candidates) {
    try {
      readdirSync(dir);
      return dir;
    } catch {
      // try the next root
    }
  }
  throw new Error("supabase/migrations not found");
}

const migrationName = readdirSync(migrationsDir()).find((name) =>
  name.endsWith("_live_list_keep_offline.sql"),
);
assert.ok(migrationName, "live_list_keep_offline migration missing");

const sql = readFileSync(join(migrationsDir(), migrationName!), "utf8");
const intervalSql = `interval '${LIVE_LIST_MEMBERSHIP_INTERVAL}'`;

assert.equal(LIVE_LIST_MEMBERSHIP_MIN, 14 * 24 * 60);
assert.ok(LIVE_LIST_MEMBERSHIP_MIN > RECV_CAUTION_MIN);
assert.equal(sql.split(intervalSql).length - 1, 4);
assert.equal(sql.includes("interval '2 hours'"), false);
assert.equal(sql.includes("02:00:00"), false);
assert.equal(sql.includes("security_invoker=true"), true);
assert.equal(sql.includes("alarm_low_temp_c"), true);
assert.equal(sql.includes("alarm_high_temp_c"), true);
assert.equal(sql.includes("v_iot_decoded_latest"), true);
assert.equal(sql.includes("d.decoded_json"), true);
assert.equal(
  /create\s+(or\s+replace\s+)?view\s+public\.v_iot_farm_overview/i.test(sql),
  false,
);

test("list membership window matches the migration", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
