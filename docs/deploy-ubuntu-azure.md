# Yayın: Ubuntu API + Azure SQL + Vercel

Karar: [ADR 003](adr/003-yayin-topolojisi.md). Bu sunucuda başka servisler çalışıyor; yalnız burada adı geçen dosya,
container ve portlara dokun.

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

## Güncelleme

```bash
cd /opt/mulk-yonetimi && git pull -q && docker compose -f deploy/compose.api.yaml up -d --build --force-recreate
```

Yeni migration varsa önce bölüm 2'deki komut çalıştırılır; `deploy/sql/migrations-idempotent.sql` yeniden üretilmelidir.

## 5. Vercel

Ortam değişkenleri: `BACKEND_BASE_URL=https://mulkapi.duckdns.org`, `FRONTEND_ORIGIN=https://<vercel-alan-adi>`.
`deploy/api.env` içindeki `Auth__FrontendOrigin` aynı değerle eşleşmeli. Bölge `fra1`.

## E-posta (Mailu)

SMTP: `mail.kasam360.com.tr:465` örtük TLS (Mailu içinde 587 kapalı). `Email__SmtpPort=465`, gönderen `mulkum@360labs.com.tr`. Container host ağını kullandığı için Mailu'ya ulaşır. Posta spam'e düşerse 360labs.com.tr için SPF/DKIM kaydı gerekir.

## Özel R2 ve zararlı yazılım taraması

Her ortam için ayrı private R2 bucket ve o bucket ile sınırlı erişim anahtarı gerekir. Bucket CORS politikasında yalnız ilgili frontend origin'i için `PUT`/`GET` ve `Content-Type` imzalı başlığını açın; üretim anahtarını frontend ortamına koymayın. `Storage__R2*` değerleri yalnız `deploy/api.env` içindedir.

ClamAV resmi container'ı imza veritabanı ile gelir ve 3310 TCP hizmeti sağlar; [resmi container belgesi](https://github.com/Cisco-Talos/clamav-documentation/blob/main/src/manual/Installing/Docker.md) 4 GB RAM önerir. Paylaşılan sunucuda kapasite ölçülmeden profili açmayın. Ayrı staging ortamında önce `docker compose -f deploy/compose.api.yaml --profile scanner up -d clamav` çalıştırın; yalnız `127.0.0.1:3310` dinlenmelidir. Güncel imza ve sağlıklı scanner doğrulandıktan sonra `Scanner__Host=127.0.0.1` koyup API'yi yeniden başlatın. Tarayıcı yoksa/erişilemiyorsa `complete` 503, tehdit bulunursa 422 döner; dosya ACTIVE olmaz. R2/ClamAV canlı kabul testi ve gerçek CORS testi geçmeden belge özelliğini açık ilan etmeyin.

## Geri dönüş

- API: `docker compose -f deploy/compose.api.yaml down` (veriye dokunmaz). Önceki sürüm için önceki commit'e `git checkout` + `up -d --build`.
- nginx: `rm /etc/nginx/sites-enabled/mulkapi.conf && nginx -t && systemctl reload nginx`.
- Veri: Azure portal → database → **Restore** (nokta-zamanlı).
