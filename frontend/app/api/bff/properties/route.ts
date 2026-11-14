import { proxyAuth } from "@/lib/api/auth-bff";

export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).search;
  return proxyAuth(request, `/api/v1/properties${query}`, false);
}

export async function POST(request: Request): Promise<Response> {
  return proxyAuth(request, "/api/v1/properties", true);
}
