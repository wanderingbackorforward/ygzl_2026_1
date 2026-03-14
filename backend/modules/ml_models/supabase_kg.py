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
from datetime import datetime
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
            'Document': '#3b82f6',
            'Concept': '#10b981',
            'Threshold': '#facc15',
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
            edge_color_map = {
                'SPATIAL_NEAR': '#38bdf8',
                'DETECTED_AT': '#f87171',
                'MENTIONS': '#3b82f6',
                'RELATED_TO': '#10b981',
                'CORRELATES_WITH': '#a78bfa',
                'CAUSES': '#fb923c',
                'EXCEEDS_THRESHOLD': '#facc15',
                'NEAR_BY': '#06b6d4',
            }
            if self.G.has_edge(point_id, nid):
                edata = self.G.edges[point_id, nid]
                etype = edata.get('edge_type', '')
                edges_out.append({'source': point_id, 'target': nid,
                                   'type': etype,
                                   'color': edge_color_map.get(etype, '#38bdf8'),
                                   'label': etype})
            elif self.G.has_edge(nid, point_id):
                edata = self.G.edges[nid, point_id]
                etype = edata.get('edge_type', '')
                edges_out.append({'source': nid, 'target': point_id,
                                   'type': etype,
                                   'color': edge_color_map.get(etype, '#f87171'),
                                   'label': etype})
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
        """RAG-enhanced QA: retrieve from documents + graph, then synthesize answer."""
        import re as _re
        self._load()
        answer_parts = []
        sources = []
        confidence = 0.5

        # 1. Extract point IDs from question
        point_matches = _re.findall(r'S\d+', question, _re.IGNORECASE)

        # 2. Search documents for relevant content
        doc_snippets = self._search_documents(question)
        if doc_snippets:
            confidence = min(0.95, confidence + 0.15 * len(doc_snippets))
            for snippet in doc_snippets[:3]:
                sources.append(snippet['title'])

        # 3. Graph-based answers for specific points
        if point_matches:
            pid = point_matches[0].upper()
            if pid in self.G:
                neighbors = list(set(self.G.successors(pid)) | set(self.G.predecessors(pid)))
                n_monitoring = [n for n in neighbors if self.G.nodes.get(n, {}).get('node_type') == 'MonitoringPoint']
                n_anomaly = [n for n in neighbors if self.G.nodes.get(n, {}).get('node_type') == 'Anomaly']
                n_concepts = [n for n in neighbors if self.G.nodes.get(n, {}).get('node_type') == 'Concept']
                n_docs = [n for n in neighbors if self.G.nodes.get(n, {}).get('node_type') == 'Document']

                answer_parts.append(f"{pid} 共有 {len(n_monitoring)} 个邻近监测点、{len(n_anomaly)} 个异常记录。")
                if n_monitoring:
                    answer_parts.append(f"邻近点位: {', '.join(n_monitoring[:5])}")
                if n_anomaly:
                    for aid in n_anomaly[:2]:
                        props = self.G.nodes[aid].get('properties', {})
                        label = self.G.nodes[aid].get('label', aid)
                        answer_parts.append(f"异常: {label}")
                if n_concepts:
                    concept_labels = [self.G.nodes[c].get('label', c) for c in n_concepts[:4]]
                    answer_parts.append(f"相关概念: {', '.join(concept_labels)}")
                if n_docs:
                    doc_labels = [self.G.nodes[d].get('label', d) for d in n_docs[:3]]
                    answer_parts.append(f"相关文献: {', '.join(doc_labels)}")
                    sources.extend(doc_labels)

                confidence = min(0.95, confidence + 0.2)
            else:
                answer_parts.append(f"{pid} 未在知识图谱中找到。")

        # 4. Add document-based context
        if doc_snippets:
            answer_parts.append("\n--- 文献参考 ---")
            for snippet in doc_snippets[:3]:
                text = snippet['content'][:150].strip()
                if len(snippet['content']) > 150:
                    text += '...'
                answer_parts.append(f"[{snippet['title']}] {text}")

        # 5. Keyword-based graph search (if no point specified)
        if not point_matches and not doc_snippets:
            # Try to find relevant nodes by keyword matching
            q_lower = question.lower()
            matched_nodes = []
            for nid, data in self.G.nodes(data=True):
                label = data.get('label', '').lower()
                ntype = data.get('node_type', '')
                if any(kw in q_lower for kw in [label, nid.lower()]):
                    matched_nodes.append((nid, data))
            if matched_nodes:
                for nid, data in matched_nodes[:3]:
                    answer_parts.append(f"{data.get('label', nid)} ({data.get('node_type', '')})")
                confidence = min(0.95, confidence + 0.1)

        # 6. General stats as fallback
        if not answer_parts:
            risk = self.get_risk_points('high')
            if risk['risk_points']:
                high_risk = [p['point_id'] for p in risk['risk_points'][:3]]
                answer_parts.append(f"当前高风险点位: {', '.join(high_risk)}")
            stats = self.get_stats()
            answer_parts.append(
                f"知识图谱包含 {stats['total_nodes']} 个节点和 {stats['total_edges']} 条边。"
            )

        # Deduplicate sources
        seen = set()
        unique_sources = []
        for s in sources:
            if s not in seen:
                seen.add(s)
                unique_sources.append(s)

        return {
            'success': True,
            'question': question,
            'answer': '\n'.join(answer_parts),
            'sources': unique_sources if unique_sources else ['knowledge_graph'],
            'confidence': round(confidence, 2),
        }

    def _search_documents(self, query: str, limit: int = 5) -> List[Dict]:
        """Search documents by keyword matching against title and content."""
        import re as _re
        try:
            # Extract meaningful keywords from query
            # Remove common Chinese question words
            stop_words = ['哪些', '什么', '怎么', '如何', '为什么', '有没有',
                          '是否', '能否', '请问', '告诉', '关于', '的', '了',
                          '吗', '呢', '吧', '啊', '在', '和', '与', '或',
                          'what', 'which', 'how', 'why', 'is', 'are', 'the',
                          'a', 'an', 'of', 'in', 'on', 'for', 'to', 'and']
            words = _re.findall(r'[a-zA-Z]+|[\u4e00-\u9fff]+|S\d+', query)
            keywords = [w for w in words if w.lower() not in stop_words and len(w) > 1]

            if not keywords:
                return []

            # Build OR filter for Supabase text search
            # Search in title and content columns
            results = []
            for kw in keywords[:4]:  # Limit to 4 keywords
                try:
                    # Search title
                    r = requests.get(
                        f"{_base_url()}/rest/v1/kg_documents"
                        f"?select=id,title,content,source_type"
                        f"&or=(title.ilike.*{kw}*,content.ilike.*{kw}*)"
                        f"&limit={limit}",
                        headers=_headers(), timeout=8,
                    )
                    if r.ok:
                        for doc in r.json():
                            if not any(d['id'] == doc['id'] for d in results):
                                results.append(doc)
                except Exception:
                    pass

            return results[:limit]
        except Exception as ex:
            print(f"[KG] _search_documents failed: {ex}")
            return []

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

            # Extract keywords as concept entities (中文标签)
            keyword_patterns = {
                '沉降': ['settlement', 'subsidence', 'deformation', 'sinking', 'heave',
                        '沉降', '下沉', '变形', '隆起', '沉陷'],
                '裂缝': ['crack', 'fracture', 'fissure', '裂缝', '裂纹', '开裂', '龟裂'],
                '地质': ['clay', 'sand', 'rock', 'soil', 'groundwater', 'karst', 'limestone', 'granite',
                        '粘土', '砂土', '岩石', '土壤', '地下水', '溶洞', '石灰岩', '花岗岩', '软土'],
                '施工': ['excavation', 'blasting', 'tunneling', 'drilling', 'grouting', 'reinforcement',
                        '开挖', '爆破', '盾构', '钻孔', '注浆', '加固', '基坑', '隧道'],
                '风险': ['risk', 'danger', 'warning', 'alert', 'threshold', 'critical', 'failure',
                        '风险', '危险', '预警', '阈值', '临界', '破坏', '超限'],
                '监测': ['monitoring', 'measurement', 'survey', 'observation',
                        '监测', '测量', '观测', '巡检'],
                '预测': ['prediction', 'forecast', 'trend', 'model',
                        '预测', '预报', '趋势', '模型'],
            }

            content_lower = content.lower()
            found_concepts = {}  # {concept_id: label}
            for cn_label, keywords in keyword_patterns.items():
                for kw in keywords:
                    if kw.lower() in content_lower or kw in content:
                        concept_id = f"concept_{cn_label}"
                        if concept_id not in found_concepts:
                            found_concepts[concept_id] = cn_label
                            entities.append({
                                'id': concept_id,
                                'node_type': 'Concept',
                                'label': cn_label,  # 中文标签
                                'properties': {'category': cn_label},
                            })
                        break  # 找到一个关键词就够了

            # Extract施工事件实体
            construction_events = []
            event_patterns = [
                (r'爆破|blasting', '爆破施工'),
                (r'开挖|excavation', '基坑开挖'),
                (r'盾构|shield|tunneling', '盾构掘进'),
                (r'注浆|grouting', '注浆加固'),
            ]
            for pattern, event_name in event_patterns:
                if _re.search(pattern, content, _re.IGNORECASE):
                    event_id = f"event_{event_name.replace(' ', '_')}"
                    if event_id not in [e['id'] for e in entities]:
                        entities.append({
                            'id': event_id,
                            'node_type': 'ConstructionEvent',
                            'label': event_name,
                            'properties': {'event_type': event_name},
                        })
                        construction_events.append(event_id)

            # Extract数值实体（沉降量、速率）
            measurements = _re.findall(r'(\d+\.?\d*)\s*(mm|cm|m|mm/day|cm/day)', content, _re.IGNORECASE)
            significant_values = set()
            for val, unit in measurements:
                num = float(val)
                # 只保留显著数值（沉降量 >10mm 或速率 >1mm/day）
                if (unit.lower() in ['mm', 'cm', 'm'] and num >= 10) or \
                   (unit.lower() in ['mm/day', 'cm/day'] and num >= 1):
                    significant_values.add(f"{val}{unit}")

            # Extract阈值实体
            threshold_patterns = _re.findall(r'(阈值|threshold|预警|warning|限值|limit).*?(\d+\.?\d*)\s*(mm|cm)', content, _re.IGNORECASE)
            for _, val, unit in threshold_patterns:
                threshold_id = f"threshold_{val}{unit}"
                if threshold_id not in [e['id'] for e in entities]:
                    entities.append({
                        'id': threshold_id,
                        'node_type': 'Threshold',
                        'label': f"预警阈值 {val}{unit}",
                        'properties': {'value': float(val), 'unit': unit},
                    })

            # Create a document node
            doc_node_id = f"doc_{doc_id[:8]}"
            entities.append({
                'id': doc_node_id,
                'node_type': 'Document',
                'label': title[:60] if title else 'Untitled',
                'properties': {'doc_id': doc_id, 'source_type': doc.get('source_type', 'text')},
            })

            # 3. Build relations (更丰富的关系类型)
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
                for concept_id, concept_label in found_concepts.items():
                    relations.append({
                        'source_id': pid_upper,
                        'target_id': concept_id,
                        'edge_type': 'RELATED_TO',
                        'properties': {'source': 'document_extraction'},
                        'confidence': 0.7,
                    })

            # Construction event -> causes -> settlement (因果关系)
            for event_id in construction_events:
                for pid in point_refs:
                    pid_upper = pid.upper()
                    # 检查文本中是否提到事件影响该点位
                    if _re.search(rf'{event_id.split("_")[1]}.*{pid_upper}|{pid_upper}.*{event_id.split("_")[1]}',
                                  content, _re.IGNORECASE):
                        relations.append({
                            'source_id': event_id,
                            'target_id': pid_upper,
                            'edge_type': 'CAUSES',
                            'properties': {'impact_type': 'settlement'},
                            'confidence': 0.8,
                        })

            # Point -> exceeds -> threshold (超限关系)
            for ent in entities:
                if ent['node_type'] == 'Threshold':
                    threshold_val = ent['properties']['value']
                    # 查找提到超过该阈值的点位
                    for pid in point_refs:
                        pid_upper = pid.upper()
                        # 简单规则：如果点位和阈值在同一句话中，且有"超过/超限/达到"等词
                        sentences = _re.split(r'[。！？\n]', content)
                        for sent in sentences:
                            if pid_upper in sent and str(threshold_val) in sent:
                                if _re.search(r'超过|超限|达到|接近|exceed|reach', sent, _re.IGNORECASE):
                                    relations.append({
                                        'source_id': pid_upper,
                                        'target_id': ent['id'],
                                        'edge_type': 'EXCEEDS_THRESHOLD',
                                        'properties': {},
                                        'confidence': 0.75,
                                    })
                                    break

            # Point-to-point spatial relations (空间邻近)
            # 如果文本中提到"S1和S2"、"S3-S5"等，建立邻近关系
            point_pairs = _re.findall(r'(S\d{1,2})\s*(?:和|与|及|、|,|-)\s*(S\d{1,2})', content, _re.IGNORECASE)
            for p1, p2 in point_pairs:
                p1_upper, p2_upper = p1.upper(), p2.upper()
                if p1_upper != p2_upper:
                    relations.append({
                        'source_id': p1_upper,
                        'target_id': p2_upper,
                        'edge_type': 'NEAR_BY',
                        'properties': {'source': 'text_mention'},
                        'confidence': 0.6,
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
