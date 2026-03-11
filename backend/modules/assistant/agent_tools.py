# -*- coding: utf-8 -*-
"""
Agent tool function implementations.
Each function queries Supabase REST API or calls existing ML modules.
Returns structured dict; on error returns {success: False, error: "..."}.
"""
import os
import time
import requests
import numpy as np
import pandas as pd


# ==================== Supabase helpers ====================

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


def _url(path):
    base = os.environ.get('SUPABASE_URL', '').rstrip('/')
    return f'{base}{path}'


# ==================== Tool implementations ====================


def tool_list_monitoring_points(**kwargs):
    """List all monitoring points with coordinates."""
    try:
        r = requests.get(
            _url('/rest/v1/monitoring_points?select=*&limit=500'),
            headers=_headers(), timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        if not data:
            return {"success": True, "points": [], "count": 0}
        # Normalize columns
        points = []
        for row in data:
            points.append({
                "point_id": row.get("point_id", ""),
                "x_coord": row.get("x_coord", 0),
                "y_coord": row.get("y_coord", 0),
                "type": row.get("type", ""),
                "description": row.get("description", ""),
            })
        return {"success": True, "points": points, "count": len(points)}
    except Exception as e:
        return {"success": False, "error": str(e)}


def tool_query_settlement_data(point_id, limit=200, **kwargs):
    """Query settlement data for a monitoring point."""
    try:
        params = {
            'select': 'point_id,measurement_date,cumulative_change',
            'point_id': f'eq.{point_id}',
            'order': 'measurement_date.desc',
            'limit': str(limit),
        }
        r = requests.get(
            _url('/rest/v1/processed_settlement_data'),
            headers=_headers(), params=params, timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        summary = {}
        if data:
            vals = [row.get('cumulative_change', 0) for row in data if row.get('cumulative_change') is not None]
            if vals:
                summary = {
                    "latest_value": vals[0],
                    "min": round(min(vals), 3),
                    "max": round(max(vals), 3),
                    "mean": round(sum(vals) / len(vals), 3),
                    "record_count": len(vals),
                    "date_range": f"{data[-1].get('measurement_date', '?')} ~ {data[0].get('measurement_date', '?')}",
                }
        return {"success": True, "point_id": point_id, "data": data[:50], "summary": summary, "total_records": len(data)}
    except Exception as e:
        return {"success": False, "error": str(e)}


def tool_query_temperature_data(point_id=None, limit=200, **kwargs):
    """Query temperature data."""
    try:
        params = {
            'select': '*',
            'order': 'measurement_date.desc',
            'limit': str(limit),
        }
        if point_id:
            params['point_id'] = f'eq.{point_id}'
        r = requests.get(
            _url('/rest/v1/temperature_data'),
            headers=_headers(), params=params, timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        summary = {}
        if data:
            temps = [row.get('temperature', 0) for row in data if row.get('temperature') is not None]
            if temps:
                summary = {
                    "latest": temps[0],
                    "min": round(min(temps), 1),
                    "max": round(max(temps), 1),
                    "mean": round(sum(temps) / len(temps), 1),
                    "record_count": len(temps),
                }
        return {"success": True, "data": data[:30], "summary": summary, "total_records": len(data)}
    except Exception as e:
        return {"success": False, "error": str(e)}


def tool_query_crack_data(point_id=None, limit=200, **kwargs):
    """Query crack monitoring data."""
    try:
        params = {
            'select': '*',
            'order': 'measurement_date.desc',
            'limit': str(limit),
        }
        if point_id:
            params['point_id'] = f'eq.{point_id}'
        r = requests.get(
            _url('/rest/v1/crack_data'),
            headers=_headers(), params=params, timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        summary = {}
        if data:
            widths = [row.get('crack_width', 0) for row in data if row.get('crack_width') is not None]
            if widths:
                summary = {
                    "latest": widths[0],
                    "min": round(min(widths), 2),
                    "max": round(max(widths), 2),
                    "mean": round(sum(widths) / len(widths), 2),
                    "record_count": len(widths),
                }
        return {"success": True, "data": data[:30], "summary": summary, "total_records": len(data)}
    except Exception as e:
        return {"success": False, "error": str(e)}


def tool_query_construction_events(limit=50, **kwargs):
    """Query construction events."""
    try:
        params = {
            'select': '*',
            'order': 'start_date.desc',
            'limit': str(limit),
        }
        r = requests.get(
            _url('/rest/v1/construction_events'),
            headers=_headers(), params=params, timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        return {"success": True, "events": data, "count": len(data)}
    except Exception as e:
        return {"success": False, "error": str(e)}


def tool_detect_anomalies(point_id, method='isolation_forest', contamination=0.05, **kwargs):
    """Run anomaly detection on a monitoring point."""
    try:
        from ..ml_models.supabase_data import fetch_point_settlement
        from ..ml_models.anomaly_detector import detect_anomalies_for_point

        df = fetch_point_settlement(point_id)
        if df.empty or len(df) < 10:
            return {
                "success": False,
                "error": f"Point {point_id}: insufficient data ({len(df)} records, need >= 10)",
            }

        result = detect_anomalies_for_point(
            point_id, df=df, method=method, contamination=contamination,
        )
        # Serialize dates
        if result.get('anomalies'):
            for a in result['anomalies']:
                if hasattr(a.get('date'), 'isoformat'):
                    a['date'] = a['date'].isoformat()
                for k in ('settlement', 'anomaly_score'):
                    if k in a and a[k] is not None:
                        a[k] = round(float(a[k]), 4)
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}


def tool_predict_settlement(point_id, steps=30, **kwargs):
    """Predict future settlement using auto-selected model."""
    try:
        from ..ml_models.supabase_data import fetch_point_settlement
        from ..ml_models.model_selector import ModelSelector

        df = fetch_point_settlement(point_id)
        if df.empty or len(df) < 15:
            return {
                "success": False,
                "error": f"Point {point_id}: insufficient data ({len(df)} records, need >= 15)",
            }

        values = df['settlement'].values.astype(float)
        selector = ModelSelector()
        chars = selector.analyze_data_characteristics(values)
        recommendations = selector.recommend_model(chars)
        best_model_name = recommendations[0]['model'] if recommendations else 'arima'

        # Use TimeSeriesPredictor
        from ..ml_models.time_series_predictor import TimeSeriesPredictor
        predictor = TimeSeriesPredictor()
        predictor.fit(values, model_type=best_model_name)
        forecast = predictor.predict(steps=steps)

        # Build date range for predictions
        last_date = df['date'].max()
        future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=steps, freq='D')

        predictions = []
        for i, d in enumerate(future_dates):
            pred = {"date": d.strftime('%Y-%m-%d')}
            if isinstance(forecast, dict):
                pred["predicted"] = round(float(forecast.get('forecast', [0])[i] if i < len(forecast.get('forecast', [])) else 0), 3)
                ci = forecast.get('confidence_interval', {})
                if ci:
                    lower = ci.get('lower', [])
                    upper = ci.get('upper', [])
                    pred["lower_bound"] = round(float(lower[i]), 3) if i < len(lower) else None
                    pred["upper_bound"] = round(float(upper[i]), 3) if i < len(upper) else None
            elif isinstance(forecast, (list, np.ndarray)):
                val = float(forecast[i]) if i < len(forecast) else 0
                pred["predicted"] = round(val, 3)
            predictions.append(pred)

        return {
            "success": True,
            "point_id": point_id,
            "model": best_model_name,
            "model_reason": recommendations[0].get('reason', '') if recommendations else '',
            "data_characteristics": chars,
            "steps": steps,
            "predictions": predictions,
            "latest_actual": round(float(values[-1]), 3),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def tool_build_knowledge_graph(distance_threshold=50, correlation_threshold=0.7, **kwargs):
    """Build the in-memory knowledge graph. Returns stats + visualization data."""
    try:
        from .knowledge_graph_nx import build_fresh_knowledge_graph
        kg, stats, viz = build_fresh_knowledge_graph(
            distance_threshold=distance_threshold,
            correlation_threshold=correlation_threshold,
        )
        # Store ref for subsequent queries in same agent loop
        import sys
        sys.modules[__name__]._last_kg = kg
        return {"success": True, **stats, "visualization": viz}
    except Exception as e:
        return {"success": False, "error": str(e)}


def tool_query_knowledge_graph(query_type, node_id=None, **kwargs):
    """Query the in-memory knowledge graph."""
    try:
        # Try to use the last built KG from this agent loop
        import sys
        kg = getattr(sys.modules[__name__], '_last_kg', None)
        if kg is None or not kg.is_built():
            from .knowledge_graph_nx import get_knowledge_graph
            kg = get_knowledge_graph()
        if not kg.is_built():
            return {"success": False, "error": "Knowledge graph not built yet. Call build_knowledge_graph first."}

        if query_type == "statistics":
            return {"success": True, **kg.statistics()}
        elif query_type == "neighbors":
            if not node_id:
                return {"success": False, "error": "node_id required for neighbors query"}
            return {"success": True, "neighbors": kg.neighbors(node_id)}
        elif query_type == "causal_chain":
            if not node_id:
                return {"success": False, "error": "node_id required for causal_chain query"}
            return {"success": True, "causal_chain": kg.causal_chain(node_id)}
        elif query_type == "risk_points":
            return {"success": True, "risk_points": kg.risk_points()}
        elif query_type == "spatial_clusters":
            return {"success": True, "clusters": kg.spatial_clusters()}
        else:
            return {"success": False, "error": f"Unknown query_type: {query_type}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def tool_analyze_correlation(point_ids=None, **kwargs):
    """Compute correlation matrix between monitoring points."""
    try:
        from ..ml_models.supabase_data import fetch_all_settlement

        df = fetch_all_settlement()
        if df.empty:
            return {"success": False, "error": "No settlement data available"}

        available_points = df['point_id'].unique().tolist()
        if point_ids:
            use_points = [p for p in point_ids if p in available_points]
        else:
            use_points = available_points[:20]  # limit to 20 points

        if len(use_points) < 2:
            return {"success": False, "error": f"Need at least 2 points, found {len(use_points)}"}

        # Pivot to wide format
        pivot = df[df['point_id'].isin(use_points)].pivot_table(
            index='measurement_date', columns='point_id', values='cumulative_change',
        )
        pivot = pivot.dropna(axis=1, how='all').fillna(method='ffill').fillna(0)

        corr = pivot.corr().round(3)

        # Find strong correlations
        strong = []
        for i, p1 in enumerate(corr.columns):
            for j, p2 in enumerate(corr.columns):
                if i < j and abs(corr.loc[p1, p2]) > 0.7:
                    strong.append({
                        "point_a": p1, "point_b": p2,
                        "correlation": float(corr.loc[p1, p2]),
                    })
        strong.sort(key=lambda x: abs(x['correlation']), reverse=True)

        return {
            "success": True,
            "points_analyzed": list(corr.columns),
            "correlation_matrix": {str(k): {str(k2): v2 for k2, v2 in v.items()} for k, v in corr.to_dict().items()},
            "strong_correlations": strong[:20],
            "total_pairs": len(strong),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def tool_query_anomalies(point_ids=None, severity_filter=None, **kwargs):
    """Batch anomaly detection across multiple points."""
    try:
        from ..ml_models.supabase_data import fetch_point_settlement, fetch_monitoring_points
        from ..ml_models.anomaly_detector import detect_anomalies_for_point

        # Get point list
        if point_ids:
            use_points = point_ids
        else:
            pts = fetch_monitoring_points()
            use_points = pts['point_id'].tolist() if not pts.empty else []

        if not use_points:
            return {"success": False, "error": "No monitoring points found"}

        # Limit to 15 points for performance
        use_points = use_points[:15]

        results = []
        total_anomalies = 0
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}

        for pid in use_points:
            df = fetch_point_settlement(pid)
            if df.empty or len(df) < 10:
                continue
            res = detect_anomalies_for_point(pid, df=df, method='isolation_forest', contamination=0.05)
            if not res.get('success'):
                continue

            anomalies = res.get('anomalies', [])
            # Apply severity filter
            if severity_filter:
                sev_order = ["critical", "high", "medium", "low"]
                min_idx = sev_order.index(severity_filter)
                anomalies = [a for a in anomalies if a.get('severity', 'low') in sev_order[:min_idx + 1]]

            # Serialize
            for a in anomalies:
                if hasattr(a.get('date'), 'isoformat'):
                    a['date'] = a['date'].isoformat()
                for k in ('settlement', 'anomaly_score'):
                    if k in a and a[k] is not None:
                        a[k] = round(float(a[k]), 4)

            if anomalies:
                total_anomalies += len(anomalies)
                for a in anomalies:
                    sev = a.get('severity', 'low')
                    if sev in severity_counts:
                        severity_counts[sev] += 1

                results.append({
                    "point_id": pid,
                    "anomaly_count": len(anomalies),
                    "anomalies": anomalies[:5],  # limit per point
                })

        return {
            "success": True,
            "points_checked": len(use_points),
            "points_with_anomalies": len(results),
            "total_anomalies": total_anomalies,
            "severity_summary": severity_counts,
            "results": results,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def tool_search_academic_papers(query, limit=5, **kwargs):
    """Search academic papers using OpenAlex API (free, no rate limit)."""
    try:
        limit = min(int(limit), 10)

        # Primary: OpenAlex API (free, no API key, no rate limit)
        papers = _search_openalex(query, limit)
        if papers:
            return {
                "success": True,
                "query": query,
                "papers": papers,
                "total": len(papers),
                "source": "OpenAlex",
            }

        # Fallback: Semantic Scholar (has rate limits)
        papers = _search_semantic_scholar(query, limit)
        if papers is not None:
            return {
                "success": True,
                "query": query,
                "papers": papers,
                "total": len(papers),
                "source": "Semantic Scholar",
            }

        return {"success": False, "error": "Both OpenAlex and Semantic Scholar failed"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def _search_openalex(query, limit):
    """Search OpenAlex API. Returns list of papers or empty list on failure."""
    try:
        url = "https://api.openalex.org/works"
        params = {
            "search": query,
            "per_page": limit,
            "select": "title,authorships,publication_year,cited_by_count,doi,id",
            "mailto": "settlement-monitor@example.com",  # polite pool
        }
        r = requests.get(url, params=params, timeout=10)
        if not r.ok:
            print(f"[DEBUG] OpenAlex HTTP {r.status_code}")
            return []

        data = r.json()
        papers = []
        for w in data.get("results", []):
            # Extract authors
            authorships = w.get("authorships", [])
            author_names = []
            for a in authorships[:4]:
                name = (a.get("author") or {}).get("display_name", "")
                if name:
                    author_names.append(name)
            if len(authorships) > 4:
                author_names.append("et al.")

            doi = (w.get("doi") or "").replace("https://doi.org/", "")
            paper_url = f"https://doi.org/{doi}" if doi else w.get("id", "")

            papers.append({
                "title": w.get("title", ""),
                "authors": ", ".join(author_names),
                "year": w.get("publication_year"),
                "citations": w.get("cited_by_count", 0),
                "url": paper_url,
                "abstract": "",  # OpenAlex doesn't return abstracts in search
                "doi": doi,
            })
        return papers
    except Exception as e:
        print(f"[DEBUG] OpenAlex exception: {e}")
        return []


def _search_semantic_scholar(query, limit):
    """Search Semantic Scholar API with retry. Returns list or None on failure."""
    try:
        url = "https://api.semanticscholar.org/graph/v1/paper/search"
        params = {
            "query": query,
            "limit": limit,
            "fields": "title,authors,year,citationCount,url,abstract,externalIds",
        }
        last_error = ""
        for attempt in range(2):
            if attempt > 0:
                time.sleep(2)
            r = requests.get(url, params=params, timeout=10)
            if r.ok:
                break
            if r.status_code == 429:
                last_error = f"HTTP 429 (attempt {attempt+1}/2)"
                continue
            return None
        else:
            print(f"[DEBUG] Semantic Scholar {last_error}")
            return None

        data = r.json()
        papers = []
        for p in data.get("data", []):
            authors = p.get("authors", [])
            author_names = [a.get("name", "") for a in authors[:4]]
            if len(authors) > 4:
                author_names.append("et al.")
            doi = (p.get("externalIds") or {}).get("DOI", "")
            paper_url = p.get("url", "")
            if doi:
                paper_url = f"https://doi.org/{doi}"
            papers.append({
                "title": p.get("title", ""),
                "authors": ", ".join(author_names),
                "year": p.get("year"),
                "citations": p.get("citationCount", 0),
                "url": paper_url,
                "abstract": (p.get("abstract") or "")[:200],
                "doi": doi,
            })
        return papers
    except Exception as e:
        print(f"[DEBUG] Semantic Scholar exception: {e}")
        return None


# ==================== Tool Registry ====================

TOOL_REGISTRY = {
    "list_monitoring_points": tool_list_monitoring_points,
    "query_settlement_data": tool_query_settlement_data,
    "query_temperature_data": tool_query_temperature_data,
    "query_crack_data": tool_query_crack_data,
    "query_construction_events": tool_query_construction_events,
    "detect_anomalies": tool_detect_anomalies,
    "predict_settlement": tool_predict_settlement,
    "build_knowledge_graph": tool_build_knowledge_graph,
    "query_knowledge_graph": tool_query_knowledge_graph,
    "analyze_correlation": tool_analyze_correlation,
    "query_anomalies": tool_query_anomalies,
    "search_academic_papers": tool_search_academic_papers,
}
