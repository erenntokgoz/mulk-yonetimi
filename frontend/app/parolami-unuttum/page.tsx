import { EmailActionForm } from "@/components/email-action-form";
export default function ForgotPasswordPage() {
  return (
    <EmailActionForm
      title="Parolanızı sıfırlayın."
      endpoint="/api/bff/auth/forgot-password"
      sentText="Bu adres kayıtlıysa birkaç dakika içinde bir sıfırlama bağlantısı gelir. Gelen kutusunda yoksa istenmeyen klasörüne de bakın."
    />
  );
}
