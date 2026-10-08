import assert from "node:assert/strict";
import type { FarmKey } from "@/lib/data/farm-key";
import {
  commandAbsTempWindow,
  commandHitAxis,
  commandHitEventLane,
  commandHitNeighborId,
  commandHitStats,
  commandHitStatsLine,
  commandHitTimeSpan,
  commandHitToEventMark,
  commandHitX,
  commandInChartScope,
  commandLiveConfirmed,
  latestChannelASetpoint,
  selectCommandHitMarks,
  selectCommandHitResult,
  type CommandHitSource,
} from "./command-hit";

const farm: FarmKey = { lsindRegistNo: "TEST01", itemCode: "P00" };
const otherFarm: FarmKey = { lsindRegistNo: "TEST02", itemCode: "P00" };

function cmd(
  partial: Partial<CommandHitSource> & Pick<CommandHitSource, "id" | "createdAt" | "status">,
): CommandHitSource {
  return {
    farmKey: farm,
    moduleUid: 1,
    controllerKey: "SP07:01:01",
    stallTyCode: "SP07",
    stallNo: "01",
    eqpmnNo: "01",
    channel: "A",
    setpointTemp: 24,
    tempDeviation: 4,
    minVentPct: 10,
    maxVentPct: 70,
    ...partial,
  };
}

{
  const from = Date.parse("2026-09-09T00:00:00.000Z");
  const to = Date.parse("2026-09-10T00:00:00.000Z");
  assert.equal(commandHitX("2026-09-09T12:00:00.000Z", from, to), 0.5);
  assert.equal(commandHitX("2026-09-08T23:00:00.000Z", from, to), null);
  assert.equal(commandHitX("2026-09-10T00:00:01.000Z", from, to), 1);
  assert.equal(commandHitX("2026-09-10T02:00:01.000Z", from, to), null);
}

{
  const base = cmd({
    id: "a",
    createdAt: "2026-09-10T02:00:00.000Z",
    status: "applied",
  });
  assert.equal(commandInChartScope(base, { level: "farm" }), true);
  assert.equal(
    commandInChartScope(base, { level: "sp", stallTyCode: "SP07" }),
    true,
  );
  assert.equal(
    commandInChartScope(base, { level: "sp", stallTyCode: "SP03" }),
    false,
  );
  assert.equal(
    commandInChartScope(base, {
      level: "stall",
      stallTyCode: "SP07",
      stallNo: "1",
    }),
    true,
  );
  assert.equal(
    commandInChartScope(base, {
      level: "controller",
      stallTyCode: "SP07",
      stallNo: "01",
      controllerKey: "SP07:01:02",
    }),
    false,
  );
}

{
  const command = cmd({
    id: "live",
    createdAt: "2026-09-10T02:00:00.000Z",
    status: "applied",
  });
  assert.equal(
    commandLiveConfirmed(command, [
      {
        farmKey: farm,
        moduleUid: 1,
        controllerKey: "SP07:01:01",
        channels: [
          {
            channel: "A",
            thermo: {
              setpointTemp: 24,
              tempDeviation: 4,
              minVentPct: 10,
              maxVentPct: 70,
            },
          },
        ],
      },
    ]),
    true,
  );
  assert.equal(
    commandLiveConfirmed(command, [
      {
        farmKey: farm,
        moduleUid: 1,
        controllerKey: "SP07:01:01",
        channels: [
          {
            channel: "A",
            thermo: {
              setpointTemp: 24,
              tempDeviation: 5,
              minVentPct: 10,
              maxVentPct: 70,
            },
          },
        ],
      },
    ]),
    false,
  );
  assert.equal(
    commandLiveConfirmed(
      { ...command, status: "pending" },
      [
        {
          farmKey: farm,
          moduleUid: 1,
          controllerKey: "SP07:01:01",
          channels: [
            {
              channel: "A",
              thermo: {
                setpointTemp: 24,
                tempDeviation: 4,
                minVentPct: 10,
                maxVentPct: 70,
              },
            },
          ],
        },
      ],
    ),
    false,
  );
  assert.equal(
    commandLiveConfirmed(command, [], {}, new Set(["live"])),
    true,
  );
}

{
  const fromMs = Date.parse("2026-09-09T00:00:00.000Z");
  const toMs = Date.parse("2026-09-10T03:00:00.000Z");
  const marks = selectCommandHitMarks({
    farmKey: farm,
    scope: {
      level: "controller",
      stallTyCode: "SP07",
      stallNo: "01",
      controllerKey: "SP07:01:01",
    },
    fromMs,
    toMs,
    readings: [
      {
        farmKey: farm,
        moduleUid: 1,
        controllerKey: "SP07:01:01",
        channels: [
          {
            channel: "A",
            thermo: {
              setpointTemp: 24,
              tempDeviation: 3,
              minVentPct: 10,
              maxVentPct: 70,
            },
          },
        ],
      },
    ],
    commands: [
      cmd({
        id: "sent",
        createdAt: "2026-09-10T02:09:53.000Z",
        status: "sent",
        tempDeviation: 4,
      }),
      cmd({
        id: "recv",
        createdAt: "2026-09-10T02:05:35.000Z",
        status: "applied",
        tempDeviation: 5,
      }),
      cmd({
        id: "hit",
        createdAt: "2026-09-10T01:57:19.000Z",
        status: "applied",
        tempDeviation: 3,
      }),
      cmd({
        id: "fail",
        createdAt: "2026-09-10T01:40:00.000Z",
        status: "failed",
      }),
      cmd({
        id: "other-farm",
        createdAt: "2026-09-10T02:00:00.000Z",
        status: "applied",
        farmKey: otherFarm,
      }),
      cmd({
        id: "outside",
        createdAt: "2026-09-01T02:00:00.000Z",
        status: "applied",
      }),
    ],
  });

  assert.deepEqual(
    marks.map((mark) => `${mark.stage}:${mark.id}`),
    ["확인:hit", "확인:recv"],
  );
  assert.equal(marks.find((mark) => mark.id === "hit")?.setpoint, "24.0℃");
  assert.equal(marks.find((mark) => mark.id === "hit")?.deviation, "±3.0℃");
  assert.equal(marks.find((mark) => mark.id === "hit")?.vent, "10–70%");
  assert.match(
    marks[0]?.target ?? "",
    /비육사 1번 축사 · 1번 컨트롤러 · 1차/,
  );
  assert.equal(/TEST01|SP07:/.test(marks[0]?.target ?? ""), false);
  assert.equal(marks.some((mark) => mark.id === "sent"), false);

  const stats = commandHitStats(marks);
  assert.equal(stats.total, 2);
  assert.equal(stats.confirmed, 2);
  assert.equal(stats.hitPctLabel, "100%");
}

{
  const fromMs = Date.parse("2026-09-10T02:00:00.000Z");
  const toMs = Date.parse("2026-09-10T02:10:00.000Z");
  const marks = selectCommandHitMarks({
    farmKey: farm,
    scope: { level: "farm" },
    fromMs,
    toMs,
    commands: [
      cmd({
        id: "a",
        createdAt: "2026-09-10T02:05:00.000Z",
        status: "applied",
      }),
      cmd({
        id: "b",
        createdAt: "2026-09-10T02:05:02.000Z",
        status: "applied",
      }),
      cmd({
        id: "c",
        createdAt: "2026-09-10T02:05:04.000Z",
        status: "applied",
      }),
    ],
  });
  assert.equal(marks.find((mark) => mark.id === "a")?.x, 0.5);
  assert.equal(
    marks.find((mark) => mark.id === "b")?.x,
    commandHitX("2026-09-10T02:05:02.000Z", fromMs, toMs),
  );
  const xs = marks.map((mark) => mark.x);
  assert.ok((xs[1]! - xs[0]!) < 0.01);
  assert.ok((xs[2]! - xs[1]!) < 0.01);
}

{
  const toMs = Date.parse("2026-09-10T12:00:00.000Z");
  const fromMs = toMs - 30 * 24 * 60 * 60 * 1000;
  const marks = selectCommandHitMarks({
    farmKey: farm,
    scope: { level: "farm" },
    fromMs,
    toMs,
    commands: [
      cmd({
        id: "early",
        createdAt: "2026-09-08T07:40:00.000Z",
        status: "applied",
        tempDeviation: 3,
      }),
      cmd({
        id: "late",
        createdAt: "2026-09-10T02:05:00.000Z",
        status: "applied",
        tempDeviation: 5,
      }),
    ],
  });
  const early = marks.find((mark) => mark.id === "early");
  const late = marks.find((mark) => mark.id === "late");
  assert.ok(early && late);
  assert.ok((late?.x ?? 0) - (early?.x ?? 0) > 0.04);
}

{
  const stats = commandHitStats(
    [{ stage: "확인" }, { stage: "전송" }],
    3,
  );
  assert.equal(stats.total, 2);
  assert.equal(stats.confirmed, 1);
  assert.equal(stats.hiddenCount, 3);
  assert.equal(stats.hitPctLabel, "50%");
  assert.equal(
    commandHitStatsLine("약 7일", stats),
    "약 7일 · 적용 최근 2건",
  );
}

{
  const now = Date.parse("2026-09-10T12:00:00.000Z");
  const liveEnd = commandHitAxis(now - 86400000, now, now);
  assert.equal(liveEnd.end, "지금");
  const oldEnd = commandHitAxis(
    now - 20 * 86400000,
    now - 10 * 86400000,
    now,
  );
  assert.notEqual(oldEnd.end, "지금");
  assert.match(oldEnd.start, /\d/);
}

{
  const row = (id: string, at: string) => ({ id, at });
  const rows = [
    row("a", "2026-09-10T01:00:00.000Z"),
    row("b", "2026-09-10T02:00:00.000Z"),
    row("c", "2026-09-10T03:00:00.000Z"),
  ];
  assert.equal(commandHitNeighborId(rows, "b", -1), "a");
  assert.equal(commandHitNeighborId(rows, "b", 1), "c");
  assert.equal(commandHitNeighborId(rows, "a", -1), "a");
  assert.equal(
    commandHitNeighborId(rows, "b", Number.NEGATIVE_INFINITY),
    "a",
  );
  assert.equal(
    commandHitNeighborId(rows, "b", Number.POSITIVE_INFINITY),
    "c",
  );
}

{
  const fromMs = Date.parse("2026-09-09T00:00:00.000Z");
  const toMs = Date.parse("2026-09-10T03:00:00.000Z");
  const result = selectCommandHitResult({
    farmKey: farm,
    scope: { level: "farm" },
    fromMs,
    toMs,
    limit: 1,
    commands: [
      cmd({
        id: "older",
        createdAt: "2026-09-09T12:00:00.000Z",
        status: "applied",
      }),
      cmd({
        id: "newer",
        createdAt: "2026-09-10T02:00:00.000Z",
        status: "applied",
      }),
    ],
  });
  assert.equal(result.marks.length, 1);
  assert.equal(result.marks[0]?.id, "newer");
  assert.equal(result.hiddenCount, 1);
}

{
  const fromMs = Date.parse("2026-09-01T00:00:00.000Z");
  const toMs = Date.parse("2026-09-08T00:00:00.000Z");
  const late = Array.from({ length: 20 }, (_, i) =>
    cmd({
      id: `late-${i}`,
      createdAt: new Date(
        Date.parse("2026-09-07T12:00:00.000Z") + i * 60_000,
      ).toISOString(),
      status: "applied",
    }),
  );
  const result = selectCommandHitResult({
    farmKey: farm,
    scope: { level: "farm" },
    fromMs,
    toMs,
    limit: 8,
    commands: [
      cmd({
        id: "early-a",
        createdAt: "2026-09-01T12:00:00.000Z",
        status: "applied",
      }),
      cmd({
        id: "early-b",
        createdAt: "2026-09-02T12:00:00.000Z",
        status: "applied",
      }),
      ...late,
    ],
  });
  assert.equal(result.marks.length, 8);
  assert.equal(result.hiddenCount, 14);
  assert.ok(result.marks.some((mark) => mark.id === "early-a"));
  assert.ok(result.marks.some((mark) => mark.id === "early-b"));
}

{
  const fallback = {
    fromMs: Date.parse("2026-01-01T00:00:00.000Z"),
    toMs: Date.parse("2026-01-02T00:00:00.000Z"),
  };
  const span = commandHitTimeSpan(["22:00", "00:00", "02:00"], fallback);
  assert.ok(span);
  assert.ok(span.toMs > span.fromMs);
  const parsedMid = commandHitX(
    new Date(span.fromMs + (span.toMs - span.fromMs) / 2).toISOString(),
    span.fromMs,
    span.toMs,
  );
  assert.ok(parsedMid != null && Math.abs(parsedMid - 0.5) < 1e-9);
  const empty = commandHitTimeSpan([], fallback);
  assert.deepEqual(empty, fallback);
  assert.equal(commandHitTimeSpan([], null), null);
}

{
  const mark = selectCommandHitMarks({
    farmKey: farm,
    scope: { level: "farm" },
    fromMs: Date.parse("2026-09-10T00:00:00.000Z"),
    toMs: Date.parse("2026-09-10T12:00:00.000Z"),
    commands: [
      cmd({
        id: "hit",
        createdAt: "2026-09-10T06:00:00.000Z",
        status: "applied",
        tempDeviation: 3,
      }),
    ],
    readings: [
      {
        farmKey: farm,
        moduleUid: 1,
        controllerKey: "SP07:01:01",
        channels: [
          {
            channel: "A",
            thermo: {
              setpointTemp: 24,
              tempDeviation: 3,
              minVentPct: 10,
              maxVentPct: 70,
            },
          },
        ],
      },
    ],
  })[0];
  assert.ok(mark);
  const event = commandHitToEventMark(mark);
  assert.equal(event.card.badge, "명령");
  assert.equal(event.tone, "ok");
  assert.equal(event.row, 0);
  assert.equal(event.markerLabel, "1차");
  assert.equal(event.card.hero, "1차");
  assert.equal(
    event.card.rows.find((row) => row.label === "설정온도")?.value,
    "24.0℃",
  );
  assert.equal(
    event.card.rows.find((row) => row.label === "편차")?.value,
    "±3.0℃",
  );
  assert.ok(event.card.rows.some((row) => row.label === "환기"));
  assert.equal(event.hold?.channel, "A");
  assert.equal(event.hold?.tempLo, 24);
  assert.equal(event.hold?.tempHi, 27);
  assert.equal(/TEST01|SP07:/.test(event.card.footnote ?? ""), false);
}

{
  const fromMs = Date.parse("2026-09-10T02:00:00.000Z");
  const toMs = Date.parse("2026-09-10T02:10:00.000Z");
  const marks = selectCommandHitMarks({
    farmKey: farm,
    scope: { level: "farm" },
    fromMs,
    toMs,
    commands: [
      cmd({
        id: "pending",
        createdAt: "2026-09-10T02:05:00.000Z",
        status: "pending",
      }),
      cmd({
        id: "sent",
        createdAt: "2026-09-10T02:06:00.000Z",
        status: "sent",
      }),
      cmd({
        id: "applied",
        createdAt: "2026-09-10T02:07:00.000Z",
        status: "applied",
      }),
    ],
  });
  assert.deepEqual(
    marks.map((mark) => mark.id),
    ["applied"],
  );
  const lane = commandHitEventLane({
    marks,
    windowLabel: "약 10분",
  });
  assert.deepEqual(lane.rowLabels, ["1차", "2차", "3차"]);
  assert.match(lane.statsLine ?? "", /적용 1건/);
  assert.equal(lane.marks[0]?.markerLabel, "1차");
  assert.equal(lane.marks[0]?.row, 0);
  assert.equal(lane.marks[0]?.hold?.tempLo, 24);
  assert.equal(lane.marks[0]?.hold?.tempHi, 28);
  assert.equal(lane.marks[0]?.hold?.ventLo, 10);
  assert.equal(lane.marks[0]?.hold?.ventHi, 70);
}

{
  const aWin = commandAbsTempWindow(
    { channel: "A", setpointTemp: 24, tempDeviation: 5 },
    null,
  );
  assert.deepEqual(aWin, { loC: 24, hiC: 29 });
  const bWin = commandAbsTempWindow(
    { channel: "B", setpointTemp: 2, tempDeviation: 4 },
    24,
  );
  assert.deepEqual(bWin, { loC: 26, hiC: 30 });
  assert.equal(
    commandAbsTempWindow(
      { channel: "B", setpointTemp: 2, tempDeviation: 4 },
      null,
    ),
    null,
  );
}

{
  const a = cmd({
    id: "a-cmd",
    createdAt: "2026-09-10T02:00:00.000Z",
    status: "applied",
    channel: "A",
    setpointTemp: 24,
  });
  const b = cmd({
    id: "b-cmd",
    createdAt: "2026-09-10T02:05:00.000Z",
    status: "applied",
    channel: "B",
    setpointTemp: 2,
  });
  assert.equal(latestChannelASetpoint(b, [a, b]), 24);
}

console.log("command-hit.test.ts ok");
