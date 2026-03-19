<p align="center">
  <img src="https://img.shields.io/badge/Stellar%20Conquest-v1.0.0-blue?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/JavaScript-ES%20Modules-yellow?style=flat-square" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?style=flat-square" alt="Vite" />
  <img src="https://img.shields.io/badge/Socket.IO-4-010101?style=flat-square" alt="Socket.IO" />
</p>

<h1 align="center">Stellar Conquest</h1>

<p align="center">
  <strong>Gerçek zamanlı uzay fetih stratejisi</strong> — hızlı makro kararlar, derin harita kontrolü, mikro yönetim karmaşası yok.
</p>

<p align="center">
  <a href="./README.md">TR</a> • <a href="./README.en.md">EN</a>
</p>

<p align="center">
  <a href="#-hızlı-başlangıç">Hızlı Başlangıç</a> •
  <a href="#-oyunu-öğrenmek">Öğrenme</a> •
  <a href="#-özellikler">Özellikler</a> •
  <a href="#-mimari-özeti">Mimari</a> •
  <a href="#-nasıl-oynanır">Nasıl Oynanır</a> •
  <a href="#-kurulum">Kurulum</a> •
  <a href="#-testler">Testler</a> •
  <a href="#-yol-haritası">Yol Haritası</a> •
  <a href="#-canlı-demo">Canlı Demo</a>
</p>

---

## 📖 Özet

**Stellar Conquest**, gezegenleri ele geçirme, filo ve **flow** hatlarıyla lojistik, **park filoları** ile cephe hazırlığı ve **asimilasyon + bölge** üzerinden kazanılan tempoyla oynanan tarayıcı tabanlı gerçek zamanlı bir uzay strateji oyunudur. Tasarım bilinçli olarak “daha çok tıklama” yerine **doğru zamanlama, rota ve harita okuma** üzerine kuruludur.

**Tek kod tabanı, çift çalışma şekli:** Simülasyon mantığı `assets/sim/` altında toplanır; istemci (Canvas 2D + `game.js`) ve çok oyunculu sunucu (`server.js`) aynı kuralları kullanarak **deterministik tick** ve **durum hash** ile senkron kalır. Kampanya, günlük meydan okuma, playlist önayarları, mutatörler ve PvE karşılaşmaları (ör. **Mega Turret**, **Relay Core**) bu çekirdeğin üzerinde modül olarak çalışır.

---

## ⚡ Hızlı Başlangıç

```bash
# Bağımlılıkları yükle
npm install

# Tek oyunculu / geliştirme modu
npm run dev
# → http://localhost:5173

# Çok oyunculu sunucu
npm run server
# → http://localhost:3000
```

**Docker ile tek komut:**

```bash
docker compose up -d --build
```

---

## 🎓 Oyunu öğrenmek

1. **Menü → Yardım / Nasıl Oynanır** (`stellar_conquest.html` ve çok oyunculu arayüzde aynı modal): Kontroller, flow, asimilasyon, doktrin, mutatörler ve HUD tek yerde toplanmıştır; güncel davranış buradaki metinle tutulur.
2. **İlk maç:** Ana ekranda **Hemen Başla** veya playlist olarak **Zen** + doktrin **Lojistik** — tempo düşük, okunabilirlik yüksek açılış.
3. **Kampanya:** Her bölümde görev paneli + koç ipuçları; bonus hedefler zorunlu değildir.
4. **Geliştirici olarak:** `npm test` ile çekirdek kurallar; `npm run e2e` ile menü/çok oyunculu duman testleri.

---

## ✨ Özellikler

### Çekirdek Mekanikler

| Mekanik | Açıklama |
|--------|----------|
| **Gezegen ele geçirme** | Filo gönderimi ve yıpranma savaşı ile |
| **Flow bağlantıları** | Bir kez öncelik ver, ekonomini otomatik çalıştır |
| **Park filoları** | Bölgeyi tutar, tedarik kesilince zayıflar |
| **Bölge & asimilasyon** | Dünyaların etrafında organik büyüyen sınırlar |
| **Savunma** | Güçlendirilmiş düğümlerde taretler ve savunma alanları |
| **Harita öğeleri** | Solucan delikleri, yerçekimi kuyuları, bariyer kapıları |

### Oyun Modları

- **Skirmish** — AI veya arkadaşlarla serbest maç
- **Campaign** — El yapımı görevlerle yapılandırılmış misyon merdiveni
- **Günlük meydan okuma** — Tohumlu prosedürel senaryo, her gün yenilenen varyasyon
- **Özel haritalar** — JSON içe/dışa aktarma ile özel harita akışı
- **Çok oyunculu** — Socket.IO ile gerçek zamanlı odalar, 6 oyunculuya kadar

### AI

- Tarayıcıda hızlı çalışan sezgisel rakip
- Dinamik zorluk ayarlamalı birden fazla zorluk seviyesi
- Bölge, taretler, tedarik, **contested** alanlar ve tehdit geometrisinden haberdar

### Oyun içi rehber

- Bağlam rozeti ve ipucu satırı (seçim türüne göre ne yapılacağı)
- Gezegen tipleri ve HUD düğmeleri üzerinde **hover** ile kısa açıklamalar
- Duraklat menüsünde **İpucu** anahtarı (koç mesajları)

---

## 🏗 Mimari özeti

```text
stellar_conquest.html     Tek oyunculu giriş sayfası + menü / tutorial UI
index.html                Vite geliştirme kabuğu
game.js                   Ana istemci (~6k satır): render, menü, tek oyunculu döngü
server.js                 Express + Socket.IO; authoritative tick, odalar, snapshot

assets/
  sim/                    Paylaşımlı simülasyon (istemci önizleme + sunucu otoritesi)
    shared_config.js      Tick sabitleri, zorluk, gezegen tipleri
    server_sim.js         Sunucu tarafı tick boru hattı
    command_apply.js      Komutların deterministik uygulanması
    territory.js, flow_step.js, fleet_step.js, node_economy.js, …
    playlists.js          Standart / Zen / Chaos / … önayarları
    mutator.js            İyon fırtınası, karartma vb.
    encounters.js         Relay Core, Mega Turret vb. PvE yapı taşları
    mission_script.js     Kampanya olay / ilerleme kancaları
    match_manifest.js     Maç meta verisi (snapshot ile uyumlu)
    custom_map.js         JSON harita içe/dışa aktarma
    doctrine.js           Doktrin pasif/aktif kuralları
  app/                    İstemci yardımcıları (input, tick fazları, hover hedefi, başlatma akışı)
  net/                    online_session, network_tick
  campaign/
    levels.js             Kampanya tanımları + hedefler
    handcrafted_maps.js   El yapımı düzenler
    objectives.js         Hedef değerlendirme
    daily_challenge.js    Günlük tohumlu senaryo
  ui/                     HUD, lobby, misyon paneli, koç / danışman
tests/                    node:test birim testleri (sim ve UI yardımcıları)
e2e/                      Playwright duman testleri
```

**Önemli ilke:** Oynanış kuralı eklerken mümkün olduğunca `assets/sim/` içinde tutulur; böylece hem yerel önizleme hem sunucu aynı sonucu üretir.

---

## 🎮 Nasıl Oynanır

### Temel Kontroller (PC)

| Eylem | Kontrol |
|-------|---------|
| Gezegen seç | Sol tık |
| Çoklu seçim | Shift + sol tık |
| Kutu seçimi | Boş alanda sürükle |
| Filo gönder | Seçiliyken hedefe sol tık (HUD’daki Send % kadar) |
| Toplu gönderim | Ctrl + sürükle-bırak |
| Flow aç/kapat | Sağ tık (hedefe) |
| Savunma modu | Kendi gezegene sağ tık |
| Kamera | Orta tuş + sürükle |
| Zoom | Mouse tekerleği |

### Klavye Kısayolları

| Tuş | İşlev |
|-----|-------|
| `1`–`9` | Send % (10–90) |
| `0` | Send % 100 |
| `U` | Seçili gezegenleri yükselt |
| `A` | Tüm gezegenleri seç |
| `Q` | Doktrin aktif becerisi |
| `Esc` / `P` | Duraklat / Devam |

**Not:** Tam seçenek listesi ve mobil **YUK / SAV / FLOW / DOC** düğmeleri için oyundaki **Nasıl Oynanır** modalına bakın.

### Mobil

- Tek parmakla seç ve sürükle
- İki parmakla haritayı pan/zoom yap

---

## 🛠 Kurulum

### Gereksinimler

- **Node.js** 18+ (ES modülleri için)
- **npm** veya **pnpm**

### Tek Oyunculu / Yerel Geliştirme

```bash
npm install
npm run dev
```

`http://localhost:5173` adresini açın — Vite istemciyi hot reload ile sunar.

### Çok Oyunculu Sunucu

```bash
npm run server
```

`http://localhost:3000` — Express derlenmiş istemciyi sunar ve Socket.IO odalarını yönetir.

### Üretim Derlemesi

```bash
npm run build
```

Çıktı `dist/` klasörüne yazılır. `server.js` otomatik algılar:

- **dist modu** — `dist/` mevcutsa Vite paketini sunar
- **kaynak modu** — aksi halde ham kaynak dosyalarına döner

### Docker ile Dağıtım

```bash
docker compose up -d --build
```

Tek komut kısayolu:

```bash
npm run deploy
```

Komut ayrımı:

- `npm run deploy` → canlı Docker deploy
- `npm run deploy:local` → yerelde `node server.js` ile aç
- `npm run deploy:check` → yerel `dist`, konteyner ve canlı URL bundle'ını karşılaştır

`deploy` komutu canlıyı hedefler. Sadece yerel deneme istiyorsanız `deploy:local` kullanın.

Oyun sunucusu `solarmax-app` konteynerinde port `3000` üzerinde başlar.

| Detay | Değer |
|-------|-------|
| Konteyner adı | `solarmax-app` |
| Dahili port | `3000` |
| Kalıcı veri | `./data` volume |
| Harici ağ | `npm-net` (mevcut olmalı) |

Ters proxy arkasında çalıştırıyorsanız Socket.IO için **WebSocket yönlendirmesini** etkinleştirin. Canlı örnek Nginx Proxy Manager ve Let's Encrypt TLS kullanır.

---

## 🧪 Testler

Node.js yerleşik test çalıştırıcısı kullanılır — ek test framework’ü gerekmez.

```bash
npm test
```

`tests/` altında çekirdek simülasyon (filo, bölge, komutlar, hash, kampanya seviyeleri, playlist, misyon script, çok oyunculu oturum vb.) ve seçili UI yardımcıları kapsanır.

**E2E (Playwright):**

```bash
npm run e2e
```

Menü duman akışı ve çok oyunculu kabuk için `e2e/` dizininde senaryolar vardır. CI benzeri ortam için `npm run e2e:docker` kullanılabilir.

---

## 🌐 Çok Oyunculu Protokolü

- Oda kodları 5 karakterdir
- Maç sonucu yalnızca **tüm aktif oyuncular** aynı kazanan indeksini bildirdikten sonra kabul edilir
- Rematch ve sonuç oyları oyuncu bağlantısı kesildiğinde temizlenir
- Sunucu yetkili simülasyon tick’i çalıştırır ve istemci durumunu sync hash ile uyumlu hale getirir

---

## 🔗 Canlı Demo

**[https://solarmax.urgup.keenetic.link](https://solarmax.urgup.keenetic.link)**

---

## 🛡 Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Oyun istemcisi | Düz JavaScript (ES modülleri), Canvas 2D, tek ana modül `game.js` |
| Geliştirme sunucusu | Vite 5 |
| Çok oyunculu | Express 4 + Socket.IO 4 |
| Derleme | Vite (ESM paketi) |
| Birim testler | Node.js yerleşik `node:test` |
| E2E | Playwright (`@playwright/test`) |
| Konteyner | Docker + Docker Compose |

Framework yok, ağır oyun motoru yok — **kural ağırlığı** paylaşımlı `assets/sim/` içindedir; istemci görüntüleme, girdi ve akışa odaklanır.

---

## 💡 Tasarım Felsefesi

Oyun **ağır mikro yerine hızlı makro kararlar** etrafında kuruludur:

- **Basit girdi döngüsü** — seç, sürükle/gönder, flow ayarla, konumlandır, saldırı zamanlamasını yap. Yeni sistemler daha fazla buton değil, daha iyi kararlar üretmeli.
- **Harita düzeyinde derinlik** — mekanikler rota, bölge, zaman pencereleri ve hedef baskısını etkilemeli; ezberlenecek birim türü çoğaltmamalı.
- **Modlar arası yeniden kullanım** — her özellik skirmish, kampanya, günlük meydan okuma, özel haritalar ve çok oyunculuda çalışmalı.
- **Okunabilirlik öncelikli** — oyuncu bir filonun neden hızlı, yavaş, zayıflayan veya çatışmalı olduğunu görselden anlayabilmeli. Mobil uyum korunmalı.

---

## 🗺 Yol Haritası

Bu yol haritası üç amaca hizmet eder:

- mevcut çekirdek oynanışı derinleştirmek
- mod ve içerik çeşitliliğini artırmak
- uzun vadede rekabetçi ve topluluk odaklı bir oyun kabuğu kurmak

Temel ilke şudur: oyun daha fazla butonla değil, daha iyi kararlarla derinleşmeli.

### Önerilen Teslim Sırası

Geliştirme zamanı kısıtlıysa önerilen sıra:

1. **Bölge 2.0 ve Çatışmalı Cepheler**
2. **Sektör Mutatörleri v1**
3. **AI Cephe Farkındalığı**
4. **Görsel Okunabilirlik Geçişi**
5. **Komutan / Doktrin Sistemi**
6. **Kampanya Genişlemesi**
7. **PvE Hedefleri ve Boss Karşılaşmaları**
8. **Mod Sarmalayıcıları ve Çalma Listeleri**
9. **Rekabet Katmanı**
10. **Faksiyon Kimliği**
11. **Sosyal ve Topluluk Özellikleri**

Bu sıra; mevcut mekanikleri yeniden kullanan, oyunun kimliğini belirginleştiren ve teknik riski nispeten düşük olan özellikleri öncelemektedir.

### Güncel Durum Notu

Bu bölümdeki durum satırları `19 Mart 2026` itibarıyla repo içindeki gerçek uygulama seviyesini özetler.

### Kısa Vadeli Odak

#### 1. Bölge 2.0 ve Çatışmalı Cepheler

**Durum**

- büyük ölçüde tamamlandı; contested zone, border bonus blokajı, parked fleet farkı ve local/server parity çalışıyor

**Amaç**

- bölgeyi sadece pasif hız/koruma bonusu olmaktan çıkarıp gerçek cephe sistemine dönüştürmek

**Kapsam**

- aynı noktada iki tarafın asimile olmuş border’ı kesişirse `contested zone` üretmek
- contested bölgede hız bonusunu, decay korumasını veya diğer border avantajlarını kapatmak ya da zayıflatmak
- contested alanı nötr ama okunabilir bir görsel dille göstermek
- park filolarının cephe gerisi / cephe hattı davranışını farklılaştırmak
- AI’nin contested alanı güvenli arka saha gibi değerlendirmesini engellemek

**Neden önemli**

- sınırlar ilk kez gerçek stratejik anlam kazanır
- “hangi gezegeni aldım?” kadar “nerede tuttum?” sorusu da değer kazanır
- park filo mekaniği ile doğal biçimde birleşir

**Bağımlılıklar**

- render tarafında daha iyi border okuması
- local ve server sim’de aynı kuralın çalışması
- AI hedefleme puanlamasının frontier farkındalığı kazanması

**Başarı ölçütü**

- oyuncu tutorial okumadan güvenli alan / tartışmalı alan farkını sezebilmeli
- contested alan savaşın doğal toplandığı yer haline gelmeli

#### 2. Sektör Mutatörleri v1

**Durum**

- tamamlandı (v1); `Iyon Firtinasi` ve `Karartma Bolgesi` deterministik, network/snapshot akışına bağlı

**Amaç**

- her maçın aynı hissedilmesini engellemek için harita başına tek baskın çevresel kural eklemek

**Kapsam**

- iyon fırtınası, karartma bölgesi, pulse zengin alan, çöküş koridoru gibi tek ana mutatör
- mutatör bilgisinin seed ile deterministik üretilmesi
- günlük görev, kampanya ve multiplayer snapshot içinde kayıtlı olması
- HUD veya mission panel içinde kısa mutatör açıklaması gösterilmesi

**Neden önemli**

- aynı input döngüsünü korurken maç açılışları ve rota kararları değişir
- daily challenge gerçek anlamda “günün senaryosu” hissi verir
- kampanya görevleri daha karakteristik olur

**Bağımlılıklar**

- map manifest / map generation entegrasyonu
- render tarafında anomaly ve alan gösterimi
- snapshot ve network state tarafında mutatör verisinin tutulması

**Başarı ölçütü**

- oyuncu maç bittikten sonra “hangi mutatör vardı?” diye hatırlayabilmeli
- mutatör sadece sayısal buff değil, rota ve tempo kararı üretmeli

#### 3. AI Cephe Farkındalığı

**Durum**

- büyük ölçüde tamamlandı; AI contested/safe farkını anlıyor, staging kuruyor ve turret drip-feed davranışını azaltıyor

**Amaç**

- AI’ı daha zor ama daha doğal hale getirmek

**Kapsam**

- taretlere ve savunmalı düğümlere damla damla besleme yapmaması
- büyük itişten önce park filo veya staging davranışı göstermesi
- contested / enemy / safe territory ayrımını anlaması
- yeni alınan gezegeni hemen overextend etmemesi
- capital baskısı ve insan oyuncu önceliğini doğru zamanlarda artırması

**Neden önemli**

- zorluk hissi artar
- yapay zeka “ucuz hile” ile değil, daha iyi kararlarla güçlü görünür
- tek oyunculu ve sandbox değeri yükselir

**Bağımlılıklar**

- territory 2.0
- turret ve defense alanları için daha iyi tehdit skoru

**Başarı ölçütü**

- hard AI belirgin şekilde daha az intihar etmelidir
- oyuncu kaybettiğinde bunu daha iyi pozisyonlama veya zamanlama yüzünden hissetmelidir

#### 4. Görsel Okunabilirlik Geçişi

**Durum**

- büyük ölçüde tamamlandı; contested görünümü, mutator/encounter göstergeleri, mission HUD ve doctrine durumları eklendi

**Amaç**

- büyüyen sistem derinliğini görsel karmaşaya dönüşmeden okunur tutmak

**Kapsam**

- contested border görünümü
- supply / decay / parked / boosted fleet görsel ayrımı
- anomaly / mutatörlerin belirgin ama ekranı boğmayan overlay’leri
- mobil HUD için daha sıkı responsive davranış
- maç sonu ve görev geri bildirimlerinde daha iyi bilgi mimarisi

**Neden önemli**

- yeni kurallar metinle değil görüntüyle anlaşılmalıdır
- özellikle mobil tarafta karmaşa hızla hissedilir

**Başarı ölçütü**

- oyuncu “neden böyle oldu?” sorusunu daha az sormalıdır
- yeni özellikler eklendikçe HUD çökmeden kalmalıdır

### Orta Vadeli Odak

#### 5. Komutan / Doktrin Sistemi

**Durum**

- tamamlandı (v1); `Logistics`, `Assimilation` ve `Siege` doktrinleri, aktif/pasif etkiler, lobby/UI ve AI eşleşmesi çalışıyor

**Amaç**

- oyuncuya maç öncesi stratejik kimlik vermek

**Kapsam**

- her doktrinde bir pasif, bir aktif, bir tradeoff
- örnek çizgiler: `Logistics`, `Assimilation`, `Siege`, `Territory`, `Pulse`
- doktrin seçim ekranı veya lobby entegrasyonu
- AI profilleriyle doktrin eşleşmesi
- kampanyada belirli görevlerin belirli doktrinleri öğretmesi

**Risk**

- fazla güçlü aktif yetenekler oyunu mikro yoğun hale getirebilir

**Başarı ölçütü**

- doktrin seçimi gerçek açılış ve öncelik farkı yaratmalı
- ama ikinci bir skill bar oyunu olmamalı

#### 6. Kampanya Genişlemesi

**Durum**

- kısmi; objective tabanlı yeni campaign bölümleri, survival ve boss odaklı görevler eklendi ama eskort/koruma ve daha geniş çok aşamalı set henüz yok

**Amaç**

- kampanyayı sadece artan zorlukta skirmish zinciri olmaktan çıkarmak

**Kapsam**

- hayatta kalma görevleri
- eskort / koruma görevleri
- belirli sektörleri tutma görevleri
- mutatör öğretici görevler
- boss sektörleri
- çok aşamalı hedefler ve bonus görevler

**Başarı ölçütü**

- her görev tek bir ana kavramı öğretmeli veya test etmeli
- oyuncu görevleri “harita 12” diye değil, “relay savunma görevi” gibi hatırlamalı

#### 7. PvE Hedefleri ve Boss Karşılaşmaları

**Durum**

- kısmi; `Mega Turret` ve `Relay Core` encounter çatısı hazır, ancak zamanlı savunma olayları ve ortak tehditli özel haritalar henüz yok

**Amaç**

- oyunu sadece tam yok etme etrafından çıkarmak

**Kapsam**

- nötr mega-taretler
- antik çekirdekler / relay yapıları
- zamanlı savunma olayları
- ortak tehditli özel haritalar
- campaign ve daily için boss encounter çatısı

**Tasarım kuralı**

- boss mekanikleri mermi cehennemi değil, harita kontrolü ve zamanlama problemi üretmeli

**Başarı ölçütü**

- PvE içerik yeni rota ve öncelik kararları doğurmalı
- sadece “daha çok unit biriktir” hissi vermemeli

#### 8. Mod Sarmalayıcıları ve Çalma Listeleri

**Durum**

- kısmi; `Chaos`, `Ironman`, `Puzzle Sector`, `Zen` ve `Frontier` var, ancak `Ranked` playlist ve buna bağlı rekabet akışı henüz yok

**Amaç**

- aynı çekirdek oyunu farklı oturum ruh hallerine paketlemek

**Kapsam**

- `Ranked`
- `Chaos`
- `Ironman`
- `Puzzle Sector`
- `Zen`
- `Frontier`

**Neden önemli**

- aynı sistemler farklı oyuncu kitlelerine hitap eder
- ana menü ve içerik yapısı daha güçlü görünür

**Başarı ölçütü**

- playlist’ler sadece rakam preset’i gibi değil, farklı oyun tarzı gibi hissettirmeli

### Uzun Vadeli Odak

#### 9. Rekabet Katmanı

**Durum**

- başlangıç seviyesinde; authoritative sync, reconnect ve temel leaderboard/persistence var ama Elo/MMR, sezon, spectator ve maç geçmişi henüz yok

**Amaç**

- çok oyunculuyu kalıcı bir ilerleme ve takip alanına çevirmek

**Kapsam**

- Elo/MMR
- sezon sistemi
- izleyici modu
- maç geçmişi
- maç sonrası zaman çizelgesi ve ekonomi kırılımı

**Bağımlılıklar**

- sağlam authoritative sync
- güvenilir maç geçmişi verisi
- reconnect / stability iyileştirmeleri

**Başarı ölçütü**

- oyuncular oda açmanın ötesinde geri dönme motivasyonu bulmalı

#### 10. Faksiyon Kimliği

**Durum**

- henüz başlanmadı; doktrin farkları var ama gerçek anlamda faksiyon sistemi yok

**Amaç**

- asimetri eklemek ama okunabilirliği bozmamak

**Kapsam**

- farklı doktrin varsayılanları
- küçük bölge / asimilasyon / lojistik farkları
- anomaly etkileşim bonusları
- biome veya gezegen trait’leri ile desteklenmiş kimlikler

**Kaçınılacak şey**

- çok sayıda ayrı unit class
- büyük counter chart’lar
- yüksek APM zorunluluğu

**Başarı ölçütü**

- aynı input sistemi korunurken taraflar stratejik olarak farklı hissedilmeli

#### 11. Sosyal ve Topluluk Özellikleri

**Durum**

- henüz başlanmadı; daily leaderboard ve custom map export gibi çekirdek parçalar var ama paylaşım/vitrin/topluluk katmanı yok

**Amaç**

- oyunun tek maç ömrünü aşan bir topluluk katmanı kurmak

**Kapsam**

- paylaşılabilir challenge seed’leri
- haftalık / günlük öne çıkan sektörler
- topluluk harita vitrinleri
- turnuva veya etkinlik playlist’leri
- gerekirse clan / squad desteği

**Başarı ölçütü**

- oyuncular sadece oynamak için değil, paylaşmak ve karşılaştırmak için de geri gelmeli

### Yapılmayacaklar

- dev tech ağaçları
- çok sayıda ayrı birim sınıfı
- yüksek APM aktif yetenek spam’i
- sadece tek bir modda çalışan tek seferlik mekanikler
- zayıflığı üretim hilesiyle telafi eden AI
- mobilde küçük buton mezarlığına dönen UI tasarımları

### Başarıyı Nasıl Ölçeceğiz

Bu yol haritasındaki işlerin gerçekten faydalı olup olmadığını şu sonuçlarla değerlendirmek gerekir:

- maç hikayeleri daha ayırt edilebilir mi
- AI daha doğal mı hissediliyor
- border / parked fleet / rota kararları daha anlamlı mı
- campaign görevleri daha akılda kalıcı mı
- multiplayer geri dönüş oranı artıyor mu
- yeni özellikler HUD ve giriş akışını bozmadan eklenebiliyor mu

## 🤖 Yol Haritası İçin Hazır Prompt'lar

Aşağıdaki prompt’lar bu repo için pratik çalışma başlangıçlarıdır. Her biri; önce kodu okuyup sonra küçük ama üretime uygun değişiklikler yapacak bir coding agent / LLM için yazılmıştır.

### Prompt 1 — Bölge 2.0 ve Çatışmalı Cepheler

```text
Bu repo içinde `Bölge 2.0 ve Çatışmalı Cepheler` özelliğini uygula.

Önce mevcut territory, holding decay, fleet movement, parked fleet ve render akışını incele.
Özellikle şu dosyalara bak:
- game.js
- assets/sim/territory.js
- assets/sim/fleet_step.js
- assets/sim/holding_decay.js
- assets/sim/server_sim.js

İstenen davranış:
- aynı noktada iki düşman oyuncunun tam asimile olmuş territory alanı kesişirse orası `contested zone` olsun
- contested zone içinde territory hız bonusu çalışmasın
- contested zone içinde parked fleet decay koruması çalışmasın
- contested zone net ama sade bir görselle gösterilsin
- AI contested zone’u güvenli alan gibi değerlendirmesin

Kısıtlar:
- local ve authoritative sim aynı kuralla çalışmalı
- mevcut mobil ve masaüstü okunabilirliğini bozma
- CPU maliyetini düşük tut
- snapshot / sync mantığını bozma

Beklenen çıktı:
- gerekli kod değişiklikleri
- ilgili testler
- build doğrulaması
- kısa teknik özet
```

### Prompt 2 — Sektör Mutatörleri v1

```text
Bu repo için `Sektör Mutatörleri v1` özelliğini tasarla ve uygula.

Önce mevcut map generation, challenge, campaign ve shared simulation yapısını incele.
Bakılacak dosyalar:
- assets/sim/map_gen.js
- assets/campaign/daily_challenge.js
- assets/campaign/levels.js
- game.js
- assets/sim/server_sim.js

Amaç:
- her maç için tek bir baskın çevresel kural seçilebilsin
- bu kural seed ile deterministik olsun
- multiplayer snapshot’larda saklansın

İlk versiyon için en fazla 2 mutatör ekle:
- ion storm: belirli bölgede fleet speed düşsün
- blackout zone: belirli bölgede territory bonusları kapansın

Kısıtlar:
- mutatör etkisi hem local hem server sim’de aynı olmalı
- render sade ve okunabilir olmalı
- daily challenge ve custom map akışını bozmamalı

Teslim şekli:
- kod
- test
- README gerekiyorsa kısa dokümantasyon
- build sonucu
```

### Prompt 3 — AI Cephe Farkındalığı

```text
Bu repo içindeki AI’ı daha zor ama daha doğal hale getir.

Önce AI karar akışını dikkatlice incele:
- game.js
- assets/sim/ai.js
- assets/sim/shared_config.js

Sorunlar:
- defended / turret hedeflere damla damla gönderim
- border hattını anlamadan saldırı
- parked fleet ve staging eksikliği

İstenen iyileştirmeler:
- ağır savunulan hedeflere düşük odds saldırıyı azalt
- contested ve enemy territory farkını skorlamaya kat
- fırsat oluştuğunda parked fleet staging kullan
- yeni alınmış gezegenleri stabilize etmeden aşırı overextend etme

Kısıtlar:
- AI CPU maliyeti tarayıcı tarafında makul kalmalı
- difficulty preset’leri korunmalı ama hard belirgin biçimde daha akıllı hissettirmeli

Teslim:
- kod değişikliği
- test senaryoları
- kısa davranış özeti
```

### Prompt 4 — Görsel Okunabilirlik ve Mobil HUD

```text
Bu repo için yeni stratejik sistemleri daha okunur hale getiren bir UI/render pass yap.

İncelenecek yerler:
- stellar_conquest.html
- game.js
- assets/ui/renderers.js

Hedefler:
- contested border için sade bir görsel dil
- parked fleet, unsupplied fleet ve decay state için ayırt edilebilir işaretler
- anomaly / mutatör overlay’lerinin ekrana hükmetmeden görünmesi
- mobil HUD’da kritik bilgilerin daha az yer kaplaması

Kısıtlar:
- mevcut görsel dili tamamen bozma
- mobile-first düşün
- performansı düşürecek ağır efektlerden kaçın

Beklenen çıktı:
- CSS / canvas render değişiklikleri
- hangi problem nasıl çözüldü özeti
- gerekiyorsa ekran alanı kullanım karşılaştırması
```

### Prompt 5 — Komutan / Doktrin Sistemi

```text
Bu repo için maç öncesi `Komutan / Doktrin Sistemi` tasarla ve ilk uygulanabilir versiyonunu ekle.

İlk hedef:
- 3 doktrin ekle
- her doktrinde 1 pasif bonus, 1 aktif yetenek, 1 tradeoff olsun

Öneri:
- Logistics
- Assimilation
- Siege

İncelenecek alanlar:
- game.js
- server.js
- assets/sim/*
- stellar_conquest.html

Kısıtlar:
- sistem ağır bir tech tree’ye dönüşmemeli
- aktif yetenekler yüksek APM istememeli
- multiplayer snapshot / AI uyumunu düşün

İstenen çıktı:
- veri modeli
- UI seçimi
- local + server entegrasyonu
- test kapsamı
- balans riski notları
```

### Prompt 6 — Kampanya + PvE Boss Çatısı

```text
Bu repo için kampanyayı güçlendirecek bir `PvE objective / boss framework` tasarla.

Amaç:
- campaign ve daily challenge içinde kullanılabilecek ortak encounter altyapısı kurmak

İlk versiyon için:
- bir mega turret boss
- bir ancient relay core objective

Bakılacak dosyalar:
- assets/campaign/levels.js
- assets/campaign/objectives.js
- assets/campaign/daily_challenge.js
- game.js
- assets/sim/server_sim.js

Kısıtlar:
- boss mekanikleri mermi cehennemi olmamalı
- harita kontrolü, rota ve zamanlama problemi üretmeli
- mevcut oyun temposuna uymalı

Teslim:
- ortak encounter/state modeli
- 1-2 örnek görev
- test ve build doğrulaması
```

### Prompt 7 — Rekabet Katmanı Planlama Prompt'u

```text
Bu repo için `Rekabet Katmanı`na geçiş planı hazırla.

Amaç:
- Elo/MMR
- sezonlar
- spectator mode
- match history

Önce mevcut multiplayer ve authoritative sync mimarisini incele.
Sonra şu formatta çıktı ver:
- mevcut durum
- eksik altyapı
- teknik riskler
- aşamalı teslim planı
- milestone başlıkları
- issue listesi

Önemli:
- hemen kod yazma
- önce uygulanabilir mimari plan çıkar
- plan bu repo yapısına ve mevcut server/client ayrımına dayanmalı
```

### Prompt 8 — Yol Haritasını GitHub Issue / Milestone Formatına Çevir

```text
Bu repo içindeki README roadmap’ini GitHub issue ve milestone formatına çevir.

İstenen çıktı:
- 3 milestone: short term, mid term, long term
- her milestone altında net issue başlıkları
- her issue için:
  - problem tanımı
  - kapsam
  - acceptance criteria
  - teknik notlar
  - bağımlılıklar

Kurallar:
- issue’lar çok büyük olmamalı
- tek commit / birkaç commit ile bitebilecek mantıklı parçalara böl
- önce oyun kimliği için en kritik işleri sırala
```

---

## 📄 Lisans

Özel proje.
