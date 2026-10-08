import { formatStallTypeLabel, normalizeStallTyCode } from "@/lib/data/stall-type";
import {
  formatChannelSlotList,
  type ChannelSlot,
} from "@/lib/data/iot-channel";

export type CommandThermoValues = {
  setpointTemp: number;
  tempDeviation: number;
  minVentPct: number;
  maxVentPct: number;
};

export type CommandConfirmLine = {
  label: string;
  from: string;
  fromWarn: boolean;
  to: string;
};

export type CommandConfirmModel = {
  title: string;
  target: string;
  lines: CommandConfirmLine[];
};

const TEMP_EPS = 0.05;
const MIXED_LABEL = "다름";
const MISSING_LABEL = "—";

const THERMO_ROWS: {
  key: keyof CommandThermoValues;
  label: string;
  kind: "temp" | "vent";
}[] = [
  { key: "setpointTemp", label: "설정온도", kind: "temp" },
  { key: "tempDeviation", label: "온도편차", kind: "temp" },
  { key: "minVentPct", label: "최저환기", kind: "vent" },
  { key: "maxVentPct", label: "최고환기", kind: "vent" },
];

export function formatOrdinalNo(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t || t.startsWith("__")) return null;
  const n = Number.parseInt(t, 10);
  if (Number.isFinite(n) && n > 0) return String(n);
  return t;
}

export function formatTempDisplay(value: number): string {
  return `${value.toFixed(1)}℃`;
}

export function formatVentDisplay(value: number): string {
  return `${Math.round(value)}%`;
}

export function thermoValuesClose(
  a: CommandThermoValues,
  b: CommandThermoValues,
): boolean {
  return (
    Math.abs(a.setpointTemp - b.setpointTemp) <= TEMP_EPS &&
    Math.abs(a.tempDeviation - b.tempDeviation) <= TEMP_EPS &&
    Math.round(a.minVentPct) === Math.round(b.minVentPct) &&
    Math.round(a.maxVentPct) === Math.round(b.maxVentPct)
  );
}

export function mergeCurrentThermo(
  values: Array<CommandThermoValues | null>,
): CommandThermoValues | "mixed" | null {
  if (values.length === 0) return null;
  const present = values.filter((v): v is CommandThermoValues => v != null);
  if (present.length === 0) return null;
  if (present.length !== values.length) return "mixed";
  const first = present[0];
  for (let i = 1; i < present.length; i += 1) {
    if (!thermoValuesClose(first, present[i])) return "mixed";
  }
  return first;
}

export function formatCommandConfirmTarget(opts: {
  stallTyCode?: string | null;
  stallNo?: string | null;
  eqpmnNo?: string | null;
  channel?: ChannelSlot | null;
  channels?: ChannelSlot[] | null;
  onlineCount: number;
  stallTyCodes?: Array<string | null | undefined>;
  chartScoped?: boolean;
}): string {
  const channelList =
    opts.channels && opts.channels.length > 0
      ? opts.channels
      : opts.channel
        ? [opts.channel]
        : [];
  const channelSuffix =
    channelList.length > 0 ? ` ${formatChannelSlotList(channelList)}` : "";
  const typeLabel = formatStallTypeLabel(opts.stallTyCode);
  const stall = formatOrdinalNo(opts.stallNo);
  const ctrl = formatOrdinalNo(opts.eqpmnNo);

  if (!opts.chartScoped || opts.onlineCount <= 1) {
    const stallPart = stall ? `${stall}번 축사` : null;
    const ctrlPart = ctrl ? `${ctrl}번 컨트롤러` : "컨트롤러";
    const place = stallPart ? `${stallPart}, ${ctrlPart}` : ctrlPart;
    return `${typeLabel} ${place}${channelSuffix}`;
  }

  const uniqueTypes = [
    ...new Set(
      (opts.stallTyCodes ?? [])
        .map((code) => normalizeStallTyCode(code))
        .filter((code) => code !== "UNK"),
    ),
  ];
  const n = opts.onlineCount;
  if (uniqueTypes.length === 1) {
    return `차트에 보이는 ${formatStallTypeLabel(uniqueTypes[0])} 온라인 ${n}대`;
  }
  return `차트에 보이는 온라인 ${n}대`;
}

function displayFrom(
  current: CommandThermoValues | "mixed" | null,
  key: keyof CommandThermoValues,
  kind: "temp" | "vent",
): { text: string; warn: boolean } {
  if (current === "mixed") return { text: MIXED_LABEL, warn: true };
  if (current == null) return { text: MISSING_LABEL, warn: false };
  const value = current[key];
  return {
    text: kind === "temp" ? formatTempDisplay(value) : formatVentDisplay(value),
    warn: false,
  };
}

export function buildCommandConfirmModel(input: {
  target: string;
  current: CommandThermoValues | "mixed" | null;
  command: CommandThermoValues;
}): CommandConfirmModel {
  return {
    title: "명령을 보낼까요?",
    target: input.target,
    lines: THERMO_ROWS.map((row) => {
      const from = displayFrom(input.current, row.key, row.kind);
      const toValue = input.command[row.key];
      return {
        label: row.label,
        from: from.text,
        fromWarn: from.warn,
        to:
          row.kind === "temp"
            ? formatTempDisplay(toValue)
            : formatVentDisplay(toValue),
      };
    }),
  };
}

export function buildMultiChannelCommandConfirmModel(input: {
  target: string;
  channels: Array<{
    channel: ChannelSlot;
    current: CommandThermoValues | null;
    command: CommandThermoValues;
  }>;
}): CommandConfirmModel {
  if (input.channels.length === 1) {
    const only = input.channels[0];
    return buildCommandConfirmModel({
      target: input.target,
      current: only.current,
      command: only.command,
    });
  }
  return {
    title: "명령을 보낼까요?",
    target: input.target,
    lines: input.channels.flatMap((ch) =>
      THERMO_ROWS.map((row) => {
        const from = displayFrom(ch.current, row.key, row.kind);
        const toValue = ch.command[row.key];
        return {
          label: `${ch.channel} ${row.label}`,
          from: from.text,
          fromWarn: from.warn,
          to:
            row.kind === "temp"
              ? formatTempDisplay(toValue)
              : formatVentDisplay(toValue),
        };
      }),
    ),
  };
}
