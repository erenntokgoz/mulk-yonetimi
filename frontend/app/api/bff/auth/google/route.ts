import { startGoogleSignIn } from "@/lib/api/google-auth";

export function GET(request: Request): Response {
  return startGoogleSignIn(request);
}
