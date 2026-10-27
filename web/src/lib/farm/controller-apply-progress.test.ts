import { expect, it } from "vitest";
import { controllerApplyProgress } from "./apply-queue";
import type { ThermoCommandStatus } from "@/lib/data/commands";

const row = (key: string, id: string, status: ThermoCommandStatus, liveConfirmed = status === "applied") =>
  ({ key, id, command: { status }, liveConfirmed });

it("14 controllers with two channels count as confirmed 10 / failed 4, never 10 / 8", () => {
  const rows = Array.from({ length: 14 }, (_, index) => ["A", "B"].map((slot) =>
    row(`controller-${index}`, `${index}:${slot}`, index < 10 ? "applied" : "failed"))).flat();
  const result = controllerApplyProgress(rows);
  expect(result.total).toBe(14);
  expect(result.counts).toEqual({ 접수: 0, 전송: 0, 확인: 10, 실패: 4 });
});

it("includes registration failures even though they have no DB row", () => {
  const rows = Array.from({ length: 10 }, (_, index) => row(`${index}`, `${index}`, "pending"));
  const result = controllerApplyProgress(rows, ["10", "10", "11", "12", "13"]);
  expect(result.total).toBe(14);
  expect(result.pending).toBe(10);
  expect(result.failed).toBe(4);
});

it("keeps controller stages exclusive until every requested channel has completed", () => {
  const result = controllerApplyProgress([
    row("pending", "pa", "applied"), row("pending", "pb", "pending"),
    row("sent", "sa", "applied"), row("sent", "sb", "sent", false),
    row("failed", "fa", "applied"), row("failed", "fb", "failed"),
    row("confirmed", "ca", "applied"), row("confirmed", "cb", "applied"),
  ]);
  expect(result.total).toBe(4);
  expect(result.counts).toEqual({ 접수: 1, 전송: 1, 확인: 1, 실패: 1 });
  expect(result.ackDone).toBe(2);
  expect(result.liveDone).toBe(1);
  expect(Object.values(result.counts).reduce((a, b) => a + b, 0)).toBe(result.total);
});

it("does not truncate a 48-controller request or count duplicated command views", () => {
  const rows = Array.from({ length: 48 }, (_, index) => row(`${index}`, `${index}`, "applied"));
  expect(controllerApplyProgress([...rows, ...rows]).total).toBe(48);
  expect(controllerApplyProgress([...rows, ...rows]).liveDone).toBe(48);
});

it("keeps all-rejected requests and same-number controllers in separate farms accurate", () => {
  expect(controllerApplyProgress([], Array.from({ length: 14 }, (_, i) => `${i}`)).counts.실패).toBe(14);
  const result = controllerApplyProgress([
    row("farm1:module1:01", "a", "applied"),
    row("farm2:module1:01", "b", "failed"),
  ]);
  expect(result.total).toBe(2);
  expect(result.liveDone).toBe(1);
  expect(result.failed).toBe(1);
});
