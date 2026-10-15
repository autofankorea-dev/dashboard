"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import {
  COMMAND_PRESET_MAX,
  hasPresetChannels,
  seedPresetCreateChannels,
  type CommandPreset,
  type CommandPresetChannels,
} from "@/lib/farm/command-presets";
import { SettingsEditOverlay } from "@/components/farm/settings-edit-overlay";
import { SettingsPresetCreateForm } from "@/components/farm/settings-preset-create-form";
import { dashboardAffordance } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";

type StripItem = CommandPreset & {
  source?: "shared" | "personal";
  removable?: boolean;
  title?: string;
};

type Props = {
  items: StripItem[];
  activeId: string | null;
  disabled?: boolean;
  canStore: boolean;
  seedChannels: CommandPresetChannels;
  onPick: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: (
    name: string,
    channels: CommandPresetChannels,
  ) => "ok" | "empty-name" | "empty-channels" | "full";
  /** 일괄 카드는 이미 저장한 칩만 고른다. */
  showCreate?: boolean;
};

const chipClass =
  "inline-flex h-7 shrink-0 items-center rounded-md border px-2 text-[11px] font-medium outline-none";

export function SettingsCommandPresetStrip({
  items,
  activeId,
  disabled = false,
  canStore,
  seedChannels,
  onPick,
  onDelete,
  onCreate,
  showCreate = true,
}: Props) {
  const t = useSheetCopy();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [drafts, setDrafts] = useState<CommandPresetChannels>({});
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CommandPreset | null>(null);
  const locked = disabled || !canStore;
  const personalCount = items.filter(
    (item) => item.source !== "shared",
  ).length;
  const atCap = personalCount >= COMMAND_PRESET_MAX;
  const canOpenCreate =
    !locked && !atCap && hasPresetChannels(seedChannels);

  const closeCreate = () => {
    setCreating(false);
    setError(null);
  };

  const submitCreate = () => {
    const result = onCreate(name, seedPresetCreateChannels(drafts));
    if (result === "ok") {
      closeCreate();
      setName("");
      setDrafts({});
      return;
    }
    if (result === "empty-name") setError(t("preset.needName"));
    else if (result === "empty-channels") setError(t("preset.needChannels"));
    else setError(t("preset.capFull"));
  };

  return (
    <div className="flex flex-col gap-1">
      {showCreate ? (
        <button
          type="button"
          disabled={!canOpenCreate}
          aria-label={t("preset.createAria")}
          title={atCap ? t("preset.cap") : t("preset.makeChip")}
          onClick={() => {
            setDrafts(seedPresetCreateChannels(seedChannels));
            setName(t("preset.numbered", { n: personalCount + 1 }));
            setError(null);
            setCreating(true);
          }}
          className={cn(
            chipClass,
            "w-fit gap-0.5",
            motionClass.microHover,
            dashboardAffordance.chipToggleIdle,
            !canOpenCreate && "opacity-60",
          )}
        >
          <Plus className="size-3" strokeWidth={2.25} aria-hidden />
          {t("preset.create")}
        </button>
      ) : null}
      {items.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label={t("preset.group")}
        >
          {items.map((item) => {
            const on = activeId === item.id;
            const removable = item.removable !== false;
            const shared = item.source === "shared";
            return (
              <span
                key={item.id}
                className={cn(
                  "inline-flex h-7 max-w-full shrink-0 items-center rounded-md border",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : dashboardAffordance.chipToggleIdle,
                  locked && "opacity-60",
                )}
              >
                <button
                  type="button"
                  disabled={locked}
                  aria-pressed={on}
                  title={
                    item.title ??
                    (shared ? t("preset.sharedTitle") : t("preset.deviceTitle"))
                  }
                  onClick={() => onPick(item.id)}
                  className={cn(
                    "h-full min-w-0 pl-2 pr-1 text-[11px] font-medium outline-none",
                    motionClass.microHover,
                  )}
                >
                  {shared ? (
                    <span className="mr-1 opacity-70" aria-hidden>
                      {t("preset.shared")}
                    </span>
                  ) : null}
                  {item.name}
                </button>
                {removable ? (
                  <button
                    type="button"
                    disabled={locked}
                    aria-label={t("preset.delete", { name: item.name })}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDelete(item);
                    }}
                    className={cn(
                      "mr-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-[11px] leading-none",
                      motionClass.microHover,
                      on
                        ? "text-primary-foreground/80 hover:text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span aria-hidden>×</span>
                  </button>
                ) : (
                  <span className="w-1" aria-hidden />
                )}
              </span>
            );
          })}
        </div>
      ) : null}
      {showCreate ? (
      <SettingsEditOverlay
        open={creating}
        wide
        focusTarget="content"
        title={t("preset.create")}
        closeLabel={t("confirm.cancel")}
        primaryLabel={t("preset.create")}
        hint={t("preset.hint")}
        onClose={closeCreate}
        onPrimary={submitCreate}
      >
        {creating ? (
          <SettingsPresetCreateForm
            name={name}
            onName={setName}
            channels={drafts}
            onChannels={setDrafts}
            error={error}
            disabled={locked}
          />
        ) : null}
      </SettingsEditOverlay>
      ) : null}
      <SettingsEditOverlay
        open={pendingDelete != null}
        title={t("preset.deleteTitle")}
        closeLabel={t("confirm.cancel")}
        primaryLabel={t("preset.deleteAction")}
        hint={t("preset.deleteHint")}
        onClose={() => setPendingDelete(null)}
        onPrimary={() => {
          if (pendingDelete) onDelete(pendingDelete.id);
          setPendingDelete(null);
        }}
      >
        <p className="text-sm text-foreground">{pendingDelete?.name}</p>
      </SettingsEditOverlay>
    </div>
  );
}
