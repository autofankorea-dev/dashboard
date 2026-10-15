import type { ThermoCommand } from "@/lib/data/commands";
import { sheetCopy } from "@/lib/ui/sheet-copy";
import type { SheetLocale } from "@/lib/ui/profile-sheet-prefs";

/** Current queue/pipeline rows precede history. A new command supersedes old failures. */
export function latestFailedCommand(commands: readonly ThermoCommand[]): ThermoCommand | null {
  const unique = new Map<string, ThermoCommand>();
  for (const cmd of commands) if (!unique.has(cmd.id)) unique.set(cmd.id, cmd);
  const latest = [...unique.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return latest?.status === "failed" ? latest : null;
}

export function commandFailureExplanation(
  error: string | null,
  locale: SheetLocale = "ko",
): { title: string; detail: string } {
  if (/ack\s*timeout|response.*timeout|응답.*시간/i.test(error ?? "")) return {
    title: sheetCopy(locale, "fail.ackTitle"),
    detail: sheetCopy(locale, "fail.ackDetail"),
  };
  if (/mqtt|publish|connection|network|timed?\s*out|timeout/i.test(error ?? "")) return {
    title: sheetCopy(locale, "fail.sendTitle"),
    detail: sheetCopy(locale, "fail.sendDetail"),
  };
  return {
    title: sheetCopy(locale, "fail.genericTitle"),
    detail: sheetCopy(locale, "fail.genericDetail"),
  };
}
