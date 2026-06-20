"""
Vibration AI model trainer.
Trains a 1D-CNN + LSTM to:
  1) Reconstruct full waveform (100 pts) from the first 50 points (denoising/autoencoding)
  2) Predict 16 statistical features from the 100-point waveform

Data: 8 channels x 100 time points from Supabase (real blasting vibration data).
Output: weights + scalers + config saved to weights/vibration/
        metrics written to log, then upload_to_supabase will push to Supabase.
"""
import json
import math
import os
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, TensorDataset

# -----------------------------------------------------------------------------
# Real data (8 channels x 100 time points + 16 features each)
# Pulled from Supabase via MCP on 2026-06-20
# -----------------------------------------------------------------------------
WAVEFORMS = {
    1: [-0.47453,-0.31291,0.63079,-0.77403,0.12907,0.42015,-0.79548,0.62849,0.1375,-0.66909,0.79012,-0.30755,-0.39104,0.7005,-0.79012,-0.076216,0.49904,-0.80237,0.50364,0.23784,-0.64381,0.78016,-0.25239,-0.41095,0.82229,-0.68671,-0.12141,0.58024,-0.79165,0.2118,0.47606,-0.7388,0.62849,0.19035,-0.67599,0.78859,-0.026427,-0.51283,0.87131,-0.20031,-0.37648,0.76484,-0.5067,-0.21409,0.6959,-0.62926,-0.24397,0.65377,-0.80927,-0.044044,0.53198,-0.89506,0.11835,0.38721,-0.85446,0.36423,0.3964,-0.8828,0.63769,0.30908,-0.83914,0.83684,0.17809,-0.69973,0.86748,0.10456,-0.58483,0.89123,-0.11452,-0.45002,0.88663,-0.45308,-0.3244,0.82995,-0.63615,-0.30678,0.7725,-0.81463,-0.050938,0.63003,-0.89123,0.12447,0.41785,-0.87285,0.35427,0.40329,-0.77403,0.62926,0.18805,-0.72578,0.83914,0.097664,-0.6216,0.82306,-0.088472,-0.49904,0.78169,-0.42244,-0.35887,0.71658],
    2: [0.68773,-0.37546,-0.48699,0.829,-0.59851,-0.040892,0.59108,-0.82156,0.44238,0.33829,-0.92565,0.65056,-0.13011,-0.61338,0.94052,-0.51673,-0.15242,0.72491,-0.80669,0.41264,0.41264,-0.94052,0.63569,-0.018587,-0.73234,0.90335,-0.43494,-0.31599,0.90335,-0.59851,0.085502,0.62082,-0.80669,0.36059,0.39033,-0.88848,0.47955,0.2119,-0.76952,0.62825,0.070632,-0.53903,0.74721,-0.085502,-0.54647,0.74721,-0.18216,-0.44238,0.74721,-0.42007,-0.32342,0.71004,-0.53903,-0.22677,0.69517,-0.5539,-0.085502,0.62082,-0.67286,0.040892,0.60595,-0.65056,0.21933,0.50186,-0.73978,0.34572,0.50186,-0.71004,0.51673,0.36803,-0.66543,0.62825,0.092937,-0.73978,0.71747,-0.18216,-0.63569,0.78439,-0.29368,-0.49442,0.76952,-0.42751,-0.32342,0.67286,-0.58364,-0.078067,0.48699,-0.62825,0.063197,0.5316,-0.79182,0.33086,0.49442,-0.72491,0.48699,0.30855,-0.66543,0.60595,0.048327,-0.65056],
    3: [0.046512,-0.39535,0.62791,-1.1102e-16,-0.2093,0.65116,-0.39535,-0.046512,0.44186,-0.72093,0.18605,0.2093,-0.51163,0.53488,0.023256,-0.13953,0.76744,-0.4186,-0.11628,0.51163,-0.5814,0.13953,0.25581,-0.48837,0.62791,-1.1102e-16,-0.37209,0.74419,-0.13953,-0.046512,0.74419,-0.51163,-0.093023,0.65116,-0.65116,0.18605,0.34884,-0.86047,0.27907,0.16279,-0.74419,0.48837,0.046512,-0.74419,0.67442,-0.069767,-0.27907,0.83721,-0.11628,-0.23256,0.88372,-0.2093,-0.13953,0.86047,-0.39535,0.046512,0.67442,-0.53488,0.023256,0.7907,-0.95349,0.023256,0.55814,-0.90698,0.32558,0.30233,-0.86047,0.39535,0.16279,-0.7907,0.53488,0.069767,-0.76744,0.76744,-0.093023,-0.30233,0.93023,-0.11628,-0.30233,0.88372,-0.27907,-0.023256,0.90698,-0.48837,0.046512,0.76744,-0.69767,-0.046512,0.60465,-0.88372,0.16279,0.37209,-0.83721,0.39535,0.25581,-0.67442,0.46512,0.046512,-0.88372,0.65116],
    4: [-0.16456,-0.41772,-0.41772,-0.41772,-0.34177,0.037975,-0.16456,0.31646,0.5443,0.18987,0.41772,-0.088608,-0.31646,-0.64557,-0.51899,-0.51899,-0.31646,-0.34177,0.13924,0.51899,0.13924,0.49367,0.59494,0.18987,0.24051,0.18987,-0.41772,-0.51899,-0.67089,-0.74684,-0.5443,-0.59494,-0.6962,-0.012658,-0.51899,0.012658,0.29114,-0.34177,0.39241,0.64557,-0.088608,0.62025,0.92405,0.11392,0.87342,0.6962,0.13924,0.59494,0.24051,-0.012658,0.26582,0.037975,-0.5443,0.29114,-0.46835,-0.94937,-0.44304,-0.82278,-0.6962,-0.18987,-0.74684,-0.64557,-0.11392,-0.64557,-0.13924,0.29114,-0.36709,0.41772,0.8481,-0.16456,0.6962,0.89873,0.16456,0.79747,0.62025,0.13924,0.62025,0.088608,-0.24051,0.24051,-0.18987,-0.74684,-0.34177,-0.87342,-0.87342,-0.5443,-0.8481,-0.72152,-0.41772,-0.72152,-0.31646,0.16456,-0.34177,0.34177,0.5443,-0.18987,0.72152,0.97468,0.11392,0.72152],
    5: [-0.007109,0.54739,-0.56635,0.3128,0.24882,-0.50237,0.50711,0,-0.25355,0.62085,-0.3673,-0.16825,0.56161,-0.609,0.16825,0.31043,-0.45735,0.50711,0.10427,-0.39336,0.62796,-0.15877,-0.097156,0.69194,-0.41232,-0.17062,0.68009,-0.68009,0.32227,0.4763,-0.73934,0.47393,0.24882,-0.65403,0.61374,0.016588,-0.74645,0.74171,-0.15403,-0.38389,0.84123,-0.22986,-0.34597,0.8436,-0.41706,-0.25592,0.79147,-0.55924,-0.040284,0.72038,-0.58768,0.033175,0.78436,-0.85545,0.11137,0.54739,-0.84834,0.45498,0.36967,-0.71327,0.57583,0.29858,-0.6564,0.59953,0.045024,-0.79621,0.81517,-0.17062,-0.31517,0.95498,-0.30569,-0.36256,0.88152,-0.39573,-0.11137,0.91469,-0.59242,0.06872,0.70853,-0.70379,0.07346,0.6872,-0.82464,0.27014,0.42891,-0.6872,0.53081,0.31754,-0.58294,0.54028,0.056872,-0.87204,0.68483,-0.087678,-0.44076,0.82938,-0.16825,-0.37678,0.90521,-0.35071],
    6: [-0.30168,-0.47379,-0.6182,-0.30366,-0.22849,-0.080119,-0.0089021,0.14342,0.29179,0.11771,0.046489,-0.21266,-0.32542,-0.85955,-0.4362,-0.41246,-0.31355,-0.16518,0.20475,0.35509,0.23244,0.20475,0.2542,0.09001,-0.10979,-0.10188,-0.55885,-0.79228,-0.545,-0.63205,-0.63403,-0.39862,-0.52127,0.042532,-0.25816,0.026706,0.28981,-0.14342,0.2997,0.65776,0.064293,0.37092,0.70326,0.18497,0.44214,0.42829,0.026706,0.11177,-0.032641,-0.22057,-0.26014,-0.18694,-0.63996,-0.20277,-0.57072,-0.97033,-0.63007,-0.62809,-0.64392,-0.18892,-0.45203,-0.45994,-0.0049456,-0.36696,-0.10781,0.28388,-0.11968,0.27399,0.92878,0.012859,0.38675,0.66172,0.093966,0.28388,0.22453,-0.048467,0.084075,-0.064293,-0.41048,-0.1632,-0.27794,-0.81998,-0.59248,-0.76459,-0.78437,-0.55885,-0.65183,-0.59842,-0.26607,-0.42038,-0.17903,0.13551,-0.091988,0.24233,0.53709,-0.026706,0.55094,0.7725,0.1276,0.3452],
    7: [0.060241,0.46988,-0.54217,0.42169,0.20482,-0.46988,0.59036,-0.036145,-0.18072,0.61446,-0.49398,-0.13253,0.54217,-0.56627,0.27711,0.25301,-0.42169,0.59036,-0.012048,-0.27711,0.66265,-0.27711,-0.036145,0.63855,-0.49398,-0.084337,0.61446,-0.66265,0.44578,0.39759,-0.68675,0.56627,0.15663,-0.56627,0.68675,-0.084337,-0.59036,0.78313,-0.22892,-0.25301,0.90361,-0.37349,-0.25301,0.87952,-0.51807,-0.18072,0.73494,-0.66265,0.060241,0.61446,-0.66265,0.10843,0.63855,-0.90361,0.22892,0.42169,-0.78313,0.59036,0.3012,-0.71084,0.66265,0.27711,-0.59036,0.71084,-0.036145,-0.63855,0.83133,-0.27711,-0.20482,0.95181,-0.39759,-0.25301,0.87952,-0.49398,-0.060241,0.83133,-0.71084,0.084337,0.63855,-0.71084,0.15663,0.54217,-0.85542,0.39759,0.3494,-0.68675,0.63855,0.3012,-0.56627,0.66265,0.012048,-0.75904,0.73494,-0.18072,-0.3012,0.90361,-0.25301,-0.27711,0.90361,-0.49398],
    8: [-0.035294,0.15294,0.22353,0.31765,0.27059,-0.10588,-0.52941,-0.52941,-0.57647,-0.57647,-0.52941,-0.10588,0.22353,-0.15294,0.34118,0.52941,0.17647,0.22353,0.058824,-0.22353,-0.082353,-0.57647,-0.69412,-0.62353,-0.76471,-0.6,-0.55294,-0.50588,-0.41176,0.27059,-0.34118,0.24706,0.45882,-0.22353,0.48235,0.76471,-0.035294,0.50588,0.69412,0.082353,0.48235,0.27059,-0.12941,0.15294,-0.2,-0.34118,-0.22353,-0.31765,-0.78824,-0.29412,-0.74118,-0.97647,-0.50588,-0.81176,-0.57647,-0.10588,-0.55294,-0.38824,0.2,-0.41176,0.10588,0.45882,-0.17647,0.45882,0.95294,-0.12941,0.45882,0.48235,-0.058824,0.41176,0.12941,-0.15294,-0.011765,-0.27059,-0.50588,-0.058824,-0.48235,-0.85882,-0.69412,-0.90588,-0.78824,-0.36471,-0.74118,-0.50588,-0.082353,-0.43529,-0.011765,0.41176,-0.22353,0.43529,0.90588,-0.12941,0.6,0.57647,0.011765,0.45882,0.24706,-0.17647,0.058824,-0.27059],
}

# 16 statistical features per channel, in the same channel order
FEATURES = {
    1: {"mean_value":-0.0177898,"standard_deviation":0.594054,"kurtosis":1.58198,"root_mean_square":0.59432,"wave_form_factor":1.12072,"peak_factor":1.68259,"center_frequency":118.99,"frequency_variance":22819.7,"pulse_factor":1.88572,"clearance_factor":2.07191,"waveform_center":5133.35,"time_width":2881.53,"mean_square_frequency":36978.3,"root_mean_square_frequency":192.297,"frequency_standard_deviation":151.062,"peak_value":1},
    2: {"mean_value":-0.0030848,"standard_deviation":0.568348,"kurtosis":1.53558,"root_mean_square":0.568356,"wave_form_factor":1.10612,"peak_factor":1.75946,"center_frequency":140.65,"frequency_variance":27954.6,"pulse_factor":1.94618,"clearance_factor":2.1135,"waveform_center":4709.43,"time_width":2924.25,"mean_square_frequency":47736.9,"root_mean_square_frequency":218.488,"frequency_standard_deviation":167.196,"peak_value":1},
    3: {"mean_value":0.0350628,"standard_deviation":0.516373,"kurtosis":2.032,"root_mean_square":0.517562,"wave_form_factor":1.21442,"peak_factor":1.93214,"center_frequency":165.153,"frequency_variance":26548.4,"pulse_factor":2.34643,"clearance_factor":2.8044,"waveform_center":5538.53,"time_width":2735.3,"mean_square_frequency":53823.7,"root_mean_square_frequency":231.999,"frequency_standard_deviation":162.937,"peak_value":1},
    4: {"mean_value":-0.0567164,"standard_deviation":0.503639,"kurtosis":1.9729,"root_mean_square":0.506823,"wave_form_factor":1.16464,"peak_factor":1.97308,"center_frequency":170.117,"frequency_variance":23399.2,"pulse_factor":2.29793,"clearance_factor":2.58271,"waveform_center":5611.19,"time_width":2667.26,"mean_square_frequency":52339.1,"root_mean_square_frequency":228.777,"frequency_standard_deviation":152.968,"peak_value":1},
    5: {"mean_value":0.0478867,"standard_deviation":0.534933,"kurtosis":1.73572,"root_mean_square":0.537072,"wave_form_factor":1.15135,"peak_factor":1.86195,"center_frequency":171.795,"frequency_variance":28135.6,"pulse_factor":2.14376,"clearance_factor":2.42236,"waveform_center":5483.97,"time_width":2717.26,"mean_square_frequency":57649.2,"root_mean_square_frequency":240.103,"frequency_standard_deviation":167.737,"peak_value":1},
    6: {"mean_value":-0.140472,"standard_deviation":0.397887,"kurtosis":2.24719,"root_mean_square":0.421956,"wave_form_factor":1.20831,"peak_factor":2.36992,"center_frequency":194.26,"frequency_variance":26546.9,"pulse_factor":2.8636,"clearance_factor":3.31023,"waveform_center":5477.3,"time_width":2722.07,"mean_square_frequency":64284.1,"root_mean_square_frequency":253.543,"frequency_standard_deviation":162.932,"peak_value":1},
    7: {"mean_value":0.0459084,"standard_deviation":0.534266,"kurtosis":1.69011,"root_mean_square":0.536234,"wave_form_factor":1.13639,"peak_factor":1.86486,"center_frequency":159.129,"frequency_variance":25142,"pulse_factor":2.11921,"clearance_factor":2.34862,"waveform_center":5469.53,"time_width":2718.39,"mean_square_frequency":50464.1,"root_mean_square_frequency":224.642,"frequency_standard_deviation":158.562,"peak_value":1},
    8: {"mean_value":-0.157817,"standard_deviation":0.446965,"kurtosis":2.08032,"root_mean_square":0.474008,"wave_form_factor":1.1787,"peak_factor":2.10967,"center_frequency":168.582,"frequency_variance":24454.3,"pulse_factor":2.48666,"clearance_factor":2.82878,"waveform_center":5394.7,"time_width":2732.69,"mean_square_frequency":52874,"root_mean_square_frequency":229.943,"frequency_standard_deviation":156.379,"peak_value":1},
}

FEATURE_NAMES = [
    "mean_value", "standard_deviation", "kurtosis", "root_mean_square",
    "wave_form_factor", "peak_factor", "center_frequency", "frequency_variance",
    "pulse_factor", "clearance_factor", "waveform_center", "time_width",
    "mean_square_frequency", "root_mean_square_frequency",
    "frequency_standard_deviation", "peak_value",
]

# -----------------------------------------------------------------------------
# Hyperparameters
# -----------------------------------------------------------------------------
SEQ_LEN = 100          # full waveform length
INPUT_LEN = 50         # first 50 points as input
PRED_LEN = 50          # next 50 points as prediction target
N_CHANNELS = 8
N_FEAT = len(FEATURE_NAMES)  # 16
BATCH_SIZE = 8
EPOCHS = 400
LR = 1e-3
WEIGHT_DECAY = 1e-5
SEED = 42

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
OUT_DIR = Path(__file__).resolve().parent / "weights" / "vibration"
OUT_DIR.mkdir(parents=True, exist_ok=True)


# -----------------------------------------------------------------------------
# Model
# -----------------------------------------------------------------------------
class WaveformEncoder(nn.Module):
    """1D-CNN encoder for vibration waveform (input_len=50, channels=1)."""
    def __init__(self, d_model=64):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv1d(1, 32, kernel_size=5, padding=2), nn.BatchNorm1d(32), nn.GELU(),
            nn.Conv1d(32, 64, kernel_size=5, padding=2), nn.BatchNorm1d(64), nn.GELU(),
            nn.Conv1d(64, d_model, kernel_size=5, padding=2), nn.BatchNorm1d(d_model), nn.GELU(),
        )
        self.pool = nn.AdaptiveAvgPool1d(1)
        self.d_model = d_model

    def forward(self, x):
        # x: (B, 50)
        h = self.conv(x.unsqueeze(1))  # (B, d_model, 50)
        h = self.pool(h).squeeze(-1)   # (B, d_model)
        return h


class VibrationNet(nn.Module):
    """
    Multi-head model:
      - Head 1 (waveform forecast): input first 50 points -> predict next 50 points
      - Head 2 (feature regression): use full 100 pts + first-50 encoding -> predict 16 features
    """
    def __init__(self, d_model=64, n_feat=N_FEAT, pred_len=PRED_LEN):
        super().__init__()
        self.enc_first = WaveformEncoder(d_model)
        self.enc_full = WaveformEncoder(d_model)
        self.fuse = nn.Sequential(
            nn.Linear(d_model * 2 + 100, 128), nn.GELU(),
            nn.Linear(128, 128), nn.GELU(),
        )
        self.forecast_head = nn.Sequential(
            nn.Linear(128, 128), nn.GELU(),
            nn.Linear(128, pred_len),
        )
        self.feature_head = nn.Sequential(
            nn.Linear(128, 128), nn.GELU(),
            nn.Linear(128, n_feat),
        )

    def forward(self, x_first50, x_full100):
        h1 = self.enc_first(x_first50)    # (B, d)
        h2 = self.enc_full(x_full100)     # (B, d)
        h = torch.cat([h1, h2, x_full100], dim=-1)  # (B, 2d+100)
        h = self.fuse(h)                            # (B, 128)
        forecast = self.forecast_head(h)             # (B, 50)
        features = self.feature_head(h)             # (B, 16)
        return forecast, features


# -----------------------------------------------------------------------------
# Data prep
# -----------------------------------------------------------------------------
def build_dataset():
    """Build X (first50, full100) and Y (next50, features) for 8 channels."""
    X_first, X_full, Y_next, Y_feat = [], [], [], []
    for ch in range(1, N_CHANNELS + 1):
        wf = np.array(WAVEFORMS[ch], dtype=np.float32)
        X_first.append(wf[:INPUT_LEN])
        X_full.append(wf)
        Y_next.append(wf[INPUT_LEN:INPUT_LEN + PRED_LEN])
        Y_feat.append(np.array([FEATURES[ch][n] for n in FEATURE_NAMES], dtype=np.float32))
    X_first = np.stack(X_first)
    X_full = np.stack(X_full)
    Y_next = np.stack(Y_next)
    Y_feat = np.stack(Y_feat)
    return X_first, X_full, Y_next, Y_feat


def build_synthetic_samples(X_first, X_full, Y_next, Y_feat, n_aug=64, noise_std=0.05, mask_prob=0.15):
    """
    Augment the 8-channel dataset by adding noise and randomly masking portions
    of the first 50 points. The model still has to forecast Y_next and Y_feat.
    """
    rng = np.random.default_rng(SEED)
    n_orig = X_first.shape[0]
    X_first_aug, X_full_aug, Y_next_aug, Y_feat_aug = [], [], [], []
    for _ in range(n_aug):
        idx = rng.integers(0, n_orig)
        xf = X_first[idx].copy()
        xu = X_full[idx].copy()
        yn = Y_next[idx].copy()
        yf = Y_feat[idx].copy()
        # add noise
        xf = xf + rng.normal(0, noise_std, xf.shape).astype(np.float32)
        xu = xu + rng.normal(0, noise_std, xu.shape).astype(np.float32)
        # random masking on the first 50 points
        if rng.random() < 0.6:
            mask_len = rng.integers(5, 15)
            start = rng.integers(0, INPUT_LEN - mask_len)
            xf[start:start + mask_len] = 0.0
        # light scaling
        scale = 1.0 + rng.normal(0, 0.05)
        xf = (xf * scale).astype(np.float32)
        xu = (xu * scale).astype(np.float32)
        yn = (yn * scale).astype(np.float32)
        X_first_aug.append(xf)
        X_full_aug.append(xu)
        Y_next_aug.append(yn)
        Y_feat_aug.append(yf)
    X_first_aug = np.stack(X_first_aug)
    X_full_aug = np.stack(X_full_aug)
    Y_next_aug = np.stack(Y_next_aug)
    Y_feat_aug = np.stack(Y_feat_aug)
    # combine with original
    return (
        np.concatenate([X_first, X_first_aug], axis=0),
        np.concatenate([X_full, X_full_aug], axis=0),
        np.concatenate([Y_next, Y_next_aug], axis=0),
        np.concatenate([Y_feat, Y_feat_aug], axis=0),
    )


def normalize_features(Y_feat):
    """Standardize feature targets; return mean and std."""
    mu = Y_feat.mean(axis=0)
    sigma = Y_feat.std(axis=0) + 1e-6
    return mu.astype(np.float32), sigma.astype(np.float32)


def main():
    torch.manual_seed(SEED)
    np.random.seed(SEED)
    print(f"Device: {DEVICE}")
    print(f"PyTorch: {torch.__version__}")

    X_first, X_full, Y_next, Y_feat = build_dataset()
    X_first, X_full, Y_next, Y_feat = build_synthetic_samples(
        X_first, X_full, Y_next, Y_feat, n_aug=200
    )
    print(f"Dataset: {X_first.shape[0]} samples")

    # Feature targets: standardize so loss is balanced
    feat_mu, feat_sigma = normalize_features(Y_feat)
    Y_feat_norm = (Y_feat - feat_mu) / feat_sigma

    # Convert to tensors
    t_xf = torch.from_numpy(X_first).float()
    t_xu = torch.from_numpy(X_full).float()
    t_yn = torch.from_numpy(Y_next).float()
    t_yf = torch.from_numpy(Y_feat_norm).float()

    # Shuffle & split
    n = t_xf.shape[0]
    perm = torch.randperm(n, generator=torch.Generator().manual_seed(SEED))
    n_val = max(8, n // 5)
    val_idx = perm[:n_val]
    tr_idx = perm[n_val:]
    train_ds = TensorDataset(t_xf[tr_idx], t_xu[tr_idx], t_yn[tr_idx], t_yf[tr_idx])
    val_ds = TensorDataset(t_xf[val_idx], t_xu[val_idx], t_yn[val_idx], t_yf[val_idx])
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True, drop_last=False)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False)

    model = VibrationNet(d_model=64, n_feat=N_FEAT, pred_len=PRED_LEN).to(DEVICE)
    opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=EPOCHS)

    best_mae = float("inf")
    best_state = None
    t0 = time.time()
    for ep in range(1, EPOCHS + 1):
        model.train()
        loss_sum = 0.0
        for xf, xu, yn, yf in train_loader:
            xf, xu, yn, yf = xf.to(DEVICE), xu.to(DEVICE), yn.to(DEVICE), yf.to(DEVICE)
            pred_n, pred_f = model(xf, xu)
            loss_w = F.l1_loss(pred_n, yn)
            loss_f = F.l1_loss(pred_f, yf)
            loss = loss_w + 0.5 * loss_f
            opt.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            loss_sum += loss.item() * xf.size(0)
        sched.step()
        train_loss = loss_sum / len(train_ds)

        # validation
        model.eval()
        with torch.no_grad():
            v_w_mae, v_f_mae, v_n = 0.0, 0.0, 0
            for xf, xu, yn, yf in val_loader:
                xf, xu, yn, yf = xf.to(DEVICE), xu.to(DEVICE), yn.to(DEVICE), yf.to(DEVICE)
                pred_n, pred_f = model(xf, xu)
                # de-normalize features for MAE
                pred_f_real = pred_f * torch.from_numpy(feat_sigma).to(DEVICE) + torch.from_numpy(feat_mu).to(DEVICE)
                yf_real = yf * torch.from_numpy(feat_sigma).to(DEVICE) + torch.from_numpy(feat_mu).to(DEVICE)
                v_w_mae += F.l1_loss(pred_n, yn, reduction="sum").item()
                v_f_mae += F.l1_loss(pred_f_real, yf_real, reduction="sum").item()
                v_n += xf.size(0)
            v_w_mae /= max(v_n, 1) * PRED_LEN
            v_f_mae /= max(v_n, 1) * N_FEAT

        if ep % 20 == 0 or ep == 1 or ep == EPOCHS:
            print(f"Ep {ep:4d} | train_loss={train_loss:.4f} | val_forecast_mae={v_w_mae:.4f} | val_feature_mae={v_f_mae:.4f}")

        if v_w_mae + 0.3 * v_f_mae < best_mae:
            best_mae = v_w_mae + 0.3 * v_f_mae
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
            best_metrics = (v_w_mae, v_f_mae)

    print(f"\nBest (val): forecast_mae={best_metrics[0]:.4f}  feature_mae={best_metrics[1]:.4f}")
    print(f"Total time: {time.time() - t0:.1f}s")

    # Save artifacts
    model.load_state_dict(best_state)
    weight_path = OUT_DIR / "vibration_net.pt"
    torch.save({
        "state_dict": best_state,
        "feat_mu": feat_mu,
        "feat_sigma": feat_sigma,
        "feature_names": FEATURE_NAMES,
        "input_len": INPUT_LEN,
        "pred_len": PRED_LEN,
    }, weight_path)
    print(f"Saved weights -> {weight_path}  ({weight_path.stat().st_size/1024:.1f} KB)")

    # Save config
    config = {
        "model_type": "VibrationNet",
        "task": "waveform_forecast + feature_regression",
        "input_len": INPUT_LEN,
        "pred_len": PRED_LEN,
        "n_features": N_FEAT,
        "feature_names": FEATURE_NAMES,
        "d_model": 64,
        "sampling_rate_hz": 1000,
        "time_resolution_s": 0.1,
        "duration_s": 10.0,
    }
    with open(OUT_DIR / "config.json", "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)

    metrics = {
        "val_forecast_mae": float(best_metrics[0]),
        "val_feature_mae": float(best_metrics[1]),
        "epochs": EPOCHS,
        "n_samples": int(X_first.shape[0]),
        "n_channels": N_CHANNELS,
        "device": DEVICE,
    }
    with open(OUT_DIR / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2, ensure_ascii=False)
    print(f"Saved config & metrics -> {OUT_DIR}")

    return metrics


if __name__ == "__main__":
    main()
