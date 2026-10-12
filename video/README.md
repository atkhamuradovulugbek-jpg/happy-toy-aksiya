# “Pulim yo‘q” — SPIN o‘quv videosi (kod orqali)

Savdo agentlari uchun ~3:50 daqiqalik vertikal (1080×1920) o‘quv video.
Video to‘liq kod bilan yasaladi: Three.js 3D sahna → kadrma-kadr render → ffmpeg.

## Tarkibi

| Fayl | Vazifasi |
|---|---|
| `script.json` | Ssenariy: sahnalar, replikalar, kamera va harakatlar |
| `make_audio.py` | O‘zbekcha ovoz (TTS), subtitr vaqtlari, lab harakati, fon musiqasi |
| `scene/world.js` | Do‘kon interyeri (javonlar, peshtaxta, kassa, muzlatkich) |
| `scene/character.js` | Personajlar (agent, do‘konchi, xaridor), qo‘l IK, mimika |
| `scene/main.js` | Rejissyor: kamera planlari, pozalar, subtitr va matn qatlamlari |
| `render.mjs` | Kadrlarni render qilib, MP4 yig‘adi |

## Qayta yig‘ish

```bash
cd video
npm install
pip install torch transformers soundfile numpy   # TTS uchun
python3 make_audio.py          # build/audio.wav + build/timeline.json
node render.mjs --workers 3    # out/pulim-yoq-spin.mp4
```

Tekshiruv uchun alohida kadrlar: `node render.mjs --stills 5s,40s,120s` (build/stills/).

## Ovozni almashtirish (tavsiya etiladi)

Hozirgi ovoz — Meta MMS o‘zbekcha TTS modeli (bitta ovoz, pitch bilan 3 personajga ajratilgan).
Haqiqiy odam ovozi ancha tabiiy chiqadi. Buning uchun:

1. Har bir replikani alohida yozib oling (telefon diktofoni yetarli).
2. Faylni `voices/<replika-id>.wav` deb saqlang (48 kHz). ID lar `script.json` da: `s2_l3`, `s7_n2` va h.k.
3. `python3 make_audio.py && rm -rf build/frames && node render.mjs` — vaqtlar, subtitr va lab harakati yangi ovozga avtomatik moslashadi.

**Litsenziya eslatmasi:** MMS modeli CC BY-NC 4.0 (notijorat) litsenziyada. Kompaniya ichki o‘quvi uchun ham
yakuniy versiyada haqiqiy ovoz yoki tijoriy TTS ishlatish xavfsizroq.

## Matnni o‘zgartirish

`script.json` dagi `text` ni o‘zgartiring → `make_audio.py` → `render.mjs`. Subtitr har doim aytilgan matnning o‘zi.
