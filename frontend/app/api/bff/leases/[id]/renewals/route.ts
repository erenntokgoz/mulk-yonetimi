import { proxyAuth } from "@/lib/api/auth-bff";

type Context = { params: Promise<{ id: string }> };

async function path(context: Context) {
  const { id } = await context.params;
  return /^[0-9a-f-]{36}$/i.test(id) ? `/api/v1/leases/${id}/renewals` : null;
}

export async function GET(request: Request, context: Context): Promise<Response> {
  const target = await path(context);
  return target ? proxyAuth(request, target, false) : new Response(null, { status: 404 });
}

export async function POST(request: Request, context: Context): Promise<Response> {
  const target = await path(context);
  return target ? proxyAuth(request, target, true) : new Response(null, { status: 404 });
}
