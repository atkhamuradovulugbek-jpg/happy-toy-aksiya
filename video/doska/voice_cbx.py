"""Diktor ovozi: o'zbekcha Chatterbox modeli bilan har bir bo'lakni sintez qiladi.

Chatterbox venv ichida ishga tushiriladi:
  CBX_DIR=/yo'l/chatterbox-finetuning venv/bin/python voice_cbx.py dumpling.json build/dumpling

Natija: <build>/cand/<id>_<k>.wav — har bo'lak uchun bir nechta variant (pick_voice.py eng tozasini tanlaydi).
Qo'shimcha argumentlar: [variantlar soni] [faqat shu id lar, vergul bilan] [birinchi variant raqami]
"""
import json
import os
import random
import re
import sys

import numpy as np
import soundfile as sf
import torch
import torchaudio
from safetensors.torch import load_file

CBX = os.environ["CBX_DIR"]
sys.path.insert(0, CBX)
from src.chatterbox_.models.t3.t3 import T3  # noqa: E402
from src.chatterbox_.tts import ChatterboxTTS  # noqa: E402

OUT_SR = 48000


def clean(text):
    """TTS uchun matn: qo'shtirnoqlarni olib tashlaymiz, o‘/g‘ ni oddiy apostrofga keltiramiz."""
    t = text.replace("«", "").replace("»", "").replace("—", ",")
    t = re.sub(r"[‘’ʻʼ`]", "'", t)
    return re.sub(r"\s+", " ", t).strip()


def load():
    eng = ChatterboxTTS.from_local(os.path.join(CBX, "pretrained_models"), device="cpu")
    hp = eng.t3.hp
    hp.text_tokens_dict_size = 2454
    t3 = T3(hp=hp)
    t3.load_state_dict(load_file(os.path.join(CBX, "uz", "t3_finetuned_merged.safetensors")), strict=False)
    eng.t3 = t3.eval()
    tok = os.path.join(CBX, "uz", "tokenizer.json")
    if os.path.exists(tok):
        from src.chatterbox_.models.tokenizers import EnTokenizer

        eng.tokenizer = EnTokenizer(tok)
    return eng


def trim(wav, sr, thr=0.01):
    idx = np.where(np.abs(wav) > thr)[0]
    if len(idx) == 0:
        return wav
    return wav[max(0, idx[0] - int(0.03 * sr)): min(len(wav), idx[-1] + int(0.08 * sr))]


def main():
    script = json.load(open(sys.argv[1], encoding="utf-8"))
    build = sys.argv[2]
    n_cand = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    only = set(sys.argv[4].split(",")) if len(sys.argv) > 4 else None
    first = int(sys.argv[5]) if len(sys.argv) > 5 else 0
    cand_dir = os.path.join(build, "cand")
    os.makedirs(cand_dir, exist_ok=True)
    cfg = script.get("voice", {})
    ref = os.path.join(CBX, "uz", "reference_voice.wav")
    eng = load()
    for i, seg in enumerate(script["segments"]):
        if only and seg["id"] not in only:
            continue
        for k in range(first, first + n_cand):
            seed = 100 + i + 1000 * k
            random.seed(seed)
            np.random.seed(seed)
            torch.manual_seed(seed)
            with torch.no_grad():
                wav = eng.generate(
                    text=clean(seg["text"]),
                    audio_prompt_path=ref,
                    exaggeration=seg.get("exaggeration", cfg.get("exaggeration", 0.5)),
                    cfg_weight=seg.get("cfg_weight", cfg.get("cfg_weight", 0.5)),
                    temperature=cfg.get("temperature", 0.8),
                    repetition_penalty=2.0,
                )
            if isinstance(wav, tuple):
                wav = wav[0]
            wav = torchaudio.functional.resample(wav, eng.sr, OUT_SR).squeeze(0).numpy()
            wav = trim(wav, OUT_SR)
            sf.write(os.path.join(cand_dir, f"{seg['id']}_{k}.wav"), wav.astype(np.float32), OUT_SR)
            print(f"{seg['id']}_{k} {len(wav) / OUT_SR:5.2f}s  {seg['text']}", flush=True)


if __name__ == "__main__":
    main()
