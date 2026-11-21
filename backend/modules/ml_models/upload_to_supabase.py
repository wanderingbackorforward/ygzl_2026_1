# -*- coding: utf-8 -*-
"""
把本地 trained_models/ 下已训练好的所有模型上传到 Supabase
=============================================================
- 权重 → Supabase Storage 桶 ml-models
- 配置/指标 → ml_models 表
- 训练历史 → ml_training_history 表

适用于所有模型, 包括之前已经训练但没上传的:
- informer (沉降, 25 点 × 52 周)
- stgcn (沉降, 25 点联合)
- pinn (沉降, 25 点)
- temperature (温度, 251 传感器共享)

作者: TRAE AI Assistant
日期: 2026-06-20
"""
import os
import sys
import json
import time
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
import supabase_store

MODEL_DIR = os.path.join(SCRIPT_DIR, 'trained_models')

# 模型注册信息
MODELS = [
    {
        'name': 'informer',
        'type': 'Informer',
        'weight': 'informer_best.pth',
        'config': 'informer_config.json',
        'metrics': 'informer_metrics.json',
        'notes': '25 监测点 × 52 周沉降, MAE=0.329mm (v2 调优)',
        'data_summary': {
            'data_source': 'Supabase.processed_settlement_data',
            'n_rows': 1300, 'n_entities': 25,
            'date_range': '2021-01-01 ~ 2021-12-24',
            'frequency': 'weekly',
            'features': ['settlement', 'avg_temperature', 'crack_mean', 'week_idx'],
        },
    },
    {
        'name': 'stgcn',
        'type': 'STGCN',
        'weight': 'stgcn_best.pth',
        'config': 'stgcn_config.json',
        'metrics': 'stgcn_metrics.json',
        'notes': '25 监测点联合训练, MAE=0.338mm (最佳)',
        'data_summary': {
            'data_source': 'Supabase.processed_settlement_data',
            'n_rows': 1300, 'n_entities': 25,
            'date_range': '2021-01-01 ~ 2021-12-24',
            'frequency': 'weekly',
            'features': ['settlement'],
        },
    },
    {
        'name': 'pinn',
        'type': 'PINN',
        'weight': 'pinn_best.pth',
        'config': 'pinn_config.json',
        'metrics': 'pinn_metrics.json',
        'notes': '物理信息神经网络, Terzaghi 固结约束, MAE=0.969mm',
        'data_summary': {
            'data_source': 'Supabase.processed_settlement_data',
            'n_rows': 1300, 'n_entities': 25,
            'date_range': '2021-01-01 ~ 2021-12-24',
            'frequency': 'weekly',
            'features': ['week_idx', 'avg_temperature', 'crack_mean'],
        },
    },
    {
        'name': 'temperature',
        'type': 'MultiTaskInformer',
        'weight': 'temperature_best.pth',
        'config': 'temperature_config.json',
        'metrics': 'temperature_metrics.json',
        'notes': '251 传感器共享 Informer + 传感器 ID 嵌入, MAE=0.10°C',
        'data_summary': {
            'data_source': 'Supabase.processed_temperature_data',
            'n_rows': 3175, 'n_entities': 251,
            'date_range': '2024-08-10 ~ 2024-08-29',
            'frequency': 'daily',
            'features': ['avg_temperature', 'min_temperature', 'max_temperature',
                         'std_temperature', 'temperature_range'],
        },
    },
]


def upload_one(m):
    name = m['name']
    weight_path = os.path.join(MODEL_DIR, m['weight'])
    if not os.path.exists(weight_path):
        print(f"  [SKIP] {name}: 权重文件不存在 ({m['weight']})")
        return None

    # 读配置和指标
    cfg = {}
    cfg_path = os.path.join(MODEL_DIR, m['config'])
    if os.path.exists(cfg_path):
        with open(cfg_path) as f:
            cfg = json.load(f)

    metrics = {}
    metrics_path = os.path.join(MODEL_DIR, m['metrics'])
    if os.path.exists(metrics_path):
        with open(metrics_path) as f:
            metrics = json.load(f)

    file_size = os.path.getsize(weight_path)
    version = f"v{datetime.now().strftime('%Y%m%d_%H%M%S')}_{name}"
    storage_path = f"{name}/{version}.pth"

    # 1. 上传权重
    print(f"  1. 上传权重: storage/{storage_path} ({file_size} bytes)")
    try:
        supabase_store.upload_weight(weight_path, storage_path)
        print(f"     OK")
    except Exception as e:
        print(f"     FAIL: {e}")
        return None

    # 2. 写 ml_models 表
    print(f"  2. 注册到 ml_models 表")
    try:
        model_id = supabase_store.insert_model(
            model_name=name,
            model_type=m['type'],
            version=version,
            storage_path=storage_path,
            config=cfg,
            metrics=metrics,
            file_size_bytes=file_size,
            notes=m['notes'],
        )
        print(f"     OK (model_id={model_id})")
    except Exception as e:
        print(f"     FAIL: {e}")
        return None

    # 3. 写训练历史
    print(f"  3. 写训练历史到 ml_training_history")
    try:
        history_id = supabase_store.insert_training_history(
            model_name=name,
            model_id=model_id,
            training_type=m['type'].lower(),
            started_at=cfg.get('train_time_sec', 0) and
                        datetime.fromtimestamp(time.time() - cfg['train_time_sec']).isoformat(),
            duration_sec=cfg.get('train_time_sec', 0),
            n_samples=m['data_summary'].get('n_rows', 0),
            n_entities=m['data_summary'].get('n_entities', 0),
            metrics=metrics,
            data_summary=m['data_summary'],
            notes=m['notes'],
        )
        print(f"     OK (history_id={history_id})")
    except Exception as e:
        print(f"     [WARN] {e}")

    return model_id


def main():
    print("=" * 70)
    print("  批量上传训练好的模型到 Supabase")
    print(f"  Storage: ml-models 桶")
    print(f"  Database: ml_models / ml_training_history")
    print("=" * 70)

    success = []
    for m in MODELS:
        print(f"\n[{m['name'].upper()}]")
        mid = upload_one(m)
        if mid:
            success.append(m['name'])

    print("\n" + "=" * 70)
    print(f"  上传完成! 成功: {len(success)}/{len(MODELS)}")
    for n in success:
        print(f"   - {n}")
    print("=" * 70)


if __name__ == '__main__':
    main()
