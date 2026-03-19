# Kampanya çeşitliliği — referanslar ve yol haritası

## Benzer oyunlar (mekanik / tema)

| Oyun / tür | Ortak DNA | Bu repoda karşılığı |
|------------|-----------|---------------------|
| **Galcon**, **Tentacle Wars**, **Axel** | Gezegenler arası akış, ani öneme geçiş, çok cephe | Flow, send %, çoklu AI, pulse |
| **Eufloria** | Yavaş büyüme, sakin risk, “organik” yayılma | Zen benzeri düşük tempo (playlist ile değil; `tune` ile) |
| **Creeper World**, **Particle Fleet** | Sabit baskı / koridor, hayatta kalma fazı | Ironman playlist, blackout, survive objectives |
| **RTS puzzle haritalar** (SC2 / WC3 özel map) | El yapımı geometri, sıralı hedef | `customMap` + `missionScript` (21–25, 40) |

## Neden 27–50 hâlâ “aynı” hissediyor?

1. **El yapımı + fazlı senaryo** sadece birkaç bölümde (21–25, 40); geri kalanı aynı `map_gen` + hedef şablonu.
2. **Hedef seti** dönemsel olarak tekrarlıyor: `gate_captures` + `flow_links_created`, `wormhole_dispatches` + `upgrades`, `encounter_control` / `encounter_captured` + ekonomi.
3. **`playlist: standard`** + `doctrineId: auto` ile **doktrin farkı** çoğu oyunda hissedilmiyor.
4. **Anlatı çerçevesi** (blurb/hint) “teknik” kaldığı için üst üste binen bölümler aynı operasyon gibi okunuyor.

## Kısa vadeli (düşük risk)

- **Bölüm 32 — Sis Köprüsü:** el yapım `buildVeilBridgeHandcraftedMap()` (sis + sabit wormhole), iki fazlı `missionScript` (ön iki düğüm → kopru sevkiyatı).
- Her bölüme bilinçli **`doctrineId`** (logistics / assimilation / siege) — aktif yetenek ve koç metni farkı.
- **`tune`**: Birkaç “nefes” bölümünde `aiAgg↓` / `flowInt↑`; birkaç “sprint”te tersi.
- **Blurb/hint**: Aynı mekaniği farklı *operasyon fantezisi* ile çerçevele (kuşatma / lojistik / diplomasi yok ama “nöbet / sızma / tahliye” gibi).

## Orta vadeli (yüksek etki)

- **Yılda 3–5** yeni `customMap` + isteğe bağlı **kısa `missionScript`** (2 faz); “prosedürel hafta” ile “el işi hafta”sal kır.
- **`control_node_ids`**: Sadece sabit ID’li haritalarda; yeni handcrafted’larda kullan.
- **Tekil hedef ailesi** bucket’ları: Örn. “sadece ekonomi”, “sadece hayatta kal + sonra X”, “boss önce / core sonra” ve ardışık bölümlerde aynı ikiliden kaçın.

## Uzun vadeli (motor)

- Kampanya şablonları: `archetype: 'breach' | 'eco' | 'siege' | 'survival'` → hedef + `tune` + mümkünse mutator seçimi.
- Günlük challenge’dan **deterministik** “konuk kural” çekip kampanya arasına serpiştirme.
