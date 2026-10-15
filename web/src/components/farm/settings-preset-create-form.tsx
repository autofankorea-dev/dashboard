"use client";

import { useEffect, useRef } from "react";
import type { PanelDraft } from "@/lib/controllers/controller-panel-draft";
import {
  type ChannelSlot,
} from "@/lib/domain/iot-channel";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { channelSlotCopyKey } from "@/lib/ui/sheet-copy";
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
  const t = useSheetCopy();
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
        <span className="text-[11px] text-muted-foreground">{t("preset.name")}</span>
        <input
          ref={nameRef}
          value={name}
          maxLength={COMMAND_PRESET_NAME_MAX}
          disabled={disabled}
          placeholder={t("preset.name")}
          aria-label={t("preset.nameAria")}
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none"
          onChange={(e) => onName(e.target.value)}
        />
      </label>
      {slots.map((slot) => {
        const draft = channels[slot] as PanelDraft;
        return (
          <SettingsChannelWell key={slot} title={t(channelSlotCopyKey(slot))}>
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
        {error ?? t("preset.formHint")}
      </p>
    </div>
  );
}
