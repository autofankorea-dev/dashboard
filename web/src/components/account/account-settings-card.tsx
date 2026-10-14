"use client";

import { useState } from "react";
import { useSyncExternalStore } from "react";
import { FarmAddressInput } from "@/components/settings/farm-address-input";
import type { FarmKey } from "@/lib/domain/farm-key";
import type { FarmLocationRow } from "@/lib/data/farm-location";
import {
  getDashboardTheme,
  setDashboardTheme,
  subscribeDashboardTheme,
} from "@/lib/ui/dashboard-theme";
import { accountMenuLayout } from "@/lib/ui/account-menu-layout";
import { cn } from "@/lib/utils";
import {
  useProfileSheetPrefs,
  useSheetCopy,
  useUpdateProfileSheetPrefs,
} from "@/components/account/profile-sheet-prefs";

type Section = "screen" | "motor" | "cover" | "language" | "address";

function addressPreview(text: string, emptyLabel: string) {
  const trimmed = text.trim();
  if (!trimmed) return emptyLabel;
  return trimmed.length > 6 ? `${trimmed.slice(0, 6)}…` : trimmed;
}

export function AccountSettingsCard({
  farmKey,
  location,
  canEditLocation,
  deferAddressFocus,
  onSaved,
}: {
  farmKey: FarmKey | null;
  location: FarmLocationRow | null | undefined;
  canEditLocation: boolean;
  deferAddressFocus?: boolean;
  onSaved?: () => void;
}) {
  const prefs = useProfileSheetPrefs();
  const update = useUpdateProfileSheetPrefs();
  const t = useSheetCopy();
  const [open, setOpen] = useState<Section | null>(null);
  const dark = useSyncExternalStore(
    subscribeDashboardTheme,
    () => getDashboardTheme() === "dark",
    () => false,
  );
  const addressText = location?.addressText ?? "";

  function toggle(section: Section) {
    setOpen((current) => (current === section ? null : section));
  }

  const rows: { id: Section; label: string; value: string; hidden?: boolean }[] = [
    {
      id: "screen",
      label: t("settings.screen"),
      value: dark ? t("settings.dark") : t("settings.light"),
    },
    {
      id: "motor",
      label: t("settings.motor"),
      value: prefs.motorDisplay === "bar" ? t("settings.bar") : t("settings.number"),
    },
    {
      id: "cover",
      label: t("settings.cover"),
      value: prefs.envCover ? t("settings.coverOn") : t("settings.coverOff"),
    },
    {
      id: "language",
      label: t("settings.language"),
      value: prefs.locale === "en" ? t("settings.english") : t("settings.korean"),
    },
    {
      id: "address",
      label: t("settings.address"),
      value: addressPreview(addressText, t("settings.address")),
      hidden: !farmKey,
    },
  ];

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      {rows.filter((row) => !row.hidden).map((row) => (
        <div key={row.id} className="min-w-0">
          <button
            type="button"
            className={cn(
              accountMenuLayout.contextFarmBtn,
              "flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left",
            )}
            aria-expanded={open === row.id}
            onClick={() => toggle(row.id)}
          >
            <span>{row.label}</span>
            <span className="truncate text-muted-foreground">{row.value}</span>
          </button>
          {open === row.id ? (
            <div className="px-1 py-1.5">
              {row.id === "screen" ? (
                <ChoiceRow
                  options={[
                    { id: "light", label: t("settings.light"), active: !dark },
                    { id: "dark", label: t("settings.dark"), active: dark },
                  ]}
                  onPick={(id) => setDashboardTheme(id === "dark" ? "dark" : "light")}
                />
              ) : null}
              {row.id === "motor" ? (
                <ChoiceRow
                  options={[
                    { id: "number", label: t("settings.number"), active: prefs.motorDisplay === "number" },
                    { id: "bar", label: t("settings.bar"), active: prefs.motorDisplay === "bar" },
                  ]}
                  onPick={(id) => void update({ motorDisplay: id === "bar" ? "bar" : "number" })}
                />
              ) : null}
              {row.id === "cover" ? (
                <ChoiceRow
                  options={[
                    { id: "on", label: t("settings.coverOn"), active: prefs.envCover },
                    { id: "off", label: t("settings.coverOff"), active: !prefs.envCover },
                  ]}
                  onPick={(id) => void update({ envCover: id === "on" })}
                />
              ) : null}
              {row.id === "language" ? (
                <ChoiceRow
                  options={[
                    { id: "ko", label: t("settings.korean"), active: prefs.locale === "ko" },
                    { id: "en", label: t("settings.english"), active: prefs.locale === "en" },
                  ]}
                  onPick={(id) => void update({ locale: id === "en" ? "en" : "ko" })}
                />
              ) : null}
              {row.id === "address" && farmKey ? (
                <FarmAddressInput
                  key={`${farmKey.lsindRegistNo}-${farmKey.itemCode}`}
                  farmKey={farmKey}
                  location={location}
                  disabled={!canEditLocation}
                  compact
                  saveOnly
                  deferFocusUntilTap={deferAddressFocus}
                  onSaved={onSaved}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ChoiceRow({
  options,
  onPick,
}: {
  options: { id: string; label: string; active: boolean }[];
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={option.active}
          className={cn(
            "rounded-md border px-2 py-1 text-xs",
            option.active ? "border-primary bg-primary/10" : "border-border",
          )}
          onClick={() => onPick(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
