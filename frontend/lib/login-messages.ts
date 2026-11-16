// Parola ve Google girişi aynı durum için aynı metni gösterir.
export const loginMessages = {
  invalid: "E-posta veya parola hatalı.",
  forbidden: "Hesap erişimi kullanılamıyor. E-posta doğrulamasını ve hesap durumunu kontrol edin.",
  pending: "Hesabınız pilot onayı bekliyor. Onaylandıktan sonra giriş yapabilirsiniz.",
  limited: "Çok fazla deneme. Bir dakika sonra tekrar deneyin.",
  failed: "Giriş yapılamadı. Daha sonra tekrar deneyin.",
  offline: "Bağlantı kurulamadı. Daha sonra tekrar deneyin.",
} as const;

export function loginStatusMessage(status: number): string {
  if (status === 401) return loginMessages.invalid;
  if (status === 403) return loginMessages.forbidden;
  if (status === 423) return loginMessages.pending;
  if (status === 429) return loginMessages.limited;
  return loginMessages.failed;
}

// /api/bff/auth/google/callback hatada /giris?hata=<kod> adresine döner.
const googleMessages: Record<string, string> = {
  google: "Google ile giriş yapılamadı. Tekrar deneyin.",
  "google-hesap": "Bu e-posta adresiyle Google girişi kullanılamıyor. E-posta ve parolayla devam edin.",
  onay: loginMessages.pending,
  erisim: loginMessages.forbidden,
  sinir: loginMessages.limited,
};

export function googleErrorMessage(code: string | null): string | null {
  return code && Object.hasOwn(googleMessages, code) ? googleMessages[code] : null;
}
