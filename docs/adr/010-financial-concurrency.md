# ADR 010: Finansal yazmalarda hesap kilidi

Durum: Kabul edildi (2026-11-15).

Technical Design v1.1 `PaymentAllocations` için transaction ve `rowversion` tarif eder. Uygulamada para hareketleri ve alacak üretimi aynı hesap satırına `UPDLOCK` alıp `RepeatableRead` transaction içinde çalışır (`RentRules.LockAccountAsync`). Bu, aynı hesaptaki ödeme/dağıtım işlemlerini sıralar; ayrıca `(AccountId, LeaseId, PeriodStart)` tekil indeksi yinelenen alacağı engeller. İki tenant aynı satırı paylaşmaz. Finansal kayıtlar silinmez; düzeltme/void izlenir.

Bu MVP'de finansal satırlara ayrı `rowversion` eklemiyoruz. Satır sürümü tek başına birden fazla alacak ve dağıtım satırının toplamını korumaz; mevcut hesap kilidinin kaldırılması güvenliği zayıflatır. SQL concurrency ve tenant izolasyon testleri release kapısıdır. Tüm finansal yazma yolları hesap kilidini kullanmayı sürdürmelidir; yeni yol eklenirse aynı kapsamda yarış testi gerekir.
