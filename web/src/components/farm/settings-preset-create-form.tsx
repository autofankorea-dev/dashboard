"use client";

import { useEffect, useRef } from "react";
import type { PanelDraft } from "@/lib/controllers/controller-panel-draft";
import {
  CHANNEL_SLOT_LABELS,
  type ChannelSlot,
} from "@/lib/data/iot-channel";
import {
  applyPresetCreateField,
  COMMAND_PRESET_NAME_MAX,
  PRESET_VENT_STEP,
  type CommandPresetChannels,
  type PresetCreateField,
} from "@/lib/farm/command-presets";
import {
  SettingsChannelStepperGrid,
  SettingsChannelWell,
} from "@/components/farm/settings-channel-stepper-grid";

const SLOTS: ChannelSlot[] = ["A", "B", "C"];

type Props = {
  name: string;
  onName: (value: string) => void;
  channels: CommandPresetChannels;
  onChannels: (next: CommandPresetChannels) => void;
  error?: string | null;
  disabled?: boolean;
};

function patchField(
  channels: CommandPresetChannels,
  slot: ChannelSlot,
  field: PresetCreateField,
  value: number,
): CommandPresetChannels {
  const current = channels[slot];
  if (!current) return channels;
  return { ...channels, [slot]: applyPresetCreateField(current, field, value) };
}

export function SettingsPresetCreateForm({
  name,
  onName,
  channels,
  onChannels,
  error,
  disabled = false,
}: Props) {
  const nameRef = useRef<HTMLInputElement>(null);
  const slots = SLOTS.filter((slot) => channels[slot] != null);

  useEffect(() => {
    const el = nameRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-muted-foreground">이름</span>
        <input
          ref={nameRef}
          value={name}
          maxLength={COMMAND_PRESET_NAME_MAX}
          disabled={disabled}
          placeholder="이름"
          aria-label="프리셋 이름"
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none"
          onChange={(e) => onName(e.target.value)}
        />
      </label>
      {slots.map((slot) => {
        const draft = channels[slot] as PanelDraft;
        return (
          <SettingsChannelWell key={slot} title={CHANNEL_SLOT_LABELS[slot]}>
            <SettingsChannelStepperGrid
              draft={draft}
              disabled={disabled}
              ventStep={PRESET_VENT_STEP}
              onChange={(field, value) =>
                onChannels(patchField(channels, slot, field, value))
              }
            />
          </SettingsChannelWell>
        );
      })}
      <p className="text-[11px] text-muted-foreground">
        {error ??
          "설정·편차 0.1℃, 환기 5%. −/+를 꾹 누르면 연속입니다. 이 기기 칩만 만듭니다."}
      </p>
    </div>
  );
}
