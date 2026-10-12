"""Ovoz, vaqt jadvali (timeline) va yakuniy audio miksni yaratadi.

Har bir replika uchun:
  - agar voices/<id>.wav mavjud bo'lsa, o'sha yozuv ishlatiladi (haqiqiy odam ovozi);
  - aks holda Meta MMS (o'zbekcha TTS) bilan sintez qilinadi.

Natija: build/timeline.json (sahna, subtitr, lab harakati) va build/audio.wav.
"""
import hashlib
import json
import math
import os
import re
import subprocess
import sys

import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(ROOT, "build")
TTS_DIR = os.path.join(BUILD, "tts")
VOICES = os.path.join(ROOT, "voices")
FPS = 24
SR = 48000

# Har bir personaj uchun ovoz rangi: pitch (yarim ton), tempo, formant.
VOICE = {
    "narr": {"seed": 11, "pitch": -0.8, "tempo": 0.97, "formant": "preserved", "gain_db": 0.0},
    "agent": {"seed": 23, "pitch": 1.4, "tempo": 1.0, "formant": "shifted", "gain_db": 0.0},
    "shop": {"seed": 37, "pitch": -2.4, "tempo": 0.96, "formant": "shifted", "gain_db": 0.5},
}
DEFAULT_GAP = {"narr": 0.8, "agent": 0.6, "shop": 0.6}

LAT2CYR = {
    "a": "а", "b": "б", "d": "д", "e": "е", "f": "ф", "g": "г", "h": "ҳ", "i": "и",
    "j": "ж", "k": "к", "l": "л", "m": "м", "n": "н", "o": "о", "p": "п", "q": "қ",
    "r": "р", "s": "с", "t": "т", "u": "у", "v": "в", "x": "х", "y": "й", "z": "з",
    "c": "с", "w": "в",
}


def to_cyrillic(text):
    """O'zbek lotin yozuvini MMS modeli tushunadigan kirill yozuviga o'giradi."""
    s = text.lower()
    s = re.sub(r"([og])[‘'`ʻ]", lambda m: "ў" if m.group(1) == "o" else "ғ", s)
    s = re.sub(r"[’ʼ']", "ъ", s)
    s = s.replace("sh", "ш").replace("ch", "ч")
    s = re.sub(r"y([oё])", "ё", s)
    s = re.sub(r"yu", "ю", s)
    s = re.sub(r"ya", "я", s)
    s = re.sub(r"ye", "е", s)
    s = re.sub(r"(^|[\s\-ъ])e", lambda m: m.group(1) + "э", s)
    s = re.sub(r"([aouiўeёюя])e", r"\1э", s)
    s = "".join(LAT2CYR.get(ch, ch) for ch in s)
    s = s.replace("-", "")
    s = re.sub(r"[^\sа-яёўғқҳъ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def split_sentences(text):
    parts = re.findall(r"[^.!?]+[.!?]*", text)
    return [p.strip() for p in parts if p.strip()]


def split_phrases(sentence):
    parts = re.split(r"(?<=[,:;])\s+", sentence)
    return [p for p in parts if p.strip()]


_model = None


def mms():
    global _model
    if _model is None:
        import torch
        from transformers import AutoTokenizer, VitsModel

        name = "facebook/mms-tts-uzb-script_cyrillic"
        _model = (torch, AutoTokenizer.from_pretrained(name), VitsModel.from_pretrained(name))
    return _model


def synth_phrase(text, seed):
    torch, tok, model = mms()
    torch.manual_seed(seed)
    model.noise_scale = 0.55
    model.noise_scale_duration = 0.7
    with torch.no_grad():
        wav = model(**tok(to_cyrillic(text), return_tensors="pt")).waveform[0].numpy()
    return wav.astype(np.float32), model.config.sampling_rate


def trim(wav, sr, thr=0.012):
    idx = np.where(np.abs(wav) > thr)[0]
    if len(idx) == 0:
        return wav
    a = max(0, idx[0] - int(0.02 * sr))
    b = min(len(wav), idx[-1] + int(0.05 * sr))
    return wav[a:b]


def ffmpeg_voice(src, dst, v, tempo):
    pitch = 2 ** (v["pitch"] / 12.0)
    af = (
        f"aresample={SR},rubberband=pitch={pitch:.5f}:tempo={tempo:.4f}:formant={v['formant']},"
        "highpass=f=70,equalizer=f=3200:t=q:w=1.2:g=2,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,"
        f"volume={v['gain_db']}dB"
    )
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-af", af, "-ac", "1", "-ar", str(SR), dst],
        check=True,
    )


def make_line_audio(ev):
    """Replika uchun wav yaratadi; gaplar orasidagi vaqtlarni qaytaradi."""
    os.makedirs(TTS_DIR, exist_ok=True)
    override = os.path.join(VOICES, ev["id"] + ".wav")
    out = os.path.join(TTS_DIR, ev["id"] + ".wav")
    sentences = split_sentences(ev["text"])
    if os.path.exists(override):
        wav, sr = sf.read(override, dtype="float32", always_2d=True)
        wav = wav.mean(axis=1)
        if sr != SR:
            raise SystemExit(f"{override}: {SR} Hz bo'lishi kerak (hozir {sr})")
        sf.write(out, wav, SR)
        dur = len(wav) / SR
        lens = np.array([len(s) for s in sentences], dtype=float)
        edges = np.concatenate([[0], np.cumsum(lens) / lens.sum() * dur])
        return out, [(sentences[i], edges[i], edges[i + 1]) for i in range(len(sentences))]

    v = VOICE[ev["who"]]
    tempo = v["tempo"] * ev.get("tempo", 1.0)
    key = hashlib.sha1(json.dumps([ev["text"], v, tempo, 3]).encode()).hexdigest()[:12]
    meta_path = out + ".json"
    if os.path.exists(out) and os.path.exists(meta_path):
        meta = json.load(open(meta_path))
        if meta.get("key") == key:
            return out, [tuple(x) for x in meta["sentences"]]

    chunks, marks, pos = [], [], 0
    for si, sent in enumerate(sentences):
        start = pos
        for pi, phrase in enumerate(split_phrases(sent)):
            wav, sr = synth_phrase(phrase, v["seed"] + si * 7 + pi)
            wav = trim(wav, sr)
            chunks.append(wav)
            pos += len(wav)
            if pi < len(split_phrases(sent)) - 1:
                gap = np.zeros(int(0.16 * sr), np.float32)
                chunks.append(gap)
                pos += len(gap)
        marks.append((sent, start / sr, pos / sr))
        if si < len(sentences) - 1:
            gap = np.zeros(int(0.34 * sr), np.float32)
            chunks.append(gap)
            pos += len(gap)
    raw = np.concatenate(chunks)
    raw = raw / max(1e-6, np.abs(raw).max()) * 0.9
    tmp = out + ".raw.wav"
    sf.write(tmp, raw, sr)
    ffmpeg_voice(tmp, out, v, tempo)
    os.remove(tmp)
    total_raw = len(raw) / sr
    final = sf.info(out).duration
    scale = final / total_raw
    sentences_t = [(s, a * scale, b * scale) for s, a, b in marks]
    json.dump({"key": key, "sentences": sentences_t}, open(meta_path, "w"), ensure_ascii=False)
    return out, sentences_t


def envelope(wav, n_frames):
    """Har bir kadr uchun og'iz ochilishi (0..1)."""
    hop = SR / FPS
    env = np.zeros(n_frames, np.float32)
    for i in range(n_frames):
        a, b = int(i * hop), int((i + 1) * hop)
        seg = wav[a:b]
        env[i] = math.sqrt(float((seg**2).mean())) if len(seg) else 0.0
    peak = np.percentile(env[env > 0], 95) if np.any(env > 0) else 1.0
    env = np.clip(env / max(peak, 1e-4), 0, 1)
    env = np.where(env < 0.08, 0, env)
    sm = np.copy(env)
    for i in range(1, len(sm)):
        sm[i] = max(env[i], sm[i - 1] * 0.55)
    return [round(float(x), 3) for x in sm]


def chunk_subtitles(sentences, max_chars=64):
    """Uzun gaplarni o'qishga qulay bo'laklarga ajratadi (matn o'zgarmaydi)."""
    out = []
    for text, a, b in sentences:
        if len(text) <= max_chars:
            out.append({"text": text, "start": round(a, 3), "end": round(b, 3)})
            continue
        words = text.split(" ")
        pieces, cur = [], ""
        for w in words:
            if cur and len(cur) + 1 + len(w) > max_chars:
                pieces.append(cur)
                cur = w
            else:
                cur = (cur + " " + w).strip()
        if cur:
            pieces.append(cur)
        total = sum(len(p) for p in pieces)
        t = a
        for p in pieces:
            d = (b - a) * len(p) / total
            out.append({"text": p, "start": round(t, 3), "end": round(t + d, 3)})
            t += d
    return out


def synth_music(dur):
    """Juda yumshoq fon musiqasi (akkordli pad + yengil pluck)."""
    t = np.arange(int(dur * SR)) / SR
    chords = [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]]
    bar = 4.0
    pad = np.zeros_like(t)
    pluck = np.zeros_like(t)
    for ci in range(int(dur / bar) + 1):
        notes = chords[ci % 4]
        a, b = int(ci * bar * SR), int(min(dur, (ci + 1) * bar + 0.6) * SR)
        if a >= len(t):
            break
        tt = t[a:b] - ci * bar
        env = np.minimum(1, tt / 0.8) * np.exp(-np.maximum(0, tt - bar + 0.4) * 3)
        for n in notes:
            f = 440 * 2 ** ((n - 69) / 12)
            pad[a:b] += env * (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt)) * 0.12
        for k in range(8):
            n = notes[[0, 2, 1, 3, 2, 1, 3, 2][k]] + 12
            f = 440 * 2 ** ((n - 69) / 12)
            pa = a + int(k * bar / 8 * SR)
            pb = min(len(t), pa + int(0.9 * SR))
            if pa >= len(t):
                break
            pt = t[pa:pb] - t[pa]
            pluck[pa:pb] += np.sin(2 * np.pi * f * pt) * np.exp(-pt * 5) * 0.08
    mix = pad + pluck
    lp = np.copy(mix)
    alpha = 0.08
    for i in range(1, len(lp)):
        lp[i] = lp[i - 1] + alpha * (mix[i] - lp[i - 1])
    return lp / max(1e-6, np.abs(lp).max())


def sfx(kind):
    if kind in ("doorbell", "doorbell_late"):
        d = 1.6
        t = np.arange(int(d * SR)) / SR
        s = np.zeros_like(t)
        for f0, off in ((1318.5, 0.0), (1046.5, 0.22)):
            m = t >= off
            tt = t[m] - off
            s[m] += (np.sin(2 * np.pi * f0 * tt) + 0.4 * np.sin(2 * np.pi * f0 * 2.76 * tt)) * np.exp(-tt * 3.2)
        return s * 0.22
    if kind == "stamp":
        d = 0.5
        t = np.arange(int(d * SR)) / SR
        rng = np.random.default_rng(3)
        s = np.sin(2 * np.pi * 70 * t) * np.exp(-t * 14) + rng.normal(0, 1, len(t)) * np.exp(-t * 40) * 0.3
        return s * 0.5
    if kind == "rewind":
        d = 1.8
        t = np.arange(int(d * SR)) / SR
        rng = np.random.default_rng(5)
        noise = rng.normal(0, 1, len(t))
        f = 300 + 1600 * (t / d) ** 1.5
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.35 + noise * 0.12
        env = np.sin(np.pi * t / d) ** 0.7
        return s * env * 0.35
    if kind == "flash":
        d = 0.9
        t = np.arange(int(d * SR)) / SR
        rng = np.random.default_rng(9)
        s = rng.normal(0, 1, len(t))
        lp = np.copy(s)
        for i in range(1, len(lp)):
            lp[i] = lp[i - 1] + 0.05 * (s[i] - lp[i - 1])
        env = np.minimum(1, t / 0.5) * np.exp(-np.maximum(0, t - 0.5) * 10)
        return lp * env * 1.2
    return np.zeros(1)


def main():
    script = json.load(open(os.path.join(ROOT, "script.json"), encoding="utf-8"))
    os.makedirs(BUILD, exist_ok=True)
    t = 0.0
    timeline = {"fps": FPS, "width": 1080, "height": 1920, "title": script["title"],
                "subtitle": script["subtitle"], "speakers": script["speakers"],
                "scenes": [], "events": []}
    placements, sfx_list = [], []
    for sc in script["scenes"]:
        sc_out = {k: v for k, v in sc.items() if k != "events"}
        sc_out["start"] = round(t, 3)
        for ev in sc["events"]:
            e = dict(ev)
            e["scene"] = sc["id"]
            e["start"] = round(t, 3)
            if ev["t"] == "line":
                path, sentences = make_line_audio(ev)
                wav, _ = sf.read(path, dtype="float32")
                dur = len(wav) / SR
                lead = 0.25
                e["speech_start"] = round(t + lead, 3)
                e["speech_end"] = round(t + lead + dur, 3)
                n = int(math.ceil(dur * FPS)) + 1
                e["env"] = envelope(wav, n)
                e["subs"] = [
                    {"text": c["text"], "start": round(t + lead + c["start"], 3), "end": round(t + lead + c["end"], 3)}
                    for c in chunk_subtitles(sentences)
                ]
                placements.append((t + lead, wav))
                gap = ev.get("gap", DEFAULT_GAP[ev["who"]])
                t += lead + dur + gap
                print(f"  {ev['id']:<10} {ev['who']:<5} {dur:5.2f}s  {ev['text'][:60]}")
            else:
                t += ev["dur"]
            if ev.get("sfx"):
                off = 2.6 if ev["sfx"] == "doorbell_late" else 0.0
                sfx_list.append((e["start"] + off, ev["sfx"]))
            if ev.get("transition") == "flash":
                sfx_list.append((e["start"], "flash"))
            e["end"] = round(t, 3)
            timeline["events"].append(e)
        sc_out["end"] = round(t, 3)
        timeline["scenes"].append(sc_out)
    total = t
    timeline["duration"] = round(total, 3)
    timeline["frames"] = int(math.ceil(total * FPS))

    n = int(total * SR) + SR
    voice = np.zeros(n, np.float32)
    for start, wav in placements:
        a = int(start * SR)
        voice[a:a + len(wav)] += wav
    fx = np.zeros(n, np.float32)
    for start, kind in sfx_list:
        s = sfx(kind).astype(np.float32)
        a = int(start * SR)
        fx[a:a + len(s)] += s[: max(0, min(len(s), n - a))]
    music = synth_music(n / SR).astype(np.float32)[:n]
    # Nutq paytida musiqa yanada pasayadi (ducking).
    speech_env = np.abs(voice)
    k = int(0.3 * SR)
    kernel = np.ones(k, np.float32) / k
    sm = np.convolve(speech_env, kernel, mode="same")
    duck = 1.0 - 0.6 * np.clip(sm / (sm.max() * 0.15 + 1e-6), 0, 1)
    fade = np.minimum(1, np.arange(n) / (SR * 2.0)) * np.minimum(1, (n - np.arange(n)) / (SR * 3.0))
    music_level = 10 ** (-27 / 20)
    mix = voice + fx + music * music_level * duck * fade
    mix = mix / max(1.0, np.abs(mix).max() / 0.95)
    stereo = np.stack([mix, mix], axis=1)
    sf.write(os.path.join(BUILD, "audio.wav"), stereo, SR)
    json.dump(timeline, open(os.path.join(BUILD, "timeline.json"), "w"), ensure_ascii=False)
    print(f"Jami davomiylik: {total:.1f} s ({int(total // 60)}:{int(total % 60):02d}), kadrlar: {timeline['frames']}")


if __name__ == "__main__":
    sys.exit(main())
