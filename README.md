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
  <a href="#-hızlı-başlangıç">Hızlı Başlangıç</a> •
  <a href="#-özellikler">Özellikler</a> •
  <a href="#-nasıl-oynanır">Nasıl Oynanır</a> •
  <a href="#-kurulum">Kurulum</a> •
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

### Kısa vadeli

1. **Bölge 2.0 ve Çatışmalı Cepheler** — bölgeyi pasif değiştiriciden gerçek bir cephe sistemine dönüştürme
2. **Sektör Mutatörleri v1** — harita başına bir baskın çevresel kural (iyon fırtınaları, pulse zengin sektörler, karartma bölgeleri)
3. **AI Cephe Farkındalığı** — savunulan cephelere damla damla beslemeyi bırakma, itmeden önce park filoları konuşlandırma
4. **Görsel Okunabilirlik Geçişi** — daha güçlü cephe render’ı, net filo durum göstergeleri, daha iyi mobil HUD

### Orta vadeli

5. **Komutan / Doktrin Sistemi** — maç öncesi stratejik kimlik (bir pasif bonus, bir aktif yetenek, bir tradeoff)
6. **Kampanya Genişlemesi** — hayatta kalma, eskort, boss ve hedef varyantlarıyla yapılandırılmış öğretim ve meydan okuma misyonları
7. **PvE Hedefleri ve Boss Karşılaşmaları** — mega taretler, antik çekirdekler, zamanlı savunma olayları
8. **Mod Sarmalayıcıları ve Çalma Listeleri** — Ranked, Chaos, Ironman, Puzzle Sector, Zen, Frontier

### Uzun vadeli

9. **Rekabet Katmanı** — Elo/MMR, sezonlar, izleyici modu, replay tarayıcı, maç geçmişi
10. **Faksiyon Kimliği** — doktrin varsayılanları ve bölge davranış farklarıyla asimetri
11. **Sosyal ve Topluluk Özellikleri** — meydan okuma tohumları, replay paylaşımı, topluluk harita vitrinleri, turnuvalar

### Yapılmayacaklar

- Dev tech ağaçları
- Çok sayıda ayrı birim sınıfı
- Yüksek APM aktif yetenek spam’i
- Sadece tek bir modda çalışan tek seferlik mekanikler
- Zayıflığı üretim hilesiyle telafi eden AI

---

## 📄 Lisans

Özel proje.
