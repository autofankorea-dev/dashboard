export type ControllerCommandFailure = { key: string; error: string };

/** `key` identifies a controller reading, including farm/module scope, never a channel. */
export function controllerCommandResult<T extends { key: string }>(
  sentItems: T[], failures: ControllerCommandFailure[], error?: string,
) {
  const failed = [...new Map(failures.map((failure) => [failure.key, failure])).values()];
  const failedKeys = new Set(failed.map((failure) => failure.key));
  const sent = new Set(sentItems.map((item) => item.key).filter((key) => !failedKeys.has(key))).size;
  // Keep all registered IDs for ACK polling, even when a controller partly failed registration.
  return { ok: !error && failed.length === 0, sent, failed, sentItems, error };
}
