"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { COMMAND_PRESET_MAX } from "@/lib/farm/command-presets";
import type { CommandPreset } from "@/lib/farm/command-presets";
import { SettingsEditOverlay } from "@/components/farm/settings-edit-overlay";
import { dashboardAffordance } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

type Props = {
  items: CommandPreset[];
  activeId: string | null;
  disabled?: boolean;
  canStore: boolean;
  onPick: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: (name: string) => "ok" | "empty-name" | "empty-channels" | "full";
};

const chipClass =
  "inline-flex h-7 shrink-0 items-center rounded-md border px-2 text-[11px] font-medium outline-none";

export function SettingsCommandPresetStrip({
  items,
  activeId,
  disabled = false,
  canStore,
  onPick,
  onDelete,
  onCreate,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CommandPreset | null>(null);
  const locked = disabled || !canStore;
  const atCap = items.length >= COMMAND_PRESET_MAX;

  return (
    <div className="flex flex-col gap-1">
      {adding ? (
        <form
          className="flex flex-col gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const result = onCreate(name);
            if (result === "ok") {
              setAdding(false);
              setName("");
              setError(null);
              return;
            }
            if (result === "empty-name") setError("이름을 입력하세요");
            else if (result === "empty-channels") setError("표에 저장할 값이 없습니다");
            else setError("카드당 8개까지입니다");
          }}
        >
          <div className="flex items-center gap-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={12}
              placeholder="이름"
              aria-label="프리셋 이름"
              className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[11px] outline-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={locked}
              className={cn(
                chipClass,
                motionClass.microHover,
                "border-primary bg-primary text-primary-foreground",
              )}
            >
              저장
            </button>
            <button
              type="button"
              className={cn(
                chipClass,
                motionClass.microHover,
                dashboardAffordance.chipToggleIdle,
              )}
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
            >
              취소
            </button>
          </div>
          <p className="px-0.5 text-[11px] text-muted-foreground">
            {error ?? "지금 표의 채널 값만 이 기기에 남깁니다. 현장으로 나가지 않습니다."}
          </p>
        </form>
      ) : (
        <button
          type="button"
          disabled={locked || atCap}
          aria-label="프리셋 추가"
          title={atCap ? "카드당 8개까지" : "지금 표를 이름으로 저장"}
          onClick={() => {
            setAdding(true);
            setName("");
            setError(null);
          }}
          className={cn(
            chipClass,
            "w-fit gap-0.5",
            motionClass.microHover,
            dashboardAffordance.chipToggleIdle,
            (locked || atCap) && "opacity-60",
          )}
        >
          <Plus className="size-3" strokeWidth={2.25} aria-hidden />
          저장
        </button>
      )}
      {items.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="명령 프리셋"
        >
          {items.map((item) => {
            const on = activeId === item.id;
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
                  onClick={() => {
                    setAdding(false);
                    setError(null);
                    onPick(item.id);
                  }}
                  className={cn(
                    "h-full min-w-0 pl-2 pr-1 text-[11px] font-medium outline-none",
                    motionClass.microHover,
                  )}
                >
                  {item.name}
                </button>
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
              </span>
            );
          })}
        </div>
      ) : null}
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
