# -*- coding: utf-8 -*-
"""
Supabase Storage / Database 工具模块
====================================
用于:
- 上传训练好的模型权重到 Storage 桶 ml-models
- 写训练元数据到 ml_models 表
- 写预测结果到 ml_predictions 表
- 写训练历史到 ml_training_history 表
- 拉取已训练好的权重(用于推理)

作者: TRAE AI Assistant
日期: 2026-06-20
"""
import os
import io
import json
import time
import requests
import numpy as np

SUPABASE_URL = "https://sjjosdferbbnqcejjfqi.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqam9zZGZlcmJibnFjZWpqZnFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MDIxNTcsImV4cCI6MjA4Mzk3ODE1N30.aG_4vnzeYMcgF0077hEqGpsOuNxzCHAMD7de-XpAUmk"

HEADERS_JSON = {
    'apikey': ANON_KEY,
    'Authorization': f'Bearer {ANON_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
}

HEADERS_BINARY_UPLOAD = {
    'apikey': ANON_KEY,
    'Authorization': f'Bearer {ANON_KEY}',
    'Content-Type': 'application/octet-stream',
    'x-upsert': 'true',
}

STORAGE_BUCKET = 'ml-models'


# ==================== Storage (上传/下载权重) ====================

def upload_weight(local_path, storage_path):
    """上传 .pth 权重文件到 Supabase Storage"""
    with open(local_path, 'rb') as f:
        data = f.read()
    url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{storage_path}"
    r = requests.post(url, headers=HEADERS_BINARY_UPLOAD, data=data, timeout=120)
    r.raise_for_status()
    return r.json()


def download_weight(storage_path, save_to=None):
    """从 Supabase Storage 下载权重文件"""
    url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{storage_path}"
    r = requests.get(url, headers={
        'apikey': ANON_KEY, 'Authorization': f'Bearer {ANON_KEY}'
    }, timeout=120)
    r.raise_for_status()
    data = r.content
    if save_to:
        with open(save_to, 'wb') as f:
            f.write(data)
        return save_to
    return data


def weight_exists(storage_path):
    """检查 Storage 上是否存在某权重"""
    url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{storage_path}"
    r = requests.head(url, headers={
        'apikey': ANON_KEY, 'Authorization': f'Bearer {ANON_KEY}'
    }, timeout=30)
    return r.status_code == 200


# ==================== Database (写元数据) ====================

def insert_model(model_name, model_type, version, storage_path, config, metrics,
                 file_size_bytes, notes=None):
    """注册一个新训练的模型到 ml_models 表"""
    payload = {
        'model_name': model_name,
        'model_type': model_type,
        'version': version,
        'storage_path': storage_path,
        'config': config,
        'metrics': metrics,
        'file_size_bytes': file_size_bytes,
        'is_active': True,
        'notes': notes,
    }
    r = requests.post(f"{SUPABASE_URL}/rest/v1/ml_models",
                      headers=HEADERS_JSON, data=json.dumps(payload), timeout=30)
    r.raise_for_status()
    rows = r.json()
    return rows[0]['id'] if rows else None


def deactivate_old_models(model_name, keep_id):
    """标记某模型名的其他版本为非激活"""
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/ml_models?model_name=eq.{model_name}&id=neq.{keep_id}",
        headers={**HEADERS_JSON, 'Prefer': 'return=minimal'},
        data=json.dumps({'is_active': False}), timeout=30)
    r.raise_for_status()
    return True


def insert_training_history(model_name, training_type, started_at, duration_sec,
                            n_samples, n_entities, metrics, data_summary,
                            model_id=None, status='completed', notes=None):
    """写一条训练历史记录"""
    payload = {
        'model_name': model_name,
        'model_id': model_id,
        'training_type': training_type,
        'started_at': started_at,
        'finished_at': 'now()',
        'duration_sec': duration_sec,
        'n_samples': n_samples,
        'n_entities': n_entities,
        'metrics': metrics,
        'data_summary': data_summary,
        'status': status,
        'notes': notes,
    }
    r = requests.post(f"{SUPABASE_URL}/rest/v1/ml_training_history",
                      headers=HEADERS_JSON, data=json.dumps(payload), timeout=30)
    r.raise_for_status()
    rows = r.json()
    return rows[0]['id'] if rows else None


def insert_prediction(model_id, model_name, target_type, target_id, prediction_date,
                      forecast_steps, forecast_values, lower_bound=None, upper_bound=None,
                      historical=None):
    """写一条预测结果到 ml_predictions 表"""
    payload = {
        'model_id': model_id,
        'model_name': model_name,
        'target_type': target_type,
        'target_id': str(target_id),
        'prediction_date': prediction_date,
        'forecast_steps': forecast_steps,
        'forecast_values': forecast_values,
        'lower_bound': lower_bound,
        'upper_bound': upper_bound,
        'historical': historical,
    }
    r = requests.post(f"{SUPABASE_URL}/rest/v1/ml_predictions",
                      headers=HEADERS_JSON, data=json.dumps(payload), timeout=30)
    r.raise_for_status()
    rows = r.json()
    return rows[0]['id'] if rows else None


def get_active_model(model_name):
    """查询某个模型名的当前激活版本"""
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/ml_models?model_name=eq.{model_name}&is_active=eq.true&order=trained_at.desc&limit=1",
        headers=HEADERS_JSON, timeout=30)
    r.raise_for_status()
    rows = r.json()
    return rows[0] if rows else None


def get_latest_predictions(model_name, target_id, limit=5):
    """查询某传感器/点的最近几次预测"""
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/ml_predictions?model_name=eq.{model_name}&target_id=eq.{target_id}&order=prediction_date.desc&limit={limit}",
        headers=HEADERS_JSON, timeout=30)
    r.raise_for_status()
    return r.json()


# ==================== 自测 ====================

if __name__ == '__main__':
    print(f"Supabase: {SUPABASE_URL}")
    print(f"\n1. 查询当前激活的 informer 模型:")
    m = get_active_model('informer')
    print(f"   {'存在' if m else '未找到'}: {m.get('version') if m else '-'}")

    print(f"\n2. 查询 S1 的最近预测:")
    preds = get_latest_predictions('informer', 'S1', 3)
    print(f"   找到 {len(preds)} 条")
    for p in preds[:2]:
        print(f"   - {p['prediction_date']}: {len(p['forecast_values'])} 步预测")
