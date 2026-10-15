import { formatStallTypeLabelLocalized, normalizeStallTyCode } from "@/lib/domain/stall-type";
import {
  CHANNEL_SLOT_LABELS,
  type ChannelSlot,
} from "@/lib/domain/iot-channel";
import { channelSlotCopyKey, sheetCopy } from "@/lib/ui/sheet-copy";
import type { SheetLocale } from "@/lib/ui/profile-sheet-prefs";

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
const MISSING_LABEL = "—";

const THERMO_ROWS: {
  key: keyof CommandThermoValues;
  labelKey: "settings.setpoint" | "confirm.deviation" | "settings.minVent" | "settings.maxVent";
  kind: "temp" | "vent";
}[] = [
  { key: "setpointTemp", labelKey: "settings.setpoint", kind: "temp" },
  { key: "tempDeviation", labelKey: "confirm.deviation", kind: "temp" },
  { key: "minVentPct", labelKey: "settings.minVent", kind: "vent" },
  { key: "maxVentPct", labelKey: "settings.maxVent", kind: "vent" },
];

function channelListLabel(slots: readonly ChannelSlot[], locale: SheetLocale): string {
  return slots
    .map((slot) =>
      locale === "en" ? sheetCopy(locale, channelSlotCopyKey(slot)) : CHANNEL_SLOT_LABELS[slot],
    )
    .join(", ");
}

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
  locale?: SheetLocale;
}): string {
  const locale = opts.locale ?? "ko";
  const channelList =
    opts.channels && opts.channels.length > 0
      ? opts.channels
      : opts.channel
        ? [opts.channel]
        : [];
  const channelSuffix =
    channelList.length > 0 ? ` ${channelListLabel(channelList, locale)}` : "";
  const typeLabel = formatStallTypeLabelLocalized(opts.stallTyCode, locale);
  const stall = formatOrdinalNo(opts.stallNo);
  const ctrl = formatOrdinalNo(opts.eqpmnNo);

  if (!opts.chartScoped || opts.onlineCount <= 1) {
    const stallPart = stall ? sheetCopy(locale, "confirm.stall", { stall }) : null;
    const ctrlPart = ctrl
      ? sheetCopy(locale, "confirm.ctrl", { ctrl })
      : sheetCopy(locale, "confirm.controller");
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
    return sheetCopy(locale, "confirm.chartTyped", {
      type: formatStallTypeLabelLocalized(uniqueTypes[0], locale),
      count: n,
    });
  }
  return sheetCopy(locale, "confirm.chartMixed", { count: n });
}

function displayFrom(
  current: CommandThermoValues | "mixed" | null,
  key: keyof CommandThermoValues,
  kind: "temp" | "vent",
  locale: SheetLocale,
): { text: string; warn: boolean } {
  if (current === "mixed") return { text: sheetCopy(locale, "confirm.mixed"), warn: true };
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
  locale?: SheetLocale;
}): CommandConfirmModel {
  const locale = input.locale ?? "ko";
  return {
    title: sheetCopy(locale, "confirm.title"),
    target: input.target,
    lines: THERMO_ROWS.map((row) => {
      const from = displayFrom(input.current, row.key, row.kind, locale);
      const toValue = input.command[row.key];
      return {
        label: sheetCopy(locale, row.labelKey),
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
  locale?: SheetLocale;
}): CommandConfirmModel {
  const locale = input.locale ?? "ko";
  if (input.channels.length === 1) {
    const only = input.channels[0];
    return buildCommandConfirmModel({
      target: input.target,
      current: only.current,
      command: only.command,
      locale,
    });
  }
  return {
    title: sheetCopy(locale, "confirm.title"),
    target: input.target,
    lines: input.channels.flatMap((ch) =>
      THERMO_ROWS.map((row) => {
        const from = displayFrom(ch.current, row.key, row.kind, locale);
        const toValue = ch.command[row.key];
        const slotName =
          locale === "en" ? sheetCopy(locale, channelSlotCopyKey(ch.channel)) : ch.channel;
        return {
          label: `${slotName} ${sheetCopy(locale, row.labelKey)}`,
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
