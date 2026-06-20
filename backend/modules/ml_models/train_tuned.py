# -*- coding: utf-8 -*-
"""
超参调优训练 (第二轮)
====================
针对第一轮的问题优化:
- Informer: 加学习率调度(CosineAnnealing) + 权重衰减 + 更多epochs
- PINN: 调小物理权重(0.1->0.01) + 更长训练(200->400) + 更小学习率(0.001->0.0005)
- STGCN: 已最优(MAE=0.338), 保持不变, 仅重新加载验证

作者: TRAE AI Assistant
日期: 2026-06-20
"""
import os
import sys
import json
import time
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from datetime import datetime
from sklearn.preprocessing import StandardScaler

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, 'data')
MODEL_DIR = os.path.join(SCRIPT_DIR, 'trained_models')
REPORT_DIR = os.path.join(SCRIPT_DIR, 'reports')
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(REPORT_DIR, exist_ok=True)

sys.path.insert(0, os.path.dirname(SCRIPT_DIR))
from ml_models.informer_predictor import Informer
from ml_models.pinn_predictor import PINN

DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')


def load_features():
    """加载并构建多源特征 (复用第一轮逻辑)"""
    settlement = pd.read_csv(os.path.join(DATA_DIR, 'settlement.csv'))
    settlement['measurement_date'] = pd.to_datetime(settlement['measurement_date'])
    temperature = pd.read_csv(os.path.join(DATA_DIR, 'temperature.csv'))
    temperature['measurement_date'] = pd.to_datetime(temperature['measurement_date'])
    crack = pd.read_csv(os.path.join(DATA_DIR, 'crack.csv'))
    crack['measurement_date'] = pd.to_datetime(crack['measurement_date'])

    temp_weekly = temperature.copy()
    temp_weekly['week'] = temp_weekly['measurement_date'].dt.isocalendar().week
    temp_weekly['year'] = temp_weekly['measurement_date'].dt.year
    temp_avg = temp_weekly.groupby(['year', 'week'])['avg_temperature'].mean().reset_index()
    temp_avg['date'] = pd.to_datetime(
        temp_avg['year'].astype(str) + '-' + temp_avg['week'].astype(str) + '-1',
        format='%Y-%W-%w', errors='coerce')

    crack_weekly = crack.copy()
    crack_weekly['crack_mean'] = crack_weekly.select_dtypes(include=[np.number]).mean(axis=1)
    crack_weekly['week'] = crack_weekly['measurement_date'].dt.isocalendar().week
    crack_weekly['year'] = crack_weekly['measurement_date'].dt.year
    crack_avg = crack_weekly.groupby(['year', 'week'])['crack_mean'].mean().reset_index()
    crack_avg['date'] = pd.to_datetime(
        crack_avg['year'].astype(str) + '-' + crack_avg['week'].astype(str) + '-1',
        format='%Y-%W-%w', errors='coerce')

    point_features = {}
    point_ids = sorted(settlement['point_id'].unique())
    for pid in point_ids:
        pdf = settlement[settlement['point_id'] == pid].sort_values('measurement_date').copy()
        pdf = pdf.rename(columns={'measurement_date': 'date', 'cumulative_change': 'settlement'})
        pdf['date'] = pd.to_datetime(pdf['date'])
        pdf['week'] = pdf['date'].dt.isocalendar().week
        pdf['year'] = pdf['date'].dt.year
        pdf = pdf.merge(temp_avg[['year', 'week', 'avg_temperature']], on=['year', 'week'], how='left')
        pdf = pdf.merge(crack_avg[['year', 'week', 'crack_mean']], on=['year', 'week'], how='left')
        pdf['avg_temperature'] = pdf['avg_temperature'].ffill().bfill().fillna(20.0)
        pdf['crack_mean'] = pdf['crack_mean'].ffill().bfill().fillna(0.0)
        pdf['week_idx'] = np.arange(len(pdf), dtype=float)
        point_features[pid] = pdf[['date', 'settlement', 'avg_temperature', 'crack_mean', 'week_idx']].reset_index(drop=True)
    return point_features, point_ids


# ==================== Informer 调优 ====================

def train_informer_v2(point_features, point_ids):
    print("\n" + "=" * 60)
    print("[调优] Informer v2 (CosineLR + WeightDecay + 150 epochs)")
    print("=" * 60)

    SEQ_LEN, PRED_LEN, LABEL_LEN = 24, 8, 12
    FEATURES = ['settlement', 'avg_temperature', 'crack_mean', 'week_idx']
    N_FEATURES = len(FEATURES)

    model = Informer(
        enc_in=N_FEATURES, dec_in=N_FEATURES, c_out=1,
        seq_len=SEQ_LEN, label_len=LABEL_LEN, out_len=PRED_LEN,
        d_model=128, n_heads=4, e_layers=2, d_layers=1,
        d_ff=256, dropout=0.15  # 略增 dropout 防过拟合
    ).to(DEVICE)

    # 优化: Adam + 权重衰减
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001, weight_decay=1e-4)
    # 优化: 余弦退火学习率
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=150, eta_min=1e-5)
    criterion = nn.MSELoss()

    all_samples = []
    scaler_dict = {}
    for pid in point_ids:
        df = point_features[pid]
        values = df[FEATURES].values.astype(np.float32)
        scaler = StandardScaler()
        values_norm = scaler.fit_transform(values)
        scaler_dict[pid] = scaler
        n = len(values_norm) - SEQ_LEN - PRED_LEN + 1
        for i in range(n):
            x_enc = values_norm[i:i + SEQ_LEN]
            x_dec_start = values_norm[i + SEQ_LEN - LABEL_LEN:i + SEQ_LEN]
            x_dec_end = np.zeros((PRED_LEN, N_FEATURES), dtype=np.float32)
            x_dec = np.vstack([x_dec_start, x_dec_end])
            y = values_norm[i + SEQ_LEN:i + SEQ_LEN + PRED_LEN, 0]
            all_samples.append((x_enc, x_dec, y, pid))

    print(f"  样本数: {len(all_samples)}")
    EPOCHS, BATCH_SIZE = 150, 16
    best_loss = float('inf')
    t0 = time.time()

    for epoch in range(EPOCHS):
        model.train()
        np.random.shuffle(all_samples)
        epoch_loss, n_batches = 0, 0
        for i in range(0, len(all_samples), BATCH_SIZE):
            batch = all_samples[i:i + BATCH_SIZE]
            x_enc = torch.FloatTensor(np.array([s[0] for s in batch])).to(DEVICE)
            x_dec = torch.FloatTensor(np.array([s[1] for s in batch])).to(DEVICE)
            y = torch.FloatTensor(np.array([s[2] for s in batch])).unsqueeze(-1).to(DEVICE)
            optimizer.zero_grad()
            pred = model(x_enc, x_dec)
            loss = criterion(pred, y)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)  # 梯度裁剪
            optimizer.step()
            epoch_loss += loss.item()
            n_batches += 1
        scheduler.step()
        avg_loss = epoch_loss / n_batches
        if avg_loss < best_loss:
            best_loss = avg_loss
            torch.save(model.state_dict(), os.path.join(MODEL_DIR, 'informer_best.pth'))
        if (epoch + 1) % 15 == 0:
            print(f"  Epoch {epoch+1}/{EPOCHS}, Loss: {avg_loss:.6f}, LR: {scheduler.get_last_lr()[0]:.2e}")

    model.load_state_dict(torch.load(os.path.join(MODEL_DIR, 'informer_best.pth')))
    model.eval()
    metrics = _eval_informer(model, point_features, point_ids, scaler_dict, SEQ_LEN, PRED_LEN, LABEL_LEN, FEATURES)
    elapsed = time.time() - t0
    print(f"  完成 ({elapsed:.1f}s), MAE={metrics['MAE']:.4f}, RMSE={metrics['RMSE']:.4f}")

    config = {'model': 'informer', 'seq_len': SEQ_LEN, 'pred_len': PRED_LEN, 'label_len': LABEL_LEN,
              'features': FEATURES, 'd_model': 128, 'epochs': EPOCHS, 'device': str(DEVICE),
              'train_time_sec': round(elapsed, 1), 'version': 'v2', 'optimizer': 'Adam+CosineLR+WeightDecay'}
    with open(os.path.join(MODEL_DIR, 'informer_config.json'), 'w') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    with open(os.path.join(MODEL_DIR, 'informer_metrics.json'), 'w') as f:
        json.dump(metrics, f, indent=2)
    return metrics


def _eval_informer(model, point_features, point_ids, scaler_dict, seq_len, pred_len, label_len, features):
    all_preds, all_targets = [], []
    n_feat = len(features)
    with torch.no_grad():
        for pid in point_ids:
            df = point_features[pid]
            scaler = scaler_dict[pid]
            values = df[features].values.astype(np.float32)
            values_norm = scaler.transform(values)
            if len(values_norm) < seq_len + pred_len:
                continue
            x_enc = values_norm[-seq_len - pred_len:-pred_len]
            x_dec_start = values_norm[-seq_len - pred_len + seq_len - label_len:-pred_len]
            x_dec_end = np.zeros((pred_len, n_feat), dtype=np.float32)
            x_dec = np.vstack([x_dec_start, x_dec_end])
            y_true = values_norm[-pred_len:, 0]
            x_enc_t = torch.FloatTensor(x_enc).unsqueeze(0).to(DEVICE)
            x_dec_t = torch.FloatTensor(x_dec).unsqueeze(0).to(DEVICE)
            pred = model(x_enc_t, x_dec_t).squeeze().cpu().numpy()
            pred_full = np.zeros((pred_len, n_feat)); pred_full[:, 0] = pred
            true_full = np.zeros((pred_len, n_feat)); true_full[:, 0] = y_true
            all_preds.append(scaler.inverse_transform(pred_full)[:, 0])
            all_targets.append(scaler.inverse_transform(true_full)[:, 0])
    all_preds = np.concatenate(all_preds); all_targets = np.concatenate(all_targets)
    return {'MAE': float(np.mean(np.abs(all_preds - all_targets))),
            'RMSE': float(np.sqrt(np.mean((all_preds - all_targets) ** 2))),
            'MAPE': float(np.mean(np.abs((all_preds - all_targets) / (all_targets + 1e-8))) * 100)}


# ==================== PINN 调优 ====================

def train_pinn_v2(point_features, point_ids):
    print("\n" + "=" * 60)
    print("[调优] PINN v2 (物理权重0.01 + 400 epochs + LR=5e-4)")
    print("=" * 60)

    FEATURES = ['week_idx', 'avg_temperature', 'crack_mean']
    N_FEATURES = len(FEATURES)

    model = PINN(input_dim=N_FEATURES, hidden_dims=[128, 256, 256, 128, 64],
                 output_dim=1, activation='tanh').to(DEVICE)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.0005, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=400, eta_min=1e-6)
    data_criterion = nn.MSELoss()

    all_X, all_y, all_scalers = [], [], []
    for pid in point_ids:
        df = point_features[pid]
        sc_feat = StandardScaler()
        sc_target = StandardScaler()
        X = sc_feat.fit_transform(df[FEATURES].values.astype(np.float32))
        y = sc_target.fit_transform(df[['settlement']].values.astype(np.float32)).flatten()
        all_X.append(X); all_y.append(y); all_scalers.append((sc_feat, sc_target))

    X_all = np.vstack(all_X); y_all = np.concatenate(all_y)
    print(f"  样本数: {len(X_all)}")
    X_tensor = torch.FloatTensor(X_all).to(DEVICE)
    y_tensor = torch.FloatTensor(y_all).unsqueeze(-1).to(DEVICE)

    EPOCHS = 400
    PHYSICS_WEIGHT = 0.01  # 关键: 从0.1降到0.01, 让数据拟合主导
    best_loss = float('inf')
    t0 = time.time()

    for epoch in range(EPOCHS):
        model.train()
        optimizer.zero_grad()
        y_pred = model(X_tensor)
        data_loss = data_criterion(y_pred, y_tensor)

        # 物理损失: 单调性 (更温和的约束)
        physics_loss = torch.tensor(0.0, device=DEVICE)
        offset = 0
        for pid in point_ids:
            n = len(point_features[pid])
            pred_point = y_pred[offset:offset + n].squeeze()
            diff = pred_point[1:] - pred_point[:-1]
            # 只惩罚二阶差分(加速度), 允许一阶变化
            physics_loss = physics_loss + torch.mean(torch.abs(diff[1:] - diff[:-1]))
            offset += n
        physics_loss = physics_loss / len(point_ids)

        total_loss = data_loss + PHYSICS_WEIGHT * physics_loss
        total_loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        scheduler.step()

        if total_loss.item() < best_loss:
            best_loss = total_loss.item()
            torch.save(model.state_dict(), os.path.join(MODEL_DIR, 'pinn_best.pth'))
        if (epoch + 1) % 40 == 0:
            print(f"  Epoch {epoch+1}/{EPOCHS}, Data: {data_loss.item():.6f}, "
                  f"Phys: {physics_loss.item():.6f}, Total: {total_loss.item():.6f}")

    model.load_state_dict(torch.load(os.path.join(MODEL_DIR, 'pinn_best.pth')))
    model.eval()
    metrics = _eval_pinn(model, point_features, point_ids, all_scalers, FEATURES)
    elapsed = time.time() - t0
    print(f"  完成 ({elapsed:.1f}s), MAE={metrics['MAE']:.4f}, RMSE={metrics['RMSE']:.4f}")

    config = {'model': 'pinn', 'features': FEATURES, 'hidden_dims': [128, 256, 256, 128, 64],
              'epochs': EPOCHS, 'physics_weight': PHYSICS_WEIGHT, 'device': str(DEVICE),
              'train_time_sec': round(elapsed, 1), 'version': 'v2', 'optimizer': 'Adam+CosineLR'}
    with open(os.path.join(MODEL_DIR, 'pinn_config.json'), 'w') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    with open(os.path.join(MODEL_DIR, 'pinn_metrics.json'), 'w') as f:
        json.dump(metrics, f, indent=2)
    return metrics


def _eval_pinn(model, point_features, point_ids, scalers, features):
    all_preds, all_targets = [], []
    PRED_LEN = 8
    with torch.no_grad():
        for i, pid in enumerate(point_ids):
            df = point_features[pid]
            sc_feat, sc_target = scalers[i]
            n = len(df)
            test_start = n - PRED_LEN
            X_test = sc_feat.transform(df[features].values[test_start:].astype(np.float32))
            X_t = torch.FloatTensor(X_test).to(DEVICE)
            pred = model(X_t).squeeze().cpu().numpy()
            pred_denorm = sc_target.inverse_transform(pred.reshape(-1, 1)).flatten()
            true_denorm = df['settlement'].values[test_start:]
            all_preds.append(pred_denorm); all_targets.append(true_denorm)
    all_preds = np.concatenate(all_preds); all_targets = np.concatenate(all_targets)
    return {'MAE': float(np.mean(np.abs(all_preds - all_targets))),
            'RMSE': float(np.sqrt(np.mean((all_preds - all_targets) ** 2))),
            'MAPE': float(np.mean(np.abs((all_preds - all_targets) / (all_targets + 1e-8))) * 100)}


# ==================== 主函数 ====================

def main():
    print("=" * 70)
    print("  超参调优训练 (第二轮)")
    print(f"  设备: {DEVICE} | PyTorch: {torch.__version__}")
    if DEVICE.type == 'cuda':
        print(f"  GPU: {torch.cuda.get_device_name(0)}")
    print("=" * 70)

    # 读取第一轮指标作为对比基线
    v1_metrics = {}
    for name in ['informer', 'pinn']:
        path = os.path.join(MODEL_DIR, f'{name}_metrics.json')
        if os.path.exists(path):
            with open(path) as f:
                v1_metrics[name] = json.load(f)

    point_features, point_ids = load_features()
    print(f"  数据: {len(point_ids)} 个监测点, 每点 {len(next(iter(point_features.values())))} 周")

    start = time.time()
    results = {}
    results['informer'] = train_informer_v2(point_features, point_ids)
    results['pinn'] = train_pinn_v2(point_features, point_ids)

    # STGCN 保持第一轮结果
    stgcn_path = os.path.join(MODEL_DIR, 'stgcn_metrics.json')
    if os.path.exists(stgcn_path):
        with open(stgcn_path) as f:
            results['stgcn'] = json.load(f)

    elapsed = time.time() - start

    # 对比报告
    print("\n" + "=" * 70)
    print("  调优结果对比")
    print("=" * 70)
    print(f"{'模型':<12} {'v1 MAE':>10} {'v2 MAE':>10} {'v1 RMSE':>10} {'v2 RMSE':>10} {'变化':>10}")
    for name in ['informer', 'pinn']:
        v1 = v1_metrics.get(name, {})
        v2 = results[name]
        v1_mae = v1.get('MAE', 0); v2_mae = v2['MAE']
        change = ((v2_mae - v1_mae) / v1_mae * 100) if v1_mae > 0 else 0
        print(f"{name.upper():<12} {v1_mae:>10.4f} {v2_mae:>10.4f} "
              f"{v1.get('RMSE', 0):>10.4f} {v2['RMSE']:>10.4f} {change:>9.1f}%")

    # 更新报告
    best = min(results, key=lambda k: results[k]['MAE'])
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    report = f"""# 深度学习模型训练评估报告 (第二轮调优)

**生成时间**: {ts}
**训练环境**: {str(DEVICE)} (PyTorch {torch.__version__})
**数据来源**: Supabase (dt-terrain-settlement-dev)
**数据规模**: 25 个监测点, 每点 52 周沉降记录

## 模型性能对比 (第二轮)

| 模型 | MAE (mm) | RMSE (mm) | MAPE (%) | 版本 |
|------|----------|-----------|----------|------|
"""
    for name in ['informer', 'stgcn', 'pinn']:
        m = results[name]
        ver = 'v2调优' if name in ['informer', 'pinn'] else 'v1(未变)'
        report += f"| {name.upper()} | {m['MAE']:.4f} | {m['RMSE']:.4f} | {m['MAPE']:.2f} | {ver} |\n"

    report += f"""
## 调优说明

### Informer v2
- 新增: CosineAnnealing 学习率调度 (0.001 -> 1e-5)
- 新增: 权重衰减 (1e-4) + 梯度裁剪 (1.0)
- 调整: epochs 80 -> 150, dropout 0.1 -> 0.15
- v1 MAE: {v1_metrics.get('informer', {}).get('MAE', 0):.4f} -> v2 MAE: {results['informer']['MAE']:.4f}

### PINN v2
- 关键: 物理损失权重 0.1 -> 0.01 (让数据拟合主导)
- 新增: 更深网络 [128,256,256,128,64] + CosineLR + 梯度裁剪
- 调整: epochs 200 -> 400, LR 0.001 -> 0.0005
- v1 MAE: {v1_metrics.get('pinn', {}).get('MAE', 0):.4f} -> v2 MAE: {results['pinn']['MAE']:.4f}

### STGCN
- 保持第一轮结果 (MAE={results['stgcn']['MAE']:.4f}, 已最优)

## 最佳模型: {best.upper()} (MAE = {results[best]['MAE']:.4f} mm)

## API 端点
- `GET /api/ml/dl/status` - 查询模型状态
- `GET /api/ml/dl/predict/informer/<point_id>` - Informer 预测
- `GET /api/ml/dl/predict/stgcn` - STGCN 多点预测
- `GET /api/ml/dl/predict/pinn/<point_id>` - PINN 预测
"""
    report_path = os.path.join(REPORT_DIR, 'training_report.md')
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)
    print(f"\n  报告已更新: {report_path}")
    print(f"  总耗时: {elapsed:.1f}s")


if __name__ == '__main__':
    main()
