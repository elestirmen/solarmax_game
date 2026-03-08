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
  <a href="#-özellikler">Özellikler</a> •
  <a href="#-nasıl-oynanır">Nasıl Oynanır</a> •
  <a href="#-kurulum">Kurulum</a> •
  <a href="#-yol-haritası">Yol Haritası</a> •
  <a href="#-canlı-demo">Canlı Demo</a>
</p>

---

## 📖 Özet

**Stellar Conquest**, gezegenleri ele geçirdiğiniz, filoları yönlendirdiğiniz, bölge kontrolü kurduğunuz ve zamanlama ile konumlandırma üzerinden rakiplerinizi alt ettiğiniz tarayıcı tabanlı bir strateji oyunudur. Birim spam’i yerine zamanlama ve pozisyonlama öne çıkar. Tek oyunculu veya çok oyunculu odalarda canlı rakiplerle oynanabilir.

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
- **Günlük meydan okuma** — Tohumlu prosedürel senaryo, günde bir deneme
- **Özel haritalar** — Oyun içi harita editörü ve dışa aktarma
- **Çok oyunculu** — Socket.IO ile gerçek zamanlı odalar, 6 oyunculuya kadar
- **Replay** — Her maçı kaydet ve tekrar izle

### AI

- Tarayıcıda hızlı çalışan sezgisel rakip
- Dinamik zorluk ayarlamalı birden fazla zorluk seviyesi
- Bölge, taretler, tedarik ve tehdit geometrisinden haberdar

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
| `Esc` / `P` | Duraklat / Devam |

### Mobil

- Tek parmakla seç ve sürükle
- İki parmakla haritayı pan/zoom yap

---

## 📁 Proje Yapısı

```
stellar_conquest.html   Ana oyun sayfası (tek oyunculu giriş)
game.js                 Tek kanonik oyun istemcisi (~6.100 satır, düz JS)
server.js               Çok oyunculu sunucu (Express + Socket.IO)
index.html              Vite geliştirme girişi

assets/
  sim/                  Deterministik simülasyon modülleri (istemci ↔ sunucu paylaşımlı)
    ai.js               AI sezgileri ve hedefleme
    barrier.js          Bariyer kapısı gönderim kuralları
    cap.js              Birim kap hesaplaması
    command_apply.js    Yetkili komut uygulaması
    defense_field.js    Savunma alanı hasarı ve istatistikleri
    dispatch_math.js    Filo gönderim sayısı hesaplaması
    fleet_step.js       Filo hareketi ve varış çözümlemesi
    flow_step.js        Flow bağlantı yayılımı
    holding_decay.js    Park filo tedarik azalması
    map_gen.js          Prosedürel harita üretimi
    territory.js        Bölge yarıçapı ve sınır geometrisi
    turret.js           Taret hedefleme ve hasar
    ...
  campaign/
    levels.js           Kampanya misyon tanımları
    daily_challenge.js  Günlük tohum üretimi
    objectives.js       Hedef değerlendirme mantığı
  ui/
    renderers.js        Lider tablosu, misyon paneli, oda listesi render’ları
  audio.js              Ses motoru

tests/                  Node.js yerleşik test çalıştırıcı — sim modülü başına bir dosya
```

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

Node.js yerleşik test çalıştırıcısı kullanılır — ek bağımlılık gerekmez.

```bash
npm test
```

Her simülasyon modülünün `tests/` altında karşılık gelen bir test dosyası vardır. Filo hareketi, gönderim matematiği, bölge, taret hasarı, flow yayılımı, harita üretimi, durum hash’leme ve daha fazlası kapsanır.

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
| Oyun istemcisi | Düz JavaScript (ES modülleri), Canvas 2D |
| Geliştirme sunucusu | Vite 5 |
| Çok oyunculu | Express 4 + Socket.IO 4 |
| Derleme | Vite (ESM paketi) |
| Testler | Node.js yerleşik `node:test` |
| Konteyner | Docker + Docker Compose |

Framework yok, ağır runtime yok — tüm oyun mantığı tarayıcıda doğrudan açılabilen tek bir `game.js` dosyasında çalışır.

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

### Kısa Vadeli Odak

#### 1. Bölge 2.0 ve Çatışmalı Cepheler

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

**Amaç**

- her maçın aynı hissedilmesini engellemek için harita başına tek baskın çevresel kural eklemek

**Kapsam**

- iyon fırtınası, karartma bölgesi, pulse zengin alan, çöküş koridoru gibi tek ana mutatör
- mutatör bilgisinin seed ile deterministik üretilmesi
- günlük görev, kampanya ve multiplayer snapshot/replay içinde kayıtlı olması
- HUD veya mission panel içinde kısa mutatör açıklaması gösterilmesi

**Neden önemli**

- aynı input döngüsünü korurken maç açılışları ve rota kararları değişir
- daily challenge gerçek anlamda “günün senaryosu” hissi verir
- kampanya görevleri daha karakteristik olur

**Bağımlılıklar**

- map manifest / map generation entegrasyonu
- render tarafında anomaly ve alan gösterimi
- replay ve network state tarafında mutatör verisinin tutulması

**Başarı ölçütü**

- oyuncu maç bittikten sonra “hangi mutatör vardı?” diye hatırlayabilmeli
- mutatör sadece sayısal buff değil, rota ve tempo kararı üretmeli

#### 3. AI Cephe Farkındalığı

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

**Amaç**

- çok oyunculuyu kalıcı bir ilerleme ve takip alanına çevirmek

**Kapsam**

- Elo/MMR
- sezon sistemi
- izleyici modu
- replay tarayıcı
- maç geçmişi
- maç sonrası zaman çizelgesi ve ekonomi kırılımı

**Bağımlılıklar**

- sağlam authoritative sync
- güvenilir replay verisi
- reconnect / stability iyileştirmeleri

**Başarı ölçütü**

- oyuncular oda açmanın ötesinde geri dönme motivasyonu bulmalı

#### 10. Faksiyon Kimliği

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

**Amaç**

- oyunun tek maç ömrünü aşan bir topluluk katmanı kurmak

**Kapsam**

- paylaşılabilir challenge seed’leri
- replay paylaşımı
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
- replay / snapshot / sync mantığını bozma

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
- replay ve multiplayer snapshot’larda saklansın

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
- multiplayer snapshot / replay / AI uyumunu düşün

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
- replay browser
- match history

Önce mevcut multiplayer, replay ve authoritative sync mimarisini incele.
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
