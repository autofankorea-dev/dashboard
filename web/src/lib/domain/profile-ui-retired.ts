/** profiles.ui_config keys retired with the legacy barn array / display-flag UI. */

const RETIRED_TOP_KEYS = [
  "barns",
  "displaySettings",
  "piggyPlayerId",
] as const;

export function omitRetiredProfileUiConfigKeys(
  prev: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...prev };
  for (const key of RETIRED_TOP_KEYS) {
    delete next[key];
  }
  const aliases = next.barnAliases;
  if (
    aliases &&
    typeof aliases === "object" &&
    !Array.isArray(aliases) &&
    Object.keys(aliases as Record<string, unknown>).length === 0
  ) {
    delete next.barnAliases;
  }
  return next;
}
