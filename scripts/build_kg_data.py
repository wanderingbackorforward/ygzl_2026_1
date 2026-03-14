# -*- coding: utf-8 -*-
"""
Build knowledge graph data from existing Supabase tables.
Reads settlement/temperature/crack data and populates kg_nodes + kg_edges.

Usage: python scripts/build_kg_data.py
"""

import os
import sys
import requests
import numpy as np

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))


def _base_url():
    return os.environ.get('SUPABASE_URL', '').rstrip('/')

def _headers():
    anon = os.environ.get('SUPABASE_ANON_KEY', '')
    h = {'apikey': anon, 'Accept': 'application/json',
         'Content-Type': 'application/json', 'Prefer': 'return=representation'}
    if anon:
        h['Authorization'] = f'Bearer {anon}'
    return h


def upsert_nodes(nodes):
    """Batch upsert nodes into kg_nodes."""
    if not nodes:
        return
    url = f"{_base_url()}/rest/v1/kg_nodes"
    h = _headers()
    h['Prefer'] = 'resolution=merge-duplicates,return=representation'
    r = requests.post(url, headers=h, json=nodes, timeout=30)
    r.raise_for_status()
    print(f"  Upserted {len(nodes)} nodes")


def insert_edges(edges):
    """Batch insert edges into kg_edges (delete existing first)."""
    if not edges:
        return
    # Clear existing edges
    url_del = f"{_base_url()}/rest/v1/kg_edges?id=gt.0"
    requests.delete(url_del, headers=_headers(), timeout=15)

    url = f"{_base_url()}/rest/v1/kg_edges"
    # Insert in chunks of 100
    for i in range(0, len(edges), 100):
        chunk = edges[i:i+100]
        r = requests.post(url, headers=_headers(), json=chunk, timeout=30)
        r.raise_for_status()
    print(f"  Inserted {len(edges)} edges")


def fetch_settlement_points():
    """Get unique point IDs from settlement data."""
    url = f"{_base_url()}/rest/v1/processed_settlement_data?select=point_id&limit=1000"
    r = requests.get(url, headers=_headers(), timeout=15)
    r.raise_for_status()
    rows = r.json()
    return list(set(row['point_id'] for row in rows))


def fetch_monitoring_points():
    """Get monitoring point coordinates."""
    url = f"{_base_url()}/rest/v1/monitoring_points?select=point_id,x_coord,y_coord"
    r = requests.get(url, headers=_headers(), timeout=15)
    r.raise_for_status()
    return r.json()


def fetch_construction_events():
    """Get construction events."""
    url = f"{_base_url()}/rest/v1/construction_events?select=*&limit=50"
    r = requests.get(url, headers=_headers(), timeout=15)
    if r.status_code == 200:
        return r.json()
    return []


def build_graph():
    print("[1/4] Fetching data from Supabase...")
    point_ids = fetch_settlement_points()
    monitoring_pts = fetch_monitoring_points()
    events = fetch_construction_events()

    print(f"  Found {len(point_ids)} settlement points, {len(monitoring_pts)} monitoring points, {len(events)} events")

    # Build coordinate lookup
    coords = {}
    for p in monitoring_pts:
        coords[p['point_id']] = (float(p.get('x_coord', 0)), float(p.get('y_coord', 0)))

    # ---- Nodes ----
    print("[2/4] Building nodes...")
    nodes = []

    # Monitoring point nodes
    for pid in point_ids:
        xy = coords.get(pid, (0, 0))
        nodes.append({
            'id': pid,
            'node_type': 'MonitoringPoint',
            'label': pid,
            'properties': {'x': xy[0], 'y': xy[1]},
        })

    # Construction event nodes
    for ev in events:
        eid = f"event_{ev.get('id', ev.get('event_id', ''))}"
        nodes.append({
            'id': eid,
            'node_type': 'ConstructionEvent',
            'label': ev.get('event_name', ev.get('name', eid)),
            'properties': {
                'date': str(ev.get('event_date', ev.get('start_date', ''))),
                'description': ev.get('description', ''),
            },
        })

    # Anomaly nodes (derived: points with large settlement)
    # Use simple heuristic: create anomaly nodes for points that likely have issues
    anomaly_count = 0
    for pid in point_ids:
        # Fetch latest settlement for this point
        url = f"{_base_url()}/rest/v1/processed_settlement_data?select=cumulative_change&point_id=eq.{pid}&order=measurement_date.desc&limit=1"
        try:
            r = requests.get(url, headers=_headers(), timeout=10)
            if r.ok and r.json():
                val = float(r.json()[0].get('cumulative_change', 0))
                if abs(val) > 15:  # Significant settlement
                    severity = 'critical' if abs(val) > 25 else 'high' if abs(val) > 20 else 'medium'
                    aid = f"anomaly_{pid}"
                    nodes.append({
                        'id': aid,
                        'node_type': 'Anomaly',
                        'label': f"{pid} anomaly ({val:.1f}mm)",
                        'properties': {
                            'severity': severity,
                            'value': val,
                            'anomaly_count': 1,
                            'description': f"{pid} cumulative settlement {val:.1f}mm",
                        },
                    })
                    anomaly_count += 1
        except Exception:
            pass

    print(f"  {len(point_ids)} MonitoringPoint + {len(events)} ConstructionEvent + {anomaly_count} Anomaly = {len(nodes)} total nodes")

    # ---- Edges ----
    print("[3/4] Building edges...")
    edges = []

    # Spatial proximity edges (distance < 50m)
    pids_with_coords = [pid for pid in point_ids if pid in coords]
    for i, p1 in enumerate(pids_with_coords):
        for p2 in pids_with_coords[i+1:]:
            c1, c2 = coords[p1], coords[p2]
            dist = np.sqrt((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2)
            if dist < 50:
                edges.append({
                    'source_id': p1, 'target_id': p2,
                    'edge_type': 'SPATIAL_NEAR',
                    'properties': {'distance': round(dist, 1)},
                })

    # Anomaly -> MonitoringPoint edges
    for pid in point_ids:
        aid = f"anomaly_{pid}"
        if any(n['id'] == aid for n in nodes):
            edges.append({
                'source_id': aid, 'target_id': pid,
                'edge_type': 'DETECTED_AT',
                'properties': {},
            })

    # ConstructionEvent -> nearest MonitoringPoint edges
    for ev in events:
        eid = f"event_{ev.get('id', ev.get('event_id', ''))}"
        # Link to first 3 monitoring points (simplified)
        for pid in point_ids[:3]:
            edges.append({
                'source_id': eid, 'target_id': pid,
                'edge_type': 'AFFECTS',
                'properties': {},
            })

    print(f"  {len(edges)} total edges")

    # ---- Upload ----
    print("[4/4] Uploading to Supabase...")
    upsert_nodes(nodes)
    insert_edges(edges)

    print(f"\n[Done] Knowledge graph built: {len(nodes)} nodes, {len(edges)} edges")


if __name__ == '__main__':
    from dotenv import load_dotenv
    load_dotenv()
    build_graph()
