import { EmailActionForm } from "@/components/email-action-form";
export default function ResendConfirmationPage() {
  return (
    <EmailActionForm
      title="Doğrulama e-postası"
      endpoint="/api/bff/auth/resend-confirmation"
      sentText="Bu adres kayıtlıysa ve henüz doğrulanmamışsa birkaç dakika içinde yeni bir doğrulama bağlantısı gelir. Gelen kutusunda yoksa istenmeyen klasörüne de bakın."
    />
  );
}
