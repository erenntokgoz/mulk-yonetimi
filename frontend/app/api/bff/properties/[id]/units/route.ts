import { proxyAuth } from "@/lib/api/auth-bff";

type Context = { params: Promise<{ id: string }> };

async function propertyId(context: Context): Promise<string | null> {
  const { id } = await context.params;
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

export async function GET(request: Request, context: Context): Promise<Response> {
  const id = await propertyId(context);
  if (!id) return new Response(null, { status: 404 });
  const query = new URL(request.url).search;
  return proxyAuth(request, `/api/v1/properties/${id}/units${query}`, false);
}

export async function POST(request: Request, context: Context): Promise<Response> {
  const id = await propertyId(context);
  if (!id) return new Response(null, { status: 404 });
  return proxyAuth(request, `/api/v1/properties/${id}/units`, true);
}
