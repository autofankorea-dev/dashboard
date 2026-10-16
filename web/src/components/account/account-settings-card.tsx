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
import { SettingsControllerPanelExample } from "@/components/account/account-settings-examples";

function addressPreview(text: string, emptyLabel: string) {
  const trimmed = text.trim();
  if (!trimmed) return emptyLabel;
  return trimmed.length > 6 ? `${trimmed.slice(0, 6)}…` : trimmed;
}

export function AccountFarmAddressSetting({
  farmKey,
  location,
  canEditLocation,
  deferAddressFocus,
  onSaved,
}: {
  farmKey: FarmKey;
  location: FarmLocationRow | null | undefined;
  farmLabel?: string | null;
  canEditLocation: boolean;
  deferAddressFocus?: boolean;
  onSaved?: () => void;
}) {
  const t = useSheetCopy();
  const [open, setOpen] = useState(false);
  const addressText = location?.addressText ?? "";

  return (
    <div className={accountMenuLayout.addressChip} data-account-address-setting="">
      {open ? (
        <div className="flex h-full w-full min-w-0 items-center gap-1 px-2">
          <button
            type="button"
            className={cn(accountMenuLayout.contextFarmBtn, "shrink-0")}
            aria-expanded
            onClick={() => setOpen(false)}
          >
            {t("settings.address")}
          </button>
          <FarmAddressInput
            key={`${farmKey.lsindRegistNo}-${farmKey.itemCode}`}
            farmKey={farmKey}
            location={location}
            disabled={!canEditLocation}
            compact
            saveOnly
            inline
            deferFocusUntilTap={deferAddressFocus}
            onSaved={() => {
              setOpen(false);
              onSaved?.();
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          className={cn(
            accountMenuLayout.contextFarmBtn,
            "inline-flex h-full max-w-full items-center gap-2 px-2 text-left",
          )}
          aria-expanded={false}
          onClick={() => setOpen(true)}
        >
          <span className="shrink-0">{t("settings.address")}</span>
          <span className="min-w-0 truncate text-muted-foreground">
            {addressPreview(addressText, t("settings.address"))}
          </span>
        </button>
      )}
    </div>
  );
}

export function AccountSettingsCard() {
  const prefs = useProfileSheetPrefs();
  const update = useUpdateProfileSheetPrefs();
  const t = useSheetCopy();
  const dark = useSyncExternalStore(
    subscribeDashboardTheme,
    () => getDashboardTheme() === "dark",
    () => false,
  );

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex w-fit max-w-full flex-col items-start gap-3 sm:flex-row">
        <div className={accountMenuLayout.settingsToggles}>
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
    <div className="flex min-w-0 flex-wrap gap-1">
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
