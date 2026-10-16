"use client";

import { useState } from "react";
import type { MotorFocus, SheetLocale } from "@/lib/ui/profile-sheet-prefs";
import { useProfileSheetPrefs, useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { accountMenuLayout } from "@/lib/ui/account-menu-layout";
import { cn } from "@/lib/utils";

const MOTOR_VALUES = [72, 41, 8] as const;
const MOTOR_SETS = [
  { set: "24.0", dev: "2.0" },
  { set: "25.5", dev: "2.5" },
  { set: "27.0", dev: "3.0" },
] as const;

function exampleStallType(locale: SheetLocale) {
  return locale === "en" ? "Finisher" : "비육사";
}

function ExampleChannels({
  mode,
  focus,
  selected,
  onPick,
}: {
  mode: "number" | "bar";
  focus: MotorFocus;
  selected: number;
  onPick: (index: number) => void;
}) {
  const t = useSheetCopy();
  const labels = [t("cover.channel1"), t("cover.channel2"), t("cover.channel3")];
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
      {labels.map((label, index) => {
        const fanLarge = focus !== "setpoint";
        const parts = MOTOR_SETS[index];
        const fan = (
          mode === "bar" ? (
            <span className="flex w-full min-w-0 items-center gap-1">
              <span
                className={cn(
                  "block min-w-0 flex-1 overflow-hidden rounded-full bg-muted",
                  fanLarge ? "h-1.5" : "h-1",
                )}
                aria-hidden
              >
                <span
                  className="block h-full bg-channel-motor"
                  style={{ width: `${MOTOR_VALUES[index]}%` }}
                />
              </span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  fanLarge ? "text-xs" : "text-[11px] text-muted-foreground",
                )}
              >
                {MOTOR_VALUES[index]}
              </span>
            </span>
          ) : (
            <span
              className={cn(
                "block text-center font-semibold tabular-nums",
                fanLarge ? "text-sm" : "text-[11px] text-muted-foreground",
              )}
            >
              {MOTOR_VALUES[index]}
              <span className="ml-0.5 text-[10px] font-medium">%</span>
            </span>
          )
        );
        const set = fanLarge ? (
          <span className="block text-center text-[11px] font-semibold tabular-nums text-muted-foreground">
            {parts.set} +{parts.dev}
          </span>
        ) : (
          <span className="flex items-baseline justify-center gap-0.5">
            <span className="text-sm font-semibold tabular-nums">{parts.set}</span>
            <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
              +{parts.dev}
            </span>
          </span>
        );
        return (
          <button
            key={label}
            type="button"
            aria-pressed={selected === index}
            className={cn(
              "relative min-h-12 rounded-md border bg-background px-1 py-1",
              selected === index && "border-primary",
            )}
            onClick={() => onPick(index)}
          >
            <span className="absolute top-0.5 left-1 text-[9px] font-semibold text-channel-motor">
              {label}
            </span>
            <span className="mt-3 flex w-full flex-col items-center gap-0.5">
              {focus === "setpoint" ? (
                <>
                  {set}
                  {fan}
                </>
              ) : (
                <>
                  {fan}
                  {set}
                </>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** 화면·모터·덮개·언어가 같이 먹는 컨트롤러 카드 한 장. */
export function SettingsControllerPanelExample() {
  const prefs = useProfileSheetPrefs();
  const [selected, setSelected] = useState(0);
  const stall = exampleStallType(prefs.locale);

  return (
    <div
      data-settings-example="controller"
      className={cn(
        accountMenuLayout.previewCard,
        "relative shrink-0 overflow-hidden rounded-xl border bg-card",
      )}
    >
      <div className="px-2.5 py-2.5 sm:px-3 sm:py-3">
        <div className="mb-2 flex items-start justify-between gap-2 text-xs">
          <div>
            <div className="font-semibold">{stall}</div>
            <div className="mt-0.5 font-medium">12 · 3</div>
          </div>
          <div className="text-right">
            <div className="font-semibold">24.6°C</div>
            <div>61%</div>
          </div>
        </div>
        <ExampleChannels
          mode={prefs.motorDisplay}
          focus={prefs.motorFocus}
          selected={selected}
          onPick={setSelected}
        />
      </div>
      {prefs.envCover ? (
        <div className="absolute inset-0 flex flex-col justify-between bg-[var(--status-ok)] p-2.5 text-[11px] font-semibold sm:p-3">
          <div>
            <div>{stall}</div>
            <div className="mt-0.5 font-medium">12 · 3</div>
          </div>
          <div className="text-sm">24.6°C</div>
        </div>
      ) : (
        <span
          className="pointer-events-none absolute inset-y-0 left-0 w-2 bg-[var(--status-ok)]"
          aria-hidden
        />
      )}
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
    <div
      data-settings-example="address"
      className={cn(
        "rounded-lg border bg-background px-2 py-1.5",
      )}
    >
      <div className="text-xs font-semibold">{farmName}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        {address.trim() || t("settings.address")}
      </div>
    </div>
  );
}
