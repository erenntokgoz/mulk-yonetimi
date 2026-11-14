export const sections = [
  { path: "/panel", title: "Genel bakış", group: "GENEL", unavailable: "" },
  {
    path: "/portfoy",
    title: "Portföy",
    group: "MÜLK YÖNETİMİ",
    unavailable: "Mülk kayıtları şu anda kullanıma açık değil.",
  },
  {
    path: "/kiracilar",
    title: "Kiracılar",
    group: "MÜLK YÖNETİMİ",
    unavailable: "Kiracı kayıtları şu anda kullanıma açık değil.",
  },
  {
    path: "/sozlesmeler",
    title: "Sözleşmeler",
    group: "MÜLK YÖNETİMİ",
    unavailable: "Sözleşme kayıtları şu anda kullanıma açık değil.",
  },
  {
    path: "/kira-tahsilatlar",
    title: "Kira ve tahsilatlar",
    group: "FİNANS",
    unavailable: "Alacak ve tahsilat kayıtları şu anda kullanıma açık değil.",
  },
  {
    path: "/depozitolar",
    title: "Depozitolar",
    group: "FİNANS",
    unavailable: "Depozito kayıtları şu anda kullanıma açık değil.",
  },
  {
    path: "/giderler",
    title: "Giderler",
    group: "FİNANS",
    unavailable: "Gider kayıtları şu anda kullanıma açık değil.",
  },
  { path: "/belgeler", title: "Belgeler", group: "KAYITLAR", unavailable: "" },
  {
    path: "/raporlar",
    title: "Raporlar",
    group: "KAYITLAR",
    unavailable: "Raporlar şu anda kullanıma açık değil.",
  },
  { path: "/bildirimler", title: "Bildirimler", group: "SİSTEM", unavailable: "" },
  { path: "/ayarlar", title: "Ayarlar", group: "SİSTEM", unavailable: "" },
] as const;

export function findSection(path: string) {
  return sections.find((section) => section.path === path);
}
