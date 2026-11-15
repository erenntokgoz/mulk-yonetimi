import type { Metadata } from "next";
import { BrandMark } from "@/components/brand-mark";
import { LandingActions, LandingGoogle } from "@/components/landing/landing-actions";
import { LandingClient } from "@/components/landing/landing-client";
import { ThemeControl } from "@/components/theme-control";
import styles from "@/components/landing/landing.module.css";

const description =
  "Mülkünüzü, kiracınızı ve her ayın kirasını tek hesapta tutarsınız. Kira gecikirse size e-posta gelir.";

export const metadata: Metadata = {
  title: "Mülküm | Kira, sözleşme ve tahsilat",
  description,
  openGraph: {
    title: "Mülküm | Kira, sözleşme ve tahsilat",
    description,
    siteName: "Mülküm",
    locale: "tr_TR",
    type: "website",
  },
};

// Açılış animasyonu yalnız hareket serbestse metni gizler; betik yüklenmezse 7 sn sonra içerik görünür kalır.
const animScript = `if(!matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.classList.add("anim");setTimeout(function(){if(!window.__ready)document.documentElement.classList.remove("anim")},7000)}`;

const sections = ["ust", "portfoy", "sozlesme", "tahsilat", "rapor", "guvence"];

const tileIcons = [
  <svg key="a" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><path d="M17 14v6M14 17h6" /></svg>,
  <svg key="b" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>,
  <svg key="c" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16M4 10h16M4 15h10" /><path d="M16 17l2 2 3-4" /></svg>,
];

const tiles = [
  ["Her hesap ayrı tutulur", "Mülk, kiracı, sözleşme ve ödeme kayıtlarınız yalnız sizin hesabınıza bağlıdır. Başka bir hesaptan bunlara ulaşılamaz."],
  ["Belgeler taranarak saklanır", "Yüklediğiniz dosya önce virüs taramasından geçer, sonra dışarıya kapalı bir depoya konur. İndirme bağlantısı kısa bir süre sonra kendiliğinden geçersiz olur."],
  ["Para kayıtları silinmez", "Bir ödemeyi iptal ettiğinizde ya da düzelttiğinizde nedeni de kayda geçer. Eski kayıt yerinde kalır."],
] as const;

// Metin sunucuda çizilir; üç boyutlu sahne ve kaydırma animasyonları LandingClient ile sonradan yüklenir.
export default function LandingPage() {
  return (
    <div className={styles.page}>
      <script dangerouslySetInnerHTML={{ __html: animScript }} />
      <a href="#icerik" className="skip-link">
        İçeriğe geç
      </a>
      <header className={styles.header} data-ui="">
        <a className={styles.brand} href="#ust" aria-label="Mülküm ana sayfa">
          <BrandMark size={32} />
          Mülküm
        </a>
        <nav className={styles.nav} aria-label="Bölümler">
          <a href="#portfoy">Portföy</a>
          <a href="#sozlesme">Sözleşme</a>
          <a href="#tahsilat">Tahsilat</a>
          <a href="#rapor">Rapor</a>
          <a href="#guvence">Güvence</a>
        </nav>
        <div className={styles.actions}>
          <ThemeControl />
          <LandingActions placement="header" />
        </div>
      </header>

      <div className={styles.progress} aria-hidden="true" data-ui="" data-progress="">
        {sections.map((id) => (
          <a key={id} href={`#${id}`} tabIndex={-1} />
        ))}
      </div>

      <LandingClient />

      <main id="icerik" tabIndex={-1} className={styles.main}>
        <section className={`${styles.sec} ${styles.hero}`} id="ust" data-phase="0">
          <div className={styles.wrap}>
            <h1>
              <span className={styles.ln}><span data-fx="ln">Kiralarınızı</span></span>{" "}
              <span className={styles.ln}><span data-fx="ln">tek yerden</span></span>{" "}
              <span className={styles.ln}><span data-fx="ln" className={styles.grad}>takip edin.</span></span>
            </h1>
            <p data-fx="rv">Mülkünüzü, kiracınızı ve her ayın kirasını aynı hesapta tutarsınız. Kira gecikirse size e-posta gelir.</p>
            <div className={styles.cta} data-fx="rv" data-ui="">
              <LandingActions placement="hero" />
              <a className={`${styles.btn} ${styles.btnGhost} ${styles.btnLg}`} href="#portfoy">Nasıl çalışır</a>
            </div>
            <ul className={styles.chips} data-fx="rv" data-ui="">
              <li className={styles.chip}><i style={{ background: "var(--brand)" }} />Kira alacağı her ay kendiliğinden açılır</li>
              <li className={styles.chip}><i style={{ background: "var(--partial)" }} />Geciken kira için e-posta gelir</li>
              <li className={styles.chip}><i style={{ background: "var(--paid)" }} />Tahsilat listesi CSV olarak iner</li>
            </ul>
            <div className={styles.scrollHint} data-fx="rv"><i /> Aşağı kaydırın</div>
          </div>
        </section>

        <section className={`${styles.sec} ${styles.chapter} ${styles.right}`} id="portfoy" data-phase="1">
          <div className={styles.wrap}><article className={styles.card} data-ui="" data-fx="card">
            <div className={styles.step}><b>01</b> Portföy</div>
            <h2>Her daire kendi kaydını taşır.</h2>
            <p>Binayı ve daireleri bir kez girersiniz. Sözleşmeler, ödemeler ve belgeler sonra doğru daireye bağlanır.</p>
            <ul className={styles.points}>
              <li>Tek daireli ev de girilir, çok daireli apartman da.</li>
              <li>Arşive aldığınız dairenin geçmişi raporlarda kalır.</li>
            </ul>
            <div className={styles.frag} data-ui="">
              <div className={styles.fragLabel}>Örnek görünüm</div>
              <div className={styles.row} data-fx="row"><span><b>D-101</b><small>A. Yılmaz</small></span><span className={`${styles.pill} ${styles.active}`}>Etkin sözleşme</span></div>
              <div className={styles.row} data-fx="row"><span><b>D-102</b><small>M. Demir</small></span><span className={`${styles.pill} ${styles.paid}`}>Ödendi</span></div>
              <div className={styles.row} data-fx="row"><span><b>D-201</b><small>S. Kaya</small></span><span className={`${styles.pill} ${styles.late}`}>Gecikti</span></div>
              <div className={styles.row} data-fx="row"><span><b>D-202</b><small>Kiracı yok</small></span><span className={`${styles.pill} ${styles.empty}`}>Boş</span></div>
            </div>
          </article></div>
        </section>

        <section className={`${styles.sec} ${styles.chapter}`} id="sozlesme" data-phase="2">
          <div className={styles.wrap}><article className={styles.card} data-ui="" data-fx="card">
            <div className={styles.step}><b>02</b> Kiracı ve sözleşme</div>
            <h2>Bir daireye aynı anda tek sözleşme açılır.</h2>
            <p>Aynı döneme ikinci bir sözleşme açmak isterseniz sistem buna izin vermez. Sözleşmeyi yenilediğinizde eski kira bedeli silinmez ve geçmişte görünmeye devam eder.</p>
            <ul className={styles.points}>
              <li>Ek protokol yapabilir, bitiş tarihini uzatabilirsiniz.</li>
              <li>Yeni bedel sizin seçtiğiniz tarihte başlar.</li>
            </ul>
            <div className={styles.frag} data-ui="">
              <div className={styles.fragLabel}>Örnek görünüm · Kira geçmişi</div>
              <div className={styles.tl}>
                <div className={styles.tlTrack}><i className={styles.tlLine} data-grow="" /></div>
                <div className={styles.tlN} data-fx="row"><b>14.000 ₺</b><small>01.10.2022</small></div>
                <div className={styles.tlN} data-fx="row"><b>18.500 ₺</b><small>01.10.2023</small></div>
                <div className={styles.tlN} data-fx="row"><b>23.000 ₺</b><small>01.10.2024</small></div>
              </div>
            </div>
          </article></div>
        </section>

        <section className={`${styles.sec} ${styles.chapter} ${styles.right}`} id="tahsilat" data-phase="3">
          <div className={styles.wrap}><article className={styles.card} data-ui="" data-fx="card">
            <div className={styles.step}><b>03</b> Tahsilat</div>
            <h2>Kimin ödediğini, kimin geciktiğini bir bakışta görürsünüz.</h2>
            <p>Kira alacağı her ay kendiliğinden açılır ve gelen ödeme açık alacaklara dağıtılır. İptal ettiğiniz ödeme silinmez, iptal nedeniyle birlikte kayıtta kalır.</p>
            <div className={styles.legend}>
              <span className={styles.chip}><i style={{ background: "var(--paid)" }} />Ödendi</span>
              <span className={styles.chip}><i style={{ background: "var(--partial)" }} />Kısmi</span>
              <span className={styles.chip}><i style={{ background: "var(--late)" }} />Gecikti</span>
            </div>
            <div className={styles.frag} data-ui="">
              <div className={styles.fragLabel}>Örnek görünüm · Aylık tahsilat</div>
              <div className={styles.stack}>
                <i className={`${styles.seg} ${styles.paid}`} style={{ width: "68%" }} data-grow="" />
                <i className={`${styles.seg} ${styles.partial}`} style={{ width: "18%" }} data-grow="" />
                <i className={`${styles.seg} ${styles.late}`} style={{ width: "14%" }} data-grow="" />
              </div>
              <div className={styles.key} data-fx="row"><i style={{ background: "var(--paid)" }} /><span>Ödendi</span><b>102.000 ₺</b></div>
              <div className={styles.key} data-fx="row"><i style={{ background: "var(--partial)" }} /><span>Kısmi ödendi</span><b>27.000 ₺</b></div>
              <div className={styles.key} data-fx="row"><i style={{ background: "var(--late)" }} /><span>Gecikti</span><b>21.000 ₺</b></div>
            </div>
          </article></div>
        </section>

        <section className={`${styles.sec} ${styles.chapter}`} id="rapor" data-phase="4">
          <div className={styles.wrap}><article className={styles.card} data-ui="" data-fx="card">
            <div className={styles.step}><b>04</b> Rapor</div>
            <h2>Her ayın nakit akışı tek tabloda durur.</h2>
            <p>Tahsilat, gider ve net tutar yan yana görünür. Tahsilat listesini de nakit akışını da CSV olarak indirebilirsiniz.</p>
            <ul className={styles.points}>
              <li>Tarih aralığına ve daireye göre süzebilirsiniz.</li>
              <li>Vadesi yaklaşan ve geciken kira için e-posta gelir.</li>
            </ul>
            <div className={styles.frag} data-ui="">
              <div className={styles.fragLabel}>Örnek görünüm · Aylık özet</div>
              <div className={styles.rr} data-fx="row"><span>Tahsilat</span><b>148.500 ₺</b></div>
              <div className={styles.rr} data-fx="row"><span>Gider</span><b>31.200 ₺</b></div>
              <div className={`${styles.rr} ${styles.net}`} data-fx="row"><span>Net</span><b>117.300 ₺</b></div>
            </div>
          </article></div>
        </section>

        <section className={`${styles.sec} ${styles.assure}`} id="guvence" data-phase="5">
          <div className={styles.wrap}>
            <div className={styles.head} data-fx="assure-head">
              <div className={styles.step}><b>05</b> Güvence</div>
              <h2>Kayıtlarınızı sizden başkası göremez.</h2>
            </div>
            <div className={styles.tiles} data-fx="tiles">
              {tiles.map(([title, text], index) => (
                <article key={title} className={styles.tile} data-ui="" data-fx="tile">
                  <div className={styles.ico}>{tileIcons[index]}</div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.sec} ${styles.final}`} id="basla" data-phase="6">
          <div className={styles.wrap} data-fx="final" data-ui="">
            <h2>İlk dairenizi bugün girin.</h2>
            <p>Hesap açmak ücretsizdir. Pilot döneminde hesapları tek tek onaylıyoruz, onaydan sonra kullanmaya başlarsınız.</p>
            <div className={styles.cta}>
              <LandingActions placement="final" />
              <LandingGoogle />
            </div>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <div className={styles.wrap}>
          <span>Mülküm</span>
          <span>Bireysel mülk sahipleri için yapıldı.</span>
        </div>
      </footer>
    </div>
  );
}
