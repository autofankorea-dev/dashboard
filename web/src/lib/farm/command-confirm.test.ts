/**
 * 실행: npx tsx src/lib/farm/command-confirm.test.ts
 */
import assert from "node:assert/strict";
import {
  buildCommandConfirmModel,
  buildMultiChannelCommandConfirmModel,
  formatCommandConfirmTarget,
  formatOrdinalNo,
  mergeCurrentThermo,
} from "./command-confirm";

{
  assert.equal(formatOrdinalNo("01"), "1");
  assert.equal(formatOrdinalNo("1"), "1");
  assert.equal(formatOrdinalNo("12"), "12");
  assert.equal(formatOrdinalNo("__x"), null);
}

{
  const target = formatCommandConfirmTarget({
    stallTyCode: "SP02",
    stallNo: "01",
    eqpmnNo: "01",
    onlineCount: 1,
  });
  assert.equal(target, "임신사 1번 축사, 1번 컨트롤러");
  assert.equal(/SP\d{2}/.test(target), false);
}

{
  const withChannel = formatCommandConfirmTarget({
    stallTyCode: "SP02",
    stallNo: "01",
    eqpmnNo: "01",
    channel: "B",
    onlineCount: 1,
  });
  assert.equal(withChannel, "임신사 1번 축사, 1번 컨트롤러 2차");
}

{
  const chartMany = formatCommandConfirmTarget({
    stallTyCode: "SP02",
    stallNo: "01",
    eqpmnNo: "01",
    onlineCount: 3,
    stallTyCodes: ["SP02", "SP02", "SP02"],
    chartScoped: true,
  });
  assert.equal(chartMany, "차트에 보이는 임신사 온라인 3대");
  assert.equal(/SP\d{2}/.test(chartMany), false);
}

{
  const mixedTypes = formatCommandConfirmTarget({
    onlineCount: 4,
    stallTyCodes: ["SP02", "SP03"],
    chartScoped: true,
  });
  assert.equal(mixedTypes, "차트에 보이는 온라인 4대");
}

{
  const a = {
    setpointTemp: 22.5,
    tempDeviation: 2,
    minVentPct: 15,
    maxVentPct: 80,
  };
  const same = {
    setpointTemp: 22.52,
    tempDeviation: 2.01,
    minVentPct: 15,
    maxVentPct: 80,
  };
  const other = { ...a, setpointTemp: 24 };
  assert.deepEqual(mergeCurrentThermo([a, same]), a);
  assert.equal(mergeCurrentThermo([a, other]), "mixed");
  assert.equal(mergeCurrentThermo([a, null]), "mixed");
  assert.equal(mergeCurrentThermo([null, null]), null);
}

{
  const model = buildCommandConfirmModel({
    target: "임신사 1번 축사, 1번 컨트롤러",
    current: {
      setpointTemp: 22.5,
      tempDeviation: 2,
      minVentPct: 15,
      maxVentPct: 80,
    },
    command: {
      setpointTemp: 24,
      tempDeviation: 1.5,
      minVentPct: 10,
      maxVentPct: 100,
    },
  });
  assert.equal(model.title, "명령을 보낼까요?");
  assert.equal(model.lines[0].from, "22.5℃");
  assert.equal(model.lines[0].to, "24.0℃");
  assert.equal(model.lines[0].fromWarn, false);
  assert.equal(model.lines[2].from, "15%");
  assert.equal(model.lines[2].to, "10%");
}

{
  const multiTarget = formatCommandConfirmTarget({
    stallTyCode: "SP02",
    stallNo: "01",
    eqpmnNo: "01",
    channels: ["A", "B"],
    onlineCount: 1,
  });
  assert.equal(multiTarget, "임신사 1번 축사, 1번 컨트롤러 1차, 2차");
}

{
  const mixed = buildCommandConfirmModel({
    target: "차트에 보이는 임신사 온라인 3대",
    current: "mixed",
    command: {
      setpointTemp: 24,
      tempDeviation: 1.5,
      minVentPct: 10,
      maxVentPct: 100,
    },
  });
  assert.ok(mixed.lines.every((line) => line.from === "다름" && line.fromWarn));
  assert.equal(mixed.lines[3].to, "100%");
}

{
  const multi = buildMultiChannelCommandConfirmModel({
    target: "임신사 1번 축사, 1번 컨트롤러 1차, 2차",
    channels: [
      {
        channel: "A",
        current: {
          setpointTemp: 24,
          tempDeviation: 3,
          minVentPct: 20,
          maxVentPct: 70,
        },
        command: {
          setpointTemp: 25,
          tempDeviation: 3,
          minVentPct: 20,
          maxVentPct: 70,
        },
      },
      {
        channel: "B",
        current: {
          setpointTemp: 1,
          tempDeviation: 3,
          minVentPct: 20,
          maxVentPct: 70,
        },
        command: {
          setpointTemp: 2,
          tempDeviation: 3,
          minVentPct: 20,
          maxVentPct: 70,
        },
      },
    ],
  });
  assert.equal(multi.lines[0].label, "A 설정온도");
  assert.equal(multi.lines[0].to, "25.0℃");
  assert.equal(multi.lines[4].label, "B 설정온도");
  assert.equal(multi.lines[4].to, "2.0℃");
}

console.log("command-confirm.test.ts ok");
