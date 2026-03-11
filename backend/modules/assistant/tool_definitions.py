# -*- coding: utf-8 -*-
"""
Claude tool_use JSON Schema definitions for Agent mode.
11 tools for querying data, anomaly detection, prediction, and knowledge graph.
"""

AGENT_TOOLS = [
    {
        "name": "list_monitoring_points",
        "description": "List all monitoring points with their coordinates. Use this to discover available point IDs before querying data.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "query_settlement_data",
        "description": "Query settlement (subsidence) data for a specific monitoring point. Returns date and cumulative settlement values.",
        "input_schema": {
            "type": "object",
            "properties": {
                "point_id": {
                    "type": "string",
                    "description": "Monitoring point ID, e.g. 'DB-01' or 'S1'",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max number of records to return (default 200)",
                    "default": 200,
                },
            },
            "required": ["point_id"],
        },
    },
    {
        "name": "query_temperature_data",
        "description": "Query temperature data for a monitoring point or all points. Returns date and temperature values.",
        "input_schema": {
            "type": "object",
            "properties": {
                "point_id": {
                    "type": "string",
                    "description": "Monitoring point ID. If omitted, returns data for all points.",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max number of records (default 200)",
                    "default": 200,
                },
            },
            "required": [],
        },
    },
    {
        "name": "query_crack_data",
        "description": "Query crack monitoring data. Returns crack width measurements over time.",
        "input_schema": {
            "type": "object",
            "properties": {
                "point_id": {
                    "type": "string",
                    "description": "Crack monitoring point ID. If omitted, returns all.",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max number of records (default 200)",
                    "default": 200,
                },
            },
            "required": [],
        },
    },
    {
        "name": "query_construction_events",
        "description": "Query construction events (e.g. excavation, piling). Returns event type, date range, description and affected area.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Max number of events (default 50)",
                    "default": 50,
                },
            },
            "required": [],
        },
    },
    {
        "name": "detect_anomalies",
        "description": "Run anomaly detection on a monitoring point's settlement data using Isolation Forest. Returns anomaly list with severity and type.",
        "input_schema": {
            "type": "object",
            "properties": {
                "point_id": {
                    "type": "string",
                    "description": "Monitoring point ID to analyze",
                },
                "method": {
                    "type": "string",
                    "enum": ["isolation_forest", "lof"],
                    "description": "Detection method (default: isolation_forest)",
                    "default": "isolation_forest",
                },
                "contamination": {
                    "type": "number",
                    "description": "Expected anomaly ratio 0-1 (default: 0.05)",
                    "default": 0.05,
                },
            },
            "required": ["point_id"],
        },
    },
    {
        "name": "predict_settlement",
        "description": "Predict future settlement for a monitoring point. Auto-selects the best model (ARIMA/SARIMA/Prophet) and returns predicted values with confidence intervals.",
        "input_schema": {
            "type": "object",
            "properties": {
                "point_id": {
                    "type": "string",
                    "description": "Monitoring point ID",
                },
                "steps": {
                    "type": "integer",
                    "description": "Number of days to predict (default: 30)",
                    "default": 30,
                },
            },
            "required": ["point_id"],
        },
    },
    {
        "name": "build_knowledge_graph",
        "description": "Build an in-memory knowledge graph from all monitoring data. Creates nodes for monitoring points, events, and anomalies, with edges for spatial proximity, correlation, and causation. Call this before query_knowledge_graph.",
        "input_schema": {
            "type": "object",
            "properties": {
                "distance_threshold": {
                    "type": "number",
                    "description": "Max distance (meters) to create SPATIAL_NEAR edges (default: 50)",
                    "default": 50,
                },
                "correlation_threshold": {
                    "type": "number",
                    "description": "Min correlation coefficient to create CORRELATES_WITH edges (default: 0.7)",
                    "default": 0.7,
                },
            },
            "required": [],
        },
    },
    {
        "name": "query_knowledge_graph",
        "description": "Query the in-memory knowledge graph. Supports: neighbors (adjacent nodes), causal_chain (cause-effect paths), risk_points (high-risk nodes), spatial_clusters (nearby groups), statistics (graph summary).",
        "input_schema": {
            "type": "object",
            "properties": {
                "query_type": {
                    "type": "string",
                    "enum": [
                        "neighbors",
                        "causal_chain",
                        "risk_points",
                        "spatial_clusters",
                        "statistics",
                    ],
                    "description": "Type of graph query",
                },
                "node_id": {
                    "type": "string",
                    "description": "Node ID for neighbors/causal_chain queries (e.g. 'point:DB-01')",
                },
            },
            "required": ["query_type"],
        },
    },
    {
        "name": "analyze_correlation",
        "description": "Compute Pearson correlation matrix between multiple monitoring points' settlement data. Use to find which points move together.",
        "input_schema": {
            "type": "object",
            "properties": {
                "point_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of monitoring point IDs to correlate. If omitted, uses all points.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "query_anomalies",
        "description": "Query previously detected anomalies across all or specific monitoring points. Runs batch anomaly detection and returns a summary.",
        "input_schema": {
            "type": "object",
            "properties": {
                "point_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of point IDs. If omitted, checks all points.",
                },
                "severity_filter": {
                    "type": "string",
                    "enum": ["critical", "high", "medium", "low"],
                    "description": "Filter by minimum severity level",
                },
            },
            "required": [],
        },
    },
    {
        "name": "search_academic_papers",
        "description": "Search for relevant academic papers on Semantic Scholar. Use this to find research references related to settlement monitoring, anomaly detection, geotechnical engineering, or any technical topic the user asks about. Returns paper titles, authors, year, citation count, and URLs.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query in English, e.g. 'settlement monitoring anomaly detection' or 'geotechnical foundation subsidence prediction'",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max number of papers to return (default: 5, max: 10)",
                    "default": 5,
                },
            },
            "required": ["query"],
        },
    },
]
