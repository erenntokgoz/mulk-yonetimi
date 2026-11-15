import "server-only";
import { headers } from "next/headers";
import type { paths } from "@/lib/api/generated";
import { getBackendBaseUrl } from "@/lib/api/health";

type JsonGetPath = {
  [Path in keyof paths]: paths[Path]["get"] extends {
    responses: { 200: { content: { "application/json": unknown } } }
  } ? Path : never;
}[keyof paths];

type JsonResponse<Path extends JsonGetPath> = paths[Path]["get"] extends {
  responses: { 200: { content: { "application/json": infer Body } } }
} ? Body : never;

export async function serverGet<Path extends JsonGetPath>(path: Path,
  query: Record<string, string | number | boolean> = {}): Promise<JsonResponse<Path>> {
  const url = new URL(path, getBackendBaseUrl());
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
  const cookie = (await headers()).get("cookie");
  const response = await fetch(url, {
    headers: { Accept: "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`API request failed (${response.status})`);
  return await response.json() as JsonResponse<Path>;
}
