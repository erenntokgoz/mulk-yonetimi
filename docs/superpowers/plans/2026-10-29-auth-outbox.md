# Auth outbox uygulama planı

1. Gerçek SQL testinde migration ve kayıt isteğinin outbox satırı oluşturduğunu önce başarısız doğrula.
2. Outbox modelini, migration'ı ve HTTP endpoint kuyruğa alma davranışını ekle.
3. Worker için claim, gönderim, tekrar deneme testini önce başarısız doğrula; worker'ı ekle.
4. Proxy IP güven zincirini yapılandır, test et; dağıtık limit için veri store kararı ve operasyonel açığı belgele.
5. Restore, build, unit/integration test, format ve migration script kontrolünü çalıştır.
