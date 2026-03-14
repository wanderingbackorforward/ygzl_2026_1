# -*- coding: utf-8 -*-
"""
Streaming Agent loop - yields SSE events for real-time UI updates.

Flow:
  1. Classify intent -> select tool subset (fewer tools = faster)
  2. Call Claude with tools (non-streaming) -> get tool_use blocks
  3. Execute tools -> yield tool_start/tool_end events
  4. Claude sees results -> yield text (or stream final summary)
  5. Save to DB -> yield done event

SSE event types:
  thinking    - status updates (planning, calling_ai, summarizing)
  tool_start  - tool execution begins
  tool_end    - tool execution finished with summary
  text_delta  - text chunk from AI response
  error       - error occurred
  done        - final event with metadata
"""
import json
import os
import time

import requests

from .agent_prompts import build_agent_system_prompt
from .agent_tools import TOOL_REGISTRY
from .db_service import ConversationService
from .intent_classifier import classify_agent_intent, get_tools_for_intent
from .module_prompts import extract_module_key


MAX_ITERATIONS = 2
TOOL_RESULT_MAX_CHARS = 2000
AGENT_TIMEOUT = 50  # seconds hard limit


def _sse(event_type, data):
    payload = json.dumps(data, ensure_ascii=False, default=str)
    return f"event: {event_type}\ndata: {payload}\n\n"


def _decode_utf8_text(value):
    if isinstance(value, str):
        return value
    if isinstance(value, (bytes, bytearray)):
        try:
            return value.decode("utf-8")
        except Exception:
            try:
                return value.decode("utf-8", errors="replace")
            except Exception:
                return ""
    return ""


def _response_json_utf8(resp):
    try:
        raw = resp.content
        if isinstance(raw, (bytes, bytearray)):
            return json.loads(raw.decode("utf-8"))
    except Exception:
        pass
    return resp.json()


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


def _headers(api_key):
    return {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }


def _truncate_result(result_str, max_chars=TOOL_RESULT_MAX_CHARS):
    if len(result_str) <= max_chars:
        return result_str
    try:
        obj = json.loads(result_str)
        if isinstance(obj, dict):
            for key in (
                "data", "anomalies", "events", "points",
                "results", "predictions", "point_summaries", "time_series",
            ):
                if (key in obj and isinstance(obj[key], list)
                        and len(obj[key]) > 5):
                    obj[f"{key}_original_count"] = len(obj[key])
                    obj[key] = obj[key][:5]
                    obj[f"{key}_truncated"] = True
            truncated = json.dumps(obj, ensure_ascii=False, default=str)
            if len(truncated) <= max_chars:
                return truncated
    except Exception:
        pass
    return result_str[:max_chars] + "\n...[truncated]"


def _make_summary(tool_name, result):
    if not isinstance(result, dict):
        return "completed"
    if not result.get("success", True):
        return f"error: {result.get('error', 'unknown')}"
    if tool_name == "query_settlement_data":
        return f"{len(result.get('data', []))} data points"
    if tool_name == "detect_anomalies":
        return f"{len(result.get('anomalies', []))} anomalies"
    if tool_name == "predict_settlement":
        return f"{len(result.get('predictions', []))}-step prediction"
    if tool_name == "build_knowledge_graph":
        viz = result.get("visualization", {})
        return f"{len(viz.get('nodes', []))} nodes, {len(viz.get('edges', []))} edges"
    if tool_name == "search_academic_papers":
        return f"{len(result.get('papers', []))} papers"
    if tool_name == "query_analysis_summary":
        return "analysis data loaded"
    if tool_name == "query_crack_data":
        point_summaries = result.get("point_summaries", [])
        summary = result.get("summary", {}) if isinstance(result.get("summary"), dict) else {}
        total_points = summary.get("total_points", len(point_summaries))
        rates = []
        for row in point_summaries:
            if not isinstance(row, dict):
                continue
            rate = row.get("average_change_rate")
            if rate is None:
                continue
            try:
                rate_val = float(rate)
            except Exception:
                continue
            rates.append((str(row.get("point_id", "?")), rate_val))
        if rates:
            high = [x for x in rates if x[1] > 0.1]
            medium = [x for x in rates if 0.05 < x[1] <= 0.1]
            top = sorted(rates, key=lambda x: abs(x[1]), reverse=True)[:3]
            top_text = ", ".join([f"{pid}:{rate:.3f}mm/day" for pid, rate in top])
            return (
                f"{total_points} points, rates={len(rates)}, "
                f"high>{0.1}={len(high)}, medium={len(medium)}, top={top_text}"
            )
        total_records = result.get("total_records", 0)
        latest = summary.get("latest")
        if latest is not None:
            return f"{total_points} points, records={total_records}, latest={latest}mm"
        return f"{total_points} points, records={total_records}"
    if tool_name == "list_monitoring_points":
        return f"{len(result.get('points', []))} points"
    return "completed"


def _build_user_msg(content, page_path, page_context):
    """Build user message text with page context."""
    text = content
    if page_path:
        text = f"[Current page: {page_path}]\n\n{content}"

    if not page_context or not isinstance(page_context, dict):
        return text

    parts = []
    title = page_context.get("pageTitle", "")
    if title:
        parts.append(f"Page: {title}")

    snapshot = page_context.get("dataSnapshot") or {}
    summary = snapshot.get("summary") or {}
    if summary:
        parts.append("Data summary:")
        for k, v in summary.items():
            if v is not None:
                parts.append(f"  {k}: {v}")

    stats = snapshot.get("statistics") or {}
    if stats:
        parts.append("Statistics:")
        for k in ("totalCount", "anomalyCount", "normalCount",
                   "warningCount", "criticalCount"):
            v = stats.get(k)
            if v is not None:
                parts.append(f"  {k}: {v}")

    meta = page_context.get("metadata") or {}
    if meta.get("selectedPoint"):
        parts.append(f"Selected point: {meta['selectedPoint']}")

    if parts:
        block = "\n".join(parts)
        text = f"[{block}]\n\n{content}"

    return text


# ------------------------------------------------------------------
# Main generator
# ------------------------------------------------------------------

def stream_agent(content, page_path, page_context, conv_id, user_message):
    """Generator yielding SSE event strings for agent mode."""

    api_key, api_base, model, max_tokens = _claude_settings()
    if not api_key:
        yield _sse("error", {
            "message": "Claude API key not configured (Agent mode requires Claude)"
        })
        return

    start_time = time.time()

    # 1. Intent classification -> tool subset
    intent = classify_agent_intent(content)
    tools = get_tools_for_intent(intent)
    tool_names = [t["name"] for t in tools]

    yield _sse("thinking", {
        "status": "planning",
        "intent": intent,
        "tools_selected": tool_names,
    })

    # 2. Build prompts
    module_key = extract_module_key(page_path)
    agent_prompt = build_agent_system_prompt(module_key)
    user_msg_text = _build_user_msg(content, page_path, page_context)

    messages = [{"role": "user", "content": user_msg_text}]
    hdrs = _headers(api_key)

    tool_steps = []
    actual_model = model
    kg_visualization = None
    papers = []
    papers_query = ""

    # 3. Agent loop
    for iteration in range(MAX_ITERATIONS):
        elapsed = time.time() - start_time
        if elapsed > AGENT_TIMEOUT:
            yield _sse("error", {"message": "Agent timeout"})
            return

        yield _sse("thinking", {
            "status": "calling_ai",
            "iteration": iteration + 1,
        })

        # Call Claude with tools (non-streaming)
        payload = {
            "model": model,
            "max_tokens": max_tokens,
            "system": agent_prompt,
            "messages": messages,
            "tools": tools,
            "temperature": 0.2,
        }

        try:
            resp = requests.post(
                f"{api_base}/v1/messages",
                headers=hdrs, json=payload,
                timeout=20,
            )
            if not resp.ok:
                detail = resp.text[:300] if resp.text else ""
                yield _sse("error", {
                    "message": f"Claude HTTP {resp.status_code}: {detail}"
                })
                return
            response_data = _response_json_utf8(resp)
        except requests.exceptions.Timeout:
            yield _sse("error", {"message": "Claude API timeout"})
            return
        except Exception as exc:
            yield _sse("error", {"message": f"Claude error: {exc}"})
            return

        stop_reason = response_data.get("stop_reason", "")
        actual_model = response_data.get("model", model)
        blocks = response_data.get("content", [])

        # Extract tool_use blocks
        tool_uses = [
            b for b in blocks
            if isinstance(b, dict) and b.get("type") == "tool_use"
        ]

        # -- end_turn: extract text and finish --
        if stop_reason == "end_turn" or not tool_uses:
            texts = [
                b.get("text", "") for b in blocks
                if isinstance(b, dict) and b.get("type") == "text"
            ]
            full_text = "\n".join(texts).strip()
            if full_text:
                yield _sse("text_delta", {"delta": full_text})
                yield from _finish(
                    full_text, conv_id, user_message, actual_model,
                    tool_steps, intent, kg_visualization, papers,
                    papers_query,
                )
            else:
                yield _sse("error", {"message": "Empty AI response"})
            return

        # -- tool_use: execute tools --
        messages.append({"role": "assistant", "content": blocks})
        tool_results = []

        for tu in tool_uses:
            t_name = tu.get("name", "")
            t_id = tu.get("id", "")
            t_input = tu.get("input", {})

            yield _sse("tool_start", {
                "tool_name": t_name,
                "tool_input": t_input,
                "iteration": iteration + 1,
            })

            t_start = time.time()
            func = TOOL_REGISTRY.get(t_name)
            if func:
                try:
                    result = func(**t_input)
                except Exception as exc:
                    result = {"success": False, "error": str(exc)}
            else:
                result = {"success": False, "error": f"Unknown tool: {t_name}"}

            dur_ms = int((time.time() - t_start) * 1000)
            result_str = json.dumps(result, ensure_ascii=False, default=str)
            result_str = _truncate_result(result_str)
            summary = _make_summary(t_name, result)

            # Capture KG / papers for frontend
            if isinstance(result, dict) and result.get("success"):
                if t_name == "build_knowledge_graph":
                    viz = result.get("visualization")
                    if viz:
                        kg_visualization = viz
                elif t_name == "search_academic_papers":
                    found = result.get("papers", [])
                    if found:
                        papers = found
                        papers_query = result.get("query", "")

            ok = (result.get("success", True)
                  if isinstance(result, dict) else True)
            tool_steps.append({
                "iteration": iteration + 1,
                "tool_name": t_name,
                "tool_input": t_input,
                "result_summary": summary,
                "duration_ms": dur_ms,
                "success": ok,
            })

            yield _sse("tool_end", {
                "tool_name": t_name,
                "result_summary": summary,
                "duration_ms": dur_ms,
                "success": ok,
            })

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": t_id,
                "content": result_str,
            })

        messages.append({"role": "user", "content": tool_results})

    # 4. Exceeded max iterations -> stream a summary
    yield from _stream_summary(
        content, tool_steps, api_base, hdrs, model, max_tokens,
        conv_id, user_message, actual_model, intent,
        kg_visualization, papers, papers_query,
    )


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _finish(full_text, conv_id, user_message, model,
            tool_steps, intent, kg_viz, papers, papers_query):
    """Save to DB and yield done event."""
    assistant_msg = ConversationService.add_message(
        conv_id=conv_id,
        role="assistant",
        content=full_text,
        content_type="markdown",
        metadata={
            "mode": "agent",
            "model": model,
            "tool_steps": tool_steps,
            "intent": intent,
        },
    )
    yield _sse("done", {
        "message_id": assistant_msg.get("id", ""),
        "model": model,
        "user_message": user_message,
        "tool_steps": tool_steps,
        "kg_visualization": kg_viz,
        "papers": papers,
        "papers_query": papers_query,
    })


def _stream_summary(question, tool_steps, api_base, hdrs, model,
                     max_tokens, conv_id, user_message, actual_model,
                     intent, kg_viz, papers, papers_query):
    """Stream a final summary when max iterations exhausted."""
    yield _sse("thinking", {"status": "summarizing"})

    parts = []
    for s in tool_steps:
        parts.append(
            f"Tool: {s.get('tool_name', '?')} -> "
            f"{s.get('result_summary', 'completed')}"
        )

    condensed = (
        "Based on the following data gathered by tools, "
        "provide a concise analysis and answer the user's question. "
        "Respond in Chinese with Markdown format. "
        "You must quote concrete numeric values from tool results. "
        "If a metric is missing, explicitly say which metric is missing.\n\n"
        f"User question: {question}\n\n"
        f"Tool results:\n" + "\n".join(parts)
    )

    payload = {
        "model": model,
        "max_tokens": min(max_tokens, 2048),
        "system": "You are a helpful assistant. Respond in Chinese.",
        "messages": [{"role": "user", "content": condensed}],
        "temperature": 0.2,
        "stream": True,
    }

    full_text = ""
    try:
        resp = requests.post(
            f"{api_base}/v1/messages",
            headers=hdrs, json=payload,
            timeout=15, stream=True,
        )
        if not resp.ok:
            yield _sse("error", {
                "message": f"Claude summary HTTP {resp.status_code}"
            })
            return

        for raw_line in resp.iter_lines(decode_unicode=False):
            line = _decode_utf8_text(raw_line)
            if not line or not line.startswith("data: "):
                continue
            data_str = line[6:]
            if data_str.strip() == "[DONE]":
                break
            try:
                ev = json.loads(data_str)
            except (json.JSONDecodeError, ValueError):
                continue
            etype = ev.get("type", "")
            if etype == "content_block_delta":
                delta = ev.get("delta", {})
                if delta.get("type") == "text_delta":
                    chunk = delta.get("text", "")
                    if chunk:
                        full_text += chunk
                        yield _sse("text_delta", {"delta": chunk})
            elif etype == "message_stop":
                break
    except Exception as exc:
        yield _sse("error", {"message": f"Summary stream error: {exc}"})
        return

    if full_text:
        yield from _finish(
            full_text, conv_id, user_message, actual_model,
            tool_steps, intent, kg_viz, papers, papers_query,
        )
    else:
        yield _sse("error", {"message": "Empty summary from AI"})
