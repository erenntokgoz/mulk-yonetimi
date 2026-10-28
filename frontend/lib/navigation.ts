export const sections = [
  { path: "/", title: "Genel bakış", unavailable: "" },
  { path: "/portfoy", title: "Portföy", unavailable: "Mülk kayıtları şu anda kullanıma açık değil." },
  { path: "/kiracilar", title: "Kiracılar", unavailable: "Kiracı kayıtları şu anda kullanıma açık değil." },
  { path: "/sozlesmeler", title: "Sözleşmeler", unavailable: "Sözleşme kayıtları şu anda kullanıma açık değil." },
  { path: "/kira-tahsilatlar", title: "Kira ve tahsilatlar", unavailable: "Alacak ve tahsilat kayıtları şu anda kullanıma açık değil." },
  { path: "/depozitolar", title: "Depozitolar", unavailable: "Depozito kayıtları şu anda kullanıma açık değil." },
  { path: "/giderler", title: "Giderler", unavailable: "Gider kayıtları şu anda kullanıma açık değil." },
  { path: "/belgeler", title: "Belgeler", unavailable: "Belge kayıtları şu anda kullanıma açık değil." },
  { path: "/raporlar", title: "Raporlar", unavailable: "Raporlar şu anda kullanıma açık değil." },
  { path: "/bildirimler", title: "Bildirimler", unavailable: "Bildirimler şu anda kullanıma açık değil." },
  { path: "/ayarlar", title: "Ayarlar", unavailable: "Hesap ayarları şu anda kullanıma açık değil." },
] as const;

export function findSection(path: string) {
  return sections.find((section) => section.path === path);
}
