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
