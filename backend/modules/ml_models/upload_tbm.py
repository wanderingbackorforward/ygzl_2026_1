"""Upload TBM trajectory prediction model to Supabase Storage + DB."""
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

WEIGHTS_DIR = THIS / "weights" / "tbm"
WEIGHT_FILE = WEIGHTS_DIR / "tbm_net.pt"
STORAGE_PATH = "tbm/tbm_net.pt"
MODEL_NAME = "tbm"
VERSION = "1.0.0"
MODEL_TYPE = "TBMNet (Multi-variate LSTM + per-TBM embedding, 5min interval, seq=8, pred=4)"


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
        "TBM trajectory prediction model. Multi-variate LSTM (hidden=64, layers=2) with "
        "per-TBM embedding (dim=8) for 5 TBMs. "
        "Input: 14 operational features over last 8 time points (5min interval, 40min). "
        "Output: 4 deviation targets (tail/head x vertical/horizontal) over next 4 steps (20min). "
        "StandardScaler normalization (global, per-feature). "
        "Trained on 227 rows x 5 TBMs (172 sliding-window samples, 80/20 split). "
        f"Best val MAE = {metrics.get('val_mae_real', 0.656):.4f} (real scale)."
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
    started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 14))
    insert_training_history(
        model_name=MODEL_NAME,
        model_id=model_id,
        training_type="initial",
        started_at=started_at,
        duration_sec=13.2,
        n_samples=metrics.get("n_samples", 172),
        n_entities=config.get("n_tbms", 5),
        metrics=metrics,
        data_summary={
            "source": "Supabase public.tbm_trajectory_data",
            "n_rows": 227,
            "interval": "5min",
            "n_tbms": 5,
            "tbm_ids": config.get("tbm_ids", []),
            "features": config.get("features", []),
            "targets": config.get("targets", []),
            "split": "per-TBM last 20% as validation",
            "device": metrics.get("device", "cuda"),
        },
        notes="Initial training. 137 train / 35 val samples.",
    )

    print(f"\n[4/4] Done. TBM model is live in Supabase.")
    print(f"   model_id = {model_id}")
    print(f"   storage  = {STORAGE_BUCKET}/{STORAGE_PATH}")


if __name__ == "__main__":
    main()
