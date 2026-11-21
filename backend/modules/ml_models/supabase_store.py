# -*- coding: utf-8 -*-
"""
模型权重存储 + 训练元数据（MySQL 本地版）
=========================================
- 权重文件存服务器本地目录（默认 backend/ml_artifacts），不再依赖 Supabase Storage
- 元数据表 ml_models / ml_predictions / ml_training_history 走 MySQL 兼容层
"""
import os
import sys
import json
import shutil

_BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)
try:
    from modules.db.http_compat import requests  # 本地/云端 MySQL 兼容层
except ImportError:
    import requests

# 兼容层只认 /rest/v1/，这里的域名仅作占位
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'http://127.0.0.1')
ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', 'local')

HEADERS_JSON = {
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
}

STORAGE_BUCKET = 'ml-models'
ARTIFACT_DIR = os.environ.get(
    'ML_ARTIFACT_DIR',
    os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'ml_artifacts')),
)


def _local_path(storage_path):
    safe = str(storage_path).replace('\\', '/').lstrip('/')
    path = os.path.abspath(os.path.join(ARTIFACT_DIR, STORAGE_BUCKET, safe))
    if not path.startswith(os.path.abspath(ARTIFACT_DIR)):
        raise ValueError(f'illegal storage path: {storage_path}')
    return path


# ==================== Storage (本地权重文件) ====================

def upload_weight(local_path, storage_path):
    dest = _local_path(storage_path)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    shutil.copyfile(local_path, dest)
    return {'Key': storage_path, 'size': os.path.getsize(dest)}


def download_weight(storage_path, save_to=None):
    src = _local_path(storage_path)
    if save_to:
        os.makedirs(os.path.dirname(os.path.abspath(save_to)) or '.', exist_ok=True)
        shutil.copyfile(src, save_to)
        return save_to
    with open(src, 'rb') as f:
        return f.read()


def weight_exists(storage_path):
    return os.path.exists(_local_path(storage_path))


# ==================== Database (写元数据) ====================

def insert_model(model_name, model_type, version, storage_path, config, metrics,
                 file_size_bytes, notes=None):
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
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/ml_models?model_name=eq.{model_name}&id=neq.{keep_id}",
        headers={**HEADERS_JSON, 'Prefer': 'return=minimal'},
        data=json.dumps({'is_active': False}), timeout=30)
    r.raise_for_status()
    return True


def insert_training_history(model_name, training_type, started_at, duration_sec,
                            n_samples, n_entities, metrics, data_summary,
                            model_id=None, status='completed', notes=None):
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
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/ml_models?model_name=eq.{model_name}&is_active=eq.true&order=trained_at.desc&limit=1",
        headers=HEADERS_JSON, timeout=30)
    r.raise_for_status()
    rows = r.json()
    return rows[0] if rows else None


def get_latest_predictions(model_name, target_id, limit=5):
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/ml_predictions?model_name=eq.{model_name}&target_id=eq.{target_id}&order=prediction_date.desc&limit={limit}",
        headers=HEADERS_JSON, timeout=30)
    r.raise_for_status()
    return r.json()


if __name__ == '__main__':
    print('artifact dir:', ARTIFACT_DIR)
    print('active informer:', get_active_model('informer'))
    print('S1 predictions:', get_latest_predictions('informer', 'S1', 3))
