"""Upload crack LSTM model to Supabase Storage + DB."""
import json
import sys
import time
from pathlib import Path

THIS = Path(__file__).resolve().parent
sys.path.insert(0, str(THIS))
from supabase_store import (
    upload_weight, insert_model, deactivate_old_models,
    insert_training_history, STORAGE_BUCKET,
)

WEIGHTS_DIR = THIS / "weights" / "crack"
WEIGHT_FILE = WEIGHTS_DIR / "crack_lstm.pt"
STORAGE_PATH = "crack/crack_lstm.pt"
MODEL_NAME = "crack"
VERSION = "1.0.0"
MODEL_TYPE = "Shared LSTM with per-point embedding (6h interval, seq=30, pred=10)"


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
        "Crack width time-series forecaster. Shared LSTM (hidden=64, layers=2) with "
        "per-point embedding (dim=8) for 31 crack monitoring points. "
        "Input: last 30 time points (6h interval, ~7.5 days). Output: next 10 time points (~2.5 days). "
        "Detrended series (subtract first value) + per-point scaling. "
        "Trained on 1352 raw data points x 31 series (40703 sliding-window samples, 80/20 split). "
        "Best val MAE = 0.0021 (real scale, mm)."
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
    started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 321))
    insert_training_history(
        model_name=MODEL_NAME,
        model_id=model_id,
        training_type="initial",
        started_at=started_at,
        duration_sec=320.2,
        n_samples=metrics.get("n_samples", 40703),
        n_entities=config.get("n_points", 31),
        metrics=metrics,
        data_summary={
            "source": "Supabase public.raw_crack_data",
            "n_dates": 1352,
            "interval": "6h",
            "range": "2019-01-01 ~ 2019-12-05",
            "points": config.get("point_ids", []),
            "split": "per-series last 20% as validation",
            "augmentation": "none (deterministic sliding window)",
            "device": metrics.get("device", "cuda"),
        },
        notes="Initial training. 32550 train / 8153 val samples.",
    )

    print(f"\n[4/4] Done. Crack model is live in Supabase.")
    print(f"   model_id = {model_id}")
    print(f"   storage  = {STORAGE_BUCKET}/{STORAGE_PATH}")


if __name__ == "__main__":
    main()
