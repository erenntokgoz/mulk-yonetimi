import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { HeroScene } from "@/components/landing/hero-scene";
import { LandingActions } from "@/components/landing/landing-actions";
import { ThemeControl } from "@/components/theme-control";
import styles from "@/components/landing/landing.module.css";

const description =
  "Mülk, birim, kiracı ve sözleşme kayıtlarını tutun; kira alacaklarını, tahsilatları, depozitoları ve giderleri tek hesapta izleyin.";

export const metadata: Metadata = {
  title: "Mülküm: mülk, kiracı ve kira takibi",
  description,
  openGraph: {
    title: "Mülküm: mülk, kiracı ve kira takibi",
    description,
    siteName: "Mülküm",
    locale: "tr_TR",
    type: "website",
  },
};

const groups = [
  {
    title: "Kayıtlar",
    summary: "Mülkler, kiracılar ve aralarındaki sözleşmeler.",
    items: [
      [
        "Portföy ve birimler",
        "Mülkleri ve mülke bağlı birimleri kaydedin. Kullanılmayan kayıtları arşivleyin.",
      ],
      ["Kiracılar", "Kiracı iletişim bilgilerini tutun ve sözleşmelere bağlayın."],
      [
        "Sözleşmeler ve bedel dönemleri",
        "Başlangıç tarihi, ödeme günü, aylık bedel ve depozito tutarıyla sözleşme açın. Kira bedeli değiştiğinde yeni bir bedel dönemi ekleyin; önceki bedeller geçmişte kalır.",
      ],
    ],
  },
  {
    title: "Para",
    summary: "Alacaklar, tahsilatlar ve giderler.",
    items: [
      [
        "Kira alacağı ve kısmi tahsilat",
        "Etkin sözleşmeler için her dönemde bir kira alacağı oluşur. Tahsilatı tam ya da kısmi girin; kalan tutar ve ödeme durumu buna göre güncellenir.",
      ],
      ["Depozito", "Alınan depozitoyu sözleşmeye bağlı kaydedin ve bakiyesini izleyin."],
      ["Giderler", "Bakım gibi giderleri mülke bağlayarak tarih ve kategoriyle kaydedin."],
      [
        "Nakit akışı raporu",
        "Seçtiğiniz dönemin tahsilat ve gider hareketlerini görün. Rapor nakit akışını gösterir; net kâr hesabı değildir.",
      ],
    ],
  },
  {
    title: "Takip ve güvenlik",
    summary: "Bildirimler ve hesap ayrımı.",
    items: [
      [
        "Bildirimler",
        "Bildirimleri uygulama içinde okuyun, okundu olarak işaretleyin ve bildirim tercihlerini ayarlardan düzenleyin.",
      ],
      [
        "Hesap izolasyonu",
        "Her hesabın verisi ayrı tutulur; bir hesap başka bir hesabın kayıtlarına erişemez. Oturum sunucuda doğrulanır. Finansal kayıtlar silinmez; iptal ya da açık düzeltme olarak işlenir.",
      ],
    ],
  },
] as const;

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <a href="#icerik" className="skip-link">
        İçeriğe geç
      </a>
      <header className={styles.header}>
        <div className={`${styles.wrap} ${styles.headerRow}`}>
          <Link href="/" className={styles.brand} aria-label="Mülküm ana sayfa">
            <BrandMark size={30} />
            Mülküm
          </Link>
          <div className={styles.tools}>
            <ThemeControl />
            <LandingActions placement="header" />
          </div>
        </div>
      </header>
      <main id="icerik" tabIndex={-1} className={styles.wrap}>
        <section className={styles.hero} aria-labelledby="baslik">
          <div className={styles.heroText}>
            <h1 id="baslik">Mülk, kiracı ve kira takibi tek hesapta</h1>
            <p>
              Mülkleri ve sözleşmeleri kaydedin, kira alacaklarını ve tahsilatları izleyin, depozito ve
              giderleri işleyin.
            </p>
            <LandingActions placement="hero" />
          </div>
          <HeroScene />
        </section>
        {groups.map((group) => (
          <section key={group.title} className={styles.group} aria-labelledby={`g-${group.title}`}>
            <div>
              <h2 id={`g-${group.title}`}>{group.title}</h2>
              <p>{group.summary}</p>
            </div>
            <dl className={styles.items}>
              {group.items.map(([name, text]) => (
                <div key={name} className={styles.item}>
                  <dt>{name}</dt>
                  <dd>{text}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </main>
      <footer className={styles.footer}>
        <div className={`${styles.wrap} ${styles.footerRow}`}>
          <span>Mülküm: mülk, kiracı ve kira takibi</span>
        </div>
      </footer>
    </div>
  );
}
