# -*- coding: utf-8 -*-
"""
Supabase-based Knowledge Graph - lightweight alternative to Neo4j.
Uses Supabase tables (kg_nodes, kg_edges) + networkx for in-memory queries.
"""

import os
import math
import requests
import numpy as np
import networkx as nx
from typing import Dict, List, Optional


def _base_url():
    return os.environ.get('SUPABASE_URL', '').rstrip('/')

def _headers():
    anon = os.environ.get('SUPABASE_ANON_KEY', '')
    h = {
        'apikey': anon,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    }
    if anon:
        h['Authorization'] = f'Bearer {anon}'
    return h


class SupabaseKnowledgeGraph:
    """Knowledge graph backed by Supabase tables + networkx."""

    def __init__(self):
        self.G = nx.DiGraph()
        self._loaded = False

    def _load(self):
        """Load nodes and edges from Supabase into networkx graph."""
        if self._loaded:
            return
        try:
            # Fetch nodes
            r = requests.get(
                f"{_base_url()}/rest/v1/kg_nodes?select=*",
                headers=_headers(), timeout=10,
            )
            r.raise_for_status()
            nodes = r.json()

            # Fetch edges
            r2 = requests.get(
                f"{_base_url()}/rest/v1/kg_edges?select=*",
                headers=_headers(), timeout=10,
            )
            r2.raise_for_status()
            edges = r2.json()

            for n in nodes:
                self.G.add_node(n['id'], node_type=n['node_type'],
                                label=n['label'], properties=n.get('properties', {}))
            for e in edges:
                self.G.add_edge(e['source_id'], e['target_id'],
                                edge_type=e['edge_type'], properties=e.get('properties', {}))
            self._loaded = True
        except Exception as ex:
            print(f"[KG] Failed to load from Supabase: {ex}")
            self._loaded = False

    # ---- Query methods (match mock output format) ----

    def get_stats(self) -> Dict:
        self._load()
        node_types: Dict[str, int] = {}
        for _, data in self.G.nodes(data=True):
            t = data.get('node_type', 'Unknown')
            node_types[t] = node_types.get(t, 0) + 1

        edge_types: Dict[str, int] = {}
        for _, _, data in self.G.edges(data=True):
            t = data.get('edge_type', 'Unknown')
            edge_types[t] = edge_types.get(t, 0) + 1

        return {
            'success': True,
            'total_nodes': self.G.number_of_nodes(),
            'total_edges': self.G.number_of_edges(),
            'node_types': node_types,
            'edge_types': edge_types,
        }

    def get_neighbors(self, point_id: str) -> Dict:
        self._load()
        cx, cy = 400, 300
        nodes_out = [{'id': point_id, 'label': point_id,
                       'type': self.G.nodes[point_id].get('node_type', 'MonitoringPoint') if point_id in self.G else 'MonitoringPoint',
                       'color': '#06b6d4', 'size': 20, 'x': cx, 'y': cy}]
        edges_out = []

        if point_id not in self.G:
            return {'success': True, 'center': point_id, 'nodes': nodes_out, 'edges': edges_out}

        # Collect neighbors (both directions)
        neighbor_ids = set(self.G.successors(point_id)) | set(self.G.predecessors(point_id))
        color_map = {
            'MonitoringPoint': '#06b6d4',
            'ConstructionEvent': '#f59e0b',
            'Anomaly': '#ef4444',
            'GeologicalStructure': '#a78bfa',
        }
        i = 0
        for nid in list(neighbor_ids)[:12]:
            ndata = self.G.nodes.get(nid, {})
            ntype = ndata.get('node_type', 'Unknown')
            angle = (i / max(len(neighbor_ids), 1)) * math.pi * 2
            nodes_out.append({
                'id': nid,
                'label': ndata.get('label', nid),
                'type': ntype,
                'color': color_map.get(ntype, '#8b5cf6'),
                'size': 16,
                'x': cx + math.cos(angle) * 120,
                'y': cy + math.sin(angle) * 120,
            })
            # Determine edge direction and type
            if self.G.has_edge(point_id, nid):
                edata = self.G.edges[point_id, nid]
                edges_out.append({'source': point_id, 'target': nid,
                                   'type': edata.get('edge_type', ''),
                                   'color': '#38bdf8', 'label': edata.get('edge_type', '')})
            elif self.G.has_edge(nid, point_id):
                edata = self.G.edges[nid, point_id]
                edges_out.append({'source': nid, 'target': point_id,
                                   'type': edata.get('edge_type', ''),
                                   'color': '#f87171', 'label': edata.get('edge_type', '')})
            i += 1

        return {'success': True, 'center': point_id, 'nodes': nodes_out, 'edges': edges_out}

    def get_risk_points(self, min_severity: str = 'high') -> Dict:
        self._load()
        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        cutoff = severity_order.get(min_severity, 1)

        risk_points = []
        for nid, data in self.G.nodes(data=True):
            if data.get('node_type') != 'Anomaly':
                continue
            props = data.get('properties', {})
            sev = props.get('severity', 'medium')
            if severity_order.get(sev, 3) <= cutoff:
                # Find which monitoring point this anomaly is linked to
                linked_point = None
                for _, target, edata in self.G.out_edges(nid, data=True):
                    if edata.get('edge_type') == 'DETECTED_AT':
                        linked_point = target
                        break
                if not linked_point:
                    for source, _, edata in self.G.in_edges(nid, data=True):
                        if self.G.nodes.get(source, {}).get('node_type') == 'MonitoringPoint':
                            linked_point = source
                            break

                risk_points.append({
                    'point_id': linked_point or nid,
                    'severity': sev,
                    'anomaly_count': props.get('anomaly_count', 1),
                    'latest_anomaly_date': props.get('date', ''),
                    'description': props.get('description', data.get('label', '')),
                })

        risk_points.sort(key=lambda p: severity_order.get(p['severity'], 3))
        return {'success': True, 'risk_points': risk_points, 'total': len(risk_points)}

    def answer_question(self, question: str) -> Dict:
        """Simple rule-based QA over the graph."""
        self._load()
        answer_parts = []

        # Extract point IDs from question
        import re
        point_matches = re.findall(r'S\d+', question, re.IGNORECASE)

        if point_matches:
            pid = point_matches[0].upper()
            if pid in self.G:
                neighbors = list(set(self.G.successors(pid)) | set(self.G.predecessors(pid)))
                n_monitoring = [n for n in neighbors if self.G.nodes.get(n, {}).get('node_type') == 'MonitoringPoint']
                n_anomaly = [n for n in neighbors if self.G.nodes.get(n, {}).get('node_type') == 'Anomaly']
                answer_parts.append(f"{pid} has {len(n_monitoring)} nearby monitoring points and {len(n_anomaly)} associated anomalies.")
                if n_monitoring:
                    answer_parts.append(f"Nearby points: {', '.join(n_monitoring[:5])}")
                if n_anomaly:
                    answer_parts.append(f"Anomaly nodes: {', '.join(n_anomaly[:3])}")
            else:
                answer_parts.append(f"{pid} not found in knowledge graph.")

        # General stats
        stats = self.get_stats()
        answer_parts.append(
            f"Knowledge graph has {stats['total_nodes']} nodes and {stats['total_edges']} edges."
        )

        # Risk info
        risk = self.get_risk_points('high')
        if risk['risk_points']:
            high_risk = [p['point_id'] for p in risk['risk_points'][:3]]
            answer_parts.append(f"High-risk points: {', '.join(high_risk)}")

        return {
            'success': True,
            'question': question,
            'answer': ' '.join(answer_parts),
            'sources': ['supabase_knowledge_graph', 'networkx_analysis'],
            'confidence': 0.8,
        }
