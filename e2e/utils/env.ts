/**
 * E2E environment. Defaults point at local servers. A non-localhost URL is
 * refused unless E2E_ALLOW_REMOTE=1, so the suite cannot hit production by
 * accident.
 */
export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const API_URL = process.env.E2E_API_URL ?? "http://localhost:5000";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function assertLocal(name: string, value: string): void {
  if (process.env.E2E_ALLOW_REMOTE === "1") return;
  const host = new URL(value).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `${name} must point at localhost. Set E2E_ALLOW_REMOTE=1 to run against a remote host on purpose.`,
    );
  }
}

assertLocal("E2E_BASE_URL", BASE_URL);
assertLocal("E2E_API_URL", API_URL);
