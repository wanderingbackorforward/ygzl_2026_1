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


def _safe_supabase_get(path, params=None):
    """Supabase GET with graceful error handling. Returns list/dict or None on failure."""
    try:
        r = requests.get(_url(path), headers=_headers(), params=params, timeout=8)
        if r.status_code in (404, 400, 406):
            print(f"[DEBUG] Supabase {r.status_code} for {path} - table may not exist")
            return None
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"[DEBUG] Supabase request failed for {path}: {e}")
        return None


# ==================== Tool implementations ====================


def tool_list_monitoring_points(**kwargs):
    """List all monitoring points with coordinates."""
    try:
        r = requests.get(
            _url('/rest/v1/monitoring_points?select=*&limit=500'),
            headers=_headers(), timeout=8,
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
            headers=_headers(), params=params, timeout=8,
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
    """Query temperature data from processed_temperature_data table.
    Columns: measurement_date, SID (sensor_id), avg_temp, min_temp, max_temp.
    Also tries temperature_analysis for summary stats.
    """
    try:
        # Primary: processed_temperature_data (actual table name)
        params = {
            'select': 'measurement_date,SID,avg_temp,min_temp,max_temp',
            'order': 'measurement_date.desc',
            'limit': str(limit),
        }
        if point_id:
            # SID is the sensor/point column in this table
            params['SID'] = f'eq.{point_id}'

        data = _safe_supabase_get('/rest/v1/processed_temperature_data', params)

        # Normalize column names for AI readability
        if data:
            for row in data:
                row['sensor_id'] = row.pop('SID', row.get('sensor_id', ''))
                row['avg_temperature'] = row.pop('avg_temp', None)
                row['min_temperature'] = row.pop('min_temp', None)
                row['max_temperature'] = row.pop('max_temp', None)

        if not data:
            # Fallback: temperature_analysis table (summary stats)
            params2 = {'select': '*', 'limit': str(limit)}
            if point_id:
                params2['sensor_id'] = f'eq.{point_id}'
            data = _safe_supabase_get('/rest/v1/temperature_analysis', params2)
            if data:
                for row in data:
                    if 'avg_temp' in row:
                        row['avg_temperature'] = row.pop('avg_temp', None)
                    if 'min_temp' in row:
                        row['min_temperature'] = row.pop('min_temp', None)
                    if 'max_temp' in row:
                        row['max_temperature'] = row.pop('max_temp', None)

        if not data:
            return {"success": True, "data": [], "summary": {}, "total_records": 0,
                    "note": "No temperature data found"}

        summary = {}
        temps = [row.get('avg_temperature') for row in data if row.get('avg_temperature') is not None]
        if temps:
            summary = {
                "latest": round(float(temps[0]), 1),
                "min": round(float(min(temps)), 1),
                "max": round(float(max(temps)), 1),
                "mean": round(sum(float(t) for t in temps) / len(temps), 1),
                "record_count": len(temps),
            }
        return {"success": True, "data": data[:30], "summary": summary, "total_records": len(data)}
    except Exception as e:
        return {"success": False, "error": str(e)}


def tool_get_temperature_snapshot(sensor_id=None, **kwargs):
    try:
        from modules.temperature_v2.intelligence import TemperatureIntelligenceService
        service = TemperatureIntelligenceService()
        return service.get_snapshot(sensor_id=sensor_id)
    except Exception as e:
        return {"success": False, "error": str(e)}


def tool_evaluate_temperature_risk(sensor_id=None, related_point_ids=None, **kwargs):
    try:
        from modules.temperature_v2.intelligence import TemperatureIntelligenceService
        service = TemperatureIntelligenceService()
        return service.evaluate_risk(sensor_id=sensor_id, related_point_ids=related_point_ids)
    except Exception as e:
        return {"success": False, "error": str(e)}


def tool_plan_temperature_actions(sensor_id=None, related_point_ids=None, **kwargs):
    try:
        from modules.temperature_v2.intelligence import TemperatureIntelligenceService
        service = TemperatureIntelligenceService()
        return service.plan_actions(sensor_id=sensor_id, related_point_ids=related_point_ids)
    except Exception as e:
        return {"success": False, "error": str(e)}


def tool_query_crack_data(point_id=None, limit=200, **kwargs):
    """Query crack monitoring data from raw_crack_data + crack_analysis_results.
    raw_crack_data is a PIVOT table: rows=measurement_date, columns=point_ids (e.g. JC-01).
    crack_analysis_results has per-point analysis (avg_value, trend_type, etc).
    crack_monitoring_points has point metadata.
    """
    try:
        results = []

        # Source 1: crack_analysis_results (per-point summary, always available)
        analysis = _safe_supabase_get('/rest/v1/crack_analysis_results', {'select': '*'})
        points_meta = _safe_supabase_get(
            '/rest/v1/crack_monitoring_points',
            {'select': 'point_id,trend_type,change_type,total_change,average_change_rate,trend_slope,status'}
        )
        meta_map = {}
        if points_meta:
            meta_map = {r.get('point_id'): r for r in points_meta}

        # Source 2: raw_crack_data (pivot table with time series)
        raw_data = _safe_supabase_get(
            '/rest/v1/raw_crack_data',
            {'select': '*', 'order': 'measurement_date.desc', 'limit': str(limit)}
        )

        # If point_id specified, extract that column from the pivot
        point_series = []
        if raw_data and point_id:
            for row in raw_data:
                val = row.get(point_id)
                if val is not None:
                    point_series.append({
                        "measurement_date": row.get("measurement_date"),
                        "point_id": point_id,
                        "crack_width": val,
                    })

        # Build per-point summary from analysis results
        summary_list = []
        if analysis:
            for row in analysis:
                pid = row.get('point_id', '')
                if point_id and pid != point_id:
                    continue
                entry = {
                    "point_id": pid,
                    "avg_value": row.get('avg_value') or row.get('mean_value'),
                    "analysis_date": row.get('analysis_date'),
                }
                # Merge monitoring point metadata
                m = meta_map.get(pid, {})
                entry["trend_type"] = m.get('trend_type', '')
                entry["change_type"] = m.get('change_type', '')
                entry["total_change"] = m.get('total_change')
                entry["average_change_rate"] = m.get('average_change_rate')
                entry["status"] = m.get('status', '')
                summary_list.append(entry)

        # If no analysis data, try to build summary from raw pivot
        if not summary_list and raw_data and not point_id:
            # Discover point columns (all columns except measurement_date)
            all_cols = set()
            for row in raw_data:
                all_cols.update(row.keys())
            point_cols = [c for c in all_cols if c != 'measurement_date']
            for pc in sorted(point_cols):
                vals = [row.get(pc) for row in raw_data if row.get(pc) is not None]
                if vals:
                    fvals = [float(v) for v in vals]
                    summary_list.append({
                        "point_id": pc,
                        "latest": round(fvals[0], 3),
                        "min": round(min(fvals), 3),
                        "max": round(max(fvals), 3),
                        "mean": round(sum(fvals) / len(fvals), 3),
                        "record_count": len(fvals),
                    })

        # Build overall summary
        summary = {"total_points": len(summary_list)}
        if point_series:
            widths = [float(r['crack_width']) for r in point_series if r.get('crack_width') is not None]
            if widths:
                summary.update({
                    "point_id": point_id,
                    "latest": round(widths[0], 3),
                    "min": round(min(widths), 3),
                    "max": round(max(widths), 3),
                    "mean": round(sum(widths) / len(widths), 3),
                    "record_count": len(widths),
                })

        return {
            "success": True,
            "point_summaries": summary_list[:30],
            "time_series": point_series[:50] if point_series else [],
            "summary": summary,
            "total_records": len(point_series) if point_series else len(summary_list),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def tool_query_construction_events(limit=50, **kwargs):
    """Query construction events. Table may not exist - graceful fallback."""
    try:
        # Try construction_events table
        data = _safe_supabase_get(
            '/rest/v1/construction_events',
            {'select': '*', 'order': 'start_date.desc', 'limit': str(limit)}
        )
        if data is not None:
            return {"success": True, "events": data, "count": len(data)}

        # Table doesn't exist - return empty with note
        return {
            "success": True,
            "events": [],
            "count": 0,
            "note": "Construction events table not available. No event data recorded yet.",
        }
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

        # Limit to 5 points for performance (each point = Supabase + ML, ~3s each)
        use_points = use_points[:5]

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
        r = requests.get(url, params=params, timeout=5)
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
    """Search Semantic Scholar API. Single attempt, no retry. Returns list or None on failure."""
    try:
        url = "https://api.semanticscholar.org/graph/v1/paper/search"
        params = {
            "query": query,
            "limit": limit,
            "fields": "title,authors,year,citationCount,url,abstract,externalIds",
        }
        r = requests.get(url, params=params, timeout=5)
        if not r.ok:
            print(f"[DEBUG] Semantic Scholar HTTP {r.status_code}")
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


# ==================== Analysis Summary Tool ====================


def tool_query_analysis_summary(module="settlement", **kwargs):
    """Query pre-computed analysis summary - the SAME data source that powers ECharts.
    This is the most reliable data tool: if the frontend chart shows data, this returns it.
    Modules: settlement, temperature, cracks.
    """
    try:
        if module == "settlement":
            # settlement_analysis table: alert_level, trend_type, stats per point
            analysis = _safe_supabase_get('/rest/v1/settlement_analysis', {'select': '*'})
            if not analysis:
                return {"success": True, "data": [], "count": 0,
                        "note": "No settlement analysis data"}
            # Sort by point_id
            import re
            analysis.sort(key=lambda x: (
                int(re.sub(r'[^0-9]', '', str(x.get('point_id', '0'))) or '0'),
                str(x.get('point_id', ''))
            ))
            # Compute stats
            alert_counts = {}
            trend_counts = {}
            for row in analysis:
                al = row.get('alert_level', 'unknown')
                alert_counts[al] = alert_counts.get(al, 0) + 1
                tt = row.get('trend_type', 'unknown')
                trend_counts[tt] = trend_counts.get(tt, 0) + 1
            return {
                "success": True,
                "module": "settlement",
                "data": analysis,
                "count": len(analysis),
                "alert_summary": alert_counts,
                "trend_summary": trend_counts,
            }

        elif module == "temperature":
            analysis = _safe_supabase_get('/rest/v1/temperature_analysis', {'select': '*'})
            if not analysis:
                return {"success": True, "data": [], "count": 0,
                        "note": "No temperature analysis data"}
            # Normalize column names
            for row in analysis:
                if 'avg_temp' in row:
                    row['avg_temperature'] = row.pop('avg_temp', None)
                if 'min_temp' in row:
                    row['min_temperature'] = row.pop('min_temp', None)
                if 'max_temp' in row:
                    row['max_temperature'] = row.pop('max_temp', None)
            alert_counts = {}
            for row in analysis:
                al = row.get('alert_level', 'normal')
                alert_counts[al] = alert_counts.get(al, 0) + 1
            return {
                "success": True,
                "module": "temperature",
                "data": analysis,
                "count": len(analysis),
                "alert_summary": alert_counts,
            }

        elif module == "cracks":
            analysis = _safe_supabase_get('/rest/v1/crack_analysis_results', {'select': '*'})
            points = _safe_supabase_get(
                '/rest/v1/crack_monitoring_points',
                {'select': 'point_id,status,trend_type,change_type,total_change,average_change_rate'}
            )
            if not analysis and not points:
                return {"success": True, "data": [], "count": 0,
                        "note": "No crack analysis data"}
            # Merge
            meta_map = {r.get('point_id'): r for r in (points or [])}
            merged = []
            for row in (analysis or []):
                pid = row.get('point_id', '')
                entry = dict(row)
                m = meta_map.get(pid, {})
                entry['trend_type'] = m.get('trend_type', '')
                entry['change_type'] = m.get('change_type', '')
                entry['total_change'] = m.get('total_change')
                entry['average_change_rate'] = m.get('average_change_rate')
                merged.append(entry)
            return {
                "success": True,
                "module": "cracks",
                "data": merged if merged else (points or []),
                "count": len(merged) if merged else len(points or []),
            }

        else:
            return {"success": False, "error": f"Unknown module: {module}. Use: settlement, temperature, cracks"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ==================== Tool Registry ====================

TOOL_REGISTRY = {
    "list_monitoring_points": tool_list_monitoring_points,
    "query_settlement_data": tool_query_settlement_data,
    "query_temperature_data": tool_query_temperature_data,
    "get_temperature_snapshot": tool_get_temperature_snapshot,
    "evaluate_temperature_risk": tool_evaluate_temperature_risk,
    "plan_temperature_actions": tool_plan_temperature_actions,
    "query_crack_data": tool_query_crack_data,
    "query_construction_events": tool_query_construction_events,
    "detect_anomalies": tool_detect_anomalies,
    "predict_settlement": tool_predict_settlement,
    "build_knowledge_graph": tool_build_knowledge_graph,
    "query_knowledge_graph": tool_query_knowledge_graph,
    "analyze_correlation": tool_analyze_correlation,
    "query_anomalies": tool_query_anomalies,
    "search_academic_papers": tool_search_academic_papers,
    "query_analysis_summary": tool_query_analysis_summary,
}
