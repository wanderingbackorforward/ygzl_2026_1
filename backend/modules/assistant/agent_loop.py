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


MAX_ITERATIONS = 3
AGENT_TIMEOUT = int(os.environ.get("AGENT_TIMEOUT", "50"))
TOOL_RESULT_MAX_CHARS = 3000
CLAUDE_CALL_TIMEOUT = 30


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


def _call_claude_with_tools(messages, api_key, api_base, model, max_tokens,
                             system_prompt=None):
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
        "system": system_prompt or AGENT_SYSTEM_PROMPT,
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

    # Build module-aware agent prompt
    from .module_prompts import extract_module_key
    from .agent_prompts import build_agent_system_prompt
    module_key = extract_module_key(page_path)
    agent_prompt = build_agent_system_prompt(module_key)

    # Build initial user message with full context (same data powering ECharts)
    user_msg_text = user_content
    if page_path:
        user_msg_text = f"[Current page: {page_path}]\n\n{user_content}"
    if page_context and isinstance(page_context, dict):
        ctx_parts = []
        page_title = page_context.get("pageTitle", "")
        if page_title:
            ctx_parts.append(f"Page: {page_title}")

        # Include dataSnapshot - this is the SAME data the ECharts see
        snapshot = page_context.get("dataSnapshot") or {}
        summary = snapshot.get("summary") or {}
        statistics = snapshot.get("statistics") or {}

        if summary:
            ctx_parts.append("Data summary:")
            for k, v in summary.items():
                if v is not None:
                    ctx_parts.append(f"  {k}: {v}")

        if statistics:
            ctx_parts.append("Statistics:")
            for k in ("totalCount", "anomalyCount", "normalCount",
                       "warningCount", "criticalCount"):
                v = statistics.get(k)
                if v is not None:
                    ctx_parts.append(f"  {k}: {v}")

        metadata = page_context.get("metadata") or {}
        if metadata.get("hasAnomalies") is not None:
            status = "has anomalies" if metadata["hasAnomalies"] else "all normal"
            ctx_parts.append(f"Status: {status}")
        if metadata.get("selectedPoint"):
            ctx_parts.append(f"Selected point: {metadata['selectedPoint']}")

        if ctx_parts:
            ctx_block = "\n".join(ctx_parts)
            user_msg_text = f"[{ctx_block}]\n\n{user_content}"

    messages = [{"role": "user", "content": user_msg_text}]

    for iteration in range(MAX_ITERATIONS):
        elapsed = time.time() - start_time
        if elapsed > AGENT_TIMEOUT:
            # Timeout - force finish
            return _force_finish(
                messages, tool_steps, iteration, start_time,
                api_key, api_base, model, max_tokens,
                kg_visualization=kg_visualization, papers=papers, papers_query=papers_query,
                system_prompt=agent_prompt,
            )

        try:
            response_data = _call_claude_with_tools(
                messages, api_key, api_base, model, max_tokens,
                system_prompt=agent_prompt,
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

            # Auto-enrich: build KG and search papers if not already done
            kg_visualization, papers, papers_query, tool_steps = _auto_enrich(
                kg_visualization, papers, papers_query, tool_steps,
                user_content, start_time,
            )

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
                if tool_name == "build_knowledge_graph":
                    viz = result.get("visualization")
                    print(f"[DEBUG] build_knowledge_graph result keys: {list(result.keys())}")
                    print(f"[DEBUG] visualization present: {viz is not None}, "
                          f"nodes: {len(viz.get('nodes',[])) if viz else 0}, "
                          f"edges: {len(viz.get('edges',[])) if viz else 0}")
                    if viz:
                        kg_visualization = viz
                elif tool_name == "search_academic_papers":
                    found_papers = result.get("papers", [])
                    print(f"[DEBUG] search_academic_papers: found {len(found_papers)} papers")
                    if found_papers:
                        papers = found_papers
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
        system_prompt=agent_prompt,
    )


def _auto_enrich(kg_visualization, papers, papers_query, tool_steps,
                  user_content, start_time):
    """Auto-call build_knowledge_graph and search_academic_papers if Agent didn't."""
    from .agent_tools import TOOL_REGISTRY

    # Check remaining time budget
    elapsed = time.time() - start_time
    time_left = AGENT_TIMEOUT - elapsed

    # 1. Auto-build knowledge graph if not already done
    if kg_visualization is None and time_left > 15:
        print("[DEBUG] _auto_enrich: Agent did NOT call build_knowledge_graph, calling now...")
        try:
            step_start = time.time()
            func = TOOL_REGISTRY.get("build_knowledge_graph")
            if func:
                result = func()
                step_duration = int((time.time() - step_start) * 1000)
                if isinstance(result, dict) and result.get("success"):
                    viz = result.get("visualization")
                    if viz:
                        kg_visualization = viz
                        print(f"[DEBUG] _auto_enrich: KG built OK, "
                              f"nodes={len(viz.get('nodes',[]))}, "
                              f"edges={len(viz.get('edges',[]))}")
                    tool_steps.append({
                        "iteration": 0,
                        "tool_name": "build_knowledge_graph",
                        "tool_input": {},
                        "result_summary": _make_summary("build_knowledge_graph", result),
                        "duration_ms": step_duration,
                        "success": True,
                    })
                else:
                    print(f"[DEBUG] _auto_enrich: KG build failed: {result.get('error','?')}")
        except Exception as e:
            print(f"[DEBUG] _auto_enrich: KG build exception: {e}")

    # 2. Auto-search papers if not already done
    elapsed = time.time() - start_time
    time_left = AGENT_TIMEOUT - elapsed
    if not papers and time_left > 8:
        # Extract a search query from user content (use first 60 chars as base)
        search_q = "settlement monitoring geotechnical analysis"
        content_lower = user_content.lower() if user_content else ""
        if any(kw in content_lower for kw in ["anomal", "异常"]):
            search_q = "settlement anomaly detection monitoring"
        elif any(kw in content_lower for kw in ["predict", "预测", "趋势"]):
            search_q = "settlement prediction time series forecasting"
        elif any(kw in content_lower for kw in ["spatial", "空间", "关联", "correlat"]):
            search_q = "spatial correlation settlement monitoring"
        elif any(kw in content_lower for kw in ["risk", "风险"]):
            search_q = "geotechnical risk assessment settlement"
        elif any(kw in content_lower for kw in ["crack", "裂缝"]):
            search_q = "structural crack monitoring settlement"
        elif any(kw in content_lower for kw in ["温度", "temperature"]):
            search_q = "temperature effect ground settlement"
        elif any(kw in content_lower for kw in ["知识图谱", "knowledge graph"]):
            search_q = "knowledge graph structural health monitoring"

        print(f"[DEBUG] _auto_enrich: Agent did NOT call search_academic_papers, "
              f"searching for: {search_q}")
        try:
            step_start = time.time()
            func = TOOL_REGISTRY.get("search_academic_papers")
            if func:
                result = func(query=search_q, limit=5)
                step_duration = int((time.time() - step_start) * 1000)
                if isinstance(result, dict) and result.get("success"):
                    found = result.get("papers", [])
                    if found:
                        papers = found
                        papers_query = search_q
                        print(f"[DEBUG] _auto_enrich: Found {len(found)} papers")
                    tool_steps.append({
                        "iteration": 0,
                        "tool_name": "search_academic_papers",
                        "tool_input": {"query": search_q, "limit": 5},
                        "result_summary": _make_summary("search_academic_papers", result),
                        "duration_ms": step_duration,
                        "success": True,
                    })
                else:
                    print(f"[DEBUG] _auto_enrich: Paper search failed: {result.get('error','?')}")
        except Exception as e:
            print(f"[DEBUG] _auto_enrich: Paper search exception: {e}")

    return kg_visualization, papers, papers_query, tool_steps


def _force_finish(messages, tool_steps, iterations, start_time,
                   api_key, api_base, model, max_tokens,
                   kg_visualization=None, papers=None, papers_query="",
                   system_prompt=None):
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
            system_prompt=system_prompt,
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
        "query_analysis_summary": lambda r: (
            f"Module {r.get('module','?')}: {r.get('count',0)} records, "
            f"alerts={r.get('alert_summary',{})}"
        ),
    }

    func = summaries.get(tool_name)
    if func:
        try:
            return func(result)
        except Exception:
            pass
    return f"Tool {tool_name} completed"
