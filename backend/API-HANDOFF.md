# Backend API devir notu

Tip kaynağı Development ortamındaki `GET /openapi/v1.json`. Bu sayfadaki yollar doğrudan .NET API yollarıdır. Tarayıcı oturumu için Next BFF mevcut `/api/bff/auth/*` ve `/api/bff/me` yollarını kullanır.

| Yöntem ve yol | JSON gövdesi | Başarı |
| --- | --- | --- |
| GET `/health` | — | 200 `{ status, checks }`; sağlıksızsa 503 |
| GET `/api/v1/me` | — | 200 `{ accountId }`; oturum yoksa 401, geçerli hesap üyeliği yoksa 403 |
| POST `/api/v1/auth/register` | `{ email, password, accountName }` | 202 |
| POST `/api/v1/auth/confirm-email` | `{ userId, token }` | 204 |
| POST `/api/v1/auth/resend-confirmation` | `{ email }` | 202 |
| POST `/api/v1/auth/forgot-password` | `{ email }` | 202 |
| POST `/api/v1/auth/reset-password` | `{ userId, token, password }` | 204 |
| POST `/api/v1/auth/login` | `{ email, password }` | 204 ve `mulk.session` cookie; hatalı veya doğrulanmamış oturum 401 |
| POST `/api/v1/auth/logout` | — | 204 ve cookie temizleme |

Auth POST istekleri `Auth:FrontendOrigin` ile eşleşen `Origin` gerektirir. 429 yanıtında `Retry-After` döner. Kayıt ve e-posta istekleri SMTP ayarı yoksa 503 döner. 202, mesajın teslim edildiğini garanti etmez. İşçi doğrulama bağlantısını `/dogrula`, sıfırlama bağlantısını `/parola-sifirla` için üretir. Formlar `userId` ve `token` değerlerini JSON gövdesinde iletir.

## Kimlik ve e-posta durumu

Kayıt, doğrulama, giriş, çıkış ve parola sıfırlama için uçlar mevcut. Profil ve bildirim tercihleri için API yok. Çıkış tarayıcı çerezini temizler. Kopyalanmış oturum çerezi süre sonuna veya güvenlik damgası değişene kadar kullanılabilir. Eşzamanlı aynı e-posta kaydı SQL benzersizlik hatasına düşebilir.

Kayıt işlemi hesap, üye ve doğrulama mesajını aynı SQL işlemi içinde yazar. Outbox işlem kilidi, süreli yeniden deneme ve kalıcı hata durumuna sahip. SMTP kabulü ile SQL durum güncellemesi arasında süreç durursa aynı e-posta yeniden gönderilebilir. Yerel SQL Server ve gerçek SMTP teslimi bu devirde doğrulanmadı.

## Mülkler

| Yöntem ve yol | Girdi | Başarı |
| --- | --- | --- |
| GET `/api/v1/properties` | `page` (varsayılan 1), `pageSize` (varsayılan 25, en çok 100), `includeArchived` (varsayılan false) | 200 `{ items, page, pageSize, hasMore }` |
| POST `/api/v1/properties` | `{ name, address, propertyKind, defaultUnitUsageType? }` | 201 ve mülk |
| GET `/api/v1/properties/{id}` | UUID | 200 ve mülk |
| PATCH `/api/v1/properties/{id}` | `{ name, address, version }` | 200 ve güncel mülk |
| POST `/api/v1/properties/{id}/archive` | `{ version }` | 204 |

Mülk yanıtı `{ id, name, address, propertyKind, archivedAtUtc, version }`. `version` değeri Base64 dizgedir ve son okunan değer aynen gönderilir. `archivedAtUtc` aktif kayıtta null. Oluşturmada `SINGLE_UNIT` için `defaultUnitUsageType` olarak `RESIDENTIAL` veya `COMMERCIAL` zorunlu. `MULTI_UNIT` için bu alan gönderilmez. Ad en çok 200, adres en çok 500 karakter.

Tüm uçlar doğrulanmış oturum ve aktif hesap üyeliği gerektirir. Yazma istekleri auth uçlarıyla aynı Origin kontrolünü kullanır. 400 alan doğrulaması, 404 görünmeyen mülk, 409 sürüm çakışması veya arşivli mülkü düzenleme anlamına gelir. `includeArchived=true` iki durumu birlikte listeler. POST oluşturma isteğinin tekrarı yeni bir mülk açar.

`PortfolioProperties` migration'ı gerekir. İki hesaplı SQL Server testi `PropertyIsolationTests` altında ve `MULK_SQL_TEST_ADMIN_CONNECTION` ile çalışır.

## Bağımsız bölümler

| Yöntem ve yol | Girdi | Başarı |
| --- | --- | --- |
| GET `/api/v1/properties/{id}/units` | Üst mülk UUID, isteğe bağlı `page` ve `pageSize` | 200 `{ items, page, pageSize, hasMore }` |
| POST `/api/v1/properties/{id}/units` | `{ label, usageType, doorNumber?, areaM2? }` | 201 ve birim |

Birim yanıtı `{ id, propertyId, label, usageType, doorNumber, areaM2, isDefault }`. Etiket en çok 100, kapı numarası en çok 32 karakter. Kullanım türü `RESIDENTIAL` veya `COMMERCIAL`. Alan pozitif bir sayı ve en çok iki ondalık basamaklı. Erişilemeyen üst mülk 404 döner. Aynı etiket, tek birimli veya arşivli mülke ekleme 409 döner. Birim listesi arşivli mülklerde de okunabilir. `UnitDetails` migration'ı gerekir.

## Kiracılar

| Yöntem ve yol | Girdi | Başarı |
| --- | --- | --- |
| GET `/api/v1/tenants` | `q` (en çok 200 karakter), `page`, `pageSize`, `includeArchived` | 200 `{ items, page, pageSize, hasMore }` |
| POST `/api/v1/tenants` | `{ kind, firstName?, lastName?, companyName?, phone?, email? }` | 201 ve kiracı |
| GET `/api/v1/tenants/{id}` | Kiracı UUID | 200 ve kiracı |
| PATCH `/api/v1/tenants/{id}` | Oluşturma alanları ve `version` | 200 ve güncel kiracı |
| POST `/api/v1/tenants/{id}/archive` | `{ version }` | 204 |

Kiracı yanıtı `{ id, kind, firstName, lastName, companyName, phone, email, archivedAtUtc, version }`. `PERSON` ad ve soyad, `COMPANY` unvan ister. Telefon ve e-posta isteğe bağlıdır. PATCH kartın tüm alanlarını alır. Boş bırakılan isteğe bağlı alanlar temizlenir. Mülkle aynı Base64 sürüm ve sayfalama kuralları geçerlidir. Arama ad, soyad, unvan, telefon ve e-postayı kapsar. Hesap dışı kimlik 404, eski sürüm veya arşivli kartı düzenleme 409 döner. `TenantCards` migration'ı gerekir.

Mülk, birim ve kiracı uçları aynı oturum ve Origin kurallarını kullanır. Bu üç kaynak için iki hesaplı `PropertyIsolationTests` yerel SQL Server üzerinde geçti.

## Sözleşmeler

| Yöntem ve yol | Girdi | Başarı |
| --- | --- | --- |
| GET `/api/v1/leases` | İsteğe bağlı `status`, `unitId`, `tenantId`, `page`, `pageSize` | 200 sayfalı liste |
| POST `/api/v1/leases` | `{ unitId, tenantId, startDate, plannedEndDate?, dueDay, monthlyAmount, depositAmount?, note? }` | 201 taslak |
| GET `/api/v1/leases/{id}` | UUID | 200 sözleşme |
| POST `/api/v1/leases/{id}/activate` | `{ version }` | 200 etkin sözleşme |
| POST `/api/v1/leases/{id}/terminate` | `{ version, terminationDate, reason }` | 200 sonlandırılmış sözleşme |
| GET `/api/v1/leases/{id}/rates` | UUID | 200 bedel geçmişi |
| POST `/api/v1/leases/{id}/rates` | `{ effectiveFrom, monthlyAmount, reason }` | 201 yeni bedel |

Sözleşme yanıtı `{ id, unitId, tenantId, status, startDate, plannedEndDate, terminationDate, dueDay, depositAmount, note, terminationReason, version }`. Durumlar `DRAFT`, `ACTIVE`, `TERMINATED`. Bedel yanıtı `{ effectiveFrom, monthlyAmount, reason }`. Tarihler `YYYY-MM-DD`, para TRY ve iki ondalık basamaklıdır. Planlanan bitiş bilgi amaçlıdır. Bedel değişikliği gelecek takvim ayının ilk gününden başlar. Üretilmiş alacakların bedeli korunur. `LeaseLedger` migration'ı gerekir.

## Alacaklar ve tahsilatlar

| Yöntem ve yol | Girdi | Başarı |
| --- | --- | --- |
| GET `/api/v1/rent-charges` | `leaseId`, `tenantId`, `startPeriod`, `endPeriod`, `page`, `pageSize` | 200 sayfalı liste |
| POST `/api/v1/rent-charges/{id}/corrections` | `{ amount, reason }` ve `Idempotency-Key` | 201 düzeltme, tekrarda 200 |
| GET `/api/v1/payments` | `tenantId`, `page`, `pageSize` | 200 sayfalı liste |
| GET `/api/v1/payments/{id}` | UUID | 200 tahsilat |
| POST `/api/v1/payments` | `{ tenantId, paidOn, amount, method, reference? }` ve `Idempotency-Key` | 201 tahsilat, tekrarda 200 |
| POST `/api/v1/payments/{id}/allocations` | `{ rentChargeId, amount }` ve `Idempotency-Key` | 201 dağıtım, tekrarda 200 |
| POST `/api/v1/payments/{id}/void` | `{ reason }` | 200 iptal edilmiş tahsilat |

Alacak yanıtı `{ id, leaseId, tenantId, periodStart, dueDate, amount, paidAmount, balance, status, isOverdue }`. Durumlar `UNPAID`, `PARTIAL`, `PAID`. Tahsilat yanıtı `{ id, tenantId, paidOn, amount, method, reference, status, allocatedAmount, unallocatedAmount, voidedAtUtc, voidReason, allocations }`. Dağıtım yanıtı `{ id, rentChargeId, amount, isEffective }`. Yöntemler `TRANSFER`, `CASH`, `OTHER`. Tahsilat durumları `RECORDED`, `VOIDED`. Arayüzde “Kullanıcı tarafından kaydedildi. Banka doğrulaması yapılmadı.” bilgisi gösterilir.

Tekrar denemede aynı anahtar ve aynı gövde gönderilir. Anahtar 1–64 ASCII harf, rakam, tire veya alt çizgi içerir. Aynı anahtar farklı içerikle kullanılırsa 409. Dağıtım aynı kiracının alacağına yapılır ve tahsilat veya alacak bakiyesi aşılırsa 409 döner. Dağıtılmamış fazla tutar tahsilatta bekler. İptal, dağıtımları saklar ve bakiyelerden çıkarır. İşçi 15 dakikada bir İstanbul tarihine göre içinde bulunulan aya kadar eksikleri tamamlar. İlk alacak aktivasyonda oluşur. `PaymentsLedger` migration'ı gerekir.

Alacak düzeltme yanıtı `{ id, rentChargeId, previousAmount, amount, reason, occurredAtUtc }`. Tutar sıfır olabilir. Etkin tahsilata bağlı alacak 409 döner. Düzeltme önceki bedeli ve gerekçeyi ayrı kayıt olarak saklar. `ChargeCorrections` migration'ı gerekir.

Geriye dönük sonlandırmada, sonlandırma ayından sonraki pozitif alacaklar önce açık düzeltmeyle sıfırlanır. Sonlandırma alacak satırlarını veya tahsilatları silmez.

Yerel gerçek SQL Server koşusunda iki hesaplı erişim, eşzamanlı etkinleştirme ve tahsilat dağıtımı, kısa ay vadesi, üç paralel alacak üretimi, kısmi ve fazla ödeme, iptal ve alacak düzeltmesi geçti. Tarayıcı akışı ayrıca doğrulanmalıdır.

## Depozito ve giderler

| Yöntem ve yol | Girdi | Başarı |
| --- | --- | --- |
| GET `/api/v1/deposits` | `leaseId`, `page`, `pageSize` | 200 sayfalı depozito listesi |
| POST `/api/v1/deposits` | `{ leaseId, custodyType, note? }` | 201 depozito, aynı kayıtta 200 |
| GET `/api/v1/deposits/{id}/movements` | `page`, `pageSize` | 200 sayfalı hareket listesi |
| POST `/api/v1/deposits/{id}/movements` | `{ movementOn, movementType, amount, note? }` ve `Idempotency-Key` | 201 hareket, tekrarda 200 |
| GET `/api/v1/expenses` | `propertyId`, `unitId`, `category`, `fromDate`, `toDate`, `includeVoided`, `page`, `pageSize` | 200 sayfalı gider listesi |
| POST `/api/v1/expenses` | `{ propertyId, unitId?, category, amount, expenseOn, paidOn?, note? }` ve `Idempotency-Key` | 201 gider, tekrarda 200 |
| POST `/api/v1/expenses/{id}/void` | `{ reason }` | 200 iptal edilmiş gider |

Depozito yanıtı `{ id, leaseId, amountAgreed, custodyType, note, balance }`. Sözleşmedeki depozito tutarı pozitif olmalıdır. Muhafaza biçimleri `OWNER_HELD` ve `BANK_BLOCKED`. Hareket yanıtı `{ id, depositId, movementOn, movementType, amount, note }`. `HELD` ve `RETURNED` için pozitif tutar gönderilir, iade yanıtta eksi tutar olarak görünür. `ADJUSTED` işaretli tutar ve gerekçe alır. Negatif bakiye 409 döner.

Gider yanıtı `{ id, propertyId, unitId, category, amount, expenseOn, paidOn, note, status, voidedAtUtc, voidReason }`. Kategoriler `MAINTENANCE`, `DUES`, `TAX`, `INSURANCE`, `OTHER`. Durumlar `RECORDED` ve `VOIDED`. Liste tarih aralığını gider tarihine uygular. `paidOn: null` ödenmemiş gideri ifade eder. `OperatingLedger` migration'ı gerekir.

## Raporlar

| Yöntem ve yol | Sorgu | Yanıt |
| --- | --- | --- |
| GET `/api/v1/dashboard/summary` | `periodStart?` (ayın ilk günü, varsayılan bu ay), `propertyId?` | `{ periodStart, asOf, activeProperties, totalUnits, occupiedUnits, vacantUnits, periodCharges, periodUnpaid, overdueBalance, recordedExpenses, cashFlow }` |
| GET `/api/v1/reports/cashflow` | `fromDate`, `toDate`, `propertyId?`, `unitId?` | `{ fromDate, toDate, propertyId, unitId, cashIn, allocated, unallocated, cashOut, netOperatingCashFlow }` |

Doluluk ve gecikme `asOf` gününe göre hesaplanır. Arşivli mülklerin birimleri doluluğa girmez. Dönem alacağı ve açık bakiye seçilen aya, kaydedilen gider gider tarihine göre hesaplanır. Nakit aralığının iki ucu dahildir. Hesap toplamına dağıtılmamış tahsilat girer. Mülk/birim filtresinde yalnız o kapsama dağıtılan tutar girer ve `unallocated` null döner. Ödenmemiş gider, iptal edilmiş kayıt ve depozito hareketi nakit akışına girmez. Hesap dışı mülk/birim filtresi 404 döner.

Gerçek SQL Server testinde iki hesaplı erişim, eşzamanlı kısmi depozito iadesi, gider tarih filtresi ve iptali, arşivli mülkün doluluk hesabından çıkması ve nakit raporunda tahsilat/dağıtım/ödenmiş gider ayrımı geçti.

## Profil ve bildirimler (AUTH-03, NTF-01/02)

| Yöntem ve yol | Girdi | Başarı |
| --- | --- | --- |
| GET `/api/v1/me/profile` | — | 200 `{ displayName, email, emailConfirmed }` |
| PUT `/api/v1/me/profile` | `{ displayName }` | 200 güncellenmiş profil; ad 1–200 karakter olmalıdır |
| GET `/api/v1/me/notification-preferences` | — | 200 `{ emailEnabled, rentDueEnabled, overdueRentEnabled, leaseEndEnabled, rentAnniversaryEnabled }`; e-posta varsayılan kapalı, olay tercihleri açık |
| PUT `/api/v1/me/notification-preferences` | Yukarıdaki beş boolean alan | 200 kayıtlı tercihler; e-posta seçeneği doğrulanmamış adreste 400 |
| GET `/api/v1/notifications` | `page?` (varsayılan 1), `pageSize?` (varsayılan 25, en çok 100), `unreadOnly?` | 200 `{ items, page, pageSize, hasMore }` |
| PATCH `/api/v1/notifications/{id}/read` | — | 204; başka hesap/kullanıcı bildirimi 404 |
| POST `/api/v1/notifications/read-all` | — | 204 |

Tüm uçlar oturum ister; yazan isteklerde frontend `Origin` denetlenir. Tercih, bildirim ve e-posta kuyruğu hesap-kullanıcı bileşik üyeliğine bağlıdır. Bildirim işi vade gününden 3 gün öncesine kadar yaklaşan kirayı, vadesi geçmiş pozitif bakiyeyi, 30 gün içindeki planlanan sözleşme bitişini ve sözleşme başlangıç gününün yıldönümünü üretir. Olay anahtarı tekrar üretimi tekilleştirir. Sözleşme bitişi yalnızca bilgi verir; fesih yapmaz. E-posta gönderim anında doğrulanmış adres ve açık tercih gerektirir; mevcut SMTP outbox/worker'ını kullanır. SMTP yapılandırması yoksa e-posta teslim edilmez.

## Belgeler (DOC-01/02)

| Yöntem ve yol | Girdi | Başarı |
| --- | --- | --- |
| GET `/api/v1/documents` | `page?`, `pageSize?`, `propertyId?`, `unitId?`, `leaseId?` | 200 `{ items, page, pageSize, hasMore }`; yalnız etkin belgeler |
| POST `/api/v1/documents/upload-intents` | `{ propertyId?, unitId?, leaseId?, originalName, contentType, sizeBytes }` | 201 `{ id, uploadUrl, expiresAtUtc, contentType, requiredHeaders }`; tam olarak bir geçerli hesap içi bağlantı seçilir |
| POST `/api/v1/documents/{id}/complete` | — | 200 etkin belge; boyut, Content-Type, PDF/JPEG/PNG imzası ve temiz AV taraması doğrulanır; tarayıcı yoksa 503, tehdit varsa 422 |
| GET `/api/v1/documents/{id}/download-url` | — | 200 `{ downloadUrl, expiresAtUtc }`; 60 saniye imzalı, indirme yanıtı |
| DELETE `/api/v1/documents/{id}` | — | 204 soft delete; R2 temizliği idempotent işçi tarafından yeniden denenir |

Tüm yollar oturum ve hesap kapsamı gerektirir; upload/delete/download URL yazma ve denetim isteklerinde doğru `Origin` zorunludur. Dosya en çok 25 MiB, varsayılan olarak 10 MiB; izin verilen türler PDF/JPEG/PNG. PUT URL varsayılan 120 saniyede sona erer ve `Content-Type` başlığı aynı gönderilmelidir. Complete işlemi yüklenen nesneyi ayrı, tahmin edilmesi zor etkin anahtara kopyalar; tekrar kullanılabilen kısa PUT URL'si etkin belgeyi değiştiremez. Dosyalar özel tutulur ve download URL taşıyıcı anahtar gibidir.

R2 ayarları sunucu ortamında `Storage__R2AccountId`, `Storage__R2BucketName`, `Storage__R2AccessKeyId`, `Storage__R2SecretAccessKey` olarak sağlanır. İsteğe bağlı `Storage__MaximumFileSizeBytes`, `Storage__PutUrlSeconds`, `Storage__GetUrlSeconds` değerleri varsayılanı ve üst sınırı geçemez. Ayarlar eksik/geçersizse upload intent, complete ve download URL 503 verir; fake başarı üretmez. Bucket private olmalı; browser upload için R2 CORS'ta yalnız frontend origin'i ve `PUT`/`Content-Type` izinleri tanımlanmalıdır. Upload ve active objeler ayrı anahtarlarda tutulur; yükleme URL'si sona erene kadar geçici anahtar temizlik için bekler. Soft delete ve süresi dolmuş pending upload'lar 15 dakikalık job ile temizlenir.

`DocumentsPrivateStorage` migration'ı gerekir. `DocumentIsolationTests`, gerçek SQL Server'da iki hesaplı liste/IDOR, soft delete, R2 ayarı yokken fail-closed davranışı ve R2 taklit depolaması olsa bile temiz AV sonucu yokken belgenin `ACTIVE` olmamasını sınar. AV tarayıcı adaptörü henüz yoktur; varsayılan tarayıcı `Unavailable` verir ve complete 503 döndürür. Gerçek Cloudflare R2 anahtarı/bucket olmadığı için sağlayıcıya PUT, HEAD, GET, Copy ve DELETE kabulü henüz çalıştırılmadı. Gerçek R2 ve AV tarayıcı entegrasyonu tamamlanmadan belge akışı üretime hazır değildir.
