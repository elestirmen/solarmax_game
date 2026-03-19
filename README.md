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

**Son güncellemeler (ör. Mart 2026):** Haritada dönemsel **güneş patlaması** — önceden uyarı, ardından **uzaydaki filoları** ve **gezegen garnizonlarını** etkileyen deterministik olay (`assets/sim/solar_flare.js`, yapılandırma `shared_config.js`). Mobil tarafta **Visual Viewport** ile gerçek görünür alan (`stellar_conquest.html` + `game.js` içi `--app-vvh` / `--app-vvw`), ince ayar paneli ve kampanya / güç düzenine dokunan dokunuş iyileştirmeleri.

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

**`stellar_conquest.html` doğrudan:** Geliştirme için önerilen yol `npm run dev` (Vite, ESM ve yollar sorunsuz). Köke statik HTTP sunucusu koyarak (`npx serve .` gibi) `stellar_conquest.html` dosyasını da açabilirsiniz; `file://` ile modül yüklemesi tarayıcıya göre kısıtlanabilir.

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
| **Güneş patlaması** | Maç içi aralıklı olay: uyarı süresi, uzay filolarına ve gezegen garnizonlarına etki; seed ile deterministik |

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
game.js                   Ana istemci (~6.2k satır): render, menü, tek oyunculu döngü
server.js                 Express + Socket.IO; authoritative tick, odalar, snapshot

assets/
  sim/                    Paylaşımlı simülasyon (istemci önizleme + sunucu otoritesi)
    shared_config.js      Tick sabitleri, zorluk, gezegen tipleri
    server_sim.js         Sunucu tarafı tick boru hattı
    command_apply.js      Komutların deterministik uygulanması
    territory.js, flow_step.js, fleet_step.js, node_economy.js, …
    playlists.js          Standart / Zen / Chaos / … önayarları
    mutator.js            İyon fırtınası, karartma vb.
    solar_flare.js        Güneş patlaması zamanlaması ve etkisi (yerel + sunucu)
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

- Tek parmakla seç ve sürükle; iki parmakla pan / zoom
- Adres çubuğu / güvenli alan kayması **visual viewport** ile telafi edilir; canvas boyutu CSS değişkenleriyle hizalanır
- Üst sağda ince ayar (tuning) düğmesi; panel z-index ve yükseklik dokunmatik kullanıma göre ayarlanır

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

`tests/` altında çekirdek simülasyon (filo, bölge, komutlar, hash, kampanya seviyeleri, playlist, misyon script, güneş patlaması, çok oyunculu oturum vb.) ve seçili UI yardımcıları kapsanır. Güncel birim testi sayısı **208** (`npm test` çıktısındaki `tests` satırı).

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

## 🗺 Yol haritası

Detaylı teslim sırası, modül durumları ve kodlama ajanları için hazır prompt örnekleri **[docs/ROADMAP.md](./docs/ROADMAP.md)** dosyasında. İngilizce sürüm: **[docs/ROADMAP.en.md](./docs/ROADMAP.en.md)**.

**Özet (Mart 2026):** Bölge 2.0 / contested cepheler, sektör mutatörleri v1, AI cephe farkındalığı, görsel okunabilirlik, komutan / doktrin v1 ve **güneş patlaması** olayı büyük ölçüde tamamlandı. Kampanya / PvE boss ve mod sarmalayıcıları kısmen; ranked playlist, Elo/MMR, faksiyon kimliği ve topluluk katmanları planlı veya erken aşamada.

---

## 📄 Lisans

Özel proje.
