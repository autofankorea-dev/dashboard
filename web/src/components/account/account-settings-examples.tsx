"use client";

import { useState } from "react";
import { Check, Thermometer, Wifi } from "lucide-react";
import {
  controllerEnvCoverFillClass,
  controllerEnvCoverNotices,
  coverNoticeLevel,
} from "@/lib/farm/controller-env-cover";
import type { SheetLocale } from "@/lib/ui/profile-sheet-prefs";
import { useProfileSheetPrefs, useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { coverExampleReading, type ExampleTone } from "@/lib/ui/settings-example-reading";
import { cn } from "@/lib/utils";

const MOTOR_VALUES = [72, 41, 8] as const;

function exampleStallType(locale: SheetLocale) {
  return locale === "en" ? "Finisher" : "비육사";
}

function ExampleChannels({
  mode,
  selected,
  onPick,
}: {
  mode: "number" | "bar";
  selected: number;
  onPick: (index: number) => void;
}) {
  const t = useSheetCopy();
  const labels = [t("cover.channel1"), t("cover.channel2"), t("cover.channel3")];
  return (
    <div className="grid grid-cols-3 gap-1">
      {labels.map((label, index) => (
        <button
          key={label}
          type="button"
          aria-pressed={selected === index}
          className={cn(
            "relative min-h-10 rounded-md border bg-background px-1 py-1",
            selected === index && "border-primary",
          )}
          onClick={() => onPick(index)}
        >
          <span className="absolute top-0.5 left-1 text-[9px] font-semibold text-channel-info">
            {label}
          </span>
          {mode === "bar" ? (
            <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span
                className="block h-full bg-channel-info"
                style={{ width: `${MOTOR_VALUES[index]}%` }}
              />
            </span>
          ) : (
            <span className="mt-2 block text-center text-xs font-semibold">
              {MOTOR_VALUES[index]}
              <span className="ml-0.5 text-[9px] font-medium">%</span>
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function SettingsFieldExample() {
  return (
    <div data-settings-example="screen" className="rounded-lg border bg-background p-2">
      <div className="mb-2 flex items-center gap-1">
        <span className="size-3 rounded-sm bg-primary" />
        <span className="h-2 w-16 rounded bg-muted" />
      </div>
      <div className="grid grid-cols-3 gap-1">
        {["24°", "23°", "31°", "22°", "36°", "—"].map((value) => (
          <div
            key={value}
            className="rounded-md bg-card px-1 py-1 text-center text-[11px] font-semibold text-card-foreground"
          >
            {value}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsMotorExample({ mode }: { mode: "number" | "bar" }) {
  const [selected, setSelected] = useState(0);
  const locale = useProfileSheetPrefs().locale;
  const t = useSheetCopy();
  return (
    <div data-settings-example="motor" className="rounded-lg border bg-card p-2">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold">{exampleStallType(locale)}</span>
        <span>24.6°C</span>
      </div>
      <ExampleChannels mode={mode} selected={selected} onPick={setSelected} />
      <p className="mt-1 text-[10px] text-muted-foreground">{t("settings.motor")}</p>
    </div>
  );
}

export function SettingsCoverExample({ on }: { on: boolean }) {
  const [tone, setTone] = useState<ExampleTone>("ok");
  const [selected, setSelected] = useState(0);
  const prefs = useProfileSheetPrefs();
  const t = useSheetCopy();
  const reading = coverExampleReading(on ? "ok" : tone);
  const top = controllerEnvCoverNotices(reading)[0];
  const level = coverNoticeLevel(top);
  const Icon = !top ? Check : top.kind === "comm" ? Wifi : Thermometer;
  const phrase = top
    ? `${t(top.kind === "comm" ? "cover.comm" : "cover.temp")} ${t(top.grade === "caution" ? "cover.caution" : top.grade === "warning" ? "cover.warning" : "cover.down")}`
    : t("cover.ok");
  const stall = exampleStallType(prefs.locale);

  if (on) {
    return (
      <div data-settings-example="cover" className="grid grid-cols-2 gap-1">
        <div className="relative min-h-16 rounded-md bg-[var(--status-ok)] p-2 text-[11px] font-semibold">
          <div>{stall}</div>
          <div className="mt-0.5 font-medium">12 · 3</div>
          <div className="mt-1 text-sm">24.6°C</div>
        </div>
        <div className="rounded-md border bg-card p-2">
          <div className="flex items-start justify-between gap-1 text-[11px]">
            <div>
              <div className="font-semibold">{stall}</div>
              <div>12 · 3</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">24.6°C</div>
              <div>61%</div>
            </div>
          </div>
          <div className="mt-1">
            <ExampleChannels mode={prefs.motorDisplay} selected={selected} onPick={setSelected} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-settings-example="cover" className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        {(
          [
            ["ok", t("cover.ok")],
            ["temp", `${t("cover.temp")} ${t("cover.caution")}`],
            ["comm", `${t("cover.comm")} ${t("cover.warning")}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tone === id}
            className={cn(
              "rounded-md border px-2 py-0.5 text-[10px]",
              tone === id && "border-primary bg-primary/10",
            )}
            onClick={() => setTone(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex overflow-hidden rounded-md border bg-card">
        <span className={cn("w-2 shrink-0", controllerEnvCoverFillClass(level))} aria-hidden />
        <div className="min-w-0 flex-1 p-2">
          <div className="flex items-center gap-1 text-xs font-semibold">
            <Icon className="size-3.5" aria-hidden />
            <span>{phrase}</span>
          </div>
          <div className="mt-1 flex items-start justify-between text-[11px]">
            <div>
              <div className="font-semibold">{stall}</div>
              <div>12 · 3</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">24.6°C</div>
              <div>61%</div>
            </div>
          </div>
          <ExampleChannels mode={prefs.motorDisplay} selected={selected} onPick={setSelected} />
        </div>
      </div>
    </div>
  );
}

export function SettingsLanguageExample() {
  const locale = useProfileSheetPrefs().locale;
  const t = useSheetCopy();
  return (
    <div
      data-settings-example="language"
      className="flex items-center gap-2 rounded-md bg-[var(--status-ok)] px-2 py-1.5 text-[11px] font-semibold"
    >
      <span>{exampleStallType(locale)}</span>
      <span>24.6°C</span>
      <span>{[t("cover.channel1"), t("cover.channel2"), t("cover.channel3")].join(" · ")}</span>
    </div>
  );
}

export function SettingsAddressExample({
  farmName,
  address,
}: {
  farmName: string;
  address: string;
}) {
  const t = useSheetCopy();
  return (
    <div data-settings-example="address" className="rounded-lg border bg-background px-2 py-1.5">
      <div className="text-xs font-semibold">{farmName}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        {address.trim() || t("settings.address")}
      </div>
    </div>
  );
}
