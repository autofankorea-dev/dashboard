export type ExampleTone = "ok" | "temp" | "comm";

export function coverExampleReading(tone: ExampleTone, now = Date.now()) {
  const base = {
    alarmLowTempC: 10,
    alarmHighTempC: 35,
    stallTyCode: "SP02",
    humidityPct: null as number | null,
  };
  if (tone === "temp") {
    return { ...base, status: "normal" as const, tempC: 33.2 };
  }
  if (tone === "comm") {
    return {
      ...base,
      status: "caution" as const,
      tempC: 24.6,
      receivedAt: new Date(now - 20 * 60_000).toISOString(),
    };
  }
  return { ...base, status: "normal" as const, tempC: 24.6 };
}
