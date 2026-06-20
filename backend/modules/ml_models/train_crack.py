"""
Crack prediction model trainer.
Trains a multi-series shared LSTM with point embedding.
Predicts the next N time steps for any of 30 crack monitoring points.

Data source: Supabase public.raw_crack_data (1352 time points x 30 points)
Output: weights + scalers + config saved to weights/crack/
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
SEQ_LEN = 30           # input: last 30 time points (~7.5 days at 6h interval)
PRED_LEN = 10          # forecast: next 10 time points (~2.5 days)
STRIDE = 1
BATCH_SIZE = 64
EPOCHS = 120
LR = 1e-3
WEIGHT_DECAY = 1e-5
SEED = 42

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
OUT_DIR = THIS / "weights" / "crack"
OUT_DIR.mkdir(parents=True, exist_ok=True)


# -----------------------------------------------------------------------------
# Data
# -----------------------------------------------------------------------------
def fetch_crack_data():
    """
    Fetch all 1352 rows from raw_crack_data via Supabase REST API.
    Returns: (dates[1352], values[1352, 30], point_ids[30])
    """
    HEADERS = {
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
        "Content-Type": "application/json",
    }
    all_rows = []
    page_size = 1000
    offset = 0
    while True:
        url = (
            f"{SUPABASE_URL}/rest/v1/raw_crack_data"
            f"?select=*&order=measurement_date&limit={page_size}&offset={offset}"
        )
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

    # Build column list (all F*-* columns)
    all_keys = set()
    for r in all_rows:
        all_keys.update(r.keys())
    point_ids = sorted([k for k in all_keys if k.startswith("F") and "-" in k])
    print(f"  {len(point_ids)} crack points: {point_ids[:5]} ... {point_ids[-3:]}")

    # Build value matrix
    values = np.full((len(all_rows), len(point_ids)), np.nan, dtype=np.float32)
    dates = []
    for i, r in enumerate(all_rows):
        dates.append(r["measurement_date"])
        for j, pid in enumerate(point_ids):
            v = r.get(pid)
            if v is not None:
                values[i, j] = v
    return dates, values, point_ids


def build_samples(values: np.ndarray, point_ids: list, seq_len=SEQ_LEN, pred_len=PRED_LEN, stride=STRIDE):
    """
    For each point series, build (X, Y) pairs with sliding window.
    Returns: X[n, seq_len], Y[n, pred_len], point_idx[n]
    """
    X, Y, P = [], [], []
    n_t, n_p = values.shape
    p2i = {p: i for i, p in enumerate(point_ids)}
    for pid in point_ids:
        j = p2i[pid]
        s = values[:, j]
        # forward-fill NaN then back-fill remaining
        s = pd_ffill_bfill(s)
        # detrend (subtract first value) so the network learns dynamics, not absolute level
        s = s - s[0]
        for t in range(0, n_t - seq_len - pred_len + 1, stride):
            x_seg = s[t:t + seq_len]
            y_seg = s[t + seq_len:t + seq_len + pred_len]
            if not (np.isnan(x_seg).any() or np.isnan(y_seg).any()):
                X.append(x_seg)
                Y.append(y_seg)
                P.append(j)
    X = np.array(X, dtype=np.float32)
    Y = np.array(Y, dtype=np.float32)
    P = np.array(P, dtype=np.int64)
    return X, Y, P


def pd_ffill_bfill(s: np.ndarray) -> np.ndarray:
    """Forward-fill then back-fill NaN."""
    s = s.copy()
    n = len(s)
    last = None
    for i in range(n):
        if not np.isnan(s[i]):
            last = s[i]
        elif last is not None:
            s[i] = last
    # back fill leading NaN
    first = None
    for i in range(n - 1, -1, -1):
        if not np.isnan(s[i]):
            first = s[i]
            break
    if first is not None:
        for i in range(n):
            if np.isnan(s[i]):
                s[i] = first
    return s


# -----------------------------------------------------------------------------
# Model
# -----------------------------------------------------------------------------
class CrackLSTM(nn.Module):
    """
    Shared LSTM with per-point embedding.
    Input: (B, seq_len) detrended crack value series
    Output: (B, pred_len) future detrended values
    """
    def __init__(self, n_points: int, hidden=64, layers=2, seq_len=SEQ_LEN, pred_len=PRED_LEN, emb_dim=8):
        super().__init__()
        self.point_emb = nn.Embedding(n_points, emb_dim)
        self.lstm = nn.LSTM(input_size=1 + emb_dim, hidden_size=hidden, num_layers=layers,
                            batch_first=True, dropout=0.1)
        self.head = nn.Sequential(
            nn.Linear(hidden, 64), nn.GELU(),
            nn.Linear(64, pred_len),
        )

    def forward(self, x, point_idx):
        # x: (B, seq_len), point_idx: (B,)
        B, L = x.shape
        emb = self.point_emb(point_idx)              # (B, emb)
        emb_rep = emb.unsqueeze(1).expand(-1, L, -1)  # (B, L, emb)
        x_in = torch.cat([x.unsqueeze(-1), emb_rep], dim=-1)  # (B, L, 1+emb)
        h, _ = self.lstm(x_in)
        return self.head(h[:, -1, :])                # (B, pred_len)


# -----------------------------------------------------------------------------
# Train
# -----------------------------------------------------------------------------
def main():
    torch.manual_seed(SEED)
    np.random.seed(SEED)
    print(f"Device: {DEVICE}  torch: {torch.__version__}")

    print("\n[1/3] Fetching crack data from Supabase ...")
    dates, values, point_ids = fetch_crack_data()
    print(f"  data matrix: {values.shape}  dates: {len(dates)}  points: {len(point_ids)}")

    print("\n[2/3] Building sliding-window samples ...")
    X, Y, P = build_samples(values, point_ids, SEQ_LEN, PRED_LEN, STRIDE)
    print(f"  samples: {X.shape[0]}  seq_len: {SEQ_LEN}  pred_len: {PRED_LEN}")
    print(f"  X range: [{X.min():.4f}, {X.max():.4f}]  Y range: [{Y.min():.4f}, {Y.max():.4f}]")

    # Per-point scale (use initial value range as scale)
    point_scales = np.zeros(len(point_ids), dtype=np.float32)
    for j in range(len(point_ids)):
        s = values[:, j]
        s = s[~np.isnan(s)]
        if len(s) > 0:
            point_scales[j] = max(abs(s.max() - s.min()), 1e-3)

    # Normalize per-point using scale
    X_n = X / point_scales[P][:, None]
    Y_n = Y / point_scales[P][:, None]

    # Train/val split (per-point, last 20% of each series held out)
    n_per_point = (values.shape[0] - SEQ_LEN - PRED_LEN + 1) // STRIDE
    n_train_per = int(n_per_point * 0.8)
    train_mask = np.zeros(len(X), dtype=bool)
    for j in range(len(point_ids)):
        idx_j = np.where(P == j)[0]
        if len(idx_j) > 0:
            train_mask[idx_j[:n_train_per]] = True
    val_mask = ~train_mask
    print(f"  train: {train_mask.sum()}  val: {val_mask.sum()}")

    t_X = torch.from_numpy(X_n).float()
    t_Y = torch.from_numpy(Y_n).float()
    t_P = torch.from_numpy(P).long()

    train_ds = TensorDataset(t_X[train_mask], t_Y[train_mask], t_P[train_mask])
    val_ds = TensorDataset(t_X[val_mask], t_Y[val_mask], t_P[val_mask])
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False)

    model = CrackLSTM(n_points=len(point_ids)).to(DEVICE)
    opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=EPOCHS)

    best_val = float("inf")
    best_state = None
    t0 = time.time()
    for ep in range(1, EPOCHS + 1):
        model.train()
        loss_sum, n_b = 0.0, 0
        for x, y, p in train_loader:
            x, y, p = x.to(DEVICE), y.to(DEVICE), p.to(DEVICE)
            pred = model(x, p)
            loss = F.l1_loss(pred, y)
            opt.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            loss_sum += loss.item()
            n_b += 1
        sched.step()

        # val (denormalize for true MAE)
        model.eval()
        with torch.no_grad():
            v_sum, v_n = 0.0, 0
            for x, y, p in val_loader:
                x, y, p = x.to(DEVICE), y.to(DEVICE), p.to(DEVICE)
                pred_n = model(x, p)
                pred = pred_n * torch.from_numpy(point_scales).to(DEVICE)[p][:, None]
                real = y * torch.from_numpy(point_scales).to(DEVICE)[p][:, None]
                v_sum += F.l1_loss(pred, real, reduction="sum").item()
                v_n += y.numel()
            v_mae = v_sum / max(v_n, 1)

        if ep % 10 == 0 or ep == 1 or ep == EPOCHS:
            print(f"Ep {ep:3d} | train_l1={loss_sum/max(n_b,1):.4f} | val_mae={v_mae:.5f}")

        if v_mae < best_val:
            best_val = v_mae
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

    print(f"\nBest val MAE (real scale): {best_val:.5f}")
    print(f"Total time: {time.time() - t0:.1f}s")

    # Save
    model.load_state_dict(best_state)
    weight_path = OUT_DIR / "crack_lstm.pt"
    torch.save({
        "state_dict": best_state,
        "point_ids": point_ids,
        "point_scales": point_scales.tolist(),
        "config": {
            "model_type": "CrackLSTM (shared LSTM + per-point embedding)",
            "seq_len": SEQ_LEN,
            "pred_len": PRED_LEN,
            "n_points": len(point_ids),
            "hidden": 64,
            "layers": 2,
            "emb_dim": 8,
            "interval": "6h",
        },
        "metrics": {
            "val_mae_real": float(best_val),
            "epochs": EPOCHS,
            "n_samples": int(X.shape[0]),
            "n_train": int(train_mask.sum()),
            "n_val": int(val_mask.sum()),
            "device": DEVICE,
        },
    }, weight_path)
    print(f"Saved -> {weight_path}  ({weight_path.stat().st_size/1024:.1f} KB)")

    # standalone config & metrics (also saved inside the .pt for inference)
    with open(OUT_DIR / "config.json", "w", encoding="utf-8") as f:
        json.dump({
            "model_type": "CrackLSTM",
            "seq_len": SEQ_LEN, "pred_len": PRED_LEN,
            "n_points": len(point_ids),
            "point_ids": point_ids,
            "interval": "6h",
        }, f, ensure_ascii=False, indent=2)
    with open(OUT_DIR / "metrics.json", "w", encoding="utf-8") as f:
        json.dump({
            "val_mae_real": float(best_val),
            "epochs": EPOCHS,
            "n_samples": int(X.shape[0]),
            "device": DEVICE,
        }, f, ensure_ascii=False, indent=2)
    return float(best_val)


if __name__ == "__main__":
    main()
