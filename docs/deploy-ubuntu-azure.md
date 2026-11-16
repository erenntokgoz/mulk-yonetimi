# Yayın: Ubuntu API + Azure SQL + Vercel

Karar: [ADR 003](adr/003-yayin-topolojisi.md). Bu sunucuda başka servisler çalışıyor; yalnız burada adı geçen dosya,
container ve portlara dokun.

Yayın öncesi staging, kurtarma tatbikatı, go/no-go ve geri dönüş kapısı için [pilot yayın kontrolünü](release-readiness.md) tamamlayın.

## 1. Azure SQL (portal)

1. portal.azure.com → **SQL databases → Create**.
2. "Want to try Azure SQL Database for free?" → **Apply offer**.
3. Resource group: `mulk-yonetimi`. Database name: `MulkYonetimi`.
4. Server → **Create new**: ad örn. `mulkyonetimi-sql`, bölge **Sweden Central**, kimlik doğrulama **SQL authentication**.
   Yönetici kullanıcı adı ve güçlü bir parola belirle; parolayı yalnız parola yöneticine kaydet.
5. "Behavior when free limit reached": **Auto-pause the database until next month**.
6. Networking → **Public endpoint**, "Allow Azure services" **No**, "Add current client IP" **No**. Firewall kuralı:
   `ubuntu-api`, başlangıç ve bitiş `109.236.51.239`.
7. Create.

## 2. Migration ve uygulama kullanıcısı (sunucuda)

Parola, yapıştırılan komutta sqlcmd isteminde bozulur; bu yüzden gizli okunup ortam değişkeniyle verilir. `-I` zorunludur
(`QUOTED_IDENTIFIER ON` olmadan migration scripti başarısız olur).

```bash
cd /opt/mulk-yonetimi && git pull -q
read -rsp "Yönetici parolası: " SQLCMDPASSWORD; echo; export SQLCMDPASSWORD
docker run --rm -e SQLCMDPASSWORD -v "$PWD/deploy/sql:/sql:ro" mcr.microsoft.com/mssql-tools   /opt/mssql-tools/bin/sqlcmd -S tcp:mulkyonetimi-sql.database.windows.net,1433 -d MulkYonetimi -U <admin> -N -b -I   -i /sql/migrations-idempotent.sql
unset SQLCMDPASSWORD
```

Uygulama kullanıcısı `mulk_app` (yönetici ile, aynı komutta `-i` yerine `-Q`):

```sql
CREATE USER [mulk_app] WITH PASSWORD = '<guclu-parola>';
ALTER ROLE db_datareader ADD MEMBER [mulk_app];
ALTER ROLE db_datawriter ADD MEMBER [mulk_app];
```

## 3. API container

```bash
cp deploy/api.env.example deploy/api.env && chmod 600 deploy/api.env && nano deploy/api.env
docker compose -f deploy/compose.api.yaml up -d --build
curl -s http://127.0.0.1:5180/health
```

## 4. nginx + HTTPS

```bash
cp deploy/nginx/mulkapi.conf /etc/nginx/sites-available/mulkapi.conf
ln -s /etc/nginx/sites-available/mulkapi.conf /etc/nginx/sites-enabled/mulkapi.conf
nginx -t && systemctl reload nginx
certbot --nginx -d mulkapi.duckdns.org
```

`nginx -t` hata verirse reload yapma; mevcut siteler etkilenir.

`certbot` sonrasında `mulkapi.duckdns.org` için HTTPS `server` bloğunda şu başlıkların da bulunduğunu doğrulayın. HSTS'yi HTTP yönlendirme bloğunda bırakmak yeterli değildir; `includeSubDomains`/`preload` kullanmayın.

```nginx
server_tokens off;
add_header X-Content-Type-Options "nosniff" always;
add_header Strict-Transport-Security "max-age=31536000" always;
```

`deploy/nginx/mulkapi.conf` yalnız API domain'i için `server_tokens off`, `nosniff` ve HSTS örneği taşır. TLS bloğunda değişiklik sonrası `nginx -t && systemctl reload nginx` çalıştırın.

## Güncelleme

```bash
cd /opt/mulk-yonetimi &&
test "$(git branch --show-current)" = main &&
git diff --quiet HEAD -- &&
git fetch origin main &&
git diff --quiet HEAD origin/main -- deploy/sql/migrations-idempotent.sql &&
git merge --ff-only origin/main &&
docker compose -f deploy/compose.api.yaml up -d --build --no-deps api &&
git rev-parse HEAD &&
curl --silent --show-error --fail --retry 10 --retry-connrefused http://127.0.0.1:5180/health
```

Yukarıdaki komut temiz bir main checkout ister ve migration dosyası değişmişse durur. Yalnız API servisini günceller; çalışan ClamAV, nginx ve Mailu yapılandırmasına dokunmaz. Yeni migration varsa önce bölüm 2'deki komut çalıştırılır; `deploy/sql/migrations-idempotent.sql` yeniden üretilmelidir.

## 5. Vercel

Ortam değişkenleri: `BACKEND_BASE_URL=https://mulkapi.duckdns.org`, `FRONTEND_ORIGIN=https://<vercel-alan-adi>`.
`deploy/api.env` içindeki `Auth__FrontendOrigin` aynı değerle eşleşmeli. Bölge `fra1`.

Auth hız sınırının ortak Vercel çıkış IP'sinde tüm kullanıcıları birleştirmemesi için bağımsız, kriptografik rastgele en az 32 karakterlik bir anahtar üretip yalnız parola yöneticisi üzerinden iki tarafa aktarın: Vercel'de `BACKEND_RATE_LIMIT_SIGNING_KEY`, API sunucusundaki `deploy/api.env` içinde `Network__RateLimitSigningKey`. Anahtarı istemci bundle'ına (`NEXT_PUBLIC_*`), terminal komutuna, ticket'a veya Git'e koymayın; `Pilot__AdminKey` ile tekrar kullanmayın. Her iki değer ayarlanınca Vercel'i redeploy ve API container'ını yeniden oluşturun. API production'da anahtar yoksa başlamaz. Ayrıntı ADR 011'de.

## Google ile giriş

[ADR 012](adr/012-google-signin.md) bağlantı ve pilot onayı kararını açıklar. Google OAuth uygulamasında Web application client oluşturun. Kullanılacak adresi **Authorized redirect URIs** listesine aynen ekleyin:

- Üretim: `https://mulkum-beta.vercel.app/api/bff/auth/google/callback`
- Yerel: `http://localhost:3000/api/bff/auth/google/callback`

BFF yalnız bu iki kökene izin verir; Vercel Preview URL'leri bu akışı başlatmaz. Yerelde frontend'i `localhost:3000` adresinden açın ve frontend/API origin ayarlarının eşleştiğini kontrol edin.

1. Sunucudaki `deploy/api.env` içine `Auth__Google__ClientId` girin. Vercel'deki `GOOGLE_CLIENT_ID` aynı client olmalıdır. `GOOGLE_CLIENT_SECRET` yalnız Vercel Production ortamında sunucu değişkenidir. Bu sürüm yeni SQL migration gerektirmez.
2. Vercel main birleşiminde otomatik yayın yaptığı için API hazır olana kadar Production'da Google bayrağını kapalı bırakın. Uç noktayı taşıyan API'yi yayımlayın. Health'i ve yapılandırmayı kontrol edin. Sözleşme duman testi aşağıdaki geçersiz istekle `400` döner; `404` eski API, `503` eksik client ID, `403` ise origin uyumsuzluğu gösterebilir. Bu test oturum açmaz.
3. API hazır olduktan sonra Vercel Production'da `NEXT_PUBLIC_GOOGLE_AUTH=1` ile frontend'i derleyip yayımlayın. İşletmecinin onaylı örnek hesabıyla gerçek Google girişini, yeni Google hesabında pilot onay ekranını ve parola girişinin çalıştığını doğrulayın.
4. Google'ı geri almak için Vercel'de bayrağı kaldırıp yeniden derleyin, ardından API'deki `Auth__Google__ClientId` alanını kaldırıp yalnız API'yi yeniden oluşturun. Mevcut Identity hesap ve bağlantı kayıtları korunur.

```bash
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' \
  -H 'Origin: https://mulkum-beta.vercel.app' -H 'Content-Type: application/json' \
  --data '{"idToken":"","nonce":""}' https://mulkapi.duckdns.org/api/v1/auth/google
```

## E-posta (Mailu)

SMTP: `mail.kasam360.com.tr:465` örtük TLS (Mailu içinde 587 kapalı). `Email__SmtpPort=465`, gönderen `mulkum@360labs.com.tr`. Container host ağını kullandığı için Mailu'ya ulaşır. Posta spam'e düşerse 360labs.com.tr için SPF/DKIM kaydı gerekir.

## Özel R2 ve zararlı yazılım taraması

### Pilot hesap onayı

Yeni kayıt, e-posta doğrulandıktan sonra da `PENDING` kalır. Canlı kullanıcı davet etmeden önce zaten var olan, e-postası doğrulanmış ve etkin hesabı bulunan operatörün `AspNetUsers.Id` UUID'sini `Pilot__AdminUserId` olarak; en az 32 rastgele karakterlik, yalnızca parola yöneticisinde tutulan anahtarı `Pilot__AdminKey` olarak `deploy/api.env` içine koyun. Bu değerleri Vercel'e veya repoya eklemeyin. `deploy/api.env.example` içindeki alanları sunucuda doldurun ve API container'ını yeniden oluşturun.

Operatör HTTPS üzerinden aşağıdaki aracı çalıştırır. E-posta, parola ve anahtar gizli prompt ile alınır; oturum çerezi bellekte tutulur. Araç yalnız bekleyen hesapları listeler, e-posta doğrulanmamışsa aktivasyon yapmaz. Onay audit kaydı oluşturur.

```bash
python3 deploy/activate-pilot-account.py https://mulkapi.duckdns.org https://mulkum-beta.vercel.app
```

Anahtar sızarsa `Pilot__AdminKey` değerini değiştirip API'yi yeniden başlatın. Yanlış kullanıcı `Pilot__AdminUserId` ile eşleşirse aktivasyon başarısız olur; yönetici listesi/uygulama içi bir bypass yoktur.

Belge kotası `Storage__MaximumDocumentCountPerAccount` ve `Storage__MaximumStorageBytesPerAccount` ile hesap başına ayarlanır. İlk varsayılanlar 1000 belge ve 1 GiB'tır; bunlar ürün planı taahhüdü değil, ADR 006'da kayıtlı mühendislik başlangıç değerleridir. Aktif ve bekleyen belge rezervasyon sayılır; silinmiş kayıt kota kullanmaz.

Her ortam için ayrı private R2 bucket ve yalnız o bucket'a kapsamlı `Object Read & Write` S3 API token kullanın. R2 S3 kurulumu için [Cloudflare'ın resmi yönergesini](https://developers.cloudflare.com/r2/get-started/s3/), token kapsamı için [R2 token belgelerini](https://developers.cloudflare.com/r2/api/tokens/) izleyin. Bucket'ı private bırakın; public access veya public custom domain açmayın. Account ID, bucket adı, Access Key ID ve Secret Access Key yalnız API hostundaki `deploy/api.env` içine konur; secret token üretiminde yalnız bir kez gösterilir, başka yere kopyalamayın.

Bu uygulamada browser doğrudan imzalı `PUT` ile `Content-Type` gönderir ve imzalı `GET` ile indirir. `HEAD` metadata kontrolünü API tarafı yapar, tarayıcı CORS gereksinimi değildir. Cloudflare Dashboard → **Storage & databases → R2 → bucket → Settings → CORS Policy** altında exact production origin kuralı kullanın; wildcard eklemeyin:

```json
[
  {
    "AllowedOrigins": ["https://mulkum-beta.vercel.app"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

Üretim origin'i farklıysa `Auth__FrontendOrigin` ile aynı origin'i ve uygulamanın gerçek public origin'ini kullanın. Preview için origin gerekiyorsa yalnız tam preview hostunu staging bucket politikasına ekleyin; tüm `vercel.app` alanını açmayın.

ClamAV resmi container'ı imza veritabanı ile gelir ve 3310 TCP hizmeti sağlar; [resmi container belgesi](https://github.com/Cisco-Talos/clamav-documentation/blob/main/src/manual/Installing/Docker.md) 4 GB RAM önerir. Paylaşılan sunucuda kapasite ölçülmeden profili açmayın. Ayrı staging ortamında önce `docker compose -f deploy/compose.api.yaml --profile scanner up -d clamav` çalıştırın; yalnız `127.0.0.1:3310` dinlenmelidir. Güncel imza ve sağlıklı scanner doğrulandıktan sonra `Scanner__Host=127.0.0.1` koyup API'yi yeniden başlatın. Tarayıcı yoksa/erişilemiyorsa `complete` 503, tehdit bulunursa 422 döner; dosya ACTIVE olmaz. R2/ClamAV canlı kabul testi ve gerçek CORS testi geçmeden belge özelliğini açık ilan etmeyin.

ClamAV resmi container'ı imza veritabanı ile gelir ve 3310 TCP hizmeti sağlar; [resmi container belgesi](https://github.com/Cisco-Talos/clamav-documentation/blob/main/src/manual/Installing/Docker.md) 4 GB RAM önerir. Paylaşılan sunucuda kapasite ölçülmeden profili açmayın. Ayrı staging ortamında önce `docker compose -f deploy/compose.api.yaml --profile scanner up -d clamav` çalıştırın; yalnız `127.0.0.1:3310` dinlenmelidir. Güncel imza ve sağlıklı scanner doğrulandıktan sonra `Scanner__Host=127.0.0.1` koyup API'yi yeniden başlatın. Tarayıcı yoksa/erişilemiyorsa `complete` 503, tehdit bulunursa 422 döner; dosya ACTIVE olmaz. R2/ClamAV canlı kabul testi ve gerçek CORS testi geçmeden belge özelliğini açık ilan etmeyin.

Gerçek R2 kabul testi ayrı staging bucket ile çalıştırılır. Dört `Storage__R2*` değişkenini yalnız test sürecine aktarın; `MULK_R2_ALLOWED_ORIGIN` staging frontend origin'i, `MULK_R2_DENIED_ORIGIN` farklı bir origin olsun. `dotnet test backend/tests/MulkYonetimi.IntegrationTests/MulkYonetimi.IntegrationTests.csproj --filter FullyQualifiedName~R2AcceptanceTests` komutu imzalı PUT/GET, private unsigned GET, yanlış Content-Type, metadata, imza ve CORS'u denetler; test nesnesini sonunda siler. Dört credential eksikse test açıkça **SKIP** olur; R2 kabulü geçilmiş sayılmaz. CORS origin değişkenleri eksikse CORS kısmı ölçülmez ve ayrıca açık kapı kalır. İmzalı URL ve credential çıktıya yazdırılmaz.

## Geri dönüş

- API: `docker compose -f deploy/compose.api.yaml down` (veriye dokunmaz). Önceki sürüm için önceki commit'e `git checkout` + `up -d --build`.
- nginx: `rm /etc/nginx/sites-enabled/mulkapi.conf && nginx -t && systemctl reload nginx`.
- Veri: Azure portal → database → **Restore** (nokta-zamanlı).
