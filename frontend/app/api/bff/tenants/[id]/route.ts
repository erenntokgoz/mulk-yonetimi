import { proxyAuth } from "@/lib/api/auth-bff";

type Context = { params: Promise<{ id: string }> };
async function getId(context: Context): Promise<string | null> {
  const { id } = await context.params;
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

export async function GET(request: Request, context: Context): Promise<Response> {
  const id = await getId(context);
  return id ? proxyAuth(request, `/api/v1/tenants/${id}`, false) : new Response(null, { status: 404 });
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  const id = await getId(context);
  return id ? proxyAuth(request, `/api/v1/tenants/${id}`, true) : new Response(null, { status: 404 });
}

export async function POST(request: Request, context: Context): Promise<Response> {
  const id = await getId(context);
  return id ? proxyAuth(request, `/api/v1/tenants/${id}/archive`, true) : new Response(null, { status: 404 });
}
