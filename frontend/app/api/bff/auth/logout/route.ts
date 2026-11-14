import { proxyAuth } from "@/lib/api/auth-bff";

export async function POST(request: Request): Promise<Response> {
  return proxyAuth(request, "/api/v1/auth/logout", true);
}
