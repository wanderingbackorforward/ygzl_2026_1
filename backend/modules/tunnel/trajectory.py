# -*- coding: utf-8 -*-
"""
Shield trajectory deviation computation & analysis.
Pure-math algorithms (no numpy/scipy dependency).
"""
import math
import random
from datetime import datetime, timedelta


# ---------------------------------------------------------------------------
# 1. Deviation cumulative integration
# ---------------------------------------------------------------------------

def compute_deviations(telemetry_rows):
    """
    From TBM attitude angles compute position deviation.
    Input : sorted-by-chainage telemetry rows (list of dicts)
    Output: same rows with h_dev_mm / v_dev_mm appended
    """
    if not telemetry_rows:
        return []
    h_cum = 0.0
    v_cum = 0.0
    prev_ch = _f(telemetry_rows[0].get("chainage_m")) or 0.0
    results = []
    for row in telemetry_rows:
        ch = _f(row.get("chainage_m")) or prev_ch
        ds = max(0.0, ch - prev_ch)
        yaw = _f(row.get("yaw_deg")) or 0.0
        pitch = _f(row.get("pitch_deg")) or 0.0
        h_cum += ds * math.sin(math.radians(yaw)) * 1000.0
        v_cum += ds * math.sin(math.radians(pitch)) * 1000.0
        results.append({
            "ring_no": row.get("ring_no"),
            "chainage_m": round(ch, 2),
            "ts": row.get("recorded_at") or row.get("ts"),
            "pitch_deg": round(pitch, 3),
            "yaw_deg": round(yaw, 3),
            "roll_deg": round(_f(row.get("roll_deg")) or 0.0, 3),
            "h_dev_mm": round(h_cum, 1),
            "v_dev_mm": round(v_cum, 1),
            "thrust_kN": _f(row.get("thrust_kN")),
            "torque_kNm": _f(row.get("torque_kNm")),
            "face_pressure_kPa": _f(row.get("face_pressure_kPa")),
            "advance_rate_mm_min": _f(row.get("advance_rate_mm_min")),
            "cutterhead_rpm": _f(row.get("cutterhead_rpm")),
        })
        prev_ch = ch
    return results


# ---------------------------------------------------------------------------
# 2. Linear regression (least squares, no numpy)
# ---------------------------------------------------------------------------

def linear_regression(xs, ys):
    n = len(xs)
    if n < 2:
        return {"slope": 0, "intercept": 0, "r2": 0}
    sx = sum(xs)
    sy = sum(ys)
    sxy = sum(x * y for x, y in zip(xs, ys))
    sx2 = sum(x * x for x in xs)
    denom = n * sx2 - sx * sx
    if abs(denom) < 1e-12:
        return {"slope": 0, "intercept": sy / n if n else 0, "r2": 0}
    slope = (n * sxy - sx * sy) / denom
    intercept = (sy - slope * sx) / n
    y_mean = sy / n
    ss_tot = sum((y - y_mean) ** 2 for y in ys)
    ss_res = sum((y - (slope * x + intercept)) ** 2 for x, y in zip(xs, ys))
    r2 = 1 - ss_res / ss_tot if ss_tot > 1e-12 else 0
    return {"slope": round(slope, 4), "intercept": round(intercept, 2), "r2": round(r2, 3)}


# ---------------------------------------------------------------------------
# 3. Descriptive statistics (mean / std / skewness / kurtosis)
# ---------------------------------------------------------------------------

def compute_stats(values):
    n = len(values)
    if n == 0:
        return None
    mn = min(values)
    mx = max(values)
    mean = sum(values) / n
    var = sum((v - mean) ** 2 for v in values) / n if n > 1 else 0
    std = var ** 0.5
    if std > 1e-12 and n > 2:
        skew = sum(((v - mean) / std) ** 3 for v in values) / n
        kurt = sum(((v - mean) / std) ** 4 for v in values) / n - 3
    else:
        skew = 0.0
        kurt = 0.0
    return {
        "max": round(mx, 1), "min": round(mn, 1),
        "mean": round(mean, 1), "std": round(std, 1),
        "skewness": round(skew, 2), "kurtosis": round(kurt, 2),
    }


def build_summary(dev_records, window=30):
    """Build full summary from deviation records."""
    if not dev_records:
        return None
    hs = [r["h_dev_mm"] for r in dev_records]
    vs = [r["v_dev_mm"] for r in dev_records]
    rolls = [r["roll_deg"] for r in dev_records]
    h_stat = compute_stats(hs)
    v_stat = compute_stats(vs)
    r_stat = compute_stats(rolls)
    h_exceed = sum(1 for v in hs if abs(v) > 50)
    v_exceed = sum(1 for v in vs if abs(v) > 50)
    r_exceed = sum(1 for v in rolls if abs(v) > 1.5)
    n = len(dev_records)
    for st, exc, suffix in [(h_stat, h_exceed, "mm"), (v_stat, v_exceed, "mm"), (r_stat, r_exceed, "deg")]:
        if st:
            st["exceed_count"] = exc
            st["exceed_total"] = n
    # trend on recent window
    recent = dev_records[-window:]
    ring_nos = [r["ring_no"] or i for i, r in enumerate(recent)]
    h_trend = linear_regression(ring_nos, [r["h_dev_mm"] for r in recent])
    v_trend = linear_regression(ring_nos, [r["v_dev_mm"] for r in recent])
    h_trend["label"] = _trend_label(h_trend["slope"])
    v_trend["label"] = _trend_label(v_trend["slope"])
    h_trend["recent_rings"] = len(recent)
    v_trend["recent_rings"] = len(recent)
    # quality
    quality_label = "施工质量稳定"
    if h_stat and (abs(h_stat["skewness"]) > 1 or abs(h_stat["kurtosis"]) > 2):
        quality_label = "施工质量波动"
    if h_stat and (abs(h_stat["skewness"]) > 2 or abs(h_stat["kurtosis"]) > 4):
        quality_label = "施工质量异常"
    last = dev_records[-1]
    return {
        "current_ring": last.get("ring_no"),
        "current_chainage_m": last.get("chainage_m"),
        "total_length_m": last.get("chainage_m"),
        "h_dev": h_stat,
        "v_dev": v_stat,
        "roll": r_stat,
        "h_trend": h_trend,
        "v_trend": v_trend,
        "quality": {
            "skewness": h_stat["skewness"] if h_stat else 0,
            "kurtosis": h_stat["kurtosis"] if h_stat else 0,
            "label": quality_label,
        },
    }


# ---------------------------------------------------------------------------
# 4. Correction advice (rule engine)
# ---------------------------------------------------------------------------

_THRESHOLDS = [
    (50, "critical", 12, 1),
    (35, "warning", 8, 3),
    (20, "info", 4, 5),
]

def compute_correction(dev_records, n=5):
    if not dev_records:
        return None
    recent = dev_records[-n:]
    avg_h = sum(r["h_dev_mm"] for r in recent) / len(recent)
    avg_v = sum(r["v_dev_mm"] for r in recent) / len(recent)
    avg_roll = sum(r["roll_deg"] for r in recent) / len(recent)
    advice = []
    # horizontal
    for thr, sev, pct, mon in _THRESHOLDS:
        if abs(avg_h) > thr:
            d = "左" if avg_h > 0 else "右"
            advice.append({
                "type": "horizontal", "severity": sev,
                "text": f"盾构{d}偏{abs(avg_h):.0f}mm，建议增加{d}侧千斤顶推力约{pct}%，持续{mon}环后观察",
                "monitor_rings": mon,
            })
            break
    # vertical
    for thr, sev, pct, mon in _THRESHOLDS:
        if abs(avg_v) > thr:
            d = "上" if avg_v > 0 else "下"
            advice.append({
                "type": "vertical", "severity": sev,
                "text": f"盾构{d}偏{abs(avg_v):.0f}mm，建议调整{'上' if avg_v < 0 else '下'}部千斤顶推力约{pct}%",
                "monitor_rings": mon,
            })
            break
    # roll
    if abs(avg_roll) > 1.5:
        advice.append({"type": "roll", "severity": "critical",
                        "text": f"滚转角{avg_roll:.1f}deg超限，建议停机检查", "monitor_rings": 0})
    elif abs(avg_roll) > 1.0:
        advice.append({"type": "roll", "severity": "warning",
                        "text": f"滚转角{avg_roll:.1f}deg偏大，建议差异推力调整", "monitor_rings": 3})
    elif abs(avg_roll) > 0.5:
        advice.append({"type": "roll", "severity": "info",
                        "text": f"滚转角{avg_roll:.1f}deg，建议微调刀盘转向", "monitor_rings": 5})
    h_dir = "左偏" if avg_h > 5 else ("右偏" if avg_h < -5 else "居中")
    v_dir = "偏高" if avg_v > 5 else ("偏低" if avg_v < -5 else "居中")
    overall = "正常"
    if any(a["severity"] == "critical" for a in advice):
        overall = "需立即处理"
    elif any(a["severity"] == "warning" for a in advice):
        overall = "需关注"
    return {
        "based_on_recent_rings": n,
        "current_h_dev_mm": round(avg_h, 1),
        "current_v_dev_mm": round(avg_v, 1),
        "current_roll_deg": round(avg_roll, 2),
        "h_direction": h_dir, "v_direction": v_dir,
        "advice": advice, "overall_status": overall,
    }


# ---------------------------------------------------------------------------
# 5. Prediction (linear extrapolation)
# ---------------------------------------------------------------------------

def compute_prediction(dev_records, predict_rings=10, window=30):
    if not dev_records or len(dev_records) < 3:
        return None
    recent = dev_records[-window:]
    rings = [r["ring_no"] or i for i, r in enumerate(recent)]
    hs = [r["h_dev_mm"] for r in recent]
    vs = [r["v_dev_mm"] for r in recent]
    h_reg = linear_regression(rings, hs)
    v_reg = linear_regression(rings, vs)
    # residual std
    h_res = [hs[i] - (h_reg["slope"] * rings[i] + h_reg["intercept"]) for i in range(len(rings))]
    v_res = [vs[i] - (v_reg["slope"] * rings[i] + v_reg["intercept"]) for i in range(len(rings))]
    h_std = (sum(r ** 2 for r in h_res) / len(h_res)) ** 0.5 if h_res else 0
    v_std = (sum(r ** 2 for r in v_res) / len(v_res)) ** 0.5 if v_res else 0
    last_ring = dev_records[-1].get("ring_no") or len(dev_records)
    h_pred, v_pred = [], []
    h_exceed_ring, v_exceed_ring = None, None
    for i in range(1, predict_rings + 1):
        rn = last_ring + i
        hp = h_reg["slope"] * rn + h_reg["intercept"]
        vp = v_reg["slope"] * rn + v_reg["intercept"]
        h_pred.append({"ring_no": rn, "predicted_mm": round(hp, 1),
                        "upper_mm": round(hp + 2 * h_std, 1), "lower_mm": round(hp - 2 * h_std, 1)})
        v_pred.append({"ring_no": rn, "predicted_mm": round(vp, 1),
                        "upper_mm": round(vp + 2 * v_std, 1), "lower_mm": round(vp - 2 * v_std, 1)})
        if abs(hp) > 50 and h_exceed_ring is None:
            h_exceed_ring = rn
        if abs(vp) > 50 and v_exceed_ring is None:
            v_exceed_ring = rn
    return {
        "h_prediction": h_pred, "v_prediction": v_pred,
        "h_exceed_ring": h_exceed_ring, "v_exceed_ring": v_exceed_ring,
        "regression": {"h_slope": h_reg["slope"], "h_r2": h_reg["r2"],
                        "v_slope": v_reg["slope"], "v_r2": v_reg["r2"]},
    }


# ---------------------------------------------------------------------------
# 6. Demo data generator (150 rings, realistic TBM params)
# ---------------------------------------------------------------------------

def generate_demo_telemetry(project_id, machine_id, num_rings=150, start_chainage=100.0):
    """Generate realistic demo TBM telemetry records."""
    ring_length = 1.5  # m per ring
    base_time = datetime.now() - timedelta(days=num_rings * 0.3)
    yaw = 0.0
    pitch = 0.0
    roll = 0.0
    records = []
    for i in range(1, num_rings + 1):
        # random walk for attitude angles
        yaw += random.gauss(0, 0.03)
        yaw = max(-0.5, min(0.5, yaw))
        pitch += random.gauss(0, 0.02)
        pitch = max(-0.4, min(0.4, pitch))
        roll += random.gauss(0, 0.05)
        roll = max(-2.0, min(2.0, roll))
        # mean-revert bias
        yaw -= yaw * 0.05
        pitch -= pitch * 0.05
        roll -= roll * 0.1
        ch = start_chainage + (i - 1) * ring_length
        ts = base_time + timedelta(hours=i * 4.8 + random.uniform(-1, 1))
        records.append({
            "project_id": project_id,
            "machine_id": machine_id,
            "ring_no": i,
            "chainage_m": round(ch, 2),
            "recorded_at": ts.isoformat(),
            "thrust_kN": round(random.uniform(8000, 15000), 0),
            "torque_kNm": round(random.uniform(600, 1200), 0),
            "face_pressure_kPa": round(random.uniform(150, 280), 0),
            "slurry_pressure_kPa": round(random.uniform(100, 200), 0),
            "advance_rate_mm_min": round(random.uniform(20, 60), 1),
            "cutterhead_rpm": round(random.uniform(0.8, 1.8), 2),
            "pitch_deg": round(pitch, 3),
            "roll_deg": round(roll, 3),
            "yaw_deg": round(yaw, 3),
            "grout_volume_L": round(random.uniform(4000, 7000), 0),
            "grout_pressure_kPa": round(random.uniform(200, 400), 0),
        })
    return records


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _f(x):
    """Safe float conversion."""
    if x is None:
        return None
    try:
        return float(x)
    except (ValueError, TypeError):
        return None


def _trend_label(slope):
    a = abs(slope)
    if a < 0.05:
        return "稳定"
    if slope > 0:
        return "缓慢发散" if a < 0.3 else "快速发散"
    return "收敛中" if a < 0.3 else "快速收敛"
