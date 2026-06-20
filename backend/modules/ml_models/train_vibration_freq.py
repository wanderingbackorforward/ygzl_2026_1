"""
Vibration frequency-domain spectrum classifier trainer.
Trains a 1D-CNN to classify spectra by channel (8 classes).
Low confidence at inference time = anomaly.

Data source: Supabase public.vibration_frequency_data (8 channels x 500 freq points)
Data augmentation: Gaussian noise + amplitude scaling -> 100 samples per channel
Output: weights + config saved to weights/vibration_freq/
"""
import json
import os
import sys
import time
from pathlib import Path

import numpy as np
import requests
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, TensorDataset

THIS = Path(__file__).resolve().parent
sys.path.insert(0, str(THIS))
from supabase_store import SUPABASE_URL, ANON_KEY  # noqa: E402

# -----------------------------------------------------------------------------
# Hyperparameters
# -----------------------------------------------------------------------------
N_FREQ = 500           # frequency bins per spectrum
N_CHANNELS = 8         # number of vibration channels
N_AUG = 100            # augmented samples per channel
BATCH_SIZE = 32
EPOCHS = 300
LR = 1e-3
SEED = 42
NOISE_STD = 0.0008     # reduced noise for better class separation
AMP_SCALE_RANGE = 0.10  # reduced amplitude scale range

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
OUT_DIR = THIS / "weights" / "vibration_freq"
OUT_DIR.mkdir(parents=True, exist_ok=True)


# -----------------------------------------------------------------------------
# Data
# -----------------------------------------------------------------------------
def fetch_freq_data():
    """Fetch all 4000 rows from vibration_frequency_data, group by channel."""
    HEADERS = {
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
        "Content-Type": "application/json",
    }
    all_rows = []
    page_size = 1000
    offset = 0
    while True:
        url = (f"{SUPABASE_URL}/rest/v1/vibration_frequency_data"
               f"?select=channel_id,frequency,amplitude&order=channel_id,frequency"
               f"&limit={page_size}&offset={offset}")
        r = requests.get(url, headers=HEADERS, timeout=60)
        r.raise_for_status()
        rows = r.json()
        if not rows:
            break
        all_rows.extend(rows)
        offset += len(rows)
        if len(rows) < page_size:
            break
    print(f"  Fetched {len(all_rows)} rows")

    # Group by channel_id
    spectra = {}
    for row in all_rows:
        ch = row["channel_id"]
        if ch not in spectra:
            spectra[ch] = []
        spectra[ch].append((float(row["frequency"]), float(row["amplitude"])))

    # Sort by frequency and extract amplitude arrays
    channel_ids = sorted(spectra.keys())
    spectra_arr = []
    for ch in channel_ids:
        pts = sorted(spectra[ch], key=lambda x: x[0])
        amps = np.array([p[1] for p in pts], dtype=np.float32)
        spectra_arr.append(amps)
    return np.array(spectra_arr, dtype=np.float32), channel_ids


def augment_spectra(spectra, n_aug=N_AUG, noise_std=NOISE_STD, amp_range=AMP_SCALE_RANGE):
    """
    Data augmentation: for each channel's spectrum, generate n_aug variants.
    Augmentation: Gaussian noise + amplitude scaling.
    Returns: (N, n_freq) augmented spectra, (N,) labels
    """
    n_channels, n_freq = spectra.shape
    X = []
    Y = []
    rng = np.random.RandomState(SEED)
    for ch_idx in range(n_channels):
        base = spectra[ch_idx]
        for _ in range(n_aug):
            # Amplitude scaling
            scale = 1.0 + rng.uniform(-amp_range, amp_range)
            # Gaussian noise
            noise = rng.normal(0, noise_std, n_freq).astype(np.float32)
            aug = base * scale + noise
            # Clip to non-negative (amplitudes are non-negative)
            aug = np.maximum(aug, 0)
            X.append(aug)
            Y.append(ch_idx)
    X = np.array(X, dtype=np.float32)
    Y = np.array(Y, dtype=np.int64)
    return X, Y


# -----------------------------------------------------------------------------
# Model
# -----------------------------------------------------------------------------
class SpectrumClassifier(nn.Module):
    """
    1D-CNN spectrum classifier.
    Input:  (B, n_freq) spectrum amplitude array
    Output: (B, n_channels) class logits
    """
    def __init__(self, n_freq=N_FREQ, n_channels=N_CHANNELS, hidden=64):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Conv1d(1, 16, kernel_size=7, padding=3), nn.GELU(),
            nn.MaxPool1d(2),      # 250
            nn.Conv1d(16, 32, kernel_size=5, padding=2), nn.GELU(),
            nn.MaxPool1d(2),      # 125
            nn.Conv1d(32, 64, kernel_size=3, padding=1), nn.GELU(),
            nn.MaxPool1d(2),      # 62
            nn.Conv1d(64, hidden, kernel_size=3, padding=1), nn.GELU(),
            nn.AdaptiveAvgPool1d(1),
        )
        self.head = nn.Sequential(
            nn.Linear(hidden, 32), nn.GELU(),
            nn.Linear(32, n_channels),
        )

    def forward(self, x):
        # x: (B, n_freq) -> (B, 1, n_freq)
        x = x.unsqueeze(1)
        h = self.encoder(x).squeeze(-1)   # (B, hidden)
        return self.head(h)               # (B, n_channels)


# -----------------------------------------------------------------------------
# Train
# -----------------------------------------------------------------------------
def main():
    torch.manual_seed(SEED)
    np.random.seed(SEED)
    print(f"Device: {DEVICE}  torch: {torch.__version__}")

    print("\n[1/3] Fetching vibration frequency data from Supabase ...")
    spectra, channel_ids = fetch_freq_data()
    print(f"  {len(channel_ids)} channels: {channel_ids}")
    print(f"  spectrum shape: {spectra.shape}")
    for i, ch in enumerate(channel_ids):
        print(f"    ch{ch}: amp range [{spectra[i].min():.6f}, {spectra[i].max():.6f}], mean={spectra[i].mean():.6f}")

    print("\n[2/3] Data augmentation + train/val split ...")
    X, Y = augment_spectra(spectra)
    print(f"  augmented samples: {X.shape[0]}  ({N_AUG} per channel x {N_CHANNELS})")

    # Normalize: per-frequency-bin max normalization
    max_per_freq = X.max(axis=0, keepdims=True)
    max_per_freq = np.maximum(max_per_freq, 1e-8)
    X_norm = X / max_per_freq

    # Train/val split (per-channel, last 20% held out)
    n_per_ch = N_AUG
    n_train_per = int(n_per_ch * 0.8)
    train_mask = np.zeros(len(X), dtype=bool)
    for ch_idx in range(N_CHANNELS):
        start = ch_idx * n_per_ch
        train_mask[start:start + n_train_per] = True
    val_mask = ~train_mask
    print(f"  train: {train_mask.sum()}  val: {val_mask.sum()}")

    t_X = torch.from_numpy(X_norm).float()
    t_Y = torch.from_numpy(Y).long()
    train_ds = TensorDataset(t_X[train_mask], t_Y[train_mask])
    val_ds = TensorDataset(t_X[val_mask], t_Y[val_mask])
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False)

    model = SpectrumClassifier(n_freq=N_FREQ, n_channels=N_CHANNELS).to(DEVICE)
    opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-5)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=EPOCHS)

    best_val_acc = 0.0
    best_state = None
    t0 = time.time()
    for ep in range(1, EPOCHS + 1):
        model.train()
        loss_sum, n_b = 0.0, 0
        for x, y in train_loader:
            x, y = x.to(DEVICE), y.to(DEVICE)
            logits = model(x)
            loss = F.cross_entropy(logits, y)
            opt.zero_grad()
            loss.backward()
            opt.step()
            loss_sum += loss.item()
            n_b += 1
        sched.step()

        # val
        model.eval()
        correct, total = 0, 0
        with torch.no_grad():
            for x, y in val_loader:
                x, y = x.to(DEVICE), y.to(DEVICE)
                logits = model(x)
                pred = logits.argmax(dim=1)
                correct += (pred == y).sum().item()
                total += y.size(0)
            val_acc = correct / max(total, 1)

        if ep % 20 == 0 or ep == 1 or ep == EPOCHS:
            print(f"Ep {ep:3d} | train_loss={loss_sum/max(n_b,1):.4f} | val_acc={val_acc:.4f}")

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

    print(f"\nBest val accuracy: {best_val_acc:.4f}")
    print(f"Total time: {time.time() - t0:.1f}s")

    # Save
    model.load_state_dict(best_state)
    weight_path = OUT_DIR / "spectrum_classifier.pt"
    torch.save({
        "state_dict": best_state,
        "channel_ids": channel_ids,
        "max_per_freq": max_per_freq[0].tolist(),
        "config": {
            "model_type": "SpectrumClassifier (1D-CNN, 8-class)",
            "n_freq": N_FREQ,
            "n_channels": N_CHANNELS,
            "hidden": 64,
            "augmentation": f"gaussian_noise(std={NOISE_STD}) + amplitude_scale(±{AMP_SCALE_RANGE})",
            "n_aug_per_channel": N_AUG,
        },
        "metrics": {
            "val_accuracy": float(best_val_acc),
            "epochs": EPOCHS,
            "n_samples": int(X.shape[0]),
            "n_train": int(train_mask.sum()),
            "n_val": int(val_mask.sum()),
            "device": DEVICE,
        },
    }, weight_path)
    print(f"Saved -> {weight_path}  ({weight_path.stat().st_size/1024:.1f} KB)")

    # standalone config & metrics
    with open(OUT_DIR / "config.json", "w", encoding="utf-8") as f:
        json.dump({
            "model_type": "SpectrumClassifier",
            "n_freq": N_FREQ,
            "n_channels": N_CHANNELS,
            "channel_ids": channel_ids,
            "n_aug_per_channel": N_AUG,
        }, f, ensure_ascii=False, indent=2)
    with open(OUT_DIR / "metrics.json", "w", encoding="utf-8") as f:
        json.dump({
            "val_accuracy": float(best_val_acc),
            "epochs": EPOCHS,
            "n_samples": int(X.shape[0]),
            "device": DEVICE,
        }, f, ensure_ascii=False, indent=2)
    return float(best_val_acc)


if __name__ == "__main__":
    main()
