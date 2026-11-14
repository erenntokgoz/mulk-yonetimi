import { proxyAuth } from "@/lib/api/auth-bff";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  return proxyAuth(request, `/api/v1/payments/${encodeURIComponent(id)}/allocations`, true);
}
