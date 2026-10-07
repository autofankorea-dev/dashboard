import type { ThermoCommand } from "@/lib/data/commands";

/** Current queue/pipeline rows precede history. A new command supersedes old failures. */
export function latestFailedCommand(commands: readonly ThermoCommand[]): ThermoCommand | null {
  const unique = new Map<string, ThermoCommand>();
  for (const cmd of commands) if (!unique.has(cmd.id)) unique.set(cmd.id, cmd);
  const latest = [...unique.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return latest?.status === "failed" ? latest : null;
}

export function commandFailureExplanation(error: string | null): { title: string; detail: string } {
  if (/ack\s*timeout|response.*timeout|응답.*시간/i.test(error ?? "")) return {
    title: "반영 확인 시간 초과",
    detail: "장비 응답을 시간 안에 확인하지 못했습니다. 실제 적용 여부는 마지막 수신값을 확인하세요.",
  };
  if (/mqtt|publish|connection|network|timed?\s*out|timeout/i.test(error ?? "")) return {
    title: "명령 전송 실패",
    detail: "통신 과정에서 명령 처리를 완료하지 못했습니다. 연결 상태를 확인한 후 다시 설정하세요.",
  };
  return { title: "명령 처리 실패", detail: "명령 처리를 완료하지 못했습니다. 마지막 수신값을 확인한 후 다시 설정하세요." };
}
