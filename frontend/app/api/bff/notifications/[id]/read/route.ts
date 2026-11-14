import { proxyAuth } from "@/lib/api/auth-bff";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/bff/notifications/[id]/read">,
): Promise<Response> {
  const { id } = await context.params;
  return proxyAuth(request, `/api/v1/notifications/${encodeURIComponent(id)}/read`, true);
}
