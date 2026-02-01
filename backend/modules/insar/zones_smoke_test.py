import json
import sys

from modules.insar.zones import ZoneParams, build_zones


def _pt(fid: str, lon: float, lat: float, v: float):
    return {
        "type": "Feature",
        "id": fid,
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": {"id": fid, "velocity": v},
    }


def main():
    base_lon = 121.575
    base_lat = 31.245
    feats = []

    for i in range(8):
        feats.append(_pt(f"sd{i}", base_lon + 0.00015 * i, base_lat + 0.00005 * i, -12.0 - 0.1 * i))

    for i in range(10):
        feats.append(_pt(f"sw{i}", base_lon + 0.01 + 0.00012 * i, base_lat + 0.01 + 0.00007 * i, -3.0 - 0.05 * i))

    for i in range(9):
        feats.append(_pt(f"ud{i}", base_lon - 0.02 + 0.00014 * i, base_lat + 0.012 + 0.00006 * i, 12.0 + 0.08 * i))

    for i in range(7):
        feats.append(_pt(f"uw{i}", base_lon - 0.012 + 0.00011 * i, base_lat - 0.006 + 0.00005 * i, 2.5 + 0.05 * i))

    feats.append(_pt("n0", base_lon - 0.03, base_lat - 0.02, 0.2))
    feats.append(_pt("n1", base_lon - 0.031, base_lat - 0.0205, -0.5))

    geo = {"type": "FeatureCollection", "features": feats}
    zones_geo, meta = build_zones(
        geo,
        ZoneParams(dataset="test", velocity_field="velocity", mild=2.0, strong=10.0, eps_m=250.0, min_pts=3),
    )
    features = zones_geo.get("features") or []
    if not features:
        raise RuntimeError("zones 为空")
    directions = {(f.get("properties") or {}).get("direction") for f in features}
    if "subsidence" not in directions:
        raise RuntimeError("未生成沉降区")
    if "uplift" not in directions:
        raise RuntimeError("未生成抬升区")

    print(json.dumps({"ok": True, "meta": meta, "zone_count": len(features)}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"smoke_test_failed: {e}", file=sys.stderr)
        sys.exit(2)

