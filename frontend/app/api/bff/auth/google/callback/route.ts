import { finishGoogleSignIn } from "@/lib/api/google-auth";

export async function GET(request: Request): Promise<Response> {
  return finishGoogleSignIn(request);
}
