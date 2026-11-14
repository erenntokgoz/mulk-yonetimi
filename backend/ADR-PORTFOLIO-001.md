# ADR 001 — Finans şeması için kaynak önceliği

Durum · Ana entegrasyon için karar taslağı

Teknik tasarım v1.1 para için `decimal(19,4)` ve kira alacağı için `(LeaseId, PeriodYear, PeriodMonth, ChargeType)` önerir. PRD v1.1 ve çalışma kuralları `decimal(19,2)` ve `(AccountId, LeaseId, PeriodStart)` ister.

Uygulamada açık çalışma kuralları ve PRD v1.1 esas alınacak. İş tarihleri `DateOnly` ve SQL `date`, olay zamanları UTC olacak. Finans diliminde bu kararın şema ve concurrency testlerine taşınması gerekir. Portföy dilimi finans şeması eklemiyor.
