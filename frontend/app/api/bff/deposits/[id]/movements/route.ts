import { proxyAuth } from "@/lib/api/auth-bff";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context): Promise<Response> {
  const { id } = await context.params;
  return /^[0-9a-f-]{36}$/i.test(id)
    ? proxyAuth(request, `/api/v1/deposits/${id}/movements${new URL(request.url).search}`, false)
    : new Response(null, { status: 404 });
}
export async function POST(request: Request, context: Context): Promise<Response> {
  const { id } = await context.params;
  return /^[0-9a-f-]{36}$/i.test(id)
    ? proxyAuth(request, `/api/v1/deposits/${id}/movements`, true)
    : new Response(null, { status: 404 });
}
