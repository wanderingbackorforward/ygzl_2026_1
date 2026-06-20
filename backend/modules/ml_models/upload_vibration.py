"""Upload vibration model to Supabase Storage + DB."""
import json
import os
import sys
import time
from pathlib import Path

THIS = Path(__file__).resolve().parent
sys.path.insert(0, str(THIS))
from supabase_store import (
    upload_weight, insert_model, deactivate_old_models,
    insert_training_history, STORAGE_BUCKET,
)

WEIGHTS_DIR = THIS / "weights" / "vibration"
WEIGHT_FILE = WEIGHTS_DIR / "vibration_net.pt"
STORAGE_PATH = "vibration/vibration_net.pt"
MODEL_NAME = "vibration"
VERSION = "1.0.0"
MODEL_TYPE = "1D-CNN dual-head (waveform forecast + feature regression)"


def main():
    if not WEIGHT_FILE.exists():
        print(f"ERROR: weights not found at {WEIGHT_FILE}")
        return
    size = WEIGHT_FILE.stat().st_size
    print(f"Local weight file: {WEIGHT_FILE} ({size/1024:.1f} KB)")

    with open(WEIGHTS_DIR / "config.json", "r", encoding="utf-8") as f:
        config = json.load(f)
    with open(WEIGHTS_DIR / "metrics.json", "r", encoding="utf-8") as f:
        metrics = json.load(f)

    print(f"\n[1/4] Uploading weight to Storage bucket '{STORAGE_BUCKET}/{STORAGE_PATH}' ...")
    res = upload_weight(str(WEIGHT_FILE), STORAGE_PATH)
    print(f"   OK -> {res}")

    print(f"\n[2/4] Inserting model record into ml_models ...")
    notes = (
        "1D-CNN dual-head model for vibration signal. "
        "Input: 50 waveform points -> forecast next 50 points + 16 statistical features. "
        "Trained on 8 channels (sampling_rate=1000Hz, 10s window, 100 points) with "
        "noise + masking + scaling augmentation (208 samples). "
        "Real Supabase data (dataset_id=bd0c3c02-a4bb-4c14-b8b9-93841abf45ac, 2025-04-08)."
    )
    model_id = insert_model(
        model_name=MODEL_NAME,
        model_type=MODEL_TYPE,
        version=VERSION,
        storage_path=STORAGE_PATH,
        config=config,
        metrics=metrics,
        file_size_bytes=size,
        notes=notes,
    )
    print(f"   OK -> model_id = {model_id}")

    if model_id:
        deactivate_old_models(MODEL_NAME, model_id)
        print(f"   Other versions deactivated")

    print(f"\n[3/4] Inserting training history ...")
    started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 76))
    insert_training_history(
        model_name=MODEL_NAME,
        model_id=model_id,
        training_type="initial",
        started_at=started_at,
        duration_sec=76.1,
        n_samples=metrics.get("n_samples", 208),
        n_entities=metrics.get("n_channels", 8),
        metrics=metrics,
        data_summary={
            "source": "Supabase public.vibration_time_data + public.vibration_features",
            "dataset_id": "bd0c3c02-a4bb-4c14-b8b9-93841abf45ac",
            "channels": 8,
            "time_points_per_channel": 100,
            "sampling_rate_hz": 1000,
            "features_per_channel": 16,
            "augmentation": "noise+masking+scaling, n=200",
            "device": metrics.get("device", "cuda"),
        },
        notes="Initial training on real Supabase vibration data + augmentation.",
    )
    print(f"   OK")

    print(f"\n[4/4] Done. Vibration model is live in Supabase.")
    print(f"   model_id = {model_id}")
    print(f"   storage  = {STORAGE_BUCKET}/{STORAGE_PATH}")


if __name__ == "__main__":
    main()
