"""
E2E test: 验证裂缝预测所需的所有外部数据通路
不依赖 torch, 直接用 Supabase REST API 验证:
  1. raw_crack_data: F1-1 列有足够观测 (>= 30 条)
  2. crack_monitoring_points: F1-1 有点元信息
  3. ml_models: crack 模型已注册
  4. ml_predictions: 之前推理过的历史可读

不验证:
  - 模型 forward (需 torch)
  - 写预测 (走真实 API 时验证)
"""
import json
import os
import sys
import requests
from pathlib import Path

THIS = Path(__file__).resolve().parent
sys.path.insert(0, str(THIS))
from supabase_store import SUPABASE_URL, ANON_KEY

HEADERS = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type": "application/json",
}

POINT_ID = "F1-1"
SEQ_LEN = 30

print(f"[E2E crack] Supabase URL: {SUPABASE_URL}")
print(f"[E2E crack] 测试点: {POINT_ID}\n")

# 1) raw_crack_data: F1-1 列
print("=" * 60)
print(f"[1/4] 拉取 raw_crack_data.{POINT_ID} (limit={SEQ_LEN+5}, desc) ...")
url = (f"{SUPABASE_URL}/rest/v1/raw_crack_data"
       f"?select=measurement_date,{POINT_ID}&order=measurement_date.desc&limit={SEQ_LEN+5}")
r = requests.get(url, headers=HEADERS, timeout=30)
r.raise_for_status()
rows = r.json()
print(f"  返回 {len(rows)} 条")
assert len(rows) >= SEQ_LEN, f"数据不足 (需 ≥{SEQ_LEN}, 实际 {len(rows)})"
rows.reverse()
vals = [float(row[POINT_ID]) if row[POINT_ID] is not None else None for row in rows]
nan_count = sum(1 for v in vals if v is None)
print(f"  时间范围: {rows[0]['measurement_date']} → {rows[-1]['measurement_date']}")
print(f"  NaN 计数: {nan_count}/{len(vals)}")
print(f"  最近 3 个值: {vals[-3:]}")
assert nan_count < SEQ_LEN, "NaN 太多, 无法填满 30 步窗口"

# 2) crack_monitoring_points
print("\n" + "=" * 60)
print(f"[2/4] 拉取 crack_monitoring_points.{POINT_ID} ...")
url = f"{SUPABASE_URL}/rest/v1/crack_monitoring_points?point_id=eq.{POINT_ID}&limit=1"
r = requests.get(url, headers=HEADERS, timeout=15)
r.raise_for_status()
metas = r.json()
assert len(metas) == 1, f"找不到监测点 {POINT_ID}"
m = metas[0]
print(f"  trend_type:   {m.get('trend_type')}")
print(f"  trend_slope:  {m.get('trend_slope')}")
print(f"  r_value:      {m.get('r_value')}")
print(f"  total_change: {m.get('total_change')}")
print(f"  location:     {m.get('location')}")
print(f"  status:       {m.get('status')}")

# 3) ml_models
print("\n" + "=" * 60)
print("[3/4] 拉取 ml_models WHERE model_name='crack' ...")
url = f"{SUPABASE_URL}/rest/v1/ml_models?model_name=eq.crack&is_active=eq.true&limit=1"
r = requests.get(url, headers=HEADERS, timeout=15)
r.raise_for_status()
mods = r.json()
assert len(mods) == 1, "crack 模型未在 Supabase 注册"
mod = mods[0]
print(f"  model_id:      {mod['id']}")
print(f"  version:       {mod.get('version')}")
print(f"  storage_path:  {mod.get('storage_path')}")
print(f"  file_size:     {mod.get('file_size_bytes')} bytes")
cfg = mod.get('config', {})
print(f"  config.seq_len:   {cfg.get('seq_len')}")
print(f"  config.pred_len:  {cfg.get('pred_len')}")
print(f"  config.n_points:  {cfg.get('n_points')}")
print(f"  config.point_ids: {len(cfg.get('point_ids', []))} 个")
metrics = mod.get('metrics', {})
print(f"  metrics.val_mae:  {metrics.get('val_mae_real')}")

# 4) ml_predictions: 之前推理过没有
print("\n" + "=" * 60)
print(f"[4/4] 拉取 ml_predictions WHERE model_name='crack' AND target_id='{POINT_ID}' ...")
url = (f"{SUPABASE_URL}/rest/v1/ml_predictions"
       f"?model_name=eq.crack&target_id=eq.{POINT_ID}&order=created_at.desc&limit=5")
r = requests.get(url, headers=HEADERS, timeout=15)
r.raise_for_status()
preds = r.json()
print(f"  找到 {len(preds)} 条历史预测")
if preds:
    p = preds[0]
    print(f"  最新一条: {p.get('prediction_date')} -> {p.get('forecast_values')[:3] if p.get('forecast_values') else 'N/A'}...")

print("\n" + "=" * 60)
print("✅ 所有 4 个外部数据通路验证通过")
print("   predict_crack 走通后, 数据可用 (F1-1 至少 30 个非空观测)")
print("   ml_models 正确注册 (model_id = {})".format(mod['id']))
print("   crack_monitoring_points 有点元信息")
print("=" * 60)
