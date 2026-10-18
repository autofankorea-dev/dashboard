import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  decodeErrorPacketFromDb,
  decodeV0cPayloadOutcomeFromDb,
  fanPctFromChannels,
  fanPctFromChannelSlot,
  parseOptionalPct,
  primaryTempC,
  toSlimDecodedJson,
  channelAThermo,
  applyReceivedAtClock,
  clockModeForFarm,
} from "./wire-decode-v0c.ts";
import {
  shouldWriteSparse,
  sparseAppliesToFarm,
  type SparseLast,
} from "./sparse-gate.ts";

type RawRow = {
  id: number;
  lsind_regist_no: string;
  item_code: string;
  module_uid: number;
  topic: string | null;
  payload_bytea: unknown;
  received_at: string;
};

type DecodeConfig = {
  cron_secret: string;
  batch_limit: number | null;
  sparse_enabled: boolean | null;
  sparse_farm_keys: string[] | null;
  sparse_eps_temp: number | null;
  sparse_eps_fan: number | null;
  sparse_heartbeat_sec: number | null;
  clock_kst_farm_keys: string[] | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", Connection: "keep-alive" },
  });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "missing_supabase_env" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: config, error: configErr } = await supabase
    .from("iot_decode_config")
    .select(
      "cron_secret, batch_limit, sparse_enabled, sparse_farm_keys, sparse_eps_temp, sparse_eps_fan, sparse_heartbeat_sec, clock_kst_farm_keys",
    )
    .eq("id", 1)
    .single();

  if (configErr || !config?.cron_secret) {
    return json({ error: "config_unavailable", detail: configErr?.message }, 500);
  }

  const cfg = config as DecodeConfig;

  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${cfg.cron_secret}`) {
    return json({ error: "unauthorized" }, 401);
  }

  const batchLimit = cfg.batch_limit ?? 100;
  const sparseOn = cfg.sparse_enabled === true;
  const epsTemp = Number(cfg.sparse_eps_temp ?? 0.2);
  const epsFan = Number(cfg.sparse_eps_fan ?? 2);
  const heartbeatSec = Number(cfg.sparse_heartbeat_sec ?? 1800);

  const { data: cursorRow, error: cursorErr } = await supabase
    .from("iot_decode_cursor")
    .select("last_raw_id")
    .eq("id", 1)
    .single();

  if (cursorErr) {
    return json({ error: "cursor_unavailable", detail: cursorErr.message }, 500);
  }

  const lastRawId = cursorRow?.last_raw_id ?? 0;

  const { data: rawRows, error: rawErr } = await supabase
    .from("iot_room_state_raw")
    .select(
      "id, lsind_regist_no, item_code, module_uid, topic, payload_bytea, received_at",
    )
    .gt("id", lastRawId)
    .order("id", { ascending: true })
    .limit(batchLimit);

  if (rawErr) {
    return json({ error: "raw_fetch_failed", detail: rawErr.message }, 500);
  }

  const rows = (rawRows ?? []) as RawRow[];
  if (rows.length === 0) {
    return json({
      ok: true,
      processed: 0,
      decoded: 0,
      alarms: 0,
      skipped: 0,
      sparse_skipped: 0,
      failed: 0,
      last_raw_id: lastRawId,
    });
  }

  let decoded = 0;
  let alarms = 0;
  let skipped = 0;
  let sparseSkipped = 0;
  let failed = 0;
  let maxRawId = lastRawId;

  for (const row of rows) {
    maxRawId = row.id;

    const alarm = decodeErrorPacketFromDb(row.payload_bytea, {
      allowUnknown: true,
    });
    if (alarm) {
      if (alarm.controllerKey) {
        await supabase
          .from("farm_module_alarm")
          .update({
            status: "acked",
            status_changed_at: new Date().toISOString(),
          })
          .eq("lsind_regist_no", row.lsind_regist_no)
          .eq("item_code", row.item_code)
          .eq("controller_key", alarm.controllerKey)
          .eq("err_code", alarm.errCode)
          .eq("status", "active");
      }

      const { error: alarmErr } = await supabase.from("farm_module_alarm").upsert(
        {
          raw_id: row.id,
          lsind_regist_no: row.lsind_regist_no,
          item_code: row.item_code,
          module_uid: row.module_uid,
          topic: row.topic,
          wire_ver: alarm.wireVer,
          err_code: alarm.errCode,
          err_label: alarm.errLabel,
          stall_ty_code: alarm.stallTyCode ?? null,
          stall_no: alarm.stallNo ?? null,
          eqpmn_no: alarm.eqpmnNo ?? null,
          controller_key: alarm.controllerKey ?? null,
          channel: alarm.channel ?? null,
          status: "active",
          received_at: row.received_at,
          decoded_json: alarm,
        },
        { onConflict: "raw_id" },
      );

      if (alarmErr) {
        failed += 1;
        await supabase.from("iot_room_state_decode_failed").upsert(
          {
            raw_id: row.id,
            wire_ver: alarm.wireVer,
            error_code: "ALARM_UPSERT_FAILED",
            error_detail: alarmErr.message,
            attempted_at: new Date().toISOString(),
          },
          { onConflict: "raw_id" },
        );
        continue;
      }

      alarms += 1;
      await supabase
        .from("iot_room_state_decode_failed")
        .delete()
        .eq("raw_id", row.id);
      continue;
    }

    const outcome = decodeV0cPayloadOutcomeFromDb(row.payload_bytea);

    if (outcome.status === "invalid_stall_ty") {
      skipped += 1;
      await supabase.from("iot_room_state_decode_failed").upsert(
        {
          raw_id: row.id,
          wire_ver: outcome.wireVer,
          error_code: outcome.errorCode,
          error_detail: outcome.errorDetail,
          attempted_at: new Date().toISOString(),
        },
        { onConflict: "raw_id" },
      );
      continue;
    }

    if (outcome.status !== "ok") {
      skipped += 1;
      continue;
    }

    const payload = outcome.payload;

    const tempC = primaryTempC(payload.tempsC);
    const fanExhaust = fanPctFromChannels(payload.channels, "EC02");
    const fanIntake = fanPctFromChannels(payload.channels, "EC03");
    const nextMetrics = {
      error_code_raw: payload.errorCodeRaw,
      temp_c: tempC,
      fan_exhaust_pct: fanExhaust,
      fan_intake_pct: fanIntake,
    };

    const farmInScope =
      sparseOn &&
      sparseAppliesToFarm(
        cfg.sparse_farm_keys,
        row.lsind_regist_no,
        row.item_code,
      );

    if (farmInScope) {
      const { data: lastRow } = await supabase
        .from("iot_decoded_last_value")
        .select(
          "temp_c, fan_exhaust_pct, fan_intake_pct, error_code_raw, updated_at",
        )
        .eq("lsind_regist_no", row.lsind_regist_no)
        .eq("item_code", row.item_code)
        .eq("module_uid", row.module_uid)
        .eq("controller_key", payload.controllerKey)
        .maybeSingle();

      const write = shouldWriteSparse({
        last: (lastRow as SparseLast | null) ?? null,
        next: nextMetrics,
        nowMs: Date.now(),
        epsTemp,
        epsFan,
        heartbeatSec,
      });

      if (!write) {
        sparseSkipped += 1;
        await supabase
          .from("iot_room_state_decode_failed")
          .delete()
          .eq("raw_id", row.id);
        continue;
      }
    }

    const decodedJson = toSlimDecodedJson(payload);
    const thermo = channelAThermo(payload.channels);
    // Partition key must be present on INSERT (BEFORE trigger on parent only fills if null).
    const clockMode = clockModeForFarm(
      cfg.clock_kst_farm_keys,
      row.lsind_regist_no,
      row.item_code,
    );
    const clock = applyReceivedAtClock(
      payload.mesureDt,
      row.received_at,
      clockMode,
    );
    const insertRow = {
      raw_id: row.id,
      lsind_regist_no: row.lsind_regist_no,
      item_code: row.item_code,
      module_uid: row.module_uid,
      topic: row.topic,
      wire_ver: payload.wireVer,
      packet_mode: payload.packetMode,
      history: payload.history,
      controller_key: payload.controllerKey,
      eqpmn_no: payload.eqpmnNo,
      stall_ty_code: payload.stallTyCode,
      stall_no: payload.stallNo,
      mesure_dt: clock.mesureDt,
      mesure_at: clock.mesureAtIso,
      run_mode: payload.runMode,
      temp_c: tempC,
      humidity_pct: parseOptionalPct(payload.humidityPct),
      fan_supply_pct: fanPctFromChannels(payload.channels, "EC01"),
      fan_exhaust_pct: fanExhaust,
      fan_intake_pct: fanIntake,
      // 슬롯(A/B/C) 기준 모터% — 표시 정본(eqpmnCode 비참조). EC 컬럼은 하위호환 병행.
      fan_a_pct: fanPctFromChannelSlot(payload.channels, "A"),
      fan_b_pct: fanPctFromChannelSlot(payload.channels, "B"),
      fan_c_pct: fanPctFromChannelSlot(payload.channels, "C"),
      setpoint_temp: parseOptionalPct(thermo?.setpointTemp ?? null),
      temp_deviation: parseOptionalPct(thermo?.tempDeviation ?? null),
      min_vent_pct: thermo?.minVentPct ?? null,
      max_vent_pct: thermo?.maxVentPct ?? null,
      decoded_json: decodedJson,
      decode_status: "ok",
      decode_source: "edge",
      received_at: row.received_at,
    };

    // D1 partitioned UNIQUE(raw_id, mesure_at)
    const { error: upsertErr } = await supabase
      .from("iot_room_state_decoded")
      .upsert(insertRow, { onConflict: "raw_id,mesure_at" });

    if (upsertErr) {
      failed += 1;
      await supabase.from("iot_room_state_decode_failed").upsert(
        {
          raw_id: row.id,
          wire_ver: payload.wireVer,
          error_code: "UPSERT_FAILED",
          error_detail: upsertErr.message,
          attempted_at: new Date().toISOString(),
        },
        { onConflict: "raw_id" },
      );
      continue;
    }

    if (farmInScope) {
      await supabase.from("iot_decoded_last_value").upsert(
        {
          lsind_regist_no: row.lsind_regist_no,
          item_code: row.item_code,
          module_uid: row.module_uid,
          controller_key: payload.controllerKey,
          error_code_raw: payload.errorCodeRaw,
          temp_c: tempC,
          fan_exhaust_pct: fanExhaust,
          fan_intake_pct: fanIntake,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "lsind_regist_no,item_code,module_uid,controller_key",
        },
      );
    }

    decoded += 1;
    await supabase
      .from("iot_room_state_decode_failed")
      .delete()
      .eq("raw_id", row.id);
  }

  const { error: cursorUpdateErr } = await supabase
    .from("iot_decode_cursor")
    .update({
      last_raw_id: maxRawId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (cursorUpdateErr) {
    return json(
      {
        error: "cursor_update_failed",
        detail: cursorUpdateErr.message,
        decoded,
        alarms,
        skipped,
        sparse_skipped: sparseSkipped,
        failed,
      },
      500,
    );
  }

  return json({
    ok: true,
    processed: rows.length,
    decoded,
    alarms,
    skipped,
    sparse_skipped: sparseSkipped,
    failed,
    last_raw_id: maxRawId,
  });
});
