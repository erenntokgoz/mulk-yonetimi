import "server-only";

export type HealthStatus = "Healthy" | "Degraded" | "Unhealthy";
export type HealthReport = {
  status: HealthStatus;
  checks: { name: string; status: HealthStatus; durationMs: number; description: string | null }[];
};
export type HealthResult =
  | { kind: "available"; health: HealthReport }
  | { kind: "unavailable"; reason: "network" | "invalid-response" };

export function getBackendBaseUrl(value = process.env.BACKEND_BASE_URL): string {
  try {
    const url = new URL(value ?? "");
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error();
    }
    return url.href;
  } catch {
    throw new Error("BACKEND_BASE_URL must be an absolute HTTP(S) URL without credentials, query or fragment.");
  }
}

function isStatus(value: unknown): value is HealthStatus {
  return value === "Healthy" || value === "Degraded" || value === "Unhealthy";
}

function isHealthReport(value: unknown): value is HealthReport {
  if (!value || typeof value !== "object" || !("status" in value) || !("checks" in value)) return false;
  return isStatus(value.status) && Array.isArray(value.checks) && value.checks.every((check: unknown) =>
    !!check && typeof check === "object" &&
    "name" in check && typeof check.name === "string" &&
    "status" in check && isStatus(check.status) &&
    "durationMs" in check && typeof check.durationMs === "number" && Number.isFinite(check.durationMs) && check.durationMs >= 0 &&
    "description" in check && (check.description === null || typeof check.description === "string")
  );
}

export async function getBackendHealth(baseUrl = getBackendBaseUrl()): Promise<HealthResult> {
  let response: Response;
  try {
    response = await fetch(new URL("health", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
  } catch {
    return { kind: "unavailable", reason: "network" };
  }
  try {
    const health: unknown = await response.json();
    if (!isHealthReport(health) || (response.status !== 200 && response.status !== 503) ||
      (response.status === 503) !== (health.status === "Unhealthy")) {
      return { kind: "unavailable", reason: "invalid-response" };
    }
    return { kind: "available", health };
  } catch {
    return { kind: "unavailable", reason: "invalid-response" };
  }
}
