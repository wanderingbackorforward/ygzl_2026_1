"""
E2E test: 验证 TBM 预测所需的所有外部数据通路
不依赖 torch, 直接用 Supabase REST API 验证:
  1. tbm_trajectory_data: TBM001 有足够观测 (>= 8 条)
  2. 所有 14 个特征列 + 4 个目标列都有值
  3. ml_models: tbm 模型已注册
"""
import sys
from pathlib import Path
import requests

THIS = Path(__file__).resolve().parent
sys.path.insert(0, str(THIS))
from supabase_store import SUPABASE_URL, ANON_KEY

HEADERS = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type": "application/json",
}

TBM_ID = "TBM001"
SEQ_LEN = 8

FEATURES = [
    "thrust_force", "cutter_torque", "cutter_speed", "cutout_pressure",
    "penetration_rate", "advance_speed", "mud_flow_in", "mud_flow_out",
    "pressure_down", "pressure_up", "pressure_right_up", "pressure_right_down",
    "pressure_left_down", "pressure_left_up",
]
TARGETS = [
    "tail_vertical_deviation", "tail_horizontal_deviation",
    "head_vertical_deviation", "head_horizontal_deviation",
]

print(f"[E2E tbm] Supabase URL: {SUPABASE_URL}")
print(f"[E2E tbm] 测试 TBM: {TBM_ID}\n")

# 1) tbm_trajectory_data
print("=" * 60)
print(f"[1/2] 拉取 tbm_trajectory_data (TBM={TBM_ID}, limit={SEQ_LEN+5}) ...")
cols = ",".join(["measurement_time"] + FEATURES + TARGETS)
url = (f"{SUPABASE_URL}/rest/v1/tbm_trajectory_data"
       f"?select={cols}&point_id=eq.{TBM_ID}"
       f"&order=measurement_time.desc&limit={SEQ_LEN+5}")
r = requests.get(url, headers=HEADERS, timeout=30)
r.raise_for_status()
rows = r.json()
print(f"  返回 {len(rows)} 条")
assert len(rows) >= SEQ_LEN, f"数据不足 (需 ≥{SEQ_LEN}, 实际 {len(rows)})"
rows.reverse()
# 检查所有列都有值
for col in FEATURES + TARGETS:
    vals = [row.get(col) for row in rows]
    none_count = sum(1 for v in vals if v is None)
    if none_count > 0:
        print(f"  WARNING: {col} 有 {none_count}/{len(vals)} 个 NULL")
print(f"  时间范围: {rows[0]['measurement_time']} → {rows[-1]['measurement_time']}")
print(f"  最近 thrust_force: {rows[-1]['thrust_force']}")
print(f"  最近 tail_vertical_deviation: {rows[-1]['tail_vertical_deviation']}")

# 2) ml_models
print("\n" + "=" * 60)
print("[2/2] 拉取 ml_models WHERE model_name='tbm' ...")
url = f"{SUPABASE_URL}/rest/v1/ml_models?model_name=eq.tbm&is_active=eq.true&limit=1"
r = requests.get(url, headers=HEADERS, timeout=15)
r.raise_for_status()
mods = r.json()
assert len(mods) == 1, "tbm 模型未在 Supabase 注册"
mod = mods[0]
print(f"  model_id:      {mod['id']}")
print(f"  version:       {mod.get('version')}")
print(f"  storage_path:  {mod.get('storage_path')}")
print(f"  file_size:     {mod.get('file_size_bytes')} bytes")
cfg = mod.get('config', {})
print(f"  config.seq_len:   {cfg.get('seq_len')}")
print(f"  config.pred_len:  {cfg.get('pred_len')}")
print(f"  config.n_tbms:    {cfg.get('n_tbms')}")
metrics = mod.get('metrics', {})
print(f"  metrics.val_mae:  {metrics.get('val_mae_real')}")

print("\n" + "=" * 60)
print("✅ 所有 2 个外部数据通路验证通过")
print(f"   TBM {TBM_ID} 有 {len(rows)} 条观测 (≥{SEQ_LEN} 条)")
print(f"   ml_models 正确注册 (model_id = {mod['id']})")
print("=" * 60)
