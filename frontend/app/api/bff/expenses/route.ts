import { proxyAuth } from "@/lib/api/auth-bff";
export async function GET(request: Request): Promise<Response> {
  return proxyAuth(request, `/api/v1/expenses${new URL(request.url).search}`, false);
}
export async function POST(request: Request): Promise<Response> {
  return proxyAuth(request, "/api/v1/expenses", true);
}
