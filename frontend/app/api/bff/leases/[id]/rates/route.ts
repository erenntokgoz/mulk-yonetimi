import { proxyAuth } from "@/lib/api/auth-bff";
type Context = { params: Promise<{ id: string }> };
async function idFrom(context: Context) {
  const { id } = await context.params;
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}
export async function GET(request: Request, context: Context) {
  const id = await idFrom(context);
  return id ? proxyAuth(request, `/api/v1/leases/${id}/rates`, false) : new Response(null, { status: 404 });
}
export async function POST(request: Request, context: Context) {
  const id = await idFrom(context);
  return id ? proxyAuth(request, `/api/v1/leases/${id}/rates`, true) : new Response(null, { status: 404 });
}
