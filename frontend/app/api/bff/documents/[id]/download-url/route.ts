import { proxyAuth } from "@/lib/api/auth-bff";

export async function GET(
  request: Request,
  context: RouteContext<"/api/bff/documents/[id]/download-url">,
): Promise<Response> {
  const { id } = await context.params;
  return proxyAuth(request, `/api/v1/documents/${encodeURIComponent(id)}/download-url`, false);
}
