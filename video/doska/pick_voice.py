"""Har bir bo'lak uchun eng toza ovoz variantini tanlaydi va diktor yo'lagini yig'adi.

Har bir variant o'zbekcha nutqni taniydigan Whisper modeli bilan matnga aylantiriladi,
asl matnga eng yaqin (so'z tushmagan, takrorlanmagan) variant olinadi.

Ishlatish: python3 pick_voice.py dumpling.json build/dumpling
Natija: build/dumpling/voice.wav, voice.json, pick_report.txt
"""
import difflib
import glob
import json
import os
import re
import sys

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

ASR_MODEL = "hostmepanda/whisper-large-v3-turbo-uzbek-ct2"
SR = 48000


def norm(t):
    t = re.sub(r"[‘’ʻʼ'`]", "", t.lower())
    return re.sub(r"[^a-z0-9 ]", " ", t).split()


def score(ref, hyp):
    r, h = norm(ref), norm(hyp)
    match = sum(b.size for b in difflib.SequenceMatcher(None, r, h).get_matching_blocks())
    # Ketma-ket takrorlangan so'z (asl matnda yo'q bo'lsa) — jiddiy nuqson
    rep = sum(1 for a, b in zip(h, h[1:]) if a == b and (a, a) not in zip(r, r[1:]))
    extra = max(0, len(h) - len(r))
    return match / max(1, len(r)) - 0.25 * rep - 0.05 * extra


def main():
    from faster_whisper import WhisperModel

    script = json.load(open(sys.argv[1], encoding="utf-8"))
    build = sys.argv[2]
    model = WhisperModel(ASR_MODEL, device="cpu", compute_type="int8", cpu_threads=4)
    pieces = [np.zeros(int(0.25 * SR), np.float32)]
    t = 0.25
    meta, report = [], []
    for seg in script["segments"]:
        best = None
        for path in sorted(glob.glob(os.path.join(build, "cand", f"{seg['id']}_*.wav"))):
            wav, sr = sf.read(path, dtype="float32")
            audio16 = resample_poly(wav, 1, sr // 16000).astype(np.float32)
            segs, _ = model.transcribe(audio16, language="uz", beam_size=5, condition_on_previous_text=False)
            hyp = " ".join(s.text.strip() for s in segs)
            sc = score(seg["text"], hyp)
            report.append(f"{os.path.basename(path):<10} {sc:5.2f}  {hyp}")
            if best is None or sc > best[0]:
                best = (sc, path, wav, hyp)
        sc, path, wav, hyp = best
        report.append(f"  => {seg['id']}: {os.path.basename(path)} ({sc:.2f})")
        dur = len(wav) / SR
        meta.append({"id": seg["id"], "text": seg["text"], "start": round(t, 3), "end": round(t + dur, 3), "pick": os.path.basename(path), "score": round(sc, 3), "heard": hyp})
        pieces.append(wav)
        gap = np.zeros(int(seg.get("pause", 0.4) * SR), np.float32)
        pieces.append(gap)
        t += dur + len(gap) / SR
        print(f"{seg['id']:<4} {os.path.basename(path):<9} {sc:5.2f}  {hyp}", flush=True)
    voice = np.concatenate(pieces)
    voice = voice / max(1e-6, np.abs(voice).max()) * 0.9
    sf.write(os.path.join(build, "voice.wav"), voice, SR)
    json.dump({"duration": round(t, 3), "segments": meta}, open(os.path.join(build, "voice.json"), "w"), ensure_ascii=False, indent=1)
    open(os.path.join(build, "pick_report.txt"), "w").write("\n".join(report))
    print(f"Jami: {t:.1f} s, o'rtacha ball: {np.mean([m['score'] for m in meta]):.2f}")


if __name__ == "__main__":
    main()
