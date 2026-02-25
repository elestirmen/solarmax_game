# Stellar Conquest

Gerçek zamanlı uzay fetih strateji oyunu. Node'ları fethedin, filolar gönderin, tedarik hatlarınızı koruyun ve en son hayatta kalan olun.

![Canvas](https://img.shields.io/badge/Canvas-2D-green) ![Socket.io](https://img.shields.io/badge/Multiplayer-Socket.io-blue) ![No Build](https://img.shields.io/badge/Standalone-HTML%2FJS-orange)

---

## Hızlı Başlangıç

### Tek Oyunculu

```bash
npm install
npm run dev
```

`http://localhost:5173` adresini açın veya doğrudan `stellar_conquest.html` dosyasını tarayıcıda açın.

### Çok Oyunculu (PvP)

```bash
npm install
npm run server
```

Tüm oyuncular `http://localhost:3000` adresine bağlansın. Uzaktan oynamak için sunucu IP'sini paylaşın (örn. `http://192.168.1.20:3000`).

---

## Oyun Modları

| Mod | Açıklama |
|-----|----------|
| **Tek Oyunculu** | AI'ya karşı oyna. Seed, node sayısı, zorluk ve Fog of War seç. |
| **Çok Oyunculu** | 2–6 oyuncu PvP. Oda kur veya koda katıl. |
| **Kampanya** | 3 seviyeli basit kampanya (Easy → Normal → Hard). |
| **Replay** | Maç sonrası izle veya dışa aktar. |

---

## Zafer Koşulu

**Eliminasyon:** Tüm rakipleri yok et. Node'u ve filosu kalmayan oyuncu elenir. En son hayatta kalan kazanır.

---

## Kontroller

### Fare

| Aksiyon | Kontrol |
|---------|---------|
| Seçim | Sol tık kendi node'una |
| Çoklu seçim | Shift + sol tık |
| Kutu seçimi | Boş alanda sürükle |
| Filo gönder | Seçiliyken düşman/tarafsız node'a sol tık |
| Sürükle-gönder | Ctrl + sürükle (seçili grubu hedefe) |
| Flow link | Seçiliyken düşman node'a sağ tık |
| **Savunma modu** | Kendi node'una sağ tık (seçiliyse hepsi) |
| Yakınlaştır | Mouse tekerleği |
| Kaydır | Orta tık + sürükle |

### Klavye

| Tuş | Aksiyon |
|-----|---------|
| `A` | Tüm node'ları seç |
| `U` | Seçililere upgrade (birim harcar, max 3. seviye) |
| `1`–`9`, `0` | Gönderim yüzdesi %10–%100 |
| `P` / `Esc` | Duraklat |

---

## Strateji Mekanikleri

### Tedarik Hattı (Supply Lines)

- Node'lar **başkente** (köşeye en yakın node) bağlı olmalı.
- Bağlantı: Aynı oyuncuya ait node'lar arası mesafe ≤ 220.
- **İzole node'lar** (bağlı olmayan) **%40 daha az** üretir.
- Görsel: Kırmızı kesikli çerçeve = izole.

### Savunma Modu

- Kendi node'una **sağ tık** = savunma aç/kapat.
- **Üretim -%25**, **Savunma +%25**.
- Sınır node'larında kullan; arka hatlarda üretim kaybına değmez.

### Stratejik Node'lar

- Harita merkezine yakın, en az 3 komşusu olan node'lar **stratejik**.
- Altın çerçeve ile işaretlenir; geçiş noktaları.

---

## Gezegen Tipleri

| Tip | Üretim | Savunma | Kapasite | Flow | Hız |
|-----|--------|---------|----------|------|-----|
| **Core** | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 |
| **Forge** | 1.35 | 0.9 | 0.9 | 1.1 | 1.0 |
| **Bulwark** | 0.75 | 1.45 | 1.25 | 0.9 | 0.95 |
| **Relay** | 0.95 | 0.95 | 0.85 | 1.35 | 1.35 |
| **Nexus** | 1.1 | 1.1 | 1.1 | 1.15 | 1.1 |

---

## Harita Özellikleri

- **Wormhole:** İki Relay arasında hızlı geçiş (%175 hız).
- **Gravity Sling:** Mor alan; içinden geçen filolar hızlanır.
- **Deterministik:** Aynı seed = aynı harita.

---

## Zorluk Seviyeleri

| Seviye | AI Hızı | AI Üretimi | Fog | Adaptif AI |
|--------|---------|------------|-----|------------|
| Easy | Yavaş | Düşük | Hayır | Hayır |
| Normal | Normal | Normal | Hayır | Evet |
| Hard | Hızlı | Yüksek | Evet | Evet |

---

## Multiplayer

### Akış

1. Nick gir
2. **Oda Kur** – Yeni oda oluştur (host seed, node, zorluk seçer)
3. **Oda Listesi** – Açık odalara **Katıl** ile katıl
4. Veya **Oda Kodu** girip **Koda Katıl**
5. Host **Oyunu Başlat** ile oyunu başlatır (en az 2 oyuncu)

### Özellikler

- **Chat:** Oyuncular arası mesajlaşma
- **Emote:** GG, GL, WP, Nice
- **Tekrar Oyna:** Maç bitince aynı oyuncularla yeniden başlat
- **Liderlik Tablosu:** Galibiyet istatistikleri
- **Ping:** Gecikme göstergesi

### Vite + Multiplayer

```bash
# Terminal 1
npm run server

# Terminal 2
npm run dev
```

`http://localhost:5173` açın (socket: `localhost:3000`).

---

## Proje Yapısı

```
solarmax_game/
├── stellar_conquest.html   # Ana HTML
├── game.js                 # Oyun mantığı, render, input
├── server.js               # Multiplayer sunucu (Express + Socket.io)
├── assets/
│   └── audio.js            # Ses efektleri (Web Audio API)
├── package.json
└── README.md
```

### Bağımlılıklar

- **express** – HTTP sunucu
- **socket.io** – Gerçek zamanlı multiplayer
- **vite** – Dev server (opsiyonel)
- **typescript** – Build (opsiyonel)

---

## Özellikler Özeti

- ✅ Tek / çok oyunculu
- ✅ Tedarik hattı (supply lines)
- ✅ Savunma modu (sağ tık)
- ✅ Stratejik node'lar
- ✅ 5 gezegen tipi
- ✅ Wormhole & Gravity Sling
- ✅ Fog of War
- ✅ Ses efektleri & müzik
- ✅ Parçacık efektleri
- ✅ Minimap
- ✅ Koyu/açık tema
- ✅ Başarımlar (localStorage)
- ✅ İstatistik ekranı
- ✅ Replay kayıt/izleme
- ✅ Chat, emote, tekrar oyna
- ✅ Liderlik tablosu
- ✅ Mobil dokunmatik desteği

---

## Lisans

Private project.
