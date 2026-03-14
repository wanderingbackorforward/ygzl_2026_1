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
        """Load nodes and edges from Supabase into networkx graph. Auto-build if empty."""
        if self._loaded:
            return
        try:
            # Fetch nodes
            r = requests.get(
                f"{_base_url()}/rest/v1/kg_nodes?select=*",
                headers=_headers(), timeout=10,
            )
            if r.status_code == 404:
                # Table doesn't exist yet - try to create it
                self._create_tables()
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

            # Auto-build if tables are empty
            if not nodes:
                print("[KG] Tables empty, auto-building from settlement data...")
                self._auto_build()
                # Re-fetch after build
                r = requests.get(f"{_base_url()}/rest/v1/kg_nodes?select=*",
                                 headers=_headers(), timeout=10)
                r.raise_for_status()
                nodes = r.json()
                r2 = requests.get(f"{_base_url()}/rest/v1/kg_edges?select=*",
                                  headers=_headers(), timeout=10)
                r2.raise_for_status()
                edges = r2.json()

            for n in nodes:
                self.G.add_node(n['id'], node_type=n['node_type'],
                                label=n['label'], properties=n.get('properties', {}))
            for e in edges:
                self.G.add_edge(e['source_id'], e['target_id'],
                                edge_type=e['edge_type'], properties=e.get('properties', {}))
            self._loaded = True
            print(f"[KG] Loaded {len(nodes)} nodes, {len(edges)} edges")
        except Exception as ex:
            print(f"[KG] Failed to load from Supabase: {ex}")
            self._loaded = False

    def _create_tables(self):
        """Create kg_nodes and kg_edges tables via Supabase SQL."""
        sql = """
        CREATE TABLE IF NOT EXISTS kg_nodes (
          id TEXT PRIMARY KEY,
          node_type TEXT NOT NULL,
          label TEXT NOT NULL,
          properties JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS kg_edges (
          id SERIAL PRIMARY KEY,
          source_id TEXT NOT NULL,
          target_id TEXT NOT NULL,
          edge_type TEXT NOT NULL,
          properties JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """
        try:
            r = requests.post(
                f"{_base_url()}/rest/v1/rpc/exec_sql",
                headers=_headers(), json={'query': sql}, timeout=15
            )
            print(f"[KG] Create tables: {r.status_code}")
        except Exception as ex:
            print(f"[KG] Cannot auto-create tables: {ex}")

    def _auto_build(self):
        """Auto-populate KG from existing settlement data in Supabase."""
        try:
            # 1. Fetch settlement point IDs
            r = requests.get(
                f"{_base_url()}/rest/v1/processed_settlement_data?select=point_id&limit=1000",
                headers=_headers(), timeout=15,
            )
            r.raise_for_status()
            point_ids = sorted(set(row['point_id'] for row in r.json()))
            if not point_ids:
                print("[KG] No settlement data for auto-build")
                return

            # 2. Fetch monitoring point coordinates
            coords = {}
            try:
                r_pts = requests.get(
                    f"{_base_url()}/rest/v1/monitoring_points?select=point_id,x_coord,y_coord",
                    headers=_headers(), timeout=10,
                )
                if r_pts.ok:
                    for p in r_pts.json():
                        coords[p['point_id']] = (float(p.get('x_coord', 0)), float(p.get('y_coord', 0)))
            except Exception:
                pass

            # 3. Build nodes
            nodes = []
            for pid in point_ids:
                xy = coords.get(pid, (0, 0))
                nodes.append({
                    'id': pid, 'node_type': 'MonitoringPoint',
                    'label': pid, 'properties': {'x': xy[0], 'y': xy[1]},
                })

            # Anomaly nodes: points with large cumulative settlement
            for pid in point_ids:
                try:
                    r_s = requests.get(
                        f"{_base_url()}/rest/v1/processed_settlement_data"
                        f"?select=cumulative_change&point_id=eq.{pid}&order=measurement_date.desc&limit=1",
                        headers=_headers(), timeout=8,
                    )
                    if r_s.ok and r_s.json():
                        val = float(r_s.json()[0].get('cumulative_change', 0))
                        if abs(val) > 15:
                            sev = 'critical' if abs(val) > 25 else 'high' if abs(val) > 20 else 'medium'
                            nodes.append({
                                'id': f'anomaly_{pid}', 'node_type': 'Anomaly',
                                'label': f'{pid} anomaly ({val:.1f}mm)',
                                'properties': {'severity': sev, 'value': val, 'anomaly_count': 1,
                                               'description': f'{pid} cumulative {val:.1f}mm'},
                            })
                except Exception:
                    pass

            # 4. Build edges
            edges = []
            # Spatial proximity (distance < 50m)
            pids_with_coords = [p for p in point_ids if p in coords]
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

            # Anomaly -> MonitoringPoint
            for pid in point_ids:
                aid = f'anomaly_{pid}'
                if any(n['id'] == aid for n in nodes):
                    edges.append({
                        'source_id': aid, 'target_id': pid,
                        'edge_type': 'DETECTED_AT', 'properties': {},
                    })

            # 5. Upsert to Supabase
            if nodes:
                h = _headers()
                h['Prefer'] = 'resolution=merge-duplicates,return=representation'
                for i in range(0, len(nodes), 50):
                    requests.post(f"{_base_url()}/rest/v1/kg_nodes",
                                  headers=h, json=nodes[i:i+50], timeout=15)

            if edges:
                for i in range(0, len(edges), 50):
                    requests.post(f"{_base_url()}/rest/v1/kg_edges",
                                  headers=_headers(), json=edges[i:i+50], timeout=15)

            print(f"[KG] Auto-built: {len(nodes)} nodes, {len(edges)} edges")

        except Exception as ex:
            print(f"[KG] Auto-build failed: {ex}")

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

    # ---- Document Management ----

    def list_documents(self, limit: int = 50, offset: int = 0) -> Dict:
        """List uploaded documents."""
        try:
            url = (f"{_base_url()}/rest/v1/kg_documents"
                   f"?select=id,title,source_type,source_url,file_size,"
                   f"processed,entity_count,relation_count,uploaded_at,processed_at"
                   f"&order=uploaded_at.desc&limit={limit}&offset={offset}")
            r = requests.get(url, headers=_headers(), timeout=10)
            r.raise_for_status()
            docs = r.json()

            # Get total count
            h = _headers()
            h['Prefer'] = 'count=exact'
            h['Range-Unit'] = 'items'
            h['Range'] = '0-0'
            r2 = requests.get(
                f"{_base_url()}/rest/v1/kg_documents?select=id",
                headers=h, timeout=10,
            )
            total = 0
            cr = r2.headers.get('content-range', '')
            if '/' in cr:
                try:
                    total = int(cr.split('/')[1])
                except (ValueError, IndexError):
                    total = len(docs)
            else:
                total = len(docs)

            return {'success': True, 'documents': docs, 'total': total}
        except Exception as ex:
            print(f"[KG] list_documents failed: {ex}")
            return {'success': False, 'message': str(ex), 'documents': [], 'total': 0}

    def add_document(self, title: str, content: str,
                     source_type: str = 'text', source_url: str = '') -> Dict:
        """Add a new document to the knowledge base."""
        try:
            doc = {
                'title': title,
                'content': content,
                'source_type': source_type,
                'source_url': source_url,
                'file_size': len(content.encode('utf-8')) if content else 0,
                'processed': False,
            }
            r = requests.post(
                f"{_base_url()}/rest/v1/kg_documents",
                headers=_headers(), json=doc, timeout=10,
            )
            r.raise_for_status()
            created = r.json()
            doc_id = created[0]['id'] if isinstance(created, list) else created.get('id')
            return {'success': True, 'document_id': doc_id, 'message': 'Document added'}
        except Exception as ex:
            print(f"[KG] add_document failed: {ex}")
            return {'success': False, 'message': str(ex)}

    def get_document(self, doc_id: str) -> Dict:
        """Get a single document by ID."""
        try:
            r = requests.get(
                f"{_base_url()}/rest/v1/kg_documents?id=eq.{doc_id}&select=*",
                headers=_headers(), timeout=10,
            )
            r.raise_for_status()
            docs = r.json()
            if not docs:
                return {'success': False, 'message': 'Document not found'}
            return {'success': True, 'document': docs[0]}
        except Exception as ex:
            print(f"[KG] get_document failed: {ex}")
            return {'success': False, 'message': str(ex)}

    def delete_document(self, doc_id: str) -> Dict:
        """Delete a document and its extracted entities/relations."""
        try:
            # 1. Delete document-entity links
            requests.delete(
                f"{_base_url()}/rest/v1/kg_document_entities?document_id=eq.{doc_id}",
                headers=_headers(), timeout=10,
            )
            # 2. Delete nodes from this document
            requests.delete(
                f"{_base_url()}/rest/v1/kg_edges?document_id=eq.{doc_id}",
                headers=_headers(), timeout=10,
            )
            requests.delete(
                f"{_base_url()}/rest/v1/kg_nodes?document_id=eq.{doc_id}",
                headers=_headers(), timeout=10,
            )
            # 3. Delete the document itself
            r = requests.delete(
                f"{_base_url()}/rest/v1/kg_documents?id=eq.{doc_id}",
                headers=_headers(), timeout=10,
            )
            r.raise_for_status()
            # Invalidate cache so next query reloads
            self._loaded = False
            self.G.clear()
            return {'success': True, 'message': 'Document deleted'}
        except Exception as ex:
            print(f"[KG] delete_document failed: {ex}")
            return {'success': False, 'message': str(ex)}

    def process_document(self, doc_id: str) -> Dict:
        """Extract entities and relations from a document using rule-based NLP.
        Falls back to simple keyword extraction (no LLM dependency).
        """
        try:
            import re as _re

            # 1. Fetch document content
            doc_result = self.get_document(doc_id)
            if not doc_result.get('success'):
                return doc_result
            doc = doc_result['document']
            content = doc.get('content', '')
            if not content:
                return {'success': False, 'message': 'Document has no content'}

            title = doc.get('title', '')

            # 2. Rule-based entity extraction
            entities = []
            relations = []

            # Extract monitoring point references (S1, S2, ...)
            point_refs = set(_re.findall(r'\b(S\d{1,2})\b', content, _re.IGNORECASE))
            for pid in point_refs:
                pid_upper = pid.upper()
                entities.append({
                    'id': pid_upper,
                    'node_type': 'MonitoringPoint',
                    'label': pid_upper,
                    'properties': {},
                })

            # Extract numeric values with units (e.g., "15mm", "3.5 mm/day")
            measurements = _re.findall(
                r'(\d+\.?\d*)\s*(mm|cm|m|mm/day|cm/day)', content, _re.IGNORECASE
            )

            # Extract keywords as concept entities
            keyword_patterns = {
                'settlement': ['settlement', 'subsidence', 'deformation',
                               'sinking', 'heave'],
                'crack': ['crack', 'fracture', 'fissure'],
                'geology': ['clay', 'sand', 'rock', 'soil', 'groundwater',
                            'karst', 'limestone', 'granite'],
                'construction': ['excavation', 'blasting', 'tunneling',
                                 'drilling', 'grouting', 'reinforcement'],
                'risk': ['risk', 'danger', 'warning', 'alert', 'threshold',
                         'critical', 'failure'],
            }
            # Also check Chinese keywords
            cn_keyword_patterns = {
                'settlement': ['沉降', '下沉', '变形', '隆起'],
                'crack': ['裂缝', '裂纹', '开裂'],
                'geology': ['粘土', '砂土', '岩石', '土壤', '地下水',
                            '溶洞', '石灰岩', '花岗岩'],
                'construction': ['开挖', '爆破', '盾构', '钻孔', '注浆', '加固'],
                'risk': ['风险', '危险', '预警', '阈值', '临界', '破坏'],
            }

            content_lower = content.lower()
            found_concepts = set()
            for category, keywords in {**keyword_patterns, **cn_keyword_patterns}.items():
                for kw in keywords:
                    if kw.lower() in content_lower or kw in content:
                        concept_id = f"concept_{category}"
                        if concept_id not in found_concepts:
                            found_concepts.add(concept_id)
                            entities.append({
                                'id': concept_id,
                                'node_type': 'Concept',
                                'label': category.capitalize(),
                                'properties': {'category': category},
                            })

            # Create a document node
            doc_node_id = f"doc_{doc_id[:8]}"
            entities.append({
                'id': doc_node_id,
                'node_type': 'Document',
                'label': title[:60] if title else 'Untitled',
                'properties': {'doc_id': doc_id, 'source_type': doc.get('source_type', 'text')},
            })

            # 3. Build relations
            # Document -> mentions -> entities
            for ent in entities:
                if ent['id'] != doc_node_id:
                    relations.append({
                        'source_id': doc_node_id,
                        'target_id': ent['id'],
                        'edge_type': 'MENTIONS',
                        'properties': {},
                        'confidence': 0.9,
                    })

            # Point-to-concept relations
            for pid in point_refs:
                pid_upper = pid.upper()
                for concept_id in found_concepts:
                    relations.append({
                        'source_id': pid_upper,
                        'target_id': concept_id,
                        'edge_type': 'RELATED_TO',
                        'properties': {'source': 'document_extraction'},
                        'confidence': 0.7,
                    })

            # 4. Upsert entities to Supabase
            h = _headers()
            h['Prefer'] = 'resolution=merge-duplicates,return=representation'
            node_rows = []
            for ent in entities:
                node_rows.append({
                    'id': ent['id'],
                    'node_type': ent['node_type'],
                    'label': ent['label'],
                    'properties': ent.get('properties', {}),
                    'document_id': doc_id,
                    'source': 'document',
                })
            if node_rows:
                requests.post(f"{_base_url()}/rest/v1/kg_nodes",
                              headers=h, json=node_rows, timeout=15)

            # 5. Insert edges
            edge_rows = []
            for rel in relations:
                edge_rows.append({
                    'source_id': rel['source_id'],
                    'target_id': rel['target_id'],
                    'edge_type': rel['edge_type'],
                    'properties': rel.get('properties', {}),
                    'document_id': doc_id,
                    'confidence': rel.get('confidence', 0.8),
                })
            if edge_rows:
                requests.post(f"{_base_url()}/rest/v1/kg_edges",
                              headers=_headers(), json=edge_rows, timeout=15)

            # 6. Insert document-entity links
            de_rows = []
            for ent in entities:
                if ent['id'] != doc_node_id:
                    de_rows.append({
                        'document_id': doc_id,
                        'entity_id': ent['id'],
                        'mention_count': 1,
                    })
            if de_rows:
                h2 = _headers()
                h2['Prefer'] = 'resolution=merge-duplicates'
                requests.post(f"{_base_url()}/rest/v1/kg_document_entities",
                              headers=h2, json=de_rows, timeout=15)

            # 7. Generate summary (first 200 chars)
            summary = content[:200].strip()
            if len(content) > 200:
                summary += '...'

            # 8. Update document status
            patch = {
                'processed': True,
                'entity_count': len(entities),
                'relation_count': len(relations),
                'summary': summary,
                'processed_at': datetime.utcnow().isoformat(),
            }
            requests.patch(
                f"{_base_url()}/rest/v1/kg_documents?id=eq.{doc_id}",
                headers=_headers(), json=patch, timeout=10,
            )

            # Invalidate cache
            self._loaded = False
            self.G.clear()

            return {
                'success': True,
                'document_id': doc_id,
                'entities_extracted': len(entities),
                'relations_extracted': len(relations),
                'message': 'Document processed successfully',
            }

        except Exception as ex:
            print(f"[KG] process_document failed: {ex}")
            return {'success': False, 'message': str(ex)}
