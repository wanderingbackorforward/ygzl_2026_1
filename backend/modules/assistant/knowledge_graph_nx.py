# -*- coding: utf-8 -*-
"""
In-memory knowledge graph using networkx.
Replaces Neo4j dependency. Singleton with 5-min TTL cache for Serverless reuse.

Node types: MonitoringPoint, ConstructionEvent, Anomaly
Edge types: SPATIAL_NEAR, CORRELATES_WITH, CAUSES, DETECTED_AT
"""
import time
import numpy as np
import pandas as pd

try:
    import networkx as nx
except ImportError:
    nx = None


_KG_INSTANCE = None
_KG_TTL = 300  # 5 minutes


def get_knowledge_graph():
    """Singleton accessor."""
    global _KG_INSTANCE
    if _KG_INSTANCE is None:
        _KG_INSTANCE = KnowledgeGraphNX()
    return _KG_INSTANCE


class KnowledgeGraphNX:
    """In-memory knowledge graph backed by networkx."""

    def __init__(self):
        if nx is None:
            raise ImportError("networkx is required. pip install networkx")
        self.G = nx.DiGraph()
        self._built_at = 0
        self._build_params = {}

    def is_built(self):
        if not self._built_at:
            return False
        if time.time() - self._built_at > _KG_TTL:
            return False
        return len(self.G.nodes) > 0

    def build(self, distance_threshold=50, correlation_threshold=0.7):
        """
        Build the knowledge graph from Supabase data.
        Returns stats dict.
        """
        from ..ml_models.supabase_data import (
            fetch_monitoring_points,
            fetch_all_settlement,
        )
        import os
        import requests

        self.G.clear()
        stats = {"nodes": 0, "edges": 0, "point_nodes": 0, "event_nodes": 0, "anomaly_nodes": 0}

        # --- 1. Monitoring Points ---
        pts_df = fetch_monitoring_points()
        for _, row in pts_df.iterrows():
            pid = row['point_id']
            self.G.add_node(
                f"point:{pid}",
                type="MonitoringPoint",
                point_id=pid,
                x=float(row.get('x_coord', 0)),
                y=float(row.get('y_coord', 0)),
            )
            stats["point_nodes"] += 1

        # --- 2. Construction Events ---
        try:
            anon = os.environ.get('SUPABASE_ANON_KEY', '')
            base = os.environ.get('SUPABASE_URL', '').rstrip('/')
            hdr = {'apikey': anon, 'Accept': 'application/json'}
            if anon:
                hdr['Authorization'] = f'Bearer {anon}'
            r = requests.get(
                f"{base}/rest/v1/construction_events?select=*&limit=100",
                headers=hdr, timeout=15,
            )
            if r.ok:
                events = r.json()
                for ev in events:
                    eid = ev.get('id') or ev.get('event_id', '')
                    nid = f"event:{eid}"
                    self.G.add_node(
                        nid,
                        type="ConstructionEvent",
                        event_type=ev.get('event_type', ''),
                        description=ev.get('description', ''),
                        start_date=str(ev.get('start_date', '')),
                        end_date=str(ev.get('end_date', '')),
                    )
                    stats["event_nodes"] += 1
        except Exception as e:
            print(f"[KG] Events fetch failed: {e}")

        # --- 3. Spatial edges ---
        point_nodes = [n for n, d in self.G.nodes(data=True) if d.get('type') == 'MonitoringPoint']
        for i, n1 in enumerate(point_nodes):
            d1 = self.G.nodes[n1]
            for n2 in point_nodes[i + 1:]:
                d2 = self.G.nodes[n2]
                dist = np.sqrt((d1['x'] - d2['x']) ** 2 + (d1['y'] - d2['y']) ** 2)
                if dist <= distance_threshold:
                    self.G.add_edge(n1, n2, type="SPATIAL_NEAR", distance=round(float(dist), 2))
                    self.G.add_edge(n2, n1, type="SPATIAL_NEAR", distance=round(float(dist), 2))

        # --- 4. Correlation edges ---
        try:
            all_df = fetch_all_settlement()
            if not all_df.empty:
                pivot = all_df.pivot_table(
                    index='measurement_date', columns='point_id', values='cumulative_change',
                )
                pivot = pivot.dropna(axis=1, how='all')
                if hasattr(pivot, 'ffill'):
                    pivot = pivot.ffill().fillna(0)
                else:
                    pivot = pivot.fillna(method='ffill').fillna(0)

                if pivot.shape[1] >= 2:
                    corr = pivot.corr()
                    for i, c1 in enumerate(corr.columns):
                        for c2 in corr.columns[i + 1:]:
                            val = corr.loc[c1, c2]
                            if abs(val) >= correlation_threshold:
                                n1, n2 = f"point:{c1}", f"point:{c2}"
                                if self.G.has_node(n1) and self.G.has_node(n2):
                                    self.G.add_edge(
                                        n1, n2, type="CORRELATES_WITH",
                                        correlation=round(float(val), 3),
                                    )
                                    self.G.add_edge(
                                        n2, n1, type="CORRELATES_WITH",
                                        correlation=round(float(val), 3),
                                    )
        except Exception as e:
            print(f"[KG] Correlation calc failed: {e}")

        # --- 5. Anomaly nodes (lightweight - just run on first 10 points) ---
        try:
            from ..ml_models.anomaly_detector import detect_anomalies_for_point
            from ..ml_models.supabase_data import fetch_point_settlement

            checked = 0
            for n in point_nodes[:10]:
                pid = self.G.nodes[n]['point_id']
                df = fetch_point_settlement(pid)
                if df.empty or len(df) < 10:
                    continue
                res = detect_anomalies_for_point(pid, df=df, method='isolation_forest', contamination=0.05)
                if res.get('success') and res.get('anomalies'):
                    for j, a in enumerate(res['anomalies'][:3]):  # max 3 anomalies per point
                        aid = f"anomaly:{pid}_{j}"
                        self.G.add_node(
                            aid,
                            type="Anomaly",
                            point_id=pid,
                            severity=a.get('severity', 'low'),
                            anomaly_type=a.get('anomaly_type', 'unknown'),
                            date=str(a.get('date', '')),
                            settlement=round(float(a.get('settlement', 0)), 3),
                        )
                        stats["anomaly_nodes"] += 1
                        self.G.add_edge(aid, n, type="DETECTED_AT")
                checked += 1
        except Exception as e:
            print(f"[KG] Anomaly detection failed: {e}")

        stats["nodes"] = self.G.number_of_nodes()
        stats["edges"] = self.G.number_of_edges()
        self._built_at = time.time()
        self._build_params = {
            "distance_threshold": distance_threshold,
            "correlation_threshold": correlation_threshold,
        }
        return stats

    def statistics(self):
        """Return graph summary statistics."""
        type_counts = {}
        edge_type_counts = {}
        for _, d in self.G.nodes(data=True):
            t = d.get('type', 'Unknown')
            type_counts[t] = type_counts.get(t, 0) + 1
        for _, _, d in self.G.edges(data=True):
            t = d.get('type', 'Unknown')
            edge_type_counts[t] = edge_type_counts.get(t, 0) + 1

        return {
            "total_nodes": self.G.number_of_nodes(),
            "total_edges": self.G.number_of_edges(),
            "node_types": type_counts,
            "edge_types": edge_type_counts,
            "built_at": self._built_at,
            "build_params": self._build_params,
        }

    def neighbors(self, node_id):
        """Get all neighbors of a node with edge info."""
        if not self.G.has_node(node_id):
            return {"error": f"Node {node_id} not found"}
        result = []
        for neighbor in self.G.neighbors(node_id):
            edge_data = self.G.edges[node_id, neighbor]
            node_data = dict(self.G.nodes[neighbor])
            result.append({
                "node_id": neighbor,
                "node_type": node_data.get('type', ''),
                "edge_type": edge_data.get('type', ''),
                "edge_attrs": {k: v for k, v in edge_data.items() if k != 'type'},
                "node_attrs": {k: v for k, v in node_data.items() if k != 'type'},
            })
        return result

    def causal_chain(self, node_id, max_depth=3):
        """Find causal chain from a node (follow CAUSES, CORRELATES_WITH edges)."""
        if not self.G.has_node(node_id):
            return {"error": f"Node {node_id} not found"}
        chain = []
        visited = set()
        queue = [(node_id, 0, [])]
        while queue:
            current, depth, path = queue.pop(0)
            if depth > max_depth or current in visited:
                continue
            visited.add(current)
            for neighbor in self.G.neighbors(current):
                edge = self.G.edges[current, neighbor]
                etype = edge.get('type', '')
                if etype in ('CAUSES', 'CORRELATES_WITH', 'DETECTED_AT'):
                    new_path = path + [{
                        "from": current,
                        "to": neighbor,
                        "edge_type": etype,
                        "attrs": {k: v for k, v in edge.items() if k != 'type'},
                    }]
                    chain.append({
                        "target": neighbor,
                        "depth": depth + 1,
                        "path": new_path,
                    })
                    queue.append((neighbor, depth + 1, new_path))
        return chain

    def risk_points(self):
        """Find high-risk monitoring points (those with critical/high anomalies or many connections)."""
        risk = []
        for n, d in self.G.nodes(data=True):
            if d.get('type') != 'MonitoringPoint':
                continue
            pid = d.get('point_id', '')
            # Count anomalies
            anomaly_count = 0
            critical_count = 0
            for neighbor in self.G.predecessors(n):
                nd = self.G.nodes[neighbor]
                if nd.get('type') == 'Anomaly':
                    anomaly_count += 1
                    if nd.get('severity') in ('critical', 'high'):
                        critical_count += 1
            # Count correlations
            corr_count = sum(
                1 for _, _, ed in self.G.edges(n, data=True)
                if ed.get('type') == 'CORRELATES_WITH'
            )
            spatial_count = sum(
                1 for _, _, ed in self.G.edges(n, data=True)
                if ed.get('type') == 'SPATIAL_NEAR'
            )
            risk_score = critical_count * 3 + anomaly_count + corr_count * 0.5
            if risk_score > 0:
                risk.append({
                    "point_id": pid,
                    "node_id": n,
                    "risk_score": round(risk_score, 1),
                    "anomaly_count": anomaly_count,
                    "critical_anomalies": critical_count,
                    "correlation_links": corr_count,
                    "spatial_neighbors": spatial_count,
                })
        risk.sort(key=lambda x: x['risk_score'], reverse=True)
        return risk

    def spatial_clusters(self):
        """Find spatial clusters of nearby points."""
        # Use undirected view for connected components
        undirected = self.G.to_undirected()
        spatial_graph = nx.Graph()
        for u, v, d in undirected.edges(data=True):
            if d.get('type') == 'SPATIAL_NEAR':
                spatial_graph.add_edge(u, v)

        clusters = []
        for component in nx.connected_components(spatial_graph):
            points = [
                self.G.nodes[n].get('point_id', n)
                for n in component
                if self.G.nodes.get(n, {}).get('type') == 'MonitoringPoint'
            ]
            if len(points) >= 2:
                clusters.append({
                    "cluster_size": len(points),
                    "points": points,
                })
        clusters.sort(key=lambda x: x['cluster_size'], reverse=True)
        return clusters
