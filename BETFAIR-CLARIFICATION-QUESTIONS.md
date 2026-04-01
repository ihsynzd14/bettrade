# Proje Netleştirme Soruları — Betfair Entegrasyonu

> Aşağıda projenin mevcut durumu, Betfair API dokümantasyonu ve mevcut kod yapısı  
> (`CLAUDE.md`, `AGENTS.md`, `BETFAIR-API-DOCS.md`) incelenerek hazırlanmış **10 kritik soru** yer almaktadır.  
> Bu soruların cevapları, geliştirme sürecine güvenle başlamak için **önceden netleştirilmelidir.**

---

## SORU 1 — `bettrade/` klasörünün `geniusBackend/` ve `psychobet/` ile olan ilişkisi nedir?

### Neden soruyorum:
Mevcut projede halihazırda iki servis var:
- **`geniusBackend/`** — Genius Sports'tan canlı spor verisi çeken Node.js/Express backend. Socket.IO ile frontend'e ≤250ms gecikme hedefiyle veri aktarıyor.
- **`psychobet/`** — Bu veriyi görselleştiren Next.js frontend. Supabase auth, Shadcn/ui, Tailwind CSS kullanıyor.

Fakat projenin kök dizininde `bettrade/` adında **boş bir klasör** daha var. Bu klasörün amacı belirsiz.

### Cevaplanması gerekenler:
- **`bettrade/` bağımsız bir servis mi?** Yani kendi Express sunucusu, kendi portu, kendi process'i olan ayrı bir backend mi olacak?
- **Yoksa `geniusBackend`'in içine entegre edilecek bir modül mü?** Örneğin `geniusBackend/src/services/betfair.service.js` gibi bir dosya olarak mı yaşamalı?
- **Yoksa `psychobet`'in yanında ikinci bir frontend mi?** Tamamen ayrı bir Next.js uygulaması olarak mı kalkacak?
- **Gelecekte `geniusBackend`'in bir kısmını devralacak mı,** yoksa sadece eklenti mi olacak?

### Neden önemli:
Bu sorunun cevabı **tüm klasör yapısını, port atamalarını, deployment stratejisini ve CI/CD pipeline'ını** doğrudan etkiler. Yanlış varsayım üzerinde kurulmuş bir mimariyi sonradan değiştirmek çok maliyetlidir.

---

## SORU 2 — Betfair oturumu sunucu tarafında mı (bot login) yoksa kullanıcı bazında mı (interactive login) yönetilecek?

### Neden soruyorum:
Betfair API'de iki farklı giriş yöntemi var ve her biri tamamen farklı bir mimari gerektirir:

| Yöntem | Açıklama |
|--------|----------|
| **Non-Interactive (Bot/Cert Login)** | Sunucuda bir SSL sertifikası ile otomatik giriş yapılır. Tüm bahis işlemleri tek bir Betfair hesabı altında çalışır. Bot'lar ve otomasyon için tasarlanmıştır. |
| **Interactive (API Login)** | Her kullanıcı kendi Betfair kullanıcı adı ve şifresi ile giriş yapar. Her kullanıcının kendi session token'ı olur. Çok kullanıcılı platformlar için tasarlanmıştır. |

### Cevaplanması gerekenler:
- **Bu bir tek-hesaplı trading bot mu?** Yani sadece Ersen'in Betfair hesabına bağlanıp, sunucu otomatik bahis mi yerleştirecek?
- **Yoksa çok kullanıcılı bir platform mu?** Her kayıtlı kullanıcı kendi Betfair hesabını bağlayabilecek mi?
- Eğer çok kullanıcılıysa: **Session token kimde duracak?** Tarayıcıda (frontend) mı yoksa backend'de (proxy olarak) mı saklanacak?
- **Eğer sadece Ersen'in hesabı kullanılacaksa:** Non-Interactive (SSL sertifikalı) login yolu mu planlanıyor?

### Neden önemli:
Bu karar; authentication mimarisini, güvenlik modelini, SSL sertifika kurulumunu, session token'ların nerede ve nasıl saklanacağını tamamen değiştirir. Non-Interactive login için OpenSSL ile 2048-bit RSA sertifika üretip Betfair hesabına yüklemek gerekir. Interactive login için ise her kullanıcı için ayrı token yönetimi gerekir.

---

## SORU 3 — Genius Sports maç verisi ile Betfair market ID'leri nasıl eşleştirilecek?

### Neden soruyorum:
Mevcut `geniusBackend`, Genius Sports API'den gerçek zamanlı maç verisi alıyor (gol, kart, pas, şut, skor değişimleri vb.). Ancak Betfair'in kendi `marketId` sistemi var (örneğin `1.120684740`). Bu iki sistem arasında doğrudan bir bağlantı yok.

Yani "Genius Sports'tan gelen Liverpool vs Manchester City maçı" ile "Betfair'deki MATCH_ODDS market'i" arasındaki bağlantıyı kuracak bir **köprü mekanizması** lazım.

### Cevaplanması gerekenler:
- **Bu eşleştirme nasıl yapılacak?** Manuel bir lookup tablosu ile mi (her maç için önceden Betfair market ID'lerini yazmak), yoksa Betfair'in `listMarketCatalogue` API'sini çağırıp maç adı/saati ile otomatik arama yaparak mı?
- **Eğer otomatik arama yapılacaksa:** Hangi kriterler kullanılacak? Takım isimleri + maç saati mi? Event type ID + country code mu? Fuzzy matching (yaklaşık eşleştirme) gerekecek mi?
- **Genius Sports'ta olan ama Betfair'de olmayan maçlar için ne yapılacak?** (Alt ligler, az bilinen turnuvalar vb.) Bu maçlar için işlem yapılmayacak mı, yoksa bir uyarı mı gösterilecek?
- **Eşleştirme başarısız olursa** sistem nasıl davranacak? sessize mi alınacak, hata mı fırlatılacak?

### Neden önemli:
Bu köprü olmadan "canlı spor verisi al → analiz et → Betfair'de bahis yerleştir" boru hattı (pipeline) **tamamen çalışmaz**. Güvenilir bir eşleştirme mekanizması olmadan hiçbir bahis otomasyonu mümkün değildir.

---

## SORU 4 — Canlı fiyat verisi için Betfair Stream API mi yoksa REST polling mi kullanılacak?

### Neden soruyorum:
Betfair Exchange'den canlı fiyat (odds) verisi almak için iki farklı yöntem var:

| Yöntem | Latency | Karmaşıklık | Bağlantı |
|--------|---------|-------------|---------|
| **Stream API** (SSL Socket) | Çok düşük (milisaniye seviye) | Yüksek — kalıcı TCP bağlantı, yeniden bağlanma mantığı, `initialClk`/`clk` takibi | Kalıcı SSL socket (`stream-api.betfair.com:443`) |
| **REST `listMarketBook`** | Yüksek (saniyeler) | Düşük — basit HTTP POST isteği | İstek başına yeni bağlantı |

Mevcut sistem zaten **≤250ms uçtan uca gecikme** hedefliyor (Socket.IO üzerinden).

### Cevaplanması gerekenler:
- **Betfair fiyat verisi için de latency kritik mi?** Yani canlı bahis (in-play) yapılacak ve milisaniyeler önemli mi? Yoksa sadece maç öncesi (pre-match) bahisleri mi söz konusu?
- **Stream API kullanılacaksa:** Bu bağlantı `geniusBackend` içinde mi çalışacak (Ably stream ile aynı anda), yoksa `bettrade/` içinde ayrı bir servis olarak mı?
- **Aynı anda kaç market'e abone olunacak?** (Delayed key = max 200 market, Live key = sınırsız)
- **REST polling tercih edilirse:** Polling sıklığı ne olacak? Her saniye mi, her 5 saniye mi? Bu 5.000 tx/saat limitini nasıl etkileyecek?

### Neden önemli:
Stream API; kalıcı TCP bağlantı yönetimi, kopma anında yeniden bağlanma, `initialClk`/`clk` ile cache senkronizasyonu ve mesaj parçalama (segmentation) gibi önemli karmaşıklıklar içerir. REST polling ise çok daha basit ama latency açısından çok daha kötüdür. Yanlış seçim, ya gereksiz karmaşıklığa ya da kaçırılan fırsatlara neden olur.

---

## SORU 5 — Bahis stratejisi tam otomatik bot mu, manuel mi, yoksa sinyal destekli yarı otomatik mi?

### Neden soruyorum:
Betfair API tüm bahis yaşam döngüsünü destekliyor (`placeOrders`, `cancelOrders`, `replaceOrders`, `updateOrders`). Ancak otomasyonun seviyesi belirsiz:

- **Tam otomatik bot:** Sistem fiyat hareketlerini ve Genius Sports sinyallerini izler, insan müdahalesi olmadan otomatik bahis yerleştirir.
- **Sinyal destekli manuel:** Sistem Genius Sports verisinden bahis fırsatları tespit eder ve kullanıcıya gösterir. İnsan karar verir ve tıklayarak bahis yerleştirir.
- **Yarı otomatik:** Küçük miktarlar için otomatik yerleştirir, belirli bir üst limit için insan onayı ister.

### Cevaplanması gerekenler:
- **`placeOrders`'ı kim tetikleyecek?** Bir algoritma mı (kod içindeki bir strateji fonksiyonu), yoksa kullanıcı UI'da bir butona basarak mı?
- **Pozisyon/bakiye yönetimi yapılacak mı?** Örneğin maksimum kayıp limiti, günlük bütçe, stake sınırlaması gibi kurallar olacak mı?
- **Genius Sports canlı verisi doğrudan bahis kararlarını etkiliyor mu?** Örneğin "takım X golden sonra geride kaldı → otomatik back" gibi bir mantık mı var?
- **Strateji kuralları nerede tanımlanacak?** Kod içinde hard-coded mı, yoksa bir kural motoru/konfigürasyon dosyası ile mi?

### Neden önemli:
Tam otomatik bir bot; hata yönetimi, telafi mekanizmaları (compensation), loglama, izleme ve uyum (compliance) açısından çok daha fazla güvenlik önlemi gerektirir. İnsanın döngüde olduğu bir sistemde bu kadar katı önlemlere gerek yoktur. Bu karar projenin **tüm karmaşıklık seviyesini** belirler.

---

## SORU 6 — Uzun süre çalışan Node.js servisinde Betfair session token nasıl canlı tutulacak?

### Neden soruyorum:
Betfair session token'larının süreleri sınırlı:
- **UK/İrlanda hesapları:** 24 saat sonra sona erer
- **Uluslararası hesaplar:** 12 saat sonra sona erer
- **İtalyan/İspanyol borsaları:** 20 dakika sonra sona erer

Session'ı uzatmak için **Keep Alive** endpoint'ini proaktif olarak çağırmak gerekir. Ayrıca mevcut sistem zaten 7/24 çalışacak şekilde tasarlanıyor (`npm run prod` ile).

### Cevaplanması gerekenler:
- **Bir token yenileme planlayıcısı (scheduler) olacak mı?** Örneğin her 10-15 dakikada bir `setInterval` ile `https://identitysso.betfair.com/api/keepAlive` çağrılacak mı?
- **Session beklenmedik bir şekilde expire olduğunda ne olacak?** Örneğin canlı bahis (in-play) sırasında session düşerse, açıkta kalan emirlere (unmatched orders) ne olacak?
- **Her API çağrısında `INVALID_SESSION_TOKEN` hatası yakalanıp otomatik yeniden giriş (re-login) yapılacak mı?**
- **Non-Interactive login kullanılacaksa:** Session token nerede saklanacak? Memory'de mi, Redis'te mi, dosyada mı?

### Neden önemli:
Canlı bir işlem (özellikle in-play) sırasında session'ın expire olması, **Betfair'de açıkta kalan emirleri (unmatched orders) yönetilemez hale getirir.** Otomatik yeniden giriş mekanizması olmadan, açıkta kalan bahisler saatlerce kontrolsüz kalabilir. Bu finansal risk demektir.

---

## SORU 7 — Beklenen işlem hacmi nedir ve Betfair işlem ücretleri için bir bütçe planı var mı?

### Neden soruyorum:
Betfair, saatte **5.000 yerleştirilmiş/başarısız işlemi** aşarsa ek ücret uyguluyor. Bu limite surprisingly hızlı ulaşılabilir:

- Bir emir yerleştir (placeOrders) = 1 işlem
- Bir emir iptal et (cancelOrders) = 1 işlem  
- Yeniden yerleştir (replaceOrders) = 1 işlem
- Yani "fiyat değişti, iptal et ve tekrar yerleştir" döngüsü = **3 işlem**

Eğer 100 market'i takip edip her market'te dakikada 1 fiyat güncellemesi yapılırsa: 100 × 3 × 60 = **18.000 işlem/saat** → limiti 3.6 kat aşar.

### Cevaplanması gerekenler:
- **Saatte kaç bahis yerleştirilmesi, iptali ve güncellemesi bekleniyor?** Bir tahmin/range verilebilir mi?
- **"Sırada kal" (stay in queue) stratejisi uygulanacak mı?** Yani emri iptal edip yeniden yerleştirmek yerine, mevcut emri yerinde bırakıp eşleşmeyi beklemek mi planlanıyor?
- **Betfair Transaction Charges sayfası (https://www.betfair.com/aboutUs/Betfair.Charges/#TranCharges2) incelendi mi?** 5.000 işlem/saat üzerindeki ücret yapısı anlaşıldı mı?
- **İşlemler batch halinde mi yapılacak, tek tek mi?** Örneğin 10 market için ayrı ayrı mı yoksa toplu tek bir istekte mi?
- **Bu ücretler için bir bütçe ayrıldı mı?** £499 aktivasyon ücreti dışında aylık ek maliyet bekleniyor mu?

### Neden önemli:
Kontrolsüz bir otomatik sistem, 5.000 işlem/saat limitini kolayca aşabilir. Bu, £499 aktivasyon ücretinin **üzerinde beklenmedik finansal yükler** anlamına gelir. Özellikle cancel/re-place döngüleri çok pahalıdır.

---

## SORU 8 — Betfair geçmiş verisi (historical data) backtesting için kullanılacak mı? Hangi dönem ve marketler?

### Neden soruyorum:
Betfair, http://historicdata.betfair.com adresinden **tick-by-tick geçmiş veri** sağlıyor. Formatı canlı Stream API ile aynı (JSON stream). Herhangi bir bahis stratejisini canlıya çıkmadan önce test etmek için bu veri kritik önem taşıyor.

Ayrıca Betfair'in desteklediği araçlar var:
- **`betcode-org/betfair`** (Python) — Geçmiş veriyi parse eder, backtesting yapar
- **`betcode-org/flumine`** (Python) — Tam bir bahis trading framework'ü
- **https://www.betfairhistoricdata.co.uk/** — JSON → CSV dönüştürücü web aracı
- **Betfair Data Scientist tutorials** — Backtesting rehberleri

### Cevaplanması gerekenler:
- **Canlı trading'e başlamadan önce bir backtesting (geriye dönük test) aşaması planlanıyor mu?**
- **Hangi spor, lig ve tarih aralığı strateji için ilgili?** Örneğin son 2 yılın Premier League maçları mı?
- **Geçmiş veri local'de mi işlenecek (Python scriptleri ile), yoksa `geniusBackend` altyapısına mı entegre edilecek?**
- **`flumine` veya `betcode-org/betfair` gibi hazır framework'ler kullanılacak mı, yoksa her şey sıfırdan mı yazılacak?**
- **Backtest sonuçları nasıl değerlendirilecek?** ROI, hit rate, maximum drawdown gibi metrikler takip edilecek mi?

### Neden önemli:
Geçmiş veri üzerinde test edilmeden canlıya çıkan bir strateji **yüksek finansal risk** taşır. Ayrıca geçmiş veri işleme altyapısı ile canlı Stream API altyapısı temelde aynıdır — bu kararı erken vermek duplicate işin önüne geçer.

---

## SORU 9 — Betfair App Key ve giriş bilgileri ortamlar arasında (dev/uat/prod) nasıl saklanacak ve güvenliği nasıl sağlanacak?

### Neden soruyorum:
Mevcut projede `.env.example` dosyası yok. `CLAUDE.md`'de sadece şu ortam değişkenleri listelenmiş:
- `GENIUS_API_KEY`
- `FRONTEND_URL`
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Betfair entegrasyonu ise **çok hassas** yeni bilgiler ekliyor:

| Bilgi | Risk Seviyesi | Açıklama |
|-------|--------------|---------|
| `BETFAIR_APP_KEY` (Live) | Yüksek | 16 karakterlik canlı uygulama anahtarı |
| `BETFAIR_USERNAME` | Yüksek | Betfair hesap kullanıcı adı |
| `BETFAIR_PASSWORD` | Kritik | Betfair hesap şifresi |
| `client-2048.key` (SSL Private Key) | Kritik | Hesaba tam API erişimi sağlar, **asla Git'e commit edilmemeli** |
| `client-2048.crt` (SSL Certificate) | Orta | Public certificate, paylaşılabilir |

### Cevaplanması gerekenler:
- **SSL sertifikası ve private key deploy edildiği ortamda nerede duracak?** Dosya sisteminde mi, bir secrets manager'da (AWS Secrets Manager, HashiCorp Vault) mı, yoksa base64-encoded environment variable olarak mı?
- **`dev`, `uat`, `prod` ortamlarında farklı credential'lar mı kullanılacak?** Örneğin:
  - `dev` → Delayed App Key (güvenli, ücretsiz, gecikmeli veri)
  - `uat` → Delayed App Key veya sınırlı Live Key
  - `prod` → Live App Key (gerçek para, gerçek bahisler)
- **`.gitignore` dosyasında `client-2048.key` ve `.env` dosyaları hariç tutulmuş mu?**
- **Private key'in Git'e yanlışlıkla commit edilmesini engelleyen bir pre-commit hook var mı?**

### Neden önemli:
Live App Key veya SSL private key'in sızdırılması bir **güvenlik olayıdır (security incident).** `client-2048.key` dosyası, Betfair hesabına tam API erişimi sağlar — kim bu dosyaya sahipse hesap adına bahis yapabilir. Bu dosya **production secret** olarak korunmalıdır.

---

## SORU 10 — Mevcut `psychobet` frontend'i ile yeni Betfair trading arayüzü arasındaki ilişki ne olacak?

### Neden soruyorum:
`psychobet` halihazırda bir Next.js frontend:
- Spor verisi görselleştirme (canlı feed, admin dashboard)
- Supabase ile kullanıcı girişi
- Socket.IO ile gerçek zamanlı veri akışı
- Shadcn/ui + Tailwind CSS ile modern arayüz

Betfair entegrasyonu yeni UI bileşenleri gerektiriyor:
- **Piyasa görüntüleyici** (market viewer) — canlı odds, sıralama, fiyat ladder'ı
- **Bahis yerleştirme arayüzü** (bet placement) — back/lay seçimi, stake girişi, onay
- **Açık emirler paneli** (open orders) — mevcut eşleşmemiş bahisler
- **P&L takibi** — kar/zarar durumu

### Cevaplanması gerekenler:
- **Betfair trading arayüzü `psychobet`'in içine mi eklenecek?** Yeni sayfalar/route'lar olarak (örneğin `/trading`, `/markets`)?
- **Yoksa `bettrade/` ayrı bir frontend (ikinci bir Next.js uygulaması) olacak?** Tamamen bağımsız bir trading terminali olarak mı kalkacak?
- **Eğer `psychobet`'e eklenirse:** Betfair market verisi mevcut Socket.IO pipeline'ından mı akacak, yoksa yeni bir socket namespace/channel mı açılacak?
- **Mevcut Supabase ile giriş yapan kullanıcılar Betfair erişimine sahip olacak mı?** Yoksa Betfair entegrasyonu sadece hesap sahibi (Ersen) için mi?
- **Eğer sadece Ersen içinse:** Trading arayüzü bir admin paneli gibi mi çalışacak, yoksa public ama erişim kısıtlı mı olacak?

### Neden önemli:
Bu sorunun cevabı `bettrade/` klasörünün **ne olduğunu** belirler: Bir Next.js uygulaması mı, bir Express servisi mi, yoksa paylaşılan bir TypeScript kütüphanesi mi? Projedeki **sonraki her teknik karar** bu cevaba bağlıdır.

---

*Belge oluşturulma tarihi: Mart 2026*  
*Hazırlayan: OpenCode AI — `CLAUDE.md`, `AGENTS.md` ve `BETFAIR-API-DOCS.md` üzerinden proje analizi ile*
