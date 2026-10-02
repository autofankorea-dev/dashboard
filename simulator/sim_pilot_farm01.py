#!/usr/bin/env python3
"""Home FARM01/P00 LIVE pilot.

Primary path: MQTT publish to EC2 broker (RS.py + C.py + command_ack).
  topic raw: sungil/FARM01/P00/raw
  topic cmd: sungil/FARM01/P00/cmd
Optional --write bypasses MQTT and INSERTs iot-cloud directly.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import struct
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import paho.mqtt.client as mqtt

VER_V0C = 0x0C
HEADER_SIZE = 2
ROW_SIZE = 75
ALARM_BYTES = 4
ROW_SIZE_WITH_ALARM = ROW_SIZE + ALARM_BYTES
CHANNEL_BLOCK = 19
NA_TEMP = 0xFFFF
NA_FAN = 0xFF
# Field firmware: 500 = 0°C. Decode uses origin when raw ≥ 500.
TEMP_ORIGIN_X10 = 500
# Match field 83B alarm words (10.0°C / 43.6°C).
ALARM_LOW_X10 = 100
ALARM_HIGH_X10 = 436
TOPIC = os.environ.get("MQTT_TOPIC", "sungil/FARM01/P00/raw")
TOPIC_CMD = os.environ.get("MQTT_TOPIC_CMD", "sungil/FARM01/P00/cmd")
MQTT_HOST = os.environ.get("MQTT_HOST", "127.0.0.1")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))

# controllerKey|channel -> (sp_x10, dev_x10, min, max)
thermo_overrides: dict[str, tuple[int, int, int, int]] = {}
pending_uplink: list[tuple[int, int, int]] = []

# Last known FARM01/P00 controllers on iot-cloud (2026-08-11 LIVE list).
CONTROLLERS = (
    (2, 1, 1),
    (3, 1, 1),
    (3, 1, 2),
    (3, 1, 3),
    (3, 1, 4),
    (3, 1, 5),
    (3, 1, 6),
    (5, 1, 1),
    (5, 1, 2),
    (5, 1, 3),
    (5, 1, 4),
    (5, 1, 5),
    (5, 1, 6),
)
CTRL_SLOT = {ctrl: i for i, ctrl in enumerate(CONTROLLERS)}

# 축사유형 권장 띠 (x10). web/src/lib/farm/pig-env-recommend.ts 와 맞춤.
TYPE_BAND_X10 = {
    2: (160, 210, 500, 600),
    3: (180, 210, 500, 600),
    5: (180, 220, 500, 800),
}
HOLD_SEC_DEFAULT = 20.0
SCENARIO_NAMES = (
    "ok",
    "temp_warn",
    "hum_warn",
    "both_warn",
    "temp_danger",
    "hum_danger",
    "both_danger",
)


def crc16_ccitt_false(data: bytes) -> int:
    crc = 0xFFFF
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return crc


def u16(value: int) -> bytes:
    return struct.pack("<H", value & 0xFFFF)


def encode_channel(
    eqpmn_code: int,
    outputs: dict[int, int] | None = None,
    thermo: tuple[int, int, int, int] | None = None,
) -> bytes:
    block = bytearray([0xFF] * CHANNEL_BLOCK)
    block[0] = eqpmn_code & 0xFF
    mask = 0
    for sn, pct in (outputs or {}).items():
        if not 1 <= sn <= 10:
            continue
        mask |= 1 << (sn - 1)
        block[2 + sn] = pct & 0xFF
    block[1:3] = u16(mask)
    if thermo is None:
        block[13:19] = u16(NA_TEMP) + u16(NA_TEMP) + bytes((NA_FAN, NA_FAN))
    else:
        sp, dev, min_v, max_v = thermo
        block[13:19] = (
            u16(wire_temp_x10(sp))
            + u16(wire_temp_x10(dev))
            + bytes((min_v & 0xFF, max_v & 0xFF))
        )
    return bytes(block)


def wire_temp_x10(tenths_from_zero: int) -> int:
    """Tenths from 0°C → field origin 500."""
    return TEMP_ORIGIN_X10 + max(int(tenths_from_zero), 0)


def encode_live_row(
    *,
    epoch_sec: int,
    stall_ty: int,
    stall_no: int,
    eqpmn_no: int,
    temp_x10: int,
    humidity_x10: int,
    exhaust_pct: int,
    intake_pct: int,
) -> bytes:
    """Field v0x0C 83 B: origin 500, alarm 4 B, A=EC03, B=EC02, C empty."""
    row = bytearray(ROW_SIZE_WITH_ALARM)
    row[0:4] = struct.pack("<I", epoch_sec)
    row[4] = stall_ty & 0xFF
    row[5] = stall_no & 0xFF
    row[6] = eqpmn_no & 0xFF
    row[7] = 1
    # FARM01 always sends 4 probes: t, t-0.2, t-0.5, t-0.3
    probes = (temp_x10, temp_x10 - 2, temp_x10 - 5, temp_x10 - 3)
    for i, probe in enumerate(probes):
        row[8 + i * 2 : 10 + i * 2] = u16(wire_temp_x10(max(probe, 1)))
    row[16:18] = u16(humidity_x10)
    row[18:20] = u16(wire_temp_x10(ALARM_LOW_X10))
    row[20:22] = u16(wire_temp_x10(ALARM_HIGH_X10))
    key = f"SP{stall_ty:02d}:{stall_no:02d}:{eqpmn_no:02d}"
    thermo_a = thermo_overrides.get(f"{key}|A", (250, 20, 10, 80))
    thermo_b = thermo_overrides.get(f"{key}|B", (240, 15, 5, 90))
    intake_outputs = {1: intake_pct, 2: intake_pct} if stall_ty == 2 else {1: intake_pct}
    ch_a = encode_channel(3, outputs=intake_outputs, thermo=thermo_a)
    if stall_ty == 2:
        ch_b = bytes([0xFF] * CHANNEL_BLOCK)
    else:
        ch_b = encode_channel(2, outputs={1: exhaust_pct}, thermo=thermo_b)
    ch_c = bytes([0xFF] * CHANNEL_BLOCK)
    row[22:79] = ch_a + ch_b + ch_c
    header = bytes((VER_V0C, 0x00))
    body = header + bytes(row)
    crc = crc16_ccitt_false(body)
    return body + u16(crc)


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def resolve_env() -> tuple[str, str]:
    root = Path(__file__).resolve().parents[1]
    merged = load_env_file(root / "web" / ".env.local")
    merged.update(load_env_file(Path(__file__).resolve().parent / ".env"))
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or merged.get(
        "NEXT_PUBLIC_SUPABASE_URL", ""
    )
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or merged.get(
        "SUPABASE_SERVICE_ROLE_KEY", ""
    )
    if not url or not key:
        raise SystemExit(
            "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다. "
            "web/.env.local 또는 simulator/.env 를 확인하세요."
        )
    return url.rstrip("/"), key


def http_json(
    method: str,
    url: str,
    *,
    headers: dict[str, str],
    body: dict | None = None,
) -> object:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            raw = res.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} -> {exc.code} {detail}") from exc


def rest_headers(url: str, service_key: str) -> dict[str, str]:
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def insert_raw(url: str, service_key: str, payload: bytes) -> int:
    rows = http_json(
        "POST",
        f"{url}/rest/v1/iot_room_state_raw",
        headers=rest_headers(url, service_key),
        body={
            "topic": TOPIC,
            "payload_bytea": r"\x" + payload.hex(),
            "received_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    if not isinstance(rows, list) or not rows:
        raise RuntimeError("raw insert returned no row")
    return int(rows[0]["id"])


def fetch_cron_secret(url: str, service_key: str) -> str:
    rows = http_json(
        "GET",
        f"{url}/rest/v1/iot_decode_config?id=eq.1&select=cron_secret",
        headers=rest_headers(url, service_key),
    )
    if not isinstance(rows, list) or not rows or not rows[0].get("cron_secret"):
        raise RuntimeError("iot_decode_config.cron_secret 을 읽지 못했습니다.")
    return str(rows[0]["cron_secret"])


def invoke_decode_batch(url: str, cron_secret: str) -> object:
    return http_json(
        "POST",
        f"{url}/functions/v1/decode-batch",
        headers={
            "Authorization": f"Bearer {cron_secret}",
            "Content-Type": "application/json",
        },
        body={},
    )


def scenario_targets(stall_ty: int, kind: str) -> tuple[int, int]:
    t_lo, t_hi, h_lo, h_hi = TYPE_BAND_X10.get(stall_ty, TYPE_BAND_X10[5])
    t_mid = (t_lo + t_hi) // 2
    h_mid = (h_lo + h_hi) // 2
    t_warn = min(t_hi + 40, 320)
    h_warn = min(h_hi + 80, 850)
    t_dang = 365
    h_dang = 930
    if kind == "ok":
        return t_mid, h_mid
    if kind == "temp_warn":
        return t_warn, h_mid
    if kind == "hum_warn":
        return t_mid, h_warn
    if kind == "both_warn":
        return t_warn, h_warn
    if kind == "temp_danger":
        return t_dang, h_mid
    if kind == "hum_danger":
        return t_mid, h_dang
    return t_dang, h_dang


def sample_metrics(
    *,
    stall_ty: int,
    stall_no: int,
    eqpmn_no: int,
    index: int,
    now: float,
    hold_sec: float,
) -> tuple[int, int, int, int, str]:
    hold = hold_sec if hold_sec > 0 else HOLD_SEC_DEFAULT
    slot = CTRL_SLOT.get((stall_ty, stall_no, eqpmn_no), index)
    phase = int(now // hold)
    kind = SCENARIO_NAMES[(phase + slot) % len(SCENARIO_NAMES)]
    temp, humid = scenario_targets(stall_ty, kind)
    rng = random.Random((phase << 16) ^ (slot << 8) ^ stall_ty ^ (eqpmn_no << 4))
    temp += rng.randint(-2, 2)
    humid += rng.randint(-10, 10)
    exhaust = max(10, min(90, 18 + (temp - 160) // 4))
    intake = max(10, min(90, 12 + (temp - 160) // 5))
    return temp, humid, exhaust, intake, kind


def self_test() -> None:
    wire = encode_live_row(
        epoch_sec=1_700_000_000,
        stall_ty=3,
        stall_no=1,
        eqpmn_no=2,
        temp_x10=257,
        humidity_x10=575,
        exhaust_pct=80,
        intake_pct=80,
    )
    assert len(wire) == HEADER_SIZE + ROW_SIZE_WITH_ALARM + 2, len(wire)
    assert wire[0] == VER_V0C
    body, crc = wire[:-2], int.from_bytes(wire[-2:], "little")
    assert crc16_ccitt_false(body) == crc
    row = wire[HEADER_SIZE:-2]
    assert len(row) == ROW_SIZE_WITH_ALARM
    assert int.from_bytes(row[8:10], "little") == wire_temp_x10(257)
    assert int.from_bytes(row[16:18], "little") == 575
    assert int.from_bytes(row[18:20], "little") == wire_temp_x10(ALARM_LOW_X10)
    assert int.from_bytes(row[20:22], "little") == wire_temp_x10(ALARM_HIGH_X10)
    assert int.from_bytes(row[22 + 13 : 22 + 15], "little") == wire_temp_x10(250)
    t, h, _, _, name = sample_metrics(
        stall_ty=5,
        stall_no=1,
        eqpmn_no=1,
        index=7,
        now=0.0,
        hold_sec=HOLD_SEC_DEFAULT,
    )
    assert name == "ok", name
    assert 180 <= t <= 220, t
    assert 500 <= h <= 800, h
    t2, h2, _, _, name2 = sample_metrics(
        stall_ty=5,
        stall_no=1,
        eqpmn_no=2,
        index=8,
        now=0.0,
        hold_sec=HOLD_SEC_DEFAULT,
    )
    assert name2 == "temp_warn", name2
    assert t2 > 220, t2
    assert t2 < 350, t2
    t3, h3, _, _, name3 = sample_metrics(
        stall_ty=3,
        stall_no=1,
        eqpmn_no=1,
        index=1,
        now=0.0,
        hold_sec=HOLD_SEC_DEFAULT,
    )
    assert name3 == "temp_warn", name3
    t4, _, _, _, name4 = sample_metrics(
        stall_ty=2,
        stall_no=1,
        eqpmn_no=1,
        index=0,
        now=HOLD_SEC_DEFAULT * 4,
        hold_sec=HOLD_SEC_DEFAULT,
    )
    assert name4 == "temp_danger", name4
    assert t4 >= 350, t4
    print("self-test ok", len(wire), "bytes")


def parse_cmd(payload: bytes) -> None:
    try:
        body = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        print("cmd ignore: not json")
        return
    action = str(body.get("action") or "")
    if action not in ("SET_CHANNEL_THERMO", "SET_CTRL_THERMO"):
        print(f"cmd ignore: {action}")
        return
    stall_ty_code = str(body.get("stallTyCode") or body.get("stall_ty_code") or "")
    stall_no = str(body.get("stallNo") or body.get("stall_no") or "").zfill(2)
    eqpmn_no = str(body.get("eqpmnNo") or body.get("eqpmn_no") or "").zfill(2)
    channel = str(body.get("channel") or "A").upper()
    if not stall_ty_code.startswith("SP") or channel not in ("A", "B", "C"):
        print("cmd ignore: bad target")
        return
    try:
        stall_ty = int(stall_ty_code[2:])
        stall = int(stall_no)
        eqpmn = int(eqpmn_no)
        sp = int(round(float(body.get("setpoint_temp")) * 10))
        dev = int(round(float(body.get("temp_deviation")) * 10))
        min_v = int(round(float(body.get("min_vent_pct"))))
        max_v = int(round(float(body.get("max_vent_pct"))))
    except (TypeError, ValueError):
        print("cmd ignore: bad numbers")
        return
    key = f"SP{stall_ty:02d}:{stall:02d}:{eqpmn:02d}|{channel}"
    thermo_overrides[key] = (sp, dev, min_v, max_v)
    pending_uplink.append((stall_ty, stall, eqpmn))
    print(f"cmd apply {key} {sp/10:.1f}/{dev/10:.1f}/{min_v}/{max_v}")


def connect_mqtt(host: str, port: int) -> mqtt.Client:
    client_id = f"sim-pilot-farm01-{os.getpid()}"
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)

    def on_connect(_c, _u, _f, reason, _p=None):
        print(f"mqtt connected {host}:{port} rc={reason} id={client_id}")
        client.subscribe(TOPIC_CMD, qos=1)

    def on_message(_c, _u, msg):
        if msg.topic == TOPIC_CMD:
            parse_cmd(msg.payload)

    client.on_connect = on_connect
    client.on_message = on_message
    client.reconnect_delay_set(min_delay=1, max_delay=8)
    client.connect(host, port, keepalive=30)
    client.loop_start()
    return client


def mqtt_publish(client: mqtt.Client, payload: bytes) -> None:
    last_err: Exception | None = None
    for _ in range(3):
        if not client.is_connected():
            try:
                client.reconnect()
            except Exception as exc:
                last_err = exc
                time.sleep(1)
                continue
        info = client.publish(TOPIC, payload, qos=1)
        try:
            info.wait_for_publish(timeout=5)
        except RuntimeError as exc:
            last_err = exc
            time.sleep(1)
            continue
        if info.rc == mqtt.MQTT_ERR_SUCCESS:
            return
        last_err = RuntimeError(f"mqtt publish failed rc={info.rc}")
        time.sleep(1)
    raise RuntimeError(f"mqtt publish failed after retries: {last_err}")


def publish_one(
    *,
    write: bool,
    mqtt_client: mqtt.Client | None,
    url: str | None,
    service_key: str | None,
    cron_secret: str | None,
    stall_ty: int,
    stall_no: int,
    eqpmn_no: int,
    index: int,
    now: float,
    hold_sec: float,
) -> None:
    temp, humid, exhaust, intake, scene = sample_metrics(
        stall_ty=stall_ty,
        stall_no=stall_no,
        eqpmn_no=eqpmn_no,
        index=index,
        now=now,
        hold_sec=hold_sec,
    )
    epoch_sec = int(time.time())
    payload = encode_live_row(
        epoch_sec=epoch_sec,
        stall_ty=stall_ty,
        stall_no=stall_no,
        eqpmn_no=eqpmn_no,
        temp_x10=temp,
        humidity_x10=humid,
        exhaust_pct=exhaust,
        intake_pct=intake,
    )
    key = f"SP{stall_ty:02d}:{stall_no:02d}:{eqpmn_no:02d}"
    if mqtt_client is not None:
        mqtt_publish(mqtt_client, payload)
        print(f"mqtt {key} {scene} temp={temp/10:.1f} hum={humid/10:.1f} {len(payload)}B")
        return
    if not write:
        print(f"dry-run {key} {scene} temp={temp/10:.1f} hum={humid/10:.1f} {len(payload)}B")
        return
    assert url and service_key
    raw_id = insert_raw(url, service_key, payload)
    decoded = invoke_decode_batch(url, cron_secret or fetch_cron_secret(url, service_key))
    print(f"write {key} {scene} raw_id={raw_id} decode={decoded}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Home FARM01/P00 v0x0C LIVE pilot")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument(
        "--mqtt",
        action="store_true",
        help=f"EC2 브로커 {MQTT_HOST}:{MQTT_PORT} 로 /raw publish + /cmd subscribe",
    )
    parser.add_argument("--mqtt-host", default=MQTT_HOST)
    parser.add_argument("--mqtt-port", type=int, default=MQTT_PORT)
    parser.add_argument(
        "--write",
        action="store_true",
        help="MQTT 우회: iot-cloud iot_room_state_raw 직접 INSERT",
    )
    parser.add_argument("--once", action="store_true", help="컨트롤러 1바퀴만")
    parser.add_argument("--interval", type=float, default=2.0)
    parser.add_argument(
        "--hold",
        type=float,
        default=HOLD_SEC_DEFAULT,
        help="시나리오 단계 유지 초 (기본 20)",
    )
    args = parser.parse_args()

    if args.self_test:
        self_test()
        return 0

    url = service_key = cron_secret = None
    mqtt_client = None
    if args.mqtt:
        print(f"mqtt mode: {args.mqtt_host}:{args.mqtt_port} {TOPIC} / {TOPIC_CMD}")
        mqtt_client = connect_mqtt(args.mqtt_host, args.mqtt_port)
    elif args.write:
        url, service_key = resolve_env()
        cron_secret = fetch_cron_secret(url, service_key)
        print("write mode: FARM01/P00 -> iot-cloud raw + decode-batch")
    else:
        print("dry-run. 브로커 전송은 --mqtt")

    try:
        while True:
            queue = list(CONTROLLERS)
            while pending_uplink:
                queue.insert(0, pending_uplink.pop(0))
            for index, ctrl in enumerate(queue):
                try:
                    publish_one(
                        write=args.write,
                        mqtt_client=mqtt_client,
                        url=url,
                        service_key=service_key,
                        cron_secret=cron_secret,
                        stall_ty=ctrl[0],
                        stall_no=ctrl[1],
                        eqpmn_no=ctrl[2],
                        index=index,
                        now=time.time(),
                        hold_sec=args.hold,
                    )
                except Exception as exc:
                    print(f"publish skip {ctrl}: {exc}")
                if args.mqtt or args.write or not args.once:
                    time.sleep(args.interval)
            if args.once:
                return 0
    finally:
        if mqtt_client is not None:
            mqtt_client.loop_stop()
            mqtt_client.disconnect()


if __name__ == "__main__":
    sys.exit(main())
