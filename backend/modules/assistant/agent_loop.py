# -*- coding: utf-8 -*-
"""
Core Agent execution loop using Claude tool_use protocol.

Flow:
  user message -> Claude (with tools) ->
    if stop_reason == "tool_use": execute tools -> collect results -> call Claude again -> loop
    if stop_reason == "end_turn": extract final text -> return

Constraints:
  - Max 8 iterations
  - 55s total timeout (Vercel 60s limit minus 5s buffer)
  - Tool results truncated to 3000 chars
  - Timeout/over-iteration forces a summary response
"""
import json
import os
import time

import requests

from .agent_prompts import AGENT_SYSTEM_PROMPT
from .agent_tools import TOOL_REGISTRY
from .tool_definitions import AGENT_TOOLS


MAX_ITERATIONS = 8
AGENT_TIMEOUT = int(os.environ.get("AGENT_TIMEOUT", "55"))
TOOL_RESULT_MAX_CHARS = 3000
CLAUDE_CALL_TIMEOUT = 25


def _claude_settings():
    api_key = (
        os.environ.get("CLAUDE_API_KEY")
        or os.environ.get("ANTHROPIC_AUTH_TOKEN")
        or os.environ.get("ANTHROPIC_API_KEY")
        or ""
    ).strip()
    api_base = (
        os.environ.get("CLAUDE_API_BASE")
        or os.environ.get("ANTHROPIC_BASE_URL")
        or "https://api.anthropic.com"
    ).strip().rstrip("/")
    model = (os.environ.get("CLAUDE_MODEL") or "claude-sonnet-4-20250514").strip()
    max_tokens = int((os.environ.get("CLAUDE_MAX_TOKENS") or "4096").strip())
    return api_key, api_base, model, max_tokens


def _truncate_result(result_str, max_chars=TOOL_RESULT_MAX_CHARS):
    """Truncate tool result to max_chars, preserving JSON structure."""
    if len(result_str) <= max_chars:
        return result_str
    # Try to parse and summarize
    try:
        obj = json.loads(result_str)
        # If it has a 'data' list, truncate it
        if isinstance(obj, dict):
            for key in ('data', 'anomalies', 'events', 'points', 'results', 'predictions'):
                if key in obj and isinstance(obj[key], list) and len(obj[key]) > 5:
                    original_len = len(obj[key])
                    obj[key] = obj[key][:5]
                    obj[f'{key}_truncated'] = True
                    obj[f'{key}_original_count'] = original_len
            truncated = json.dumps(obj, ensure_ascii=False, default=str)
            if len(truncated) <= max_chars:
                return truncated
    except Exception:
        pass
    return result_str[:max_chars] + "\n...[truncated]"


def _call_claude_with_tools(messages, api_key, api_base, model, max_tokens):
    """Single Claude API call with tools parameter."""
    url = f"{api_base}/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "system": AGENT_SYSTEM_PROMPT,
        "messages": messages,
        "tools": AGENT_TOOLS,
        "temperature": 0.2,
    }

    resp = requests.post(url, headers=headers, json=payload, timeout=CLAUDE_CALL_TIMEOUT)
    if not resp.ok:
        detail = ""
        try:
            detail = resp.text[:500]
        except Exception:
            pass
        raise Exception(f"Claude HTTP {resp.status_code}: {detail}")

    return resp.json()


def _extract_text(response_data):
    """Extract text content from Claude response."""
    content = response_data.get("content", [])
    texts = []
    for block in content:
        if isinstance(block, dict) and block.get("type") == "text":
            texts.append(block.get("text", ""))
    return "\n".join(texts).strip()


def _extract_tool_uses(response_data):
    """Extract tool_use blocks from Claude response."""
    content = response_data.get("content", [])
    tool_uses = []
    for block in content:
        if isinstance(block, dict) and block.get("type") == "tool_use":
            tool_uses.append(block)
    return tool_uses


def run_agent(user_content, page_path="", page_context=None):
    """
    Run the Agent loop.

    Args:
        user_content: User's question text
        page_path: Current page path for context
        page_context: Page context dict

    Returns:
        dict with keys: answer, model, tool_steps, total_iterations, total_duration_ms, error
    """
    api_key, api_base, model, max_tokens = _claude_settings()
    if not api_key:
        return {
            "answer": None,
            "model": None,
            "tool_steps": [],
            "total_iterations": 0,
            "total_duration_ms": 0,
            "error": "Claude API key not configured (Agent mode requires Claude)",
        }

    start_time = time.time()
    tool_steps = []
    kg_visualization = None  # Captured from build_knowledge_graph
    papers = []              # Captured from search_academic_papers
    papers_query = ""

    # Build initial user message with context
    user_msg_text = user_content
    if page_path:
        user_msg_text = f"[Current page: {page_path}]\n\n{user_content}"
    if page_context and isinstance(page_context, dict):
        ctx_summary = page_context.get("pageTitle", "")
        if ctx_summary:
            user_msg_text = f"[Page: {ctx_summary}]\n\n{user_content}"

    messages = [{"role": "user", "content": user_msg_text}]

    for iteration in range(MAX_ITERATIONS):
        elapsed = time.time() - start_time
        if elapsed > AGENT_TIMEOUT:
            # Timeout - force finish
            return _force_finish(
                messages, tool_steps, iteration, start_time,
                api_key, api_base, model, max_tokens,
                kg_visualization=kg_visualization, papers=papers, papers_query=papers_query,
            )

        try:
            response_data = _call_claude_with_tools(
                messages, api_key, api_base, model, max_tokens,
            )
        except Exception as e:
            return {
                "answer": None,
                "model": model,
                "tool_steps": tool_steps,
                "total_iterations": iteration + 1,
                "total_duration_ms": int((time.time() - start_time) * 1000),
                "error": f"Claude API error: {str(e)}",
            }

        stop_reason = response_data.get("stop_reason", "")
        actual_model = response_data.get("model", model)

        # Check for tool_use
        tool_uses = _extract_tool_uses(response_data)

        if stop_reason == "end_turn" or not tool_uses:
            # Final answer
            answer = _extract_text(response_data)
            return {
                "answer": answer,
                "model": actual_model,
                "tool_steps": tool_steps,
                "total_iterations": iteration + 1,
                "total_duration_ms": int((time.time() - start_time) * 1000),
                "error": None,
                "kg_visualization": kg_visualization,
                "papers": papers,
                "papers_query": papers_query,
            }

        # Execute tools
        # Add assistant's response (with tool_use blocks) to messages
        messages.append({"role": "assistant", "content": response_data.get("content", [])})

        tool_results = []
        for tool_use in tool_uses:
            tool_name = tool_use.get("name", "")
            tool_id = tool_use.get("id", "")
            tool_input = tool_use.get("input", {})

            step_start = time.time()

            # Execute tool
            func = TOOL_REGISTRY.get(tool_name)
            if func:
                try:
                    result = func(**tool_input)
                except Exception as e:
                    result = {"success": False, "error": str(e)}
            else:
                result = {"success": False, "error": f"Unknown tool: {tool_name}"}

            step_duration = int((time.time() - step_start) * 1000)

            # Serialize and truncate
            result_str = json.dumps(result, ensure_ascii=False, default=str)
            result_str = _truncate_result(result_str)

            # Capture special data for frontend visualization
            if isinstance(result, dict) and result.get("success"):
                if tool_name == "build_knowledge_graph" and result.get("visualization"):
                    kg_visualization = result["visualization"]
                elif tool_name == "search_academic_papers" and result.get("papers"):
                    papers = result["papers"]
                    papers_query = result.get("query", "")

            # Record step
            tool_steps.append({
                "iteration": iteration + 1,
                "tool_name": tool_name,
                "tool_input": tool_input,
                "result_summary": _make_summary(tool_name, result),
                "duration_ms": step_duration,
                "success": result.get("success", True) if isinstance(result, dict) else True,
            })

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_id,
                "content": result_str,
            })

        # Add tool results to messages
        messages.append({"role": "user", "content": tool_results})

    # Exceeded max iterations
    return _force_finish(
        messages, tool_steps, MAX_ITERATIONS, start_time,
        api_key, api_base, model, max_tokens,
        kg_visualization=kg_visualization, papers=papers, papers_query=papers_query,
    )


def _force_finish(messages, tool_steps, iterations, start_time,
                   api_key, api_base, model, max_tokens,
                   kg_visualization=None, papers=None, papers_query=""):
    """Force a final text response when timeout/max iterations reached."""
    try:
        # Add a user message asking for summary
        messages.append({
            "role": "user",
            "content": (
                "You have reached the maximum number of tool calls. "
                "Please summarize your findings so far and provide "
                "the best answer you can based on the data gathered. "
                "Respond in Chinese."
            ),
        })
        response_data = _call_claude_with_tools(
            messages, api_key, api_base, model, max_tokens,
        )
        answer = _extract_text(response_data)
        actual_model = response_data.get("model", model)
    except Exception as e:
        answer = "[Agent timeout] Unable to generate final summary."
        actual_model = model

    return {
        "answer": answer,
        "model": actual_model,
        "tool_steps": tool_steps,
        "total_iterations": iterations,
        "total_duration_ms": int((time.time() - start_time) * 1000),
        "error": None,
        "kg_visualization": kg_visualization,
        "papers": papers or [],
        "papers_query": papers_query,
    }


def _make_summary(tool_name, result):
    """Create a brief Chinese summary of a tool result."""
    if not isinstance(result, dict):
        return str(result)[:100]

    if not result.get("success", True):
        return f"[Error] {result.get('error', 'unknown')}"[:100]

    summaries = {
        "list_monitoring_points": lambda r: f"Found {r.get('count', 0)} monitoring points",
        "query_settlement_data": lambda r: (
            f"Point {r.get('point_id','?')}: {r.get('total_records',0)} records, "
            f"latest={r.get('summary',{}).get('latest_value','?')}mm"
        ),
        "query_temperature_data": lambda r: f"{r.get('total_records',0)} temperature records",
        "query_crack_data": lambda r: f"{r.get('total_records',0)} crack records",
        "query_construction_events": lambda r: f"{r.get('count',0)} construction events",
        "detect_anomalies": lambda r: (
            f"Point {r.get('point_id','?')}: {r.get('anomaly_count',0)} anomalies "
            f"({r.get('anomaly_rate',0):.1f}%)"
        ),
        "predict_settlement": lambda r: (
            f"Point {r.get('point_id','?')}: {r.get('steps',0)}-day prediction, "
            f"model={r.get('model','?')}"
        ),
        "build_knowledge_graph": lambda r: (
            f"Graph built: {r.get('nodes',0)} nodes, {r.get('edges',0)} edges"
        ),
        "query_knowledge_graph": lambda r: "Graph query completed",
        "analyze_correlation": lambda r: (
            f"Analyzed {len(r.get('points_analyzed',[]))} points, "
            f"{r.get('total_pairs',0)} strong correlations"
        ),
        "query_anomalies": lambda r: (
            f"Checked {r.get('points_checked',0)} points, "
            f"{r.get('total_anomalies',0)} anomalies found "
            f"(critical={r.get('severity_summary',{}).get('critical',0)})"
        ),
        "search_academic_papers": lambda r: (
            f"Found {len(r.get('papers',[]))} papers for '{r.get('query','?')}'"
        ),
    }

    func = summaries.get(tool_name)
    if func:
        try:
            return func(result)
        except Exception:
            pass
    return f"Tool {tool_name} completed"
