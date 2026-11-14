import { proxyAuth } from "@/lib/api/auth-bff";

export async function POST(
  request: Request,
  context: RouteContext<"/api/bff/documents/[id]/complete">,
): Promise<Response> {
  const { id } = await context.params;
  return proxyAuth(request, `/api/v1/documents/${encodeURIComponent(id)}/complete`, true);
}
