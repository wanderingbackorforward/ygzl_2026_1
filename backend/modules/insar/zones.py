import hashlib
import math
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple


def _to_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        x = float(v)
        return x if math.isfinite(x) else None
    s = str(v).strip()
    if not s:
        return None
    try:
        x = float(s)
    except Exception:
        return None
    return x if math.isfinite(x) else None


def _percentile(sorted_vals: List[float], p: float) -> float:
    if not sorted_vals:
        return 0.0
    p = max(0.0, min(1.0, float(p)))
    idx = (len(sorted_vals) - 1) * p
    lo = int(math.floor(idx))
    hi = int(math.ceil(idx))
    if lo == hi:
        return float(sorted_vals[lo])
    t = idx - lo
    return float(sorted_vals[lo] * (1 - t) + sorted_vals[hi] * t)


def _feature_id(feature: Any, props: Dict[str, Any]) -> str:
    fid = None
    try:
        fid = feature.get("id")
    except Exception:
        fid = None
    if fid is None:
        fid = props.get("id")
    return "" if fid is None else str(fid)


def _get_lon_lat(feature: Any) -> Optional[Tuple[float, float]]:
    try:
        g = (feature or {}).get("geometry") or {}
        if g.get("type") != "Point":
            return None
        coords = g.get("coordinates") or []
        if not isinstance(coords, (list, tuple)) or len(coords) < 2:
            return None
        lon = _to_float(coords[0])
        lat = _to_float(coords[1])
        if lon is None or lat is None:
            return None
        if not (-180.0 <= lon <= 180.0 and -90.0 <= lat <= 90.0):
            return None
        return float(lon), float(lat)
    except Exception:
        return None


def _get_velocity(props: Dict[str, Any], velocity_field: str) -> Optional[float]:
    if velocity_field:
        v = _to_float(props.get(velocity_field))
        if v is not None:
            return v
    for k in ("velocity", "vel", "rate", "v", "value"):
        v = _to_float(props.get(k))
        if v is not None:
            return v
    return None


def _project_local_meters(lon: float, lat: float, lon0: float, lat0: float) -> Tuple[float, float]:
    r = 6371000.0
    lat0r = math.radians(lat0)
    x = math.radians(lon - lon0) * math.cos(lat0r) * r
    y = math.radians(lat - lat0) * r
    return x, y


def _unproject_local_meters(x: float, y: float, lon0: float, lat0: float) -> Tuple[float, float]:
    r = 6371000.0
    lat = lat0 + math.degrees(y / r)
    lat0r = math.radians(lat0)
    denom = math.cos(lat0r) * r
    lon = lon0 + math.degrees(x / denom) if denom != 0 else lon0
    return lon, lat


def _grid_key(x: float, y: float, cell: float) -> Tuple[int, int]:
    if cell <= 0:
        return 0, 0
    return int(math.floor(x / cell)), int(math.floor(y / cell))


def _neighbors_for_index(
    idx: int,
    xs: List[float],
    ys: List[float],
    cell: float,
    eps2: float,
    grid: Dict[Tuple[int, int], List[int]],
) -> List[int]:
    x = xs[idx]
    y = ys[idx]
    gx, gy = _grid_key(x, y, cell)
    out: List[int] = []
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            cand = grid.get((gx + dx, gy + dy))
            if not cand:
                continue
            for j in cand:
                dx2 = xs[j] - x
                dy2 = ys[j] - y
                if dx2 * dx2 + dy2 * dy2 <= eps2:
                    out.append(j)
    return out


def _dbscan_grid(xs: List[float], ys: List[float], eps: float, min_pts: int) -> List[List[int]]:
    n = len(xs)
    if n == 0:
        return []
    eps = float(eps)
    if not math.isfinite(eps) or eps <= 0:
        return []
    min_pts = int(min_pts)
    if min_pts < 1:
        min_pts = 1

    grid: Dict[Tuple[int, int], List[int]] = {}
    for i in range(n):
        k = _grid_key(xs[i], ys[i], eps)
        grid.setdefault(k, []).append(i)

    eps2 = eps * eps
    labels = [0] * n
    clusters: List[List[int]] = []
    cid = 0

    for i in range(n):
        if labels[i] != 0:
            continue
        neigh = _neighbors_for_index(i, xs, ys, eps, eps2, grid)
        if len(neigh) < min_pts:
            labels[i] = -1
            continue
        cid += 1
        labels[i] = cid
        queue = list(neigh)
        head = 0
        while head < len(queue):
            j = queue[head]
            head += 1
            if labels[j] == -1:
                labels[j] = cid
            if labels[j] != 0:
                continue
            labels[j] = cid
            neigh2 = _neighbors_for_index(j, xs, ys, eps, eps2, grid)
            if len(neigh2) >= min_pts:
                queue.extend(neigh2)

    by_cluster: Dict[int, List[int]] = {}
    for i, lb in enumerate(labels):
        if lb <= 0:
            continue
        by_cluster.setdefault(lb, []).append(i)
    for k in sorted(by_cluster.keys()):
        clusters.append(by_cluster[k])
    return clusters


def _cross(o: Tuple[float, float], a: Tuple[float, float], b: Tuple[float, float]) -> float:
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def _convex_hull(points: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
    pts = sorted(set(points))
    if len(pts) <= 1:
        return pts

    lower: List[Tuple[float, float]] = []
    for p in pts:
        while len(lower) >= 2 and _cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)

    upper: List[Tuple[float, float]] = []
    for p in reversed(pts):
        while len(upper) >= 2 and _cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)

    hull = lower[:-1] + upper[:-1]
    return hull


def _ring_from_center(center_xy: Tuple[float, float], radius: float, sides: int = 12) -> List[Tuple[float, float]]:
    cx, cy = center_xy
    r = float(radius)
    if not math.isfinite(r) or r <= 0:
        r = 1.0
    sides = int(sides)
    if sides < 6:
        sides = 6
    out: List[Tuple[float, float]] = []
    for i in range(sides):
        t = (2.0 * math.pi) * (i / sides)
        out.append((cx + r * math.cos(t), cy + r * math.sin(t)))
    return out


def _close_ring(coords: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
    if not coords:
        return coords
    if coords[0] == coords[-1]:
        return coords
    return coords + [coords[0]]


def _bbox_of_lonlat(coords: Iterable[Tuple[float, float]]) -> Optional[Tuple[float, float, float, float]]:
    xs: List[float] = []
    ys: List[float] = []
    for lon, lat in coords:
        if not (math.isfinite(lon) and math.isfinite(lat)):
            continue
        xs.append(lon)
        ys.append(lat)
    if not xs or not ys:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def _centroid_of_lonlat(coords: Iterable[Tuple[float, float]]) -> Optional[Tuple[float, float]]:
    xs: List[float] = []
    ys: List[float] = []
    for lon, lat in coords:
        if not (math.isfinite(lon) and math.isfinite(lat)):
            continue
        xs.append(lon)
        ys.append(lat)
    if not xs or not ys:
        return None
    return sum(xs) / len(xs), sum(ys) / len(ys)


def _zone_id(dataset: str, level: str, method: str, point_ids: List[str], extra: str) -> str:
    base = "|".join([dataset, level, method, extra, ",".join(point_ids[:200])])
    h = hashlib.sha1(base.encode("utf-8")).hexdigest()[:10]
    return f"{level}-{h}"


@dataclass
class ZoneParams:
    dataset: str
    velocity_field: str
    mild: float
    strong: float
    method: str = "cluster_hull"
    eps_m: float = 50.0
    min_pts: int = 6


def build_zones(points_geo: Dict[str, Any], params: ZoneParams) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    feats = points_geo.get("features") or []
    pts: List[Dict[str, Any]] = []
    for f in feats:
        props = (f or {}).get("properties") or {}
        ll = _get_lon_lat(f)
        if not ll:
            continue
        v = _get_velocity(props if isinstance(props, dict) else {}, params.velocity_field)
        pid = _feature_id(f, props if isinstance(props, dict) else {})
        pts.append({"id": pid, "lon": ll[0], "lat": ll[1], "v": v, "props": props, "feature": f})

    if not pts:
        return {"type": "FeatureCollection", "features": []}, {
            "dataset": params.dataset,
            "method": params.method,
            "thresholds": {"mild": params.mild, "strong": params.strong},
            "eps_m": params.eps_m,
            "min_pts": params.min_pts,
            "zone_count": 0,
            "danger_zone_count": 0,
            "warning_zone_count": 0,
            "input_points": 0,
            "danger_points": 0,
            "warning_points": 0,
        }

    lon0 = sum(p["lon"] for p in pts) / len(pts)
    lat0 = sum(p["lat"] for p in pts) / len(pts)
    for p in pts:
        x, y = _project_local_meters(p["lon"], p["lat"], lon0, lat0)
        p["x"] = x
        p["y"] = y

    strong = abs(float(params.strong))
    mild = abs(float(params.mild))
    danger_pts = [p for p in pts if p["v"] is not None and p["v"] <= -strong]
    warning_pts = [p for p in pts if p["v"] is not None and (-strong < p["v"] <= -mild)]

    def build_level(level: str, level_pts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not level_pts:
            return []
        xs = [float(p["x"]) for p in level_pts]
        ys = [float(p["y"]) for p in level_pts]
        clusters = _dbscan_grid(xs, ys, params.eps_m, params.min_pts)
        out_feats: List[Dict[str, Any]] = []
        for cidx, idxs in enumerate(clusters):
            members = [level_pts[i] for i in idxs]
            member_ids = [p["id"] for p in members if p["id"]]
            vlist = [float(p["v"]) for p in members if p["v"] is not None]
            vlist.sort()
            min_v = float(vlist[0]) if vlist else None
            p95_v = float(_percentile(vlist, 0.95)) if vlist else None

            xy = [(float(p["x"]), float(p["y"])) for p in members]
            if len(xy) >= 3:
                hull = _convex_hull(xy)
                ring_xy = _close_ring(hull)
            else:
                cx = sum(a for a, _ in xy) / len(xy)
                cy = sum(b for _, b in xy) / len(xy)
                ring_xy = _close_ring(_ring_from_center((cx, cy), max(5.0, params.eps_m), 12))

            ring_lonlat = [_unproject_local_meters(x, y, lon0, lat0) for x, y in ring_xy]
            bb = _bbox_of_lonlat(ring_lonlat)
            cc = _centroid_of_lonlat(ring_lonlat)
            zid = _zone_id(params.dataset, level, params.method, sorted(member_ids), f"{cidx}|{params.eps_m}|{params.min_pts}|{mild}|{strong}")
            out_feats.append(
                {
                    "type": "Feature",
                    "id": zid,
                    "geometry": {"type": "Polygon", "coordinates": [[list(x) for x in ring_lonlat]]},
                    "properties": {
                        "zone_id": zid,
                        "dataset": params.dataset,
                        "level": level,
                        "method": params.method,
                        "thresholds": {"mild": mild, "strong": strong},
                        "point_count": len(members),
                        "min_velocity": min_v,
                        "p95_velocity": p95_v,
                        "bbox": list(bb) if bb else None,
                        "centroid": list(cc) if cc else None,
                    },
                }
            )
        return out_feats

    zone_features = build_level("danger", danger_pts) + build_level("warning", warning_pts)

    meta = {
        "dataset": params.dataset,
        "method": params.method,
        "thresholds": {"mild": mild, "strong": strong},
        "eps_m": params.eps_m,
        "min_pts": params.min_pts,
        "zone_count": len(zone_features),
        "danger_zone_count": sum(1 for f in zone_features if (f.get("properties") or {}).get("level") == "danger"),
        "warning_zone_count": sum(1 for f in zone_features if (f.get("properties") or {}).get("level") == "warning"),
        "input_points": len(pts),
        "danger_points": len(danger_pts),
        "warning_points": len(warning_pts),
    }
    return {"type": "FeatureCollection", "features": zone_features}, meta

