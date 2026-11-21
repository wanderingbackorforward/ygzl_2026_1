# -*- coding: utf-8 -*-
"""
Context formatter for different intent types
Dynamically adjusts context detail level based on question intent
"""

from typing import Any, Dict, Optional
from .intent_classifier import (
    INTENT_DATA_QUERY,
    INTENT_ANOMALY_CHECK,
    INTENT_TREND_ANALYSIS,
    INTENT_COMPARISON,
    INTENT_PREDICTION,
    INTENT_EXPLANATION,
    INTENT_OPERATION,
    INTENT_GENERAL,
)


def format_context_for_prompt(page_context: Any, intent: str) -> str:
    """
    Format page context based on intent type

    Args:
        page_context: Page context data
        intent: Question intent type

    Returns:
        Formatted context string in Markdown
    """
    if not page_context or not isinstance(page_context, dict):
        return ""

    # Select formatting strategy based on intent
    if intent == INTENT_DATA_QUERY:
        return _format_for_data_query(page_context)
    elif intent == INTENT_ANOMALY_CHECK:
        return _format_for_anomaly_check(page_context)
    elif intent == INTENT_TREND_ANALYSIS:
        return _format_for_trend_analysis(page_context)
    elif intent == INTENT_COMPARISON:
        return _format_for_comparison(page_context)
    elif intent == INTENT_PREDICTION:
        return _format_for_prediction(page_context)
    elif intent in [INTENT_EXPLANATION, INTENT_OPERATION, INTENT_GENERAL]:
        return _format_general(page_context)
    else:
        return _format_general(page_context)


def _format_for_data_query(ctx: Dict[str, Any]) -> str:
    """Format context for data query questions - focus on summary and statistics"""
    lines = []
    page_title = ctx.get("pageTitle") or "Unknown Page"
    lines.append(f"### Current Page: {page_title}")

    snapshot = ctx.get("dataSnapshot") or {}
    summary = snapshot.get("summary") or {}
    stats = snapshot.get("statistics") or {}

    if summary:
        lines.append("\n**Data Summary**:")
        for key, val in summary.items():
            if val is not None:
                # Format key name
                key_display = key.replace("_", " ").title()
                lines.append(f"- {key_display}: {val}")

    if stats:
        lines.append("\n**Statistics**:")
        total = stats.get("totalCount")
        anomaly = stats.get("anomalyCount")
        normal = stats.get("normalCount")
        if total is not None:
            lines.append(f"- Total Count: {total}")
        if anomaly is not None:
            lines.append(f"- Anomaly Count: {anomaly}")
        if normal is not None:
            lines.append(f"- Normal Count: {normal}")

    return "\n".join(lines) if lines else ""


def _format_for_anomaly_check(ctx: Dict[str, Any]) -> str:
    """Format context for anomaly check - include anomaly details"""
    lines = []
    page_title = ctx.get("pageTitle") or "Unknown Page"
    lines.append(f"### Current Page: {page_title}")

    snapshot = ctx.get("dataSnapshot") or {}
    summary = snapshot.get("summary") or {}
    stats = snapshot.get("statistics") or {}

    # Statistics
    if stats:
        lines.append("\n**Statistics**:")
        total = stats.get("totalCount")
        anomaly = stats.get("anomalyCount")
        normal = stats.get("normalCount")
        if total is not None:
            lines.append(f"- Total: {total}")
        if anomaly is not None:
            lines.append(f"- Anomalies: {anomaly}")
        if normal is not None:
            lines.append(f"- Normal: {normal}")

    # Summary with focus on anomalies
    if summary:
        lines.append("\n**Key Metrics**:")
        for key, val in summary.items():
            if val is not None and ("anomaly" in key.lower() or "risk" in key.lower() or "alert" in key.lower()):
                key_display = key.replace("_", " ").title()
                lines.append(f"- {key_display}: {val}")

    # Metadata
    metadata = ctx.get("metadata") or {}
    has_anomalies = metadata.get("hasAnomalies")
    if has_anomalies is not None:
        status = "Anomalies Detected" if has_anomalies else "All Normal"
        lines.append(f"\n**Status**: {status}")

    return "\n".join(lines) if lines else ""


def _format_for_trend_analysis(ctx: Dict[str, Any]) -> str:
    """Format context for trend analysis - include trend information"""
    lines = []
    page_title = ctx.get("pageTitle") or "Unknown Page"
    lines.append(f"### Current Page: {page_title}")

    snapshot = ctx.get("dataSnapshot") or {}
    summary = snapshot.get("summary") or {}

    if summary:
        lines.append("\n**Trend Information**:")
        for key, val in summary.items():
            if val is not None and ("trend" in key.lower() or "rate" in key.lower() or "change" in key.lower()):
                key_display = key.replace("_", " ").title()
                lines.append(f"- {key_display}: {val}")

        # Also include key metrics
        lines.append("\n**Key Metrics**:")
        for key, val in summary.items():
            if val is not None and key.lower() in ["totalcount", "avgSettlement", "maxSettlement"]:
                key_display = key.replace("_", " ").title()
                lines.append(f"- {key_display}: {val}")

    return "\n".join(lines) if lines else ""


def _format_for_comparison(ctx: Dict[str, Any]) -> str:
    """Format context for comparison - structured data for comparison"""
    lines = []
    page_title = ctx.get("pageTitle") or "Unknown Page"
    lines.append(f"### Current Page: {page_title}")

    snapshot = ctx.get("dataSnapshot") or {}
    summary = snapshot.get("summary") or {}
    selected = snapshot.get("selectedItems") or []

    if summary:
        lines.append("\n**Available Data**:")
        for key, val in summary.items():
            if val is not None:
                key_display = key.replace("_", " ").title()
                lines.append(f"- {key_display}: {val}")

    if selected:
        lines.append(f"\n**Selected Items**: {', '.join(str(s) for s in selected)}")

    return "\n".join(lines) if lines else ""


def _format_for_prediction(ctx: Dict[str, Any]) -> str:
    """Format context for prediction - historical data and trends"""
    lines = []
    page_title = ctx.get("pageTitle") or "Unknown Page"
    lines.append(f"### Current Page: {page_title}")

    snapshot = ctx.get("dataSnapshot") or {}
    summary = snapshot.get("summary") or {}

    if summary:
        lines.append("\n**Historical Data**:")
        for key, val in summary.items():
            if val is not None:
                key_display = key.replace("_", " ").title()
                lines.append(f"- {key_display}: {val}")

    metadata = ctx.get("metadata") or {}
    last_update = metadata.get("lastUpdate")
    if last_update:
        lines.append(f"\n**Last Update**: {last_update}")

    return "\n".join(lines) if lines else ""


def _format_general(ctx: Dict[str, Any]) -> str:
    """Format context for general questions - balanced information"""
    lines = []
    page_title = ctx.get("pageTitle") or "Unknown Page"
    lines.append(f"### Current Page: {page_title}")

    snapshot = ctx.get("dataSnapshot") or {}
    summary = snapshot.get("summary") or {}
    stats = snapshot.get("statistics") or {}

    if summary:
        lines.append("\n**Data Summary**:")
        for key, val in summary.items():
            if val is not None:
                key_display = key.replace("_", " ").title()
                lines.append(f"- {key_display}: {val}")

    if stats:
        lines.append("\n**Statistics**:")
        total = stats.get("totalCount")
        anomaly = stats.get("anomalyCount")
        normal = stats.get("normalCount")
        if total is not None:
            lines.append(f"- Total: {total}")
        if anomaly is not None:
            lines.append(f"- Anomalies: {anomaly}")
        if normal is not None:
            lines.append(f"- Normal: {normal}")

    metadata = ctx.get("metadata") or {}
    has_anomalies = metadata.get("hasAnomalies")
    if has_anomalies is not None:
        status = "Anomalies Present" if has_anomalies else "All Normal"
        lines.append(f"\n**Status**: {status}")

    return "\n".join(lines) if lines else ""
