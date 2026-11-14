import { proxyAuth } from "@/lib/api/auth-bff";

export async function GET(request: Request): Promise<Response> {
  return proxyAuth(request, `/api/v1/rent-charges${new URL(request.url).search}`, false);
}
