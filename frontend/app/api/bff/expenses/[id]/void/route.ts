import { proxyAuth } from "@/lib/api/auth-bff";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context): Promise<Response> {
  const { id } = await context.params;
  return /^[0-9a-f-]{36}$/i.test(id)
    ? proxyAuth(request, `/api/v1/expenses/${id}/void`, true)
    : new Response(null, { status: 404 });
}
