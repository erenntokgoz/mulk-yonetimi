import { proxyAuth } from "@/lib/api/auth-bff";

export async function GET(request: Request): Promise<Response> {
  return proxyAuth(request, "/api/v1/me/notification-preferences", false);
}

export async function PUT(request: Request): Promise<Response> {
  return proxyAuth(request, "/api/v1/me/notification-preferences", true);
}
