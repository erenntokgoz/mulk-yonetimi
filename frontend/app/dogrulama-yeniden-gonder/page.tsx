import { EmailActionForm } from "@/components/email-action-form";
export default function ResendConfirmationPage() {
  return <EmailActionForm title="Doğrulama e-postası" endpoint="/api/bff/auth/resend-confirmation" />;
}
