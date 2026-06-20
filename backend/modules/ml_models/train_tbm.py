"""
TBM trajectory prediction model trainer.
Trains a multi-variate LSTM with per-TBM embedding.
Predicts the next N time steps of 4 deviation targets (tail/head × vertical/horizontal).

Data source: Supabase public.tbm_trajectory_data (227 rows × 5 TBMs × 5min interval)
Output: weights + scalers + config saved to weights/tbm/
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
from sklearn.preprocessing import StandardScaler

THIS = Path(__file__).resolve().parent
sys.path.insert(0, str(THIS))
from supabase_store import SUPABASE_URL, ANON_KEY  # noqa: E402

# -----------------------------------------------------------------------------
# Hyperparameters
# -----------------------------------------------------------------------------
SEQ_LEN = 8            # input: last 8 time points (40 min at 5min interval)
PRED_LEN = 4           # forecast: next 4 time points (20 min)
STRIDE = 1
BATCH_SIZE = 32
EPOCHS = 200
LR = 1e-3
WEIGHT_DECAY = 1e-5
SEED = 42

# 14 input features (operational parameters)
FEATURES = [
    "thrust_force", "cutter_torque", "cutter_speed", "cutout_pressure",
    "penetration_rate", "advance_speed", "mud_flow_in", "mud_flow_out",
    "pressure_down", "pressure_up", "pressure_right_up", "pressure_right_down",
    "pressure_left_down", "pressure_left_up",
]
# 4 prediction targets (deviations)
TARGETS = [
    "tail_vertical_deviation", "tail_horizontal_deviation",
    "head_vertical_deviation", "head_horizontal_deviation",
]

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
OUT_DIR = THIS / "weights" / "tbm"
OUT_DIR.mkdir(parents=True, exist_ok=True)


# -----------------------------------------------------------------------------
# Data
# -----------------------------------------------------------------------------
def fetch_tbm_data():
    """
    Fetch all 227 rows from tbm_trajectory_data via Supabase REST API.
    Returns: (df-like dict: {point_id: {times, features[N,14], targets[N,4]}})
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
            f"{SUPABASE_URL}/rest/v1/tbm_trajectory_data"
            f"?select=point_id,measurement_time,{','.join(FEATURES)},{','.join(TARGETS)}"
            f"&order=point_id,measurement_time&limit={page_size}&offset={offset}"
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

    # Group by point_id
    tbm_ids = sorted(set(r["point_id"] for r in all_rows))
    print(f"  {len(tbm_ids)} TBMs: {tbm_ids}")

    grouped = {}
    for tid in tbm_ids:
        rows_t = [r for r in all_rows if r["point_id"] == tid]
        rows_t.sort(key=lambda x: x["measurement_time"])
        times = [r["measurement_time"] for r in rows_t]
        feats = np.array([[float(r[f]) for f in FEATURES] for r in rows_t], dtype=np.float32)
        targs = np.array([[float(r[t]) for t in TARGETS] for r in rows_t], dtype=np.float32)
        grouped[tid] = {"times": times, "features": feats, "targets": targs}
    return grouped, tbm_ids


def build_samples(grouped, tbm_ids, seq_len=SEQ_LEN, pred_len=PRED_LEN, stride=STRIDE):
    """
    For each TBM series, build (X, Y, tbm_idx) pairs with sliding window.
    X: (N, seq_len, n_features), Y: (N, pred_len, n_targets), P: (N,)
    """
    X, Y, P = [], [], []
    t2i = {t: i for i, t in enumerate(tbm_ids)}
    for tid in tbm_ids:
        g = grouped[tid]
        feats = g["features"]
        targs = g["targets"]
        n = len(feats)
        idx = t2i[tid]
        for t in range(0, n - seq_len - pred_len + 1, stride):
            x_seg = feats[t:t + seq_len]
            y_seg = targs[t + seq_len:t + seq_len + pred_len]
            X.append(x_seg)
            Y.append(y_seg)
            P.append(idx)
    X = np.array(X, dtype=np.float32)
    Y = np.array(Y, dtype=np.float32)
    P = np.array(P, dtype=np.int64)
    return X, Y, P


# -----------------------------------------------------------------------------
# Model
# -----------------------------------------------------------------------------
class TBMNet(nn.Module):
    """
    Multi-variate LSTM with per-TBM embedding.
    Input:  (B, seq_len, n_features) + tbm_idx (B,)
    Output: (B, pred_len, n_targets)
    """
    def __init__(self, n_tbms, n_features=14, n_targets=4, hidden=64, layers=2,
                 seq_len=SEQ_LEN, pred_len=PRED_LEN, emb_dim=8):
        super().__init__()
        self.n_targets = n_targets
        self.pred_len = pred_len
        self.tbm_emb = nn.Embedding(n_tbms, emb_dim)
        self.lstm = nn.LSTM(input_size=n_features + emb_dim, hidden_size=hidden,
                            num_layers=layers, batch_first=True, dropout=0.1)
        self.head = nn.Sequential(
            nn.Linear(hidden, 64), nn.GELU(),
            nn.Linear(64, n_targets * pred_len),
        )

    def forward(self, x, tbm_idx):
        B, L, F = x.shape
        emb = self.tbm_emb(tbm_idx)                    # (B, emb)
        emb_rep = emb.unsqueeze(1).expand(-1, L, -1)   # (B, L, emb)
        x_in = torch.cat([x, emb_rep], dim=-1)          # (B, L, F+emb)
        h, _ = self.lstm(x_in)
        out = self.head(h[:, -1, :])                    # (B, n_targets*pred_len)
        return out.view(B, self.pred_len, self.n_targets)


# -----------------------------------------------------------------------------
# Train
# -----------------------------------------------------------------------------
def main():
    torch.manual_seed(SEED)
    np.random.seed(SEED)
    print(f"Device: {DEVICE}  torch: {torch.__version__}")

    print("\n[1/3] Fetching TBM data from Supabase ...")
    grouped, tbm_ids = fetch_tbm_data()
    total_rows = sum(len(g["times"]) for g in grouped.values())
    print(f"  total rows: {total_rows}  TBMs: {len(tbm_ids)}")
    for tid in tbm_ids:
        print(f"    {tid}: {len(grouped[tid]['times'])} rows")

    print("\n[2/3] Building sliding-window samples ...")
    X, Y, P = build_samples(grouped, tbm_ids, SEQ_LEN, PRED_LEN, STRIDE)
    print(f"  samples: {X.shape[0]}  seq_len: {SEQ_LEN}  pred_len: {PRED_LEN}")
    print(f"  X shape: {X.shape}  Y shape: {Y.shape}")

    # Global scalers (fit on all data)
    n_feat = len(FEATURES)
    n_targ = len(TARGETS)
    feat_scaler = StandardScaler()
    targ_scaler = StandardScaler()
    X_flat = X.reshape(-1, n_feat)
    Y_flat = Y.reshape(-1, n_targ)
    feat_scaler.fit(X_flat)
    targ_scaler.fit(Y_flat)
    X_norm = feat_scaler.transform(X_flat).reshape(X.shape).astype(np.float32)
    Y_norm = targ_scaler.transform(Y_flat).reshape(Y.shape).astype(np.float32)

    # Train/val split (per-TBM, last 20% held out)
    n_per_tbm = {}
    for tid in tbm_ids:
        n_t = len(grouped[tid]["times"])
        n_per_tbm[tid] = max(0, n_t - SEQ_LEN - PRED_LEN + 1)
    n_train_per = {}
    for tid, n in n_per_tbm.items():
        n_train_per[tid] = int(n * 0.8)

    train_mask = np.zeros(len(X), dtype=bool)
    cursor = 0
    for tid in tbm_ids:
        n = n_per_tbm[tid]
        nt = n_train_per[tid]
        train_mask[cursor:cursor + nt] = True
        cursor += n
    val_mask = ~train_mask
    print(f"  train: {train_mask.sum()}  val: {val_mask.sum()}")

    t_X = torch.from_numpy(X_norm).float()
    t_Y = torch.from_numpy(Y_norm).float()
    t_P = torch.from_numpy(P).long()

    train_ds = TensorDataset(t_X[train_mask], t_Y[train_mask], t_P[train_mask])
    val_ds = TensorDataset(t_X[val_mask], t_Y[val_mask], t_P[val_mask])
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False)

    model = TBMNet(n_tbms=len(tbm_ids), n_features=n_feat, n_targets=n_targ).to(DEVICE)
    opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=EPOCHS)

    # Save scaler params for inference
    feat_mean = feat_scaler.mean_.astype(np.float32)
    feat_scale = feat_scaler.scale_.astype(np.float32)
    targ_mean = targ_scaler.mean_.astype(np.float32)
    targ_scale = targ_scaler.scale_.astype(np.float32)

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
                # denormalize
                pred_real = pred_n.cpu().numpy() * targ_scale + targ_mean
                real = y.cpu().numpy() * targ_scale + targ_mean
                v_sum += np.abs(pred_real - real).sum()
                v_n += real.size
            v_mae = v_sum / max(v_n, 1)

        if ep % 20 == 0 or ep == 1 or ep == EPOCHS:
            print(f"Ep {ep:3d} | train_l1={loss_sum/max(n_b,1):.4f} | val_mae={v_mae:.5f}")

        if v_mae < best_val:
            best_val = v_mae
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

    print(f"\nBest val MAE (real scale): {best_val:.5f}")
    print(f"Total time: {time.time() - t0:.1f}s")

    # Save
    model.load_state_dict(best_state)
    weight_path = OUT_DIR / "tbm_net.pt"
    torch.save({
        "state_dict": best_state,
        "tbm_ids": tbm_ids,
        "features": FEATURES,
        "targets": TARGETS,
        "feat_mean": feat_mean.tolist(),
        "feat_scale": feat_scale.tolist(),
        "targ_mean": targ_mean.tolist(),
        "targ_scale": targ_scale.tolist(),
        "config": {
            "model_type": "TBMNet (Multi-variate LSTM + per-TBM embedding)",
            "seq_len": SEQ_LEN,
            "pred_len": PRED_LEN,
            "n_tbms": len(tbm_ids),
            "n_features": n_feat,
            "n_targets": n_targ,
            "hidden": 64,
            "layers": 2,
            "emb_dim": 8,
            "interval": "5min",
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

    # standalone config & metrics
    with open(OUT_DIR / "config.json", "w", encoding="utf-8") as f:
        json.dump({
            "model_type": "TBMNet",
            "seq_len": SEQ_LEN, "pred_len": PRED_LEN,
            "n_tbms": len(tbm_ids),
            "tbm_ids": tbm_ids,
            "features": FEATURES,
            "targets": TARGETS,
            "interval": "5min",
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
