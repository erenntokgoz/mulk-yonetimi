import { EmailActionForm } from "@/components/email-action-form";
export default function ForgotPasswordPage() {
  return <EmailActionForm title="Parolamı unuttum" endpoint="/api/bff/auth/forgot-password" />;
}
