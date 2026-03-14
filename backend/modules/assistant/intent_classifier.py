# -*- coding: utf-8 -*-
"""
Intent classifier for user questions
Classifies user intent to select appropriate prompt templates
"""

from typing import Tuple


# Intent types
INTENT_DATA_QUERY = "data_query"  # Query specific data values
INTENT_ANOMALY_CHECK = "anomaly_check"  # Check for anomalies
INTENT_TREND_ANALYSIS = "trend_analysis"  # Analyze trends
INTENT_COMPARISON = "comparison"  # Compare data points
INTENT_PREDICTION = "prediction"  # Predict future values
INTENT_EXPLANATION = "explanation"  # Explain phenomena
INTENT_OPERATION = "operation"  # Operational guidance
INTENT_GENERAL = "general"  # General questions


# Keywords for each intent type
INTENT_KEYWORDS = {
    INTENT_DATA_QUERY: [
        "多少", "几个", "数值", "值是", "当前", "最新", "最大", "最小", "平均",
        "how many", "what is", "current", "latest", "value", "number",
    ],
    INTENT_ANOMALY_CHECK: [
        "异常", "问题", "风险", "警告", "超限", "超标", "故障", "错误",
        "anomaly", "problem", "risk", "warning", "exceed", "fault", "error",
    ],
    INTENT_TREND_ANALYSIS: [
        "趋势", "变化", "发展", "走势", "增长", "下降", "稳定", "波动",
        "trend", "change", "development", "growth", "decline", "stable", "fluctuation",
    ],
    INTENT_COMPARISON: [
        "对比", "比较", "差异", "区别", "哪个", "更", "最",
        "compare", "comparison", "difference", "which", "better", "worse",
    ],
    INTENT_PREDICTION: [
        "预测", "未来", "将来", "会不会", "可能", "预计", "预期",
        "predict", "future", "forecast", "will", "might", "expect",
    ],
    INTENT_EXPLANATION: [
        "为什么", "原因", "怎么", "如何", "什么是", "解释", "说明",
        "why", "reason", "how", "what is", "explain", "describe",
    ],
    INTENT_OPERATION: [
        "怎么办", "处理", "操作", "步骤", "方法", "措施", "建议", "应该",
        "what to do", "handle", "operate", "steps", "method", "action", "should",
    ],
}


def classify_intent(question: str, page_path: str = "") -> Tuple[str, float]:
    """
    Classify user question intent using keyword matching

    Args:
        question: User question text
        page_path: Current page path (optional, for context)

    Returns:
        Tuple of (intent_type, confidence_score)
    """
    if not question:
        return INTENT_GENERAL, 0.0

    question_lower = question.lower()

    # Count keyword matches for each intent
    intent_scores = {}
    for intent, keywords in INTENT_KEYWORDS.items():
        score = sum(1 for keyword in keywords if keyword in question_lower)
        if score > 0:
            intent_scores[intent] = score

    # Module-based intent boosting using page_path
    if page_path:
        from .module_prompts import extract_module_key
        module_key = extract_module_key(page_path)
        module_boosts = {
            "settlement": {
                INTENT_DATA_QUERY: 1,
                INTENT_ANOMALY_CHECK: 1,
                INTENT_TREND_ANALYSIS: 1,
                INTENT_PREDICTION: 1,
            },
            "temperature": {
                INTENT_DATA_QUERY: 1,
                INTENT_COMPARISON: 1,
                INTENT_TREND_ANALYSIS: 1,
            },
            "cracks": {
                INTENT_ANOMALY_CHECK: 2,
                INTENT_DATA_QUERY: 1,
                INTENT_TREND_ANALYSIS: 1,
            },
            "advanced": {
                INTENT_ANOMALY_CHECK: 1,
                INTENT_PREDICTION: 1,
                INTENT_TREND_ANALYSIS: 1,
                INTENT_COMPARISON: 1,
            },
        }
        boosts = module_boosts.get(module_key, {})
        for intent, boost in boosts.items():
            intent_scores[intent] = intent_scores.get(intent, 0) + boost

    # If no matches, return general intent
    if not intent_scores:
        return INTENT_GENERAL, 0.5

    # Return intent with highest score
    best_intent = max(intent_scores, key=intent_scores.get)
    max_score = intent_scores[best_intent]

    # Calculate confidence (normalize by total keywords)
    total_keywords = len(INTENT_KEYWORDS[best_intent])
    confidence = min(max_score / total_keywords, 1.0)

    return best_intent, confidence


def get_intent_description(intent: str) -> str:
    """
    Get human-readable description of intent type

    Args:
        intent: Intent type

    Returns:
        Description string
    """
    descriptions = {
        INTENT_DATA_QUERY: "Data Query",
        INTENT_ANOMALY_CHECK: "Anomaly Check",
        INTENT_TREND_ANALYSIS: "Trend Analysis",
        INTENT_COMPARISON: "Data Comparison",
        INTENT_PREDICTION: "Future Prediction",
        INTENT_EXPLANATION: "Explanation Request",
        INTENT_OPERATION: "Operational Guidance",
        INTENT_GENERAL: "General Question",
    }
    return descriptions.get(intent, "Unknown")


# ==================== Agent Tool Selection ====================
# Maps user intent to a SUBSET of agent tools (instead of all 13)
# This reduces Claude payload by ~60-70% and speeds up each call by 2-4s.

AGENT_TOOL_GROUPS = {
    "anomaly": [
        "query_analysis_summary",
        "query_anomalies",
        "detect_anomalies",
    ],
    "prediction": [
        "query_analysis_summary",
        "query_settlement_data",
        "predict_settlement",
    ],
    "correlation": [
        "query_analysis_summary",
        "analyze_correlation",
        "query_settlement_data",
    ],
    "temperature": [
        "query_analysis_summary",
        "query_temperature_data",
    ],
    "crack": [
        "query_analysis_summary",
        "query_crack_data",
    ],
    "knowledge_graph": [
        "build_knowledge_graph",
        "query_knowledge_graph",
        "query_analysis_summary",
    ],
    "academic": [
        "search_academic_papers",
    ],
    "construction": [
        "query_construction_events",
        "query_analysis_summary",
    ],
    "general_overview": [
        "query_analysis_summary",
        "list_monitoring_points",
    ],
    "data_query": [
        "query_analysis_summary",
        "list_monitoring_points",
        "query_settlement_data",
    ],
}


def classify_agent_intent(question: str) -> str:
    """Classify user question into agent tool category using keyword matching.
    Fast, no API call needed. Returns key from AGENT_TOOL_GROUPS.
    """
    q = (question or "").lower()

    if any(k in q for k in ["anomal", "abnorm", "\u5f02\u5e38", "\u544a\u8b66", "\u8d85\u9650", "\u98ce\u9669"]):
        return "anomaly"
    if any(k in q for k in ["crack", "\u88c2\u7f1d"]):
        return "crack"
    if any(k in q for k in ["predict", "forecast", "\u9884\u6d4b", "\u8d8b\u52bf", "\u672a\u6765", "\u9884\u671f"]):
        return "prediction"
    if any(k in q for k in ["correlat", "\u5173\u8054", "\u76f8\u5173", "\u7a7a\u95f4", "spatial"]):
        return "correlation"
    if any(k in q for k in ["temperature", "\u6e29\u5ea6"]):
        return "temperature"
    if any(k in q for k in ["knowledge graph", "\u77e5\u8bc6\u56fe\u8c31", "\u56e0\u679c", "causal"]):
        return "knowledge_graph"
    if any(k in q for k in ["paper", "research", "\u8bba\u6587", "\u7814\u7a76", "\u6587\u732e"]):
        return "academic"
    if any(k in q for k in ["construct", "event", "\u65bd\u5de5", "\u4e8b\u4ef6"]):
        return "construction"
    if any(k in q for k in ["\u6982\u51b5", "\u603b\u89c8", "overview", "summary", "\u6574\u4f53"]):
        return "general_overview"

    return "data_query"


def get_tools_for_intent(intent: str) -> list:
    """Return the AGENT_TOOLS subset for the given intent.
    Returns list of tool definition dicts (filtered from full AGENT_TOOLS).
    """
    from .tool_definitions import AGENT_TOOLS

    tool_names = AGENT_TOOL_GROUPS.get(intent, AGENT_TOOL_GROUPS["data_query"])
    selected = [t for t in AGENT_TOOLS if t["name"] in tool_names]
    return selected
