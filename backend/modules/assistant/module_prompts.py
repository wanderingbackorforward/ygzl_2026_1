# -*- coding: utf-8 -*-
"""
Module-specific prompt configurations for the AI assistant.
Each module has: description, key_indicators, primary_tools, secondary_tools,
terminology, guidance, data_endpoints.

All prompt text in English (Windows encoding safe).
Only 4 main modules in this first batch:
  settlement, temperature, cracks, advanced
"""


MODULE_CONFIGS = {
    "settlement": {
        "description": (
            "Settlement (subsidence) monitoring module. "
            "Tracks vertical displacement of ground surface over time. "
            "Key concern: excessive settlement causes structural damage to buildings, "
            "roads, and underground utilities. "
            "Data source: processed_settlement_data table in Supabase."
        ),
        "key_indicators": [
            "cumulative_settlement (mm) - total vertical displacement from baseline",
            "settlement_rate (mm/day) - daily rate of vertical change",
            "differential_settlement (mm) - relative displacement between adjacent points",
            "warning threshold: 20mm cumulative settlement",
            "critical threshold: 30mm cumulative settlement",
            "rate threshold: 2mm/day is concerning, 5mm/day is critical",
        ],
        "primary_tools": [
            "query_analysis_summary",
            "query_settlement_data",
            "detect_anomalies",
            "predict_settlement",
            "analyze_correlation",
        ],
        "secondary_tools": [
            "query_construction_events",
            "build_knowledge_graph",
            "query_knowledge_graph",
            "list_monitoring_points",
        ],
        "terminology": {
            "cumulative_settlement": "total displacement accumulated from first measurement",
            "differential_settlement": "settlement difference between two adjacent monitoring points",
            "consolidation": "gradual soil compression under sustained load",
            "rebound": "upward movement after load removal or groundwater recovery",
            "creep": "slow continuous deformation under constant load over long time",
            "heave": "upward ground movement caused by swelling soil or frost",
            "settlement rate": "speed of vertical displacement change per unit of time",
        },
        "guidance": (
            "When answering about settlement data:\n"
            "- Always cite specific monitoring point IDs (e.g., S1, DB-C-01) and values in mm\n"
            "- Compare current values against thresholds (20mm warning, 30mm critical)\n"
            "- Check settlement rate for acceleration patterns (increasing rate = danger)\n"
            "- Consider differential settlement between adjacent points\n"
            "- Relate to construction events if timeline overlaps\n"
            "- For predictions, always state model type and confidence interval\n"
            "- When anomalies found, recommend specific actions (increase monitoring, inspection, etc)\n"
        ),
        "data_endpoints": [
            "/api/analysis/v2/settlement",
            "/api/analysis/v2/settlement/anomalies",
            "/api/analysis/v2/settlement/recommendations",
        ],
    },

    "temperature": {
        "description": (
            "Temperature monitoring module. "
            "Tracks ambient and structural temperature that affects ground settlement behavior. "
            "Temperature changes cause thermal expansion/contraction in structures "
            "and affect soil consolidation rates. "
            "Data source: temperature monitoring sensors."
        ),
        "key_indicators": [
            "temperature (C) - measured temperature value in Celsius",
            "temperature_gradient (C/m) - spatial temperature variation",
            "daily_range (C) - difference between daily max and min temperature",
            "seasonal_baseline (C) - expected temperature for current season",
            "alert threshold: varies by season, typically above 35C or below -5C",
        ],
        "primary_tools": [
            "get_temperature_snapshot",
            "evaluate_temperature_risk",
            "plan_temperature_actions",
            "query_analysis_summary",
        ],
        "secondary_tools": [
            "query_temperature_data",
            "analyze_correlation",
            "query_settlement_data",
            "build_knowledge_graph",
            "list_monitoring_points",
        ],
        "terminology": {
            "thermal_expansion": "material expansion due to temperature increase",
            "frost_heave": "ground uplift from freezing moisture in soil pores",
            "thermal_gradient": "temperature difference across a structure or soil layer",
            "diurnal_cycle": "daily temperature variation pattern (day-night cycle)",
            "thermal_inertia": "resistance of soil/structure to temperature change",
        },
        "guidance": (
            "When answering about temperature data:\n"
            "- Start from the temperature intelligence snapshot instead of raw rows\n"
            "- Explain temperature as an environmental risk driver, not just a number\n"
            "- Evaluate risk before giving actions or recommendations\n"
            "- Analyze correlation between temperature and settlement if asked\n"
            "- Consider seasonal patterns, daily cycles, freeze-thaw, and spatial gradients\n"
            "- Recommend concrete actions when risk is warning or critical\n"
        ),
        "data_endpoints": [
            "/api/analysis/v2/temperature",
            "/api/analysis/v2/temperature/anomalies",
            "/api/analysis/v2/temperature/recommendations",
            "/api/temperature/v2/intelligence/snapshot",
            "/api/temperature/v2/intelligence/risk-evaluation",
            "/api/temperature/v2/intelligence/actions",
        ],
    },

    "cracks": {
        "description": (
            "Crack monitoring module. "
            "Tracks structural crack width, length, and growth over time. "
            "Cracks indicate structural stress and potential settlement damage. "
            "Crack growth rate is a key indicator of ongoing structural distress. "
            "Data source: crack monitoring sensors and visual inspections."
        ),
        "key_indicators": [
            "crack_width (mm) - measured crack opening width",
            "growth_rate (mm/day) - rate of crack width increase",
            "crack_length (mm) - total crack propagation length",
            "crack_count - number of active cracks at a location",
            "severity: hairline (<0.1mm), fine (0.1-0.3mm), medium (0.3-1.0mm), wide (>1.0mm)",
            "critical threshold: width > 1.0mm or growth_rate > 0.1mm/day",
        ],
        "primary_tools": [
            "query_analysis_summary",
            "query_crack_data",
            "detect_anomalies",
        ],
        "secondary_tools": [
            "query_settlement_data",
            "analyze_correlation",
            "build_knowledge_graph",
            "list_monitoring_points",
        ],
        "terminology": {
            "hairline_crack": "very fine crack less than 0.1mm, usually cosmetic only",
            "structural_crack": "crack wider than 0.3mm indicating structural stress",
            "crack_propagation": "process of crack growth in length or width over time",
            "load_bearing_crack": "crack in load-bearing structural element, high severity",
            "shrinkage_crack": "crack caused by concrete drying shrinkage, usually harmless",
            "settlement_crack": "crack caused by differential settlement, often diagonal",
        },
        "guidance": (
            "When answering about crack data:\n"
            "- Classify cracks by width severity (hairline/fine/medium/wide)\n"
            "- Track growth rate trends - accelerating growth is critical\n"
            "- Correlate with settlement data if differential settlement exists nearby\n"
            "- Distinguish between structural and non-structural cracks\n"
            "- Settlement cracks are typically diagonal (45 degrees) and wider at top\n"
            "- Recommend structural engineer inspection for cracks > 1.0mm\n"
            "- Consider environmental factors (temperature cycles, moisture)\n"
        ),
        "data_endpoints": [],
    },

    "advanced": {
        "description": (
            "Advanced analysis module - the intelligent diagnostics center. "
            "Combines multiple data sources and ML models for comprehensive analysis. "
            "Includes anomaly detection, trend prediction, spatial correlation analysis, "
            "and automated recommendations. "
            "This module has access to all ML tools and analysis APIs."
        ),
        "key_indicators": [
            "anomaly_score - ML model anomaly detection score (0-1, higher = more anomalous)",
            "prediction_confidence - model prediction confidence level",
            "correlation_coefficient - Pearson correlation between monitoring points",
            "risk_level - computed risk level (critical/high/medium/low)",
            "model_accuracy - prediction model accuracy metrics (MAE, RMSE, MAPE)",
        ],
        "primary_tools": [
            "query_analysis_summary",
            "detect_anomalies",
            "predict_settlement",
            "analyze_correlation",
            "build_knowledge_graph",
            "query_knowledge_graph",
            "query_anomalies",
        ],
        "secondary_tools": [
            "query_settlement_data",
            "query_temperature_data",
            "query_crack_data",
            "query_construction_events",
            "list_monitoring_points",
            "search_academic_papers",
        ],
        "terminology": {
            "isolation_forest": "unsupervised ML algorithm for anomaly detection",
            "ARIMA": "Auto-Regressive Integrated Moving Average, time series forecasting model",
            "SARIMA": "Seasonal ARIMA, handles seasonal patterns in time series",
            "causal_inference": "statistical method to determine cause-effect relationships",
            "spatial_correlation": "statistical relationship between geographically nearby points",
            "knowledge_graph": "network representation of monitoring point relationships",
            "contamination": "expected proportion of anomalies in dataset (e.g., 0.05 = 5%)",
        },
        "guidance": (
            "When answering in the advanced analysis module:\n"
            "- Use ML tools liberally - this module is designed for deep analysis\n"
            "- Combine multiple data sources (settlement + temperature + cracks + events)\n"
            "- Always provide confidence levels and model accuracy metrics\n"
            "- Build knowledge graph for spatial/correlation/risk analysis questions\n"
            "- Use batch anomaly detection (query_anomalies) for overview questions\n"
            "- Use single-point detection (detect_anomalies) for specific point analysis\n"
            "- Compare multiple models if asked about prediction accuracy\n"
            "- Provide actionable recommendations based on analysis results\n"
            "- Reference academic papers for methodology questions\n"
        ),
        "data_endpoints": [
            "/api/analysis/v2/settlement",
            "/api/analysis/v2/settlement/anomalies",
            "/api/analysis/v2/settlement/recommendations",
            "/api/analysis/v2/temperature",
            "/api/analysis/v2/temperature/anomalies",
        ],
    },
}


def extract_module_key(page_path):
    """
    Extract moduleKey from pagePath.

    Examples:
        '/settlement' -> 'settlement'
        '/advanced' -> 'advanced'
        '/settlement?tab=1' -> 'settlement'
        '' or None -> ''
    """
    if not page_path:
        return ""
    path = page_path.strip().strip("/").split("/")[0].split("?")[0]
    return path if path in MODULE_CONFIGS else ""


def get_module_prompt(module_key):
    """
    Build module-specific prompt section from config.
    Returns empty string for unknown modules (backward compatible).
    """
    config = MODULE_CONFIGS.get(module_key)
    if not config:
        return ""

    parts = []
    parts.append("---")
    parts.append("MODULE-SPECIFIC CONTEXT:")
    parts.append("Current module: " + module_key)
    parts.append("Description: " + config["description"])

    parts.append("\nKey indicators for this module:")
    for ind in config["key_indicators"]:
        parts.append("  - " + ind)

    parts.append("\nDomain terminology:")
    for term, defn in config["terminology"].items():
        parts.append("  - " + term + ": " + defn)

    parts.append("\n" + config["guidance"])

    return "\n".join(parts)


def get_module_tools(module_key):
    """
    Return ordered list of recommended tool names for this module.
    Primary tools first, then secondary.
    Returns empty list for unknown modules (= use all tools, backward compatible).
    """
    config = MODULE_CONFIGS.get(module_key)
    if not config:
        return []
    return config.get("primary_tools", []) + config.get("secondary_tools", [])
