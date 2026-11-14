import { proxyAuth } from "@/lib/api/auth-bff";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context): Promise<Response> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  return proxyAuth(request, `/api/v1/properties/${id}`, true);
}

export async function POST(request: Request, { params }: Context): Promise<Response> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  return proxyAuth(request, `/api/v1/properties/${id}/archive`, true);
}
