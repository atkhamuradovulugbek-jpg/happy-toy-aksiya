"""Doska videosi uchun ovoz: ruchka shitirlashi + yumshoq fon musiqasi (+ ixtiyoriy diktor ovozi).

Ishlatish: python3 audio.py strokes.json chiqish.wav [diktor.wav]
"""
import json
import os
import sys

import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from make_audio import SR, synth_music  # noqa: E402

FPS = 30


def scribble(dur, kind, seed):
    """Ruchkaning qog'ozga ishqalanish tovushi."""
    n = int(dur * SR)
    rng = np.random.default_rng(seed)
    noise = rng.normal(0, 1, n)
    # Yuqori chastotali shitirlash (oddiy birinchi tartibli filtrlar)
    hp = np.diff(noise, prepend=0)
    lp = np.copy(hp)
    for i in range(1, n):
        lp[i] = lp[i - 1] + 0.35 * (hp[i] - lp[i - 1])
    t = np.arange(n) / SR
    rate = 11 if kind == "text" else 4
    am = 0.55 + 0.45 * np.abs(np.sin(np.pi * rate * t + rng.uniform(0, 3)))
    edge = np.minimum(1, np.minimum(t / 0.03, (dur - t) / 0.05))
    return lp * am * np.clip(edge, 0, 1) * 0.12


def main():
    meta = json.load(open(sys.argv[1]))
    out = sys.argv[2]
    voice = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None
    dur = meta["frames"] / FPS
    n = int(dur * SR)
    fx = np.zeros(n, np.float32)
    for i, (t0, t1, kind) in enumerate(meta["strokes"]):
        s = scribble(t1 - t0, kind, i)
        a = int(t0 * SR)
        fx[a:a + len(s)] += s[: max(0, n - a)]
    music = synth_music(dur)[:n] * 10 ** (-24 / 20)
    if voice:
        fx *= 0.6
    mix = fx + music
    if voice:
        v, sr = sf.read(voice, dtype="float32", always_2d=True)
        v = v.mean(axis=1)
        if sr != SR:
            raise SystemExit(f"Diktor ovozi {SR} Hz bo'lishi kerak")
        mix[: len(v)] += v[:n]
        mix -= music * 0.5
    fade = np.minimum(1, np.minimum(np.arange(n) / (SR * 0.5), (n - np.arange(n)) / (SR * 0.8)))
    mix = mix * fade
    mix = mix / max(1.0, np.abs(mix).max() / 0.95)
    sf.write(out, np.stack([mix, mix], axis=1), SR)


if __name__ == "__main__":
    main()
