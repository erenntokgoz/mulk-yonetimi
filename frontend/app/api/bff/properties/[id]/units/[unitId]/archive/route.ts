import { proxyAuth } from "@/lib/api/auth-bff";

type Context = { params: Promise<{ id: string; unitId: string }> };

export async function POST(request: Request, { params }: Context): Promise<Response> {
  const { id, unitId } = await params;
  if (![id, unitId].every((value) => /^[0-9a-f-]{36}$/i.test(value)))
    return new Response(null, { status: 404 });
  return proxyAuth(request, `/api/v1/properties/${id}/units/${unitId}/archive`, true);
}
