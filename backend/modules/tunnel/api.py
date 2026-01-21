import json
import math
import uuid
from datetime import datetime

import pandas as pd

from flask import Blueprint, jsonify, request

from modules.db.vendor import get_repo
from modules.ticket_system.models import ticket_model

tunnel_bp = Blueprint("tunnel", __name__, url_prefix="/api/tunnel")


def _repo():
    return get_repo()


@tunnel_bp.route("/projects", methods=["GET"])
def projects_list():
    rows = _repo().tunnel_projects_list()
    return jsonify({"success": True, "data": rows})


@tunnel_bp.route("/projects", methods=["POST"])
def projects_create():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"success": False, "message": "missing name"}), 400
    payload = {
        "project_id": (body.get("project_id") or str(uuid.uuid4())).strip(),
        "name": name,
        "description": body.get("description"),
    }
    row = _repo().tunnel_project_create(payload)
    return jsonify({"success": True, "data": row}), 201


@tunnel_bp.route("/alignments", methods=["GET"])
def alignments_list():
    project_id = (request.args.get("project_id") or "").strip()
    rows = _repo().tunnel_alignments_list(project_id=project_id or None)
    return jsonify({"success": True, "data": rows})


@tunnel_bp.route("/alignments", methods=["POST"])
def alignments_create():
    body = request.get_json(silent=True) or {}
    project_id = (body.get("project_id") or "").strip()
    name = (body.get("name") or "").strip()
    if not project_id:
        return jsonify({"success": False, "message": "missing project_id"}), 400
    if not name:
        return jsonify({"success": False, "message": "missing name"}), 400
    payload = {
        "alignment_id": (body.get("alignment_id") or str(uuid.uuid4())).strip(),
        "project_id": project_id,
        "name": name,
        "geojson": body.get("geojson"),
        "srid": body.get("srid") if body.get("srid") is not None else 4326,
    }
    row = _repo().tunnel_alignment_create(payload)
    return jsonify({"success": True, "data": row}), 201


@tunnel_bp.route("/point-mappings", methods=["GET"])
def point_mappings_list():
    project_id = (request.args.get("project_id") or "").strip()
    alignment_id = (request.args.get("alignment_id") or "").strip()
    if not project_id:
        return jsonify({"success": False, "message": "missing project_id"}), 400
    rows = _repo().tunnel_point_mappings_list(
        project_id=project_id,
        alignment_id=alignment_id or None,
    )
    return jsonify({"success": True, "data": rows})


@tunnel_bp.route("/point-mappings/upsert", methods=["POST"])
def point_mappings_upsert():
    body = request.get_json(silent=True)
    if body is None:
        return jsonify({"success": False, "message": "missing json body"}), 400
    rows = body if isinstance(body, list) else [body]
    written = []
    for raw in rows:
        if not isinstance(raw, dict):
            continue
        project_id = (raw.get("project_id") or "").strip()
        point_id = (raw.get("point_id") or "").strip()
        if not project_id or not point_id:
            continue
        payload = {
            "mapping_id": (raw.get("mapping_id") or str(uuid.uuid4())).strip(),
            "project_id": project_id,
            "point_id": point_id,
            "alignment_id": (raw.get("alignment_id") or "").strip() or None,
            "chainage_m": raw.get("chainage_m"),
            "offset_m": raw.get("offset_m"),
            "side": raw.get("side"),
            "section_name": raw.get("section_name"),
            "structure_part": raw.get("structure_part"),
            "ring_no": raw.get("ring_no"),
            "remark": raw.get("remark"),
        }
        written.append(_repo().tunnel_point_mapping_upsert(payload))
    return jsonify({"success": True, "data": written})


@tunnel_bp.route("/points-with-mapping", methods=["GET"])
def points_with_mapping():
    project_id = (request.args.get("project_id") or "").strip()
    alignment_id = (request.args.get("alignment_id") or "").strip()
    if not project_id:
        return jsonify({"success": False, "message": "missing project_id"}), 400
    r = _repo()
    points = r.get_all_points() or []
    mappings = r.tunnel_point_mappings_list(project_id=project_id, alignment_id=alignment_id or None) or []
    by_point = {m.get("point_id"): m for m in mappings if isinstance(m, dict) and m.get("point_id")}
    merged = []
    for p in points:
        if not isinstance(p, dict):
            continue
        pid = p.get("point_id")
        x = dict(p)
        x["tunnel_mapping"] = by_point.get(pid)
        merged.append(x)
    return jsonify({"success": True, "data": merged})


def _parse_ts(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    s = str(value).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y/%m/%d %H:%M:%S", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(s, fmt)
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            continue
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return None


@tunnel_bp.route("/tbm/telemetry", methods=["GET"])
def tbm_telemetry_list():
    project_id = (request.args.get("project_id") or "").strip()
    machine_id = (request.args.get("machine_id") or "").strip()
    start = (request.args.get("start") or "").strip()
    end = (request.args.get("end") or "").strip()
    limit = request.args.get("limit", 5000)
    if not project_id:
        return jsonify({"success": False, "message": "missing project_id"}), 400
    rows = _repo().tbm_telemetry_list(
        project_id=project_id,
        machine_id=machine_id or None,
        start=start or None,
        end=end or None,
        limit=limit,
    )
    return jsonify({"success": True, "data": rows})


@tunnel_bp.route("/tbm/progress", methods=["GET"])
def tbm_progress():
    project_id = (request.args.get("project_id") or "").strip()
    machine_id = (request.args.get("machine_id") or "").strip()
    if not project_id:
        return jsonify({"success": False, "message": "missing project_id"}), 400
    if not machine_id:
        return jsonify({"success": False, "message": "missing machine_id"}), 400
    row = _repo().tbm_progress(project_id=project_id, machine_id=machine_id)
    return jsonify({"success": True, "data": row})


@tunnel_bp.route("/tbm/telemetry/upsert", methods=["POST"])
def tbm_telemetry_upsert():
    body = request.get_json(silent=True)
    if body is None:
        return jsonify({"success": False, "message": "missing json body"}), 400
    rows = body if isinstance(body, list) else [body]
    written = []
    r = _repo()
    for raw in rows:
        if not isinstance(raw, dict):
            continue
        project_id = (raw.get("project_id") or "").strip()
        machine_id = (raw.get("machine_id") or "").strip()
        ts = _parse_ts(raw.get("ts") or raw.get("timestamp") or raw.get("time") or raw.get("datetime"))
        if not project_id or not machine_id or not ts:
            continue
        payload = {
            "record_id": (raw.get("record_id") or str(uuid.uuid4())).strip(),
            "project_id": project_id,
            "machine_id": machine_id,
            "ts": ts,
            "chainage_m": raw.get("chainage_m"),
            "ring_no": raw.get("ring_no"),
            "thrust_kN": raw.get("thrust_kN"),
            "torque_kNm": raw.get("torque_kNm"),
            "face_pressure_kPa": raw.get("face_pressure_kPa"),
            "slurry_pressure_kPa": raw.get("slurry_pressure_kPa"),
            "advance_rate_mm_min": raw.get("advance_rate_mm_min"),
            "cutterhead_rpm": raw.get("cutterhead_rpm"),
            "pitch_deg": raw.get("pitch_deg"),
            "roll_deg": raw.get("roll_deg"),
            "yaw_deg": raw.get("yaw_deg"),
            "grout_volume_L": raw.get("grout_volume_L"),
            "grout_pressure_kPa": raw.get("grout_pressure_kPa"),
            "status": raw.get("status"),
        }
        written.append(r.tbm_telemetry_upsert(payload))
    return jsonify({"success": True, "data": written})


@tunnel_bp.route("/tbm/telemetry/import-csv", methods=["POST"])
def tbm_telemetry_import_csv():
    project_id = (request.form.get("project_id") or "").strip()
    machine_id = (request.form.get("machine_id") or "").strip()
    if not project_id:
        return jsonify({"success": False, "message": "missing project_id"}), 400
    if not machine_id:
        return jsonify({"success": False, "message": "missing machine_id"}), 400
    if "file" not in request.files:
        return jsonify({"success": False, "message": "missing file"}), 400
    f = request.files["file"]
    if not f.filename:
        return jsonify({"success": False, "message": "missing filename"}), 400
    df = pd.read_csv(f)
    cols = {c.strip(): c for c in df.columns if isinstance(c, str)}
    ts_col = None
    for k in ("ts", "timestamp", "time", "datetime", "measurement_date"):
        if k in cols:
            ts_col = cols[k]
            break
    if not ts_col:
        return jsonify({"success": False, "message": "missing time column"}), 400
    def col(name):
        return cols.get(name)
    mapped = []
    r = _repo()
    for _, row in df.iterrows():
        ts = _parse_ts(row.get(ts_col))
        if not ts:
            continue
        payload = {
            "record_id": str(uuid.uuid4()),
            "project_id": project_id,
            "machine_id": machine_id,
            "ts": ts,
            "chainage_m": row.get(col("chainage_m")) if col("chainage_m") else row.get(col("chainage")),
            "ring_no": row.get(col("ring_no")) if col("ring_no") else row.get(col("ring")),
            "thrust_kN": row.get(col("thrust_kN")) if col("thrust_kN") else row.get(col("thrust")),
            "torque_kNm": row.get(col("torque_kNm")) if col("torque_kNm") else row.get(col("torque")),
            "face_pressure_kPa": row.get(col("face_pressure_kPa")) if col("face_pressure_kPa") else row.get(col("face_pressure")),
            "slurry_pressure_kPa": row.get(col("slurry_pressure_kPa")) if col("slurry_pressure_kPa") else row.get(col("slurry_pressure")),
            "advance_rate_mm_min": row.get(col("advance_rate_mm_min")) if col("advance_rate_mm_min") else row.get(col("advance_rate")),
            "cutterhead_rpm": row.get(col("cutterhead_rpm")) if col("cutterhead_rpm") else row.get(col("rpm")),
            "pitch_deg": row.get(col("pitch_deg")) if col("pitch_deg") else row.get(col("pitch")),
            "roll_deg": row.get(col("roll_deg")) if col("roll_deg") else row.get(col("roll")),
            "yaw_deg": row.get(col("yaw_deg")) if col("yaw_deg") else row.get(col("yaw")),
            "grout_volume_L": row.get(col("grout_volume_L")) if col("grout_volume_L") else row.get(col("grout_volume")),
            "grout_pressure_kPa": row.get(col("grout_pressure_kPa")) if col("grout_pressure_kPa") else row.get(col("grout_pressure")),
            "status": row.get(col("status")) if col("status") else None,
        }
        mapped.append(r.tbm_telemetry_upsert(payload))
    return jsonify({"success": True, "count": len(mapped), "data": mapped})


def _as_float(x):
    try:
        if x is None:
            return None
        if isinstance(x, (int, float)):
            return float(x)
        s = str(x).strip()
        if not s:
            return None
        return float(s)
    except Exception:
        return None


def _alignment_to_xy_m(coords, srid):
    if not coords:
        return [], (0.0, 0.0)
    if int(srid or 0) != 4326:
        return [(float(x), float(y)) for x, y in coords], (coords[0][0], coords[0][1])
    lon0, lat0 = float(coords[0][0]), float(coords[0][1])
    m_per_deg_lat = 111320.0
    m_per_deg_lon = 111320.0 * math.cos(math.radians(lat0))
    out = []
    for lon, lat in coords:
        out.append(((float(lon) - lon0) * m_per_deg_lon, (float(lat) - lat0) * m_per_deg_lat))
    return out, (lon0, lat0)


def _point_to_xy_m(x, y, srid, origin):
    if int(srid or 0) != 4326:
        return float(x), float(y)
    lon0, lat0 = origin
    m_per_deg_lat = 111320.0
    m_per_deg_lon = 111320.0 * math.cos(math.radians(lat0))
    return ((float(x) - lon0) * m_per_deg_lon, (float(y) - lat0) * m_per_deg_lat)


def _parse_alignment_geojson(geojson_value):
    if geojson_value is None:
        return None
    g = geojson_value
    if isinstance(g, str):
        s = g.strip()
        if not s:
            return None
        g = json.loads(s)
    if isinstance(g, dict) and g.get("type") == "Feature":
        g = g.get("geometry")
    if not isinstance(g, dict):
        return None
    if g.get("type") != "LineString":
        return None
    coords = g.get("coordinates")
    if not isinstance(coords, list) or len(coords) < 2:
        return None
    out = []
    for c in coords:
        if not isinstance(c, (list, tuple)) or len(c) < 2:
            continue
        out.append((c[0], c[1]))
    return out if len(out) >= 2 else None


def _project_point_to_polyline(poly_xy, x, y):
    best = None
    cum = 0.0
    for i in range(len(poly_xy) - 1):
        x1, y1 = poly_xy[i]
        x2, y2 = poly_xy[i + 1]
        vx, vy = x2 - x1, y2 - y1
        wx, wy = x - x1, y - y1
        seg2 = vx * vx + vy * vy
        if seg2 <= 0:
            continue
        t = (wx * vx + wy * vy) / seg2
        if t < 0:
            t = 0.0
        elif t > 1:
            t = 1.0
        px = x1 + t * vx
        py = y1 + t * vy
        dx = x - px
        dy = y - py
        d2 = dx * dx + dy * dy
        seg_len = math.sqrt(seg2)
        along = cum + t * seg_len
        cross = vx * wy - vy * wx
        offset = math.sqrt(d2)
        if cross < 0:
            offset = -offset
        if best is None or d2 < best[0]:
            best = (d2, along, offset)
        cum += seg_len
    if best is None:
        return None
    return {"chainage_m": best[1], "offset_m": best[2]}


@tunnel_bp.route("/alignments/<alignment_id>", methods=["GET"])
def alignment_get(alignment_id):
    alignment_id = (alignment_id or "").strip()
    if not alignment_id:
        return jsonify({"success": False, "message": "missing alignment_id"}), 400
    row = _repo().tunnel_alignment_get(alignment_id)
    return jsonify({"success": True, "data": row})


@tunnel_bp.route("/alignments/project-points", methods=["POST"])
def alignment_project_points():
    body = request.get_json(silent=True) or {}
    alignment_id = (body.get("alignment_id") or "").strip()
    points = body.get("points")
    if not alignment_id:
        return jsonify({"success": False, "message": "missing alignment_id"}), 400
    if not isinstance(points, list) or not points:
        return jsonify({"success": False, "message": "missing points"}), 400
    alignment = _repo().tunnel_alignment_get(alignment_id)
    if not alignment:
        return jsonify({"success": False, "message": "alignment not found"}), 404
    coords = _parse_alignment_geojson(alignment.get("geojson"))
    if not coords:
        return jsonify({"success": False, "message": "invalid alignment geojson"}), 400
    srid = alignment.get("srid") or 4326
    poly_xy, origin = _alignment_to_xy_m(coords, srid)
    out = []
    for p in points:
        if not isinstance(p, dict):
            continue
        x = p.get("x")
        y = p.get("y")
        if x is None or y is None:
            x = p.get("lon") if p.get("lon") is not None else p.get("lng")
            y = p.get("lat")
        if x is None or y is None:
            continue
        px, py = _point_to_xy_m(x, y, srid, origin)
        proj = _project_point_to_polyline(poly_xy, px, py)
        out.append({"input": p, "projection": proj})
    return jsonify({"success": True, "data": out})


@tunnel_bp.route("/fusion/chainage-bins", methods=["GET"])
def fusion_chainage_bins():
    project_id = (request.args.get("project_id") or "").strip()
    alignment_id = (request.args.get("alignment_id") or "").strip()
    machine_id = (request.args.get("machine_id") or "").strip()
    bin_m = _as_float(request.args.get("bin_m", 20.0))
    start_chainage = _as_float(request.args.get("start_chainage"))
    end_chainage = _as_float(request.args.get("end_chainage"))
    telemetry_limit = request.args.get("telemetry_limit", 5000)
    if not project_id:
        return jsonify({"success": False, "message": "missing project_id"}), 400
    if not bin_m or bin_m <= 0:
        return jsonify({"success": False, "message": "invalid bin_m"}), 400

    r = _repo()
    mappings = r.tunnel_point_mappings_list(project_id=project_id, alignment_id=alignment_id or None) or []
    mappings = [m for m in mappings if isinstance(m, dict) and _as_float(m.get("chainage_m")) is not None]
    if not mappings:
        return jsonify({"success": True, "data": {"bins": [], "points": 0}})

    chainages = [_as_float(m.get("chainage_m")) for m in mappings]
    chainages = [c for c in chainages if c is not None]
    min_c = min(chainages)
    max_c = max(chainages)
    if start_chainage is None:
        start_chainage = min_c
    if end_chainage is None:
        end_chainage = max_c
    if end_chainage < start_chainage:
        start_chainage, end_chainage = end_chainage, start_chainage

    summary = r.get_summary() or []
    by_point = {s.get("point_id"): s for s in summary if isinstance(s, dict) and s.get("point_id")}

    point_rows = []
    for m in mappings:
        pid = m.get("point_id")
        c = _as_float(m.get("chainage_m"))
        if pid is None or c is None:
            continue
        s = by_point.get(pid) or {}
        point_rows.append(
            {
                "point_id": pid,
                "chainage_m": c,
                "mapping": m,
                "current_value": _as_float(s.get("current_value") or s.get("value") or s.get("current")),
                "change_rate": _as_float(s.get("change_rate") or s.get("daily_change_rate") or s.get("rate")),
                "alert_level": s.get("alert_level"),
                "trend_type": s.get("trend_type"),
            }
        )

    bins = []
    cur = math.floor(start_chainage / bin_m) * bin_m
    end_edge = math.ceil(end_chainage / bin_m) * bin_m
    while cur < end_edge + 1e-9:
        bins.append(
            {
                "chainage_start": cur,
                "chainage_end": cur + bin_m,
                "point_count": 0,
                "max_abs_current_value": None,
                "max_abs_change_rate": None,
                "worst_alert_level": None,
                "tbm_samples": 0,
            }
        )
        cur += bin_m

    alert_rank = {"critical": 4, "high": 3, "medium": 2, "low": 1, "normal": 0}

    for p in point_rows:
        c = p["chainage_m"]
        if c < start_chainage or c > end_chainage:
            continue
        idx = int((c - bins[0]["chainage_start"]) // bin_m)
        if idx < 0 or idx >= len(bins):
            continue
        b = bins[idx]
        b["point_count"] += 1
        v = p.get("current_value")
        if v is not None:
            cur_max = b["max_abs_current_value"]
            av = abs(v)
            if cur_max is None or av > cur_max:
                b["max_abs_current_value"] = av
        r0 = p.get("change_rate")
        if r0 is not None:
            cur_max = b["max_abs_change_rate"]
            ar = abs(r0)
            if cur_max is None or ar > cur_max:
                b["max_abs_change_rate"] = ar
        lvl = (p.get("alert_level") or "").strip().lower()
        if lvl:
            prev = (b.get("worst_alert_level") or "").strip().lower()
            if alert_rank.get(lvl, -1) > alert_rank.get(prev, -1):
                b["worst_alert_level"] = lvl

    if machine_id:
        tele = r.tbm_telemetry_list_by_chainage(
            project_id=project_id,
            machine_id=machine_id,
            start_chainage=start_chainage,
            end_chainage=end_chainage,
            limit=telemetry_limit,
        )
        for t in tele or []:
            c = _as_float(t.get("chainage_m"))
            if c is None:
                continue
            idx = int((c - bins[0]["chainage_start"]) // bin_m)
            if idx < 0 or idx >= len(bins):
                continue
            bins[idx]["tbm_samples"] += 1

    filtered = []
    for b in bins:
        if b["chainage_end"] < start_chainage or b["chainage_start"] > end_chainage:
            continue
        filtered.append(b)

    return jsonify(
        {
            "success": True,
            "data": {
                "project_id": project_id,
                "alignment_id": alignment_id or None,
                "machine_id": machine_id or None,
                "bin_m": bin_m,
                "start_chainage": start_chainage,
                "end_chainage": end_chainage,
                "points": len(point_rows),
                "bins": filtered,
            },
        }
    )


@tunnel_bp.route("/fusion/points-near-chainage", methods=["GET"])
def fusion_points_near_chainage():
    project_id = (request.args.get("project_id") or "").strip()
    alignment_id = (request.args.get("alignment_id") or "").strip()
    chainage = _as_float(request.args.get("chainage_m"))
    window = _as_float(request.args.get("window_m", 10.0))
    if not project_id:
        return jsonify({"success": False, "message": "missing project_id"}), 400
    if chainage is None:
        return jsonify({"success": False, "message": "missing chainage_m"}), 400
    if not window or window <= 0:
        return jsonify({"success": False, "message": "invalid window_m"}), 400
    r = _repo()
    mappings = r.tunnel_point_mappings_list(project_id=project_id, alignment_id=alignment_id or None) or []
    out = []
    for m in mappings:
        if not isinstance(m, dict):
            continue
        c = _as_float(m.get("chainage_m"))
        if c is None:
            continue
        if abs(c - chainage) <= window:
            out.append(m)
    out.sort(key=lambda x: _as_float(x.get("chainage_m")) or 0.0)
    return jsonify({"success": True, "data": out})


def _priority_from_score(score):
    if score >= 85:
        return "CRITICAL"
    if score >= 70:
        return "HIGH"
    if score >= 50:
        return "MEDIUM"
    return "LOW"


def _subtype_from_metrics(max_abs_current_value, max_abs_change_rate):
    if max_abs_current_value is not None and max_abs_current_value >= 10:
        return "沉降量超限"
    if max_abs_change_rate is not None and max_abs_change_rate >= 1:
        return "沉降速率异常"
    return "监测点数据异常"


def _normalize_severity(x):
    s = (x or "").strip().lower()
    if s in ("critical", "high", "medium", "low", "normal"):
        return s
    zh_map = {
        "严重": "critical",
        "极高风险": "critical",
        "高风险": "high",
        "中风险": "medium",
        "低风险": "low",
        "正常": "normal",
    }
    return zh_map.get((x or "").strip(), "")


def _compute_risk_bins(project_id, alignment_id, bin_m, start_chainage=None, end_chainage=None):
    r = _repo()
    mappings = r.tunnel_point_mappings_list(project_id=project_id, alignment_id=alignment_id or None) or []
    mappings = [m for m in mappings if isinstance(m, dict) and _as_float(m.get("chainage_m")) is not None]
    if not mappings:
        return {"project_id": project_id, "alignment_id": alignment_id or None, "bin_m": bin_m, "points": 0, "bins": []}

    chainages = [_as_float(m.get("chainage_m")) for m in mappings]
    chainages = [c for c in chainages if c is not None]
    min_c = min(chainages)
    max_c = max(chainages)
    if start_chainage is None:
        start_chainage = min_c
    if end_chainage is None:
        end_chainage = max_c
    if end_chainage < start_chainage:
        start_chainage, end_chainage = end_chainage, start_chainage

    summary = r.get_summary() or []
    by_point = {s.get("point_id"): s for s in summary if isinstance(s, dict) and s.get("point_id")}

    point_rows = []
    for m in mappings:
        pid = m.get("point_id")
        c = _as_float(m.get("chainage_m"))
        if pid is None or c is None:
            continue
        s = by_point.get(pid) or {}
        total_change = _as_float(s.get("total_change"))
        avg_daily_rate = _as_float(s.get("avg_daily_rate") or s.get("avg_daily_rate_mm") or s.get("avg_daily_rate_mm_d"))
        current_value = _as_float(s.get("current_value") or s.get("value") or s.get("current"))
        change_rate = _as_float(s.get("change_rate") or s.get("daily_change_rate") or s.get("rate"))
        if current_value is None and total_change is not None:
            current_value = total_change
        if change_rate is None and avg_daily_rate is not None:
            change_rate = avg_daily_rate
        severity = _normalize_severity(s.get("risk_level") or s.get("alert_level"))
        point_rows.append(
            {
                "point_id": pid,
                "chainage_m": c,
                "current_value": current_value,
                "change_rate": change_rate,
                "severity": severity,
                "settlement_risk_score": _as_float(s.get("risk_score")),
                "trend_type": s.get("trend_type"),
            }
        )

    bins = []
    cur = math.floor(start_chainage / bin_m) * bin_m
    end_edge = math.ceil(end_chainage / bin_m) * bin_m
    while cur < end_edge + 1e-9:
        bins.append(
            {
                "chainage_start": cur,
                "chainage_end": cur + bin_m,
                "point_count": 0,
                "max_abs_current_value": None,
                "max_abs_change_rate": None,
                "worst_severity": None,
                "worst_point_id": None,
                "max_settlement_risk_score": None,
                "risk_score": 0,
                "risk_priority": "LOW",
                "reasons": [],
            }
        )
        cur += bin_m

    alert_rank = {"critical": 4, "high": 3, "medium": 2, "low": 1, "normal": 0}

    for p in point_rows:
        c = p["chainage_m"]
        if c < start_chainage or c > end_chainage:
            continue
        idx = int((c - bins[0]["chainage_start"]) // bin_m)
        if idx < 0 or idx >= len(bins):
            continue
        b = bins[idx]
        b["point_count"] += 1
        v = p.get("current_value")
        if v is not None:
            av = abs(v)
            cur_max = b["max_abs_current_value"]
            if cur_max is None or av > cur_max:
                b["max_abs_current_value"] = av
                b["worst_point_id"] = p.get("point_id")
        r0 = p.get("change_rate")
        if r0 is not None:
            ar = abs(r0)
            cur_max = b["max_abs_change_rate"]
            if cur_max is None or ar > cur_max:
                b["max_abs_change_rate"] = ar
        sev = _normalize_severity(p.get("severity"))
        if sev:
            prev = _normalize_severity(b.get("worst_severity"))
            if alert_rank.get(sev, -1) > alert_rank.get(prev, -1):
                b["worst_severity"] = sev
        srs = _as_float(p.get("settlement_risk_score"))
        if srs is not None:
            cur_max = b.get("max_settlement_risk_score")
            if cur_max is None or srs > cur_max:
                b["max_settlement_risk_score"] = srs

    for b in bins:
        if b["chainage_end"] < start_chainage or b["chainage_start"] > end_chainage:
            continue
        score = 0
        reasons = []
        v = b.get("max_abs_current_value")
        if v is not None:
            if v >= 15:
                score += 55
                reasons.append("沉降幅值>=15mm")
            elif v >= 10:
                score += 45
                reasons.append("沉降幅值>=10mm")
            elif v >= 5:
                score += 25
                reasons.append("沉降幅值>=5mm")
        r0 = b.get("max_abs_change_rate")
        if r0 is not None:
            if r0 >= 2:
                score += 35
                reasons.append("沉降速率>=2mm/d")
            elif r0 >= 1:
                score += 18
                reasons.append("沉降速率>=1mm/d")
        sev = _normalize_severity(b.get("worst_severity"))
        if sev:
            if sev == "critical":
                score += 25
                reasons.append("告警级别=critical")
            elif sev == "high":
                score += 15
                reasons.append("告警级别=high")
            elif sev == "medium":
                score += 8
                reasons.append("告警级别=medium")
        srs = b.get("max_settlement_risk_score")
        if srs is not None and srs >= 50:
            reasons.append("预测风险评分较高")
        final_score = min(100, max(score, int(srs) if srs is not None else 0))
        b["risk_score"] = int(final_score)
        b["risk_priority"] = _priority_from_score(final_score)
        b["reasons"] = reasons

    filtered = [b for b in bins if not (b["chainage_end"] < start_chainage or b["chainage_start"] > end_chainage)]
    return {
        "project_id": project_id,
        "alignment_id": alignment_id or None,
        "bin_m": bin_m,
        "start_chainage": start_chainage,
        "end_chainage": end_chainage,
        "points": len(point_rows),
        "bins": filtered,
    }



@tunnel_bp.route("/risk/bins", methods=["GET"])
def tunnel_risk_bins():
    project_id = (request.args.get("project_id") or "").strip()
    alignment_id = (request.args.get("alignment_id") or "").strip()
    machine_id = (request.args.get("machine_id") or "").strip()
    bin_m = _as_float(request.args.get("bin_m", 20.0))
    start_chainage = _as_float(request.args.get("start_chainage"))
    end_chainage = _as_float(request.args.get("end_chainage"))
    if not project_id:
        return jsonify({"success": False, "message": "missing project_id"}), 400
    if not bin_m or bin_m <= 0:
        return jsonify({"success": False, "message": "invalid bin_m"}), 400
    data = _compute_risk_bins(project_id, alignment_id, bin_m, start_chainage=start_chainage, end_chainage=end_chainage)
    data["machine_id"] = machine_id or None
    return jsonify({"success": True, "data": data})


@tunnel_bp.route("/risk/auto-tickets", methods=["POST"])
def tunnel_risk_auto_tickets():
    body = request.get_json(silent=True) or {}
    project_id = (body.get("project_id") or "").strip()
    alignment_id = (body.get("alignment_id") or "").strip()
    machine_id = (body.get("machine_id") or "").strip()
    threshold_score = _as_float(body.get("threshold_score", 70))
    bin_m = _as_float(body.get("bin_m", 20.0))
    start_chainage = _as_float(body.get("start_chainage"))
    end_chainage = _as_float(body.get("end_chainage"))
    creator_id = (body.get("creator_id") or "system").strip()
    creator_name = (body.get("creator_name") or "系统").strip()
    if not project_id:
        return jsonify({"success": False, "message": "missing project_id"}), 400
    if threshold_score is None:
        threshold_score = 70
    if not bin_m or bin_m <= 0:
        return jsonify({"success": False, "message": "invalid bin_m"}), 400

    repo = _repo()
    if not callable(getattr(repo, "tickets_get", None)) or not callable(getattr(repo, "ticket_create", None)):
        return jsonify({"success": False, "message": "ticket repo not supported"}), 501
    data = _compute_risk_bins(project_id, alignment_id, bin_m, start_chainage=start_chainage, end_chainage=end_chainage)
    args = {
        "project_id": project_id,
        "alignment_id": alignment_id or None,
        "machine_id": machine_id or None,
        "bin_m": bin_m,
        "start_chainage": data.get("start_chainage"),
        "end_chainage": data.get("end_chainage"),
    }
    bins = data.get("bins") or []

    created = []
    skipped = []
    for b in bins or []:
        score = _as_float(b.get("risk_score")) or 0
        if score < threshold_score:
            continue
        cs = b.get("chainage_start")
        ce = b.get("chainage_end")
        key = f"TunnelRisk:{project_id}:{machine_id or '-'}:{cs}-{ce}"
        exists = repo.tickets_get({"search_keyword": key}, limit=1, offset=0) or []
        if exists:
            skipped.append({"key": key, "existing_ticket": exists[0]})
            continue
        max_v = b.get("max_abs_current_value")
        max_r = b.get("max_abs_change_rate")
        subtype = _subtype_from_metrics(max_v, max_r)
        description = "\n".join(
            [
                f"project_id={project_id}",
                f"alignment_id={alignment_id or ''}",
                f"machine_id={machine_id or ''}",
                f"chainage={cs}~{ce}m",
                f"risk_score={int(score)}",
                f"max_abs_current_value={max_v}",
                f"max_abs_change_rate={max_r}",
                f"reasons={','.join(b.get('reasons') or [])}",
            ]
        )
        ticket = ticket_model.create_ticket(
            {
                "title": key,
                "description": description,
                "ticket_type": "SETTLEMENT_ALERT",
                "sub_type": subtype,
                "priority": _priority_from_score(score),
                "status": "PENDING",
                "creator_id": creator_id,
                "creator_name": creator_name,
                "monitoring_point_id": b.get("worst_point_id"),
                "location_info": {
                    "project_id": project_id,
                    "alignment_id": alignment_id or None,
                    "machine_id": machine_id or None,
                    "chainage_start": cs,
                    "chainage_end": ce,
                },
                "alert_data": {
                    "risk_score": int(score),
                    "max_abs_current_value": max_v,
                    "max_abs_change_rate": max_r,
                    "reasons": b.get("reasons") or [],
                },
                "metadata": {"source": "tunnel_risk_engine", **args},
            }
        )
        created.append(ticket)

    return jsonify({"success": True, "data": {"created": created, "skipped": skipped}})
