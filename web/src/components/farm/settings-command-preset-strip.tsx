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

type StripItem = CommandPreset & {
  source?: "shared" | "personal";
  removable?: boolean;
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
}: Props) {
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
    if (result === "empty-name") setError("이름을 입력하세요");
    else if (result === "empty-channels") setError("저장할 채널 값이 없습니다");
    else setError("카드당 8개까지입니다");
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={!canOpenCreate}
        aria-label="프리셋 생성"
        title={atCap ? "카드당 8개까지" : "이름과 채널 값으로 칩 만들기"}
        onClick={() => {
          setDrafts(seedPresetCreateChannels(seedChannels));
          setName(`${personalCount + 1}번`);
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
        생성
      </button>
      {items.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="명령 프리셋"
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
                  title={shared ? "축사유형 공용 프리셋" : "이 기기 프리셋"}
                  onClick={() => onPick(item.id)}
                  className={cn(
                    "h-full min-w-0 pl-2 pr-1 text-[11px] font-medium outline-none",
                    motionClass.microHover,
                  )}
                >
                  {shared ? (
                    <span className="mr-1 opacity-70" aria-hidden>
                      공용
                    </span>
                  ) : null}
                  {item.name}
                </button>
                {removable ? (
                  <button
                    type="button"
                    disabled={locked}
                    aria-label={`${item.name} 삭제`}
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
      <SettingsEditOverlay
        open={creating}
        wide
        focusTarget="content"
        title="생성"
        closeLabel="취소"
        primaryLabel="생성"
        hint="칩만 만들고 표를 채웁니다. 현장으로는 나가지 않습니다."
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
      <SettingsEditOverlay
        open={pendingDelete != null}
        title="삭제하시겠습니까?"
        closeLabel="취소"
        primaryLabel="삭제"
        hint="칩만 지웁니다. 현장 설정은 그대로입니다."
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
