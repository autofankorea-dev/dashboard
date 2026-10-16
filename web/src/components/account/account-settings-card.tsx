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
import {
  SettingsAddressExample,
  SettingsControllerPanelExample,
} from "@/components/account/account-settings-examples";

function addressPreview(text: string, emptyLabel: string) {
  const trimmed = text.trim();
  if (!trimmed) return emptyLabel;
  return trimmed.length > 6 ? `${trimmed.slice(0, 6)}…` : trimmed;
}

export function AccountSettingsCard({
  farmKey,
  location,
  farmLabel,
  canEditLocation,
  deferAddressFocus,
  onSaved,
}: {
  farmKey: FarmKey | null;
  location: FarmLocationRow | null | undefined;
  farmLabel?: string | null;
  canEditLocation: boolean;
  deferAddressFocus?: boolean;
  onSaved?: () => void;
}) {
  const prefs = useProfileSheetPrefs();
  const update = useUpdateProfileSheetPrefs();
  const t = useSheetCopy();
  const [addressOpen, setAddressOpen] = useState(false);
  const dark = useSyncExternalStore(
    subscribeDashboardTheme,
    () => getDashboardTheme() === "dark",
    () => false,
  );
  const addressText = location?.addressText ?? "";

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex w-fit max-w-full flex-col items-start gap-3 sm:flex-row">
        <div className="grid shrink-0 grid-cols-[max-content_max-content] items-start gap-x-3 gap-y-2">
          <SettingName>{t("settings.screen")}</SettingName>
          <ChoiceRow
            options={[
              { id: "light", label: t("settings.light"), active: !dark },
              { id: "dark", label: t("settings.dark"), active: dark },
            ]}
            onPick={(id) => setDashboardTheme(id === "dark" ? "dark" : "light")}
          />
          <SettingName>{t("settings.motor")}</SettingName>
          <div className="flex flex-col gap-1">
            <ChoiceRow
              options={[
                { id: "number", label: t("settings.number"), active: prefs.motorDisplay === "number" },
                { id: "bar", label: t("settings.bar"), active: prefs.motorDisplay === "bar" },
              ]}
              onPick={(id) => void update({ motorDisplay: id === "bar" ? "bar" : "number" })}
            />
            <ChoiceRow
              options={[
                {
                  id: "fan",
                  label: t("settings.motorFanLarge"),
                  active: prefs.motorFocus !== "setpoint",
                },
                {
                  id: "setpoint",
                  label: t("settings.motorSetLarge"),
                  active: prefs.motorFocus === "setpoint",
                },
              ]}
              onPick={(id) =>
                void update({ motorFocus: id === "setpoint" ? "setpoint" : "fan" })
              }
            />
          </div>
          <SettingName>{t("settings.cover")}</SettingName>
          <ChoiceRow
            options={[
              { id: "on", label: t("settings.coverOn"), active: prefs.envCover },
              { id: "off", label: t("settings.coverOff"), active: !prefs.envCover },
            ]}
            onPick={(id) => void update({ envCover: id === "on" })}
          />
          <SettingName>{t("settings.language")}</SettingName>
          <ChoiceRow
            options={[
              { id: "ko", label: t("settings.korean"), active: prefs.locale === "ko" },
              { id: "en", label: t("settings.english"), active: prefs.locale === "en" },
            ]}
            onPick={(id) => void update({ locale: id === "en" ? "en" : "ko" })}
          />
        </div>
        <SettingsControllerPanelExample />
      </div>
      {farmKey ? (
        <div className={cn("min-w-0", accountMenuLayout.previewAddress)}>
          <button
            type="button"
            className={cn(
              accountMenuLayout.contextFarmBtn,
              "flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left",
            )}
            aria-expanded={addressOpen}
            onClick={() => setAddressOpen((open) => !open)}
          >
            <span>{t("settings.address")}</span>
            <span className="truncate text-muted-foreground">
              {addressPreview(addressText, t("settings.address"))}
            </span>
          </button>
          {addressOpen ? (
            <div className="flex flex-col gap-1.5 py-1.5">
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
              <SettingsAddressExample
                farmName={farmLabel || location?.farmName || t("header.farmSelect")}
                address={addressText}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SettingName({ children }: { children: string }) {
  return <span className="pt-1 text-xs font-medium">{children}</span>;
}

function ChoiceRow({
  options,
  onPick,
}: {
  options: { id: string; label: string; active: boolean }[];
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex flex-nowrap gap-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={option.active}
          className={cn(
            "rounded-md border px-2 py-1 text-xs",
            option.active
              ? "border-control-border bg-control-active text-control-foreground"
              : "border-border",
          )}
          onClick={() => onPick(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
