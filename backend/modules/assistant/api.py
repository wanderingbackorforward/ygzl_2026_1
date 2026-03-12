# -*- coding: utf-8 -*-
import os
from typing import Any, Dict, Optional, Tuple

import requests
from flask import Blueprint, jsonify, request

from .db_service import ConversationService
from .prompts import get_role_prompt, build_full_system_prompt


assistant_bp = Blueprint("assistant", __name__, url_prefix="/api/assistant")


def _merge_papers_into_kg(kg_viz, papers):
    """Merge academic papers into the knowledge graph as nodes + edges."""
    import math
    import random
    if not kg_viz or not papers:
        return kg_viz

    nodes = list(kg_viz.get("nodes", []))
    edges = list(kg_viz.get("edges", []))
    stats = dict(kg_viz.get("stats", {}))

    # Find center of existing nodes for paper cluster placement
    if nodes:
        cx = sum(n["x"] for n in nodes) / len(nodes)
        cy = sum(n["y"] for n in nodes) / len(nodes)
    else:
        cx, cy = 400, 300

    # Place papers in a ring around the bottom-right of the graph
    paper_cx = cx + 250
    paper_cy = cy + 150
    n_papers = len(papers)

    for i, paper in enumerate(papers):
        angle = 2 * math.pi * i / max(n_papers, 1) - math.pi / 2
        radius = 80 + random.randint(-10, 10)
        px = round(paper_cx + radius * math.cos(angle), 1)
        py = round(paper_cy + radius * math.sin(angle), 1)

        paper_id = f"paper:{i}"
        year_str = f" ({paper.get('year', '')})" if paper.get("year") else ""
        # Short label: first author + year
        authors = paper.get("authors", "")
        first_author = authors.split(",")[0].strip() if authors else "Paper"
        label = f"{first_author}{year_str}"
        if len(label) > 14:
            label = label[:12] + ".."

        nodes.append({
            "id": paper_id,
            "label": label,
            "type": "AcademicPaper",
            "color": "#8b5cf6",  # violet
            "size": 16,
            "x": px,
            "y": py,
            "severity": "",
            "attrs": {
                "title": paper.get("title", ""),
                "authors": authors,
                "year": paper.get("year"),
                "citations": paper.get("citations", 0),
                "doi": paper.get("doi", ""),
                "url": paper.get("url", ""),
                "abstract": paper.get("abstract", ""),
            },
        })

        # Connect paper to all monitoring point nodes
        for node in kg_viz.get("nodes", []):
            if node.get("type") == "MonitoringPoint":
                edges.append({
                    "source": paper_id,
                    "target": node["id"],
                    "type": "REFERENCES",
                    "color": "#c084fc",  # purple-400
                    "label": "References",
                    "attrs": {},
                })
                break  # Connect to first monitoring point only (avoid clutter)

    # Update stats
    stats["total_nodes"] = len(nodes)
    stats["total_edges"] = len(edges)
    node_types = dict(stats.get("node_types", {}))
    node_types["AcademicPaper"] = n_papers
    stats["node_types"] = node_types
    edge_types = dict(stats.get("edge_types", {}))
    edge_types["REFERENCES"] = n_papers
    stats["edge_types"] = edge_types

    return {"nodes": nodes, "edges": edges, "stats": stats}


def _is_meaningful_question(q: str) -> bool:
    s = (q or "").strip()
    if not s:
        return False
    if len(s) < 2:
        return False
    if s.isdigit():
        return False
    return True


# ==================== AI Provider Settings ====================


def _claude_settings() -> Tuple[str, str, str, float, int]:
    """Get Claude API settings (Anthropic Messages format)"""
    api_key = (
        os.getenv("CLAUDE_API_KEY")
        or os.getenv("ANTHROPIC_AUTH_TOKEN")
        or os.getenv("ANTHROPIC_API_KEY")
        or ""
    ).strip()
    api_base = (
        os.getenv("CLAUDE_API_BASE")
        or os.getenv("ANTHROPIC_BASE_URL")
        or "https://api.anthropic.com"
    ).strip().rstrip("/")
    model = (os.getenv("CLAUDE_MODEL") or "claude-sonnet-4-20250514").strip()
    try:
        timeout_s = float((os.getenv("CLAUDE_TIMEOUT_SECONDS") or "60").strip())
    except Exception:
        timeout_s = 60.0
    try:
        max_tokens = int((os.getenv("CLAUDE_MAX_TOKENS") or "4096").strip())
    except Exception:
        max_tokens = 4096
    return api_key, api_base, model, timeout_s, max_tokens


def _deepseek_settings() -> Tuple[str, str, str, float]:
    """Get DeepSeek API settings (OpenAI-compatible, fallback)"""
    api_key = (
        os.getenv("DEEPSEEK_API_KEY")
        or os.getenv("DEEPSEEK_KEY")
        or os.getenv("DEEPSEEK_TOKEN")
        or ""
    ).strip()
    api_base = (os.getenv("DEEPSEEK_API_BASE") or "https://api.deepseek.com").strip().rstrip("/")
    model = (os.getenv("DEEPSEEK_MODEL") or "deepseek-chat").strip()
    try:
        timeout_s = float((os.getenv("DEEPSEEK_TIMEOUT_SECONDS") or "30").strip())
    except Exception:
        timeout_s = 30.0
    return api_key, api_base, model, timeout_s


# ==================== AI Call Functions ====================


def _call_claude(
    system_prompt: str, user_content: str, temperature: float = 0.2
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Call Claude API (Anthropic Messages format).
    Returns: (answer, model_name, error_message)
    """
    api_key, api_base, model, timeout_s, max_tokens = _claude_settings()
    if not api_key:
        return None, None, "Claude API key not configured"

    url = f"{api_base}/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system_prompt,
        "messages": [
            {"role": "user", "content": user_content},
        ],
        "temperature": temperature,
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=timeout_s)
    except Exception as e:
        return None, None, f"Claude request failed: {str(e)}"

    if not resp.ok:
        detail = ""
        try:
            detail = resp.text[:500]
        except Exception:
            pass
        return None, None, f"Claude HTTP {resp.status_code}: {detail}"

    try:
        data = resp.json()
        content_list = data.get("content") or []
        if not content_list:
            return None, None, "Claude response missing content"
        texts = []
        for block in content_list:
            if isinstance(block, dict) and block.get("type") == "text":
                texts.append(block.get("text", ""))
        answer = "\n".join(texts).strip()
        if not answer:
            return None, None, "Claude response content is empty"
        actual_model = data.get("model", model)
        return answer, actual_model, None
    except Exception as e:
        return None, None, f"Claude response parse failed: {str(e)}"


def _call_deepseek(
    system_prompt: str, user_content: str, temperature: float = 0.2
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Call DeepSeek API (OpenAI-compatible format, fallback).
    Returns: (answer, model_name, error_message)
    """
    api_key, api_base, model, timeout_s = _deepseek_settings()
    if not api_key:
        return None, None, "DeepSeek API key not configured"

    url = f"{api_base}/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "temperature": temperature,
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=timeout_s)
    except Exception as e:
        return None, None, f"DeepSeek request failed: {str(e)}"

    if not resp.ok:
        detail = ""
        try:
            detail = resp.text[:500]
        except Exception:
            pass
        return None, None, f"DeepSeek HTTP {resp.status_code}: {detail}"

    try:
        data = resp.json()
        choices = data.get("choices") or []
        if not isinstance(choices, list) or not choices:
            return None, None, "DeepSeek response missing choices"
        msg = (choices[0] or {}).get("message") or {}
        content = msg.get("content")
        if isinstance(content, str) and content.strip():
            return content, model, None
        reasoning = msg.get("reasoning_content")
        if isinstance(reasoning, str) and reasoning.strip():
            return reasoning, model, None
        text_val = (choices[0] or {}).get("text")
        if isinstance(text_val, str) and text_val.strip():
            return text_val, model, None
        return None, None, "DeepSeek response missing usable content"
    except Exception as e:
        return None, None, f"DeepSeek response parse failed: {str(e)}"


def _call_ai(
    system_prompt: str, user_content: str, temperature: float = 0.2,
    provider: str = "auto"
) -> Tuple[str, str, bool]:
    """
    Call AI with provider selection.
    provider: "auto" (Claude first, DeepSeek fallback), "claude", "deepseek"
    Returns: (answer, model_name, is_fallback)
    Raises Exception if call fails.
    """
    if provider == "claude":
        answer, model_name, err = _call_claude(system_prompt, user_content, temperature)
        if answer:
            return answer, model_name or "claude", False
        raise Exception(f"Claude failed: {err}")

    if provider == "deepseek":
        answer, model_name, err = _call_deepseek(system_prompt, user_content, temperature)
        if answer:
            return answer, model_name or "deepseek-chat", False
        raise Exception(f"DeepSeek failed: {err}")

    # auto: Claude first, DeepSeek fallback
    answer, model_name, claude_error = _call_claude(system_prompt, user_content, temperature)
    if answer:
        return answer, model_name or "claude", False

    print(f"[WARN] Claude failed: {claude_error}, falling back to DeepSeek")
    answer, model_name, deepseek_error = _call_deepseek(system_prompt, user_content, temperature)
    if answer:
        return answer, f"{model_name} (fallback)", True

    raise Exception(
        f"All AI providers failed. Claude: {claude_error}. DeepSeek: {deepseek_error}"
    )


def _any_ai_configured() -> bool:
    """Check if at least one AI provider is configured"""
    claude_key = (
        os.getenv("CLAUDE_API_KEY")
        or os.getenv("ANTHROPIC_AUTH_TOKEN")
        or os.getenv("ANTHROPIC_API_KEY")
        or ""
    ).strip()
    deepseek_key = (
        os.getenv("DEEPSEEK_API_KEY")
        or os.getenv("DEEPSEEK_KEY")
        or os.getenv("DEEPSEEK_TOKEN")
        or ""
    ).strip()
    return bool(claude_key or deepseek_key)


def _request_id() -> str:
    return (request.headers.get("x-request-id") or request.headers.get("x-vercel-id") or "").strip()


def _format_context(ctx: Any) -> str:
    if not ctx or not isinstance(ctx, dict):
        return ""

    lines = []
    page_title = ctx.get("pageTitle") or "unknown"

    lines.append(f"### Current page data: {page_title}")

    snapshot = ctx.get("dataSnapshot") or {}
    summary = snapshot.get("summary") or {}
    stats = snapshot.get("statistics") or {}
    metadata = ctx.get("metadata") or {}

    if summary:
        lines.append("\n**Data summary**:")
        for key, val in summary.items():
            if val is not None:
                lines.append(f"- {key}: {val}")

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

    if metadata:
        has_anomalies = metadata.get("hasAnomalies")
        if has_anomalies is not None:
            status = "has anomalies" if has_anomalies else "all normal"
            lines.append(f"\n**Status**: {status}")

    return "\n".join(lines) if lines else ""


def _build_user_content(question: str, page_path: str, page_context: Any) -> str:
    """Build user content string with page context"""
    context_text = _format_context(page_context)
    if context_text:
        return f"Current page: {page_path}\n\n{context_text}\n\nQuestion: {question}"
    elif page_path:
        return f"Current page: {page_path}\n\nQuestion: {question}"
    else:
        return question


# ==================== Provider Info API ====================


@assistant_bp.route("/providers", methods=["GET"])
def get_providers():
    """Return available AI providers and their status"""
    claude_key = (
        os.getenv("CLAUDE_API_KEY")
        or os.getenv("ANTHROPIC_AUTH_TOKEN")
        or os.getenv("ANTHROPIC_API_KEY")
        or ""
    ).strip()
    deepseek_key = (
        os.getenv("DEEPSEEK_API_KEY")
        or os.getenv("DEEPSEEK_KEY")
        or os.getenv("DEEPSEEK_TOKEN")
        or ""
    ).strip()
    claude_model = (os.getenv("CLAUDE_MODEL") or "claude-sonnet-4-20250514").strip()
    deepseek_model = (os.getenv("DEEPSEEK_MODEL") or "deepseek-chat").strip()

    providers = []
    if claude_key:
        providers.append({
            "id": "claude",
            "name": "Claude",
            "model": claude_model,
            "available": True,
        })
    if deepseek_key:
        providers.append({
            "id": "deepseek",
            "name": "DeepSeek",
            "model": deepseek_model,
            "available": True,
        })

    return jsonify({
        "status": "success",
        "data": {
            "providers": providers,
            "default": "auto",
        },
    })


# ==================== Chat API ====================


@assistant_bp.route("/chat", methods=["POST"])
def assistant_chat():
    body = request.get_json(silent=True) or {}
    question = (body.get("question") or body.get("q") or "").strip()
    page_path = (body.get("pagePath") or body.get("page_path") or "").strip()
    page_context = body.get("pageContext")
    provider = (body.get("provider") or "auto").strip()
    if not question:
        return jsonify({"status": "error", "message": "missing question"}), 400
    if not _is_meaningful_question(question):
        return jsonify({"status": "error", "message": "Question too short or unclear"}), 400

    if not _any_ai_configured():
        return jsonify({
            "status": "error",
            "message": "No AI provider configured. Set CLAUDE_API_KEY or DEEPSEEK_API_KEY in environment.",
        }), 400

    system_prompt = build_full_system_prompt("researcher", page_path, question)
    user_content = _build_user_content(question, page_path, page_context)

    try:
        answer, model_name, is_fallback = _call_ai(
            system_prompt, user_content, temperature=0.2, provider=provider
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 502

    return jsonify({
        "status": "success",
        "data": {
            "answerMarkdown": answer,
            "model": model_name,
            "provider": "deepseek" if is_fallback else (provider if provider != "auto" else "claude"),
        },
    })


# ==================== Conversation Management API ====================


@assistant_bp.route("/conversations", methods=["GET"])
def get_conversations():
    try:
        limit = int(request.args.get("limit", 100))
        page_path = request.args.get("page_path")
        conversations = ConversationService.get_conversations(limit=limit, page_path=page_path)
        return jsonify({"status": "success", "data": conversations})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@assistant_bp.route("/conversations", methods=["POST"])
def create_conversation():
    try:
        body = request.get_json(silent=True) or {}
        title = body.get("title", "New conversation")
        role = body.get("role", "researcher")
        page_path = body.get("pagePath") or body.get("page_path")

        if role not in ["researcher", "worker", "reporter"]:
            return jsonify({"status": "error", "message": "Invalid role type"}), 400

        conversation = ConversationService.create_conversation(title=title, role=role, page_path=page_path)
        return jsonify({"status": "success", "data": conversation})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@assistant_bp.route("/conversations/<conv_id>", methods=["GET"])
def get_conversation(conv_id: str):
    try:
        conversation = ConversationService.get_conversation(conv_id)
        if not conversation:
            return jsonify({"status": "error", "message": "Conversation not found"}), 404
        return jsonify({"status": "success", "data": conversation})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@assistant_bp.route("/conversations/<conv_id>", methods=["PUT"])
def update_conversation(conv_id: str):
    try:
        body = request.get_json(silent=True) or {}
        title = body.get("title")
        role = body.get("role")

        if role and role not in ["researcher", "worker", "reporter"]:
            return jsonify({"status": "error", "message": "Invalid role type"}), 400

        success = ConversationService.update_conversation(conv_id, title=title, role=role)
        if not success:
            return jsonify({"status": "error", "message": "Conversation not found"}), 404

        return jsonify({"status": "success", "data": {"id": conv_id}})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@assistant_bp.route("/conversations/<conv_id>", methods=["DELETE"])
def delete_conversation(conv_id: str):
    try:
        success = ConversationService.delete_conversation(conv_id)
        if not success:
            return jsonify({"status": "error", "message": "Conversation not found"}), 404

        return jsonify({"status": "success", "data": {"id": conv_id}})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@assistant_bp.route("/conversations/<conv_id>/messages", methods=["POST"])
def send_message(conv_id: str):
    try:
        body = request.get_json(silent=True) or {}
        content = (body.get("content") or body.get("question") or "").strip()
        role = body.get("role", "researcher")
        page_path = (body.get("pagePath") or "").strip()
        page_context = body.get("pageContext")
        provider = (body.get("provider") or "auto").strip()
        mode = (body.get("mode") or "chat").strip()

        if not content:
            return jsonify({"status": "error", "message": "Message content cannot be empty"}), 400

        if not _is_meaningful_question(content):
            return jsonify({"status": "error", "message": "Question too short or unclear"}), 400

        conversation = ConversationService.get_conversation(conv_id)
        if not conversation:
            return jsonify({"status": "error", "message": "Conversation not found"}), 404

        if not _any_ai_configured():
            return jsonify({"status": "error", "message": "No AI provider configured"}), 400

        # Save user message
        user_message = ConversationService.add_message(
            conv_id=conv_id,
            role="user",
            content=content,
            content_type="text",
        )

        # ==================== Agent mode ====================
        if mode == "agent":
            try:
                import time as _time
                _agent_start = _time.time()

                from .agent_loop import run_agent
                agent_result = run_agent(
                    user_content=content,
                    page_path=page_path,
                    page_context=page_context,
                )
                answer = agent_result.get("answer")
                model_name = agent_result.get("model", "claude")
                agent_error = agent_result.get("error")
                _agent_elapsed = _time.time() - _agent_start

                if not answer and agent_error:
                    # Check if it's a timeout error - don't retry if so
                    is_timeout = ("timed out" in str(agent_error).lower()
                                  or "timeout" in str(agent_error).lower()
                                  or "read timed" in str(agent_error).lower())
                    if is_timeout or _agent_elapsed > 40:
                        print(f"[WARN] Agent timeout after {_agent_elapsed:.1f}s: {agent_error}")
                        return jsonify({
                            "status": "error",
                            "message": "AI response timed out. Please try a shorter/simpler question, or switch to normal chat mode.",
                        }), 504

                    # Non-timeout failure, try fallback to normal chat
                    print(f"[WARN] Agent failed ({_agent_elapsed:.1f}s): {agent_error}, falling back to chat")
                    system_prompt = build_full_system_prompt(role, page_path, content)
                    user_content_str = _build_user_content(content, page_path, page_context)
                    answer, model_name, _ = _call_ai(
                        system_prompt, user_content_str, temperature=0.2, provider=provider
                    )
                    agent_result = {"tool_steps": [], "total_iterations": 0, "total_duration_ms": 0}

                # Save AI response with agent metadata
                kg_viz = agent_result.get("kg_visualization")
                papers_data = agent_result.get("papers", [])
                papers_query_str = agent_result.get("papers_query", "")
                tool_steps_list = agent_result.get("tool_steps", [])

                _time_left = 55 - (_time.time() - _agent_start)
                print(f"[DEBUG] Agent result: kg_viz={'YES' if kg_viz else 'NO'}, "
                      f"papers={len(papers_data)}, time_left={_time_left:.1f}s")

                # ---- Force-enrich only if enough time left ----
                if not kg_viz and _time_left > 18:
                    print("[DEBUG] api.py: Force-building knowledge graph...")
                    try:
                        from .agent_tools import tool_build_knowledge_graph
                        kg_result = tool_build_knowledge_graph()
                        if isinstance(kg_result, dict) and kg_result.get("success"):
                            kg_viz = kg_result.get("visualization")
                            print(f"[DEBUG] api.py: KG built OK, "
                                  f"nodes={len(kg_viz.get('nodes',[])) if kg_viz else 0}")
                        else:
                            print(f"[DEBUG] api.py: KG build failed: {kg_result.get('error','?')}")
                    except Exception as kg_exc:
                        print(f"[DEBUG] api.py: KG build exception: {kg_exc}")
                elif not kg_viz:
                    print(f"[DEBUG] api.py: Skipping KG build, only {_time_left:.1f}s left")

                _time_left = 55 - (_time.time() - _agent_start)
                if not papers_data and _time_left > 12:
                    print("[DEBUG] api.py: Force-searching academic papers...")
                    try:
                        from .agent_tools import tool_search_academic_papers
                        q = "settlement monitoring geotechnical analysis"
                        cl = (content or "").lower()
                        if any(k in cl for k in ["anomal", "\u5f02\u5e38"]):
                            q = "settlement anomaly detection monitoring"
                        elif any(k in cl for k in ["predict", "\u9884\u6d4b", "\u8d8b\u52bf"]):
                            q = "settlement prediction time series forecasting"
                        elif any(k in cl for k in ["spatial", "\u7a7a\u95f4", "\u5173\u8054", "correlat"]):
                            q = "spatial correlation settlement monitoring"
                        elif any(k in cl for k in ["risk", "\u98ce\u9669"]):
                            q = "geotechnical risk assessment settlement"
                        elif any(k in cl for k in ["crack", "\u88c2\u7f1d"]):
                            q = "structural crack monitoring settlement"
                        paper_result = tool_search_academic_papers(query=q, limit=5)
                        if isinstance(paper_result, dict) and paper_result.get("success"):
                            papers_data = paper_result.get("papers", [])
                            papers_query_str = q
                            print(f"[DEBUG] api.py: Found {len(papers_data)} papers for '{q}'")
                        else:
                            print(f"[DEBUG] api.py: Paper search failed: {paper_result.get('error','?')}")
                    except Exception as paper_exc:
                        print(f"[DEBUG] api.py: Paper search exception: {paper_exc}")
                elif not papers_data:
                    print(f"[DEBUG] api.py: Skipping paper search, only {_time_left:.1f}s left")

                # Merge papers into KG as nodes
                if kg_viz and papers_data:
                    kg_viz = _merge_papers_into_kg(kg_viz, papers_data)

                metadata = {
                    "mode": "agent",
                    "tool_steps": tool_steps_list,
                    "total_iterations": agent_result.get("total_iterations", 0),
                    "total_duration_ms": agent_result.get("total_duration_ms", 0),
                    "kg_visualization": kg_viz,
                    "papers": papers_data,
                    "papers_query": papers_query_str,
                }
                assistant_message = ConversationService.add_message(
                    conv_id=conv_id,
                    role="assistant",
                    content=answer or "",
                    content_type="markdown",
                    metadata=metadata,
                )

                return jsonify({
                    "status": "success",
                    "data": {
                        "userMessage": user_message,
                        "assistantMessage": assistant_message,
                        "model": model_name,
                        "provider": "claude",
                        "agentSteps": tool_steps_list,
                        "agentIterations": agent_result.get("total_iterations", 0),
                        "agentDurationMs": agent_result.get("total_duration_ms", 0),
                        "kgVisualization": kg_viz,
                        "papers": papers_data,
                        "papersQuery": papers_query_str,
                    },
                })
            except Exception as agent_exc:
                print(f"[WARN] Agent exception: {agent_exc}, falling back to chat")
                import traceback
                traceback.print_exc()
                # Fall through to normal chat mode

        # ==================== Normal chat mode ====================
        system_prompt = build_full_system_prompt(role, page_path, content)
        user_content_str = _build_user_content(content, page_path, page_context)

        try:
            answer, model_name, is_fallback = _call_ai(
                system_prompt, user_content_str, temperature=0.2, provider=provider
            )
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 502

        # Force-enrich with KG + papers (only if time permits)
        import time as _chat_time
        _chat_start = _chat_time.time()
        chat_kg_viz = None
        chat_papers = []
        chat_papers_query = ""
        _debug_errors = []

        # Only enrich if we have enough time left (Vercel 60s limit)
        # AI call already took some time, check remaining budget
        _chat_elapsed = _chat_time.time() - _chat_start
        _chat_time_left = 25  # generous budget for enrichment

        if _chat_time_left > 10:
            print(f"[DEBUG] Chat path: enriching with KG (time_left={_chat_time_left:.1f}s)...")
            try:
                from .agent_tools import tool_build_knowledge_graph
                kg_r = tool_build_knowledge_graph()
                if isinstance(kg_r, dict) and kg_r.get("success"):
                    chat_kg_viz = kg_r.get("visualization")
                    print(f"[DEBUG] Chat KG: nodes={len(chat_kg_viz.get('nodes',[])) if chat_kg_viz else 0}")
                else:
                    err_msg = f"KG build returned success=False: {kg_r.get('error','?') if isinstance(kg_r, dict) else str(kg_r)}"
                    print(f"[DEBUG] {err_msg}")
                    _debug_errors.append(err_msg)
            except Exception as ke:
                err_msg = f"KG build exception: {type(ke).__name__}: {ke}"
                print(f"[DEBUG] {err_msg}")
                _debug_errors.append(err_msg)
        else:
            print(f"[DEBUG] Chat path: skipping KG, only {_chat_time_left:.1f}s left")

        _chat_time_left2 = 25 - (_chat_time.time() - _chat_start)
        if _chat_time_left2 > 5:
            print(f"[DEBUG] Chat path: searching papers (time_left={_chat_time_left2:.1f}s)...")
            try:
                from .agent_tools import tool_search_academic_papers
                q = "settlement monitoring geotechnical analysis"
                pr = tool_search_academic_papers(query=q, limit=5)
                if isinstance(pr, dict) and pr.get("success"):
                    chat_papers = pr.get("papers", [])
                    chat_papers_query = q
                    print(f"[DEBUG] Chat papers: {len(chat_papers)}")
                else:
                    err_msg = f"Paper search returned success=False: {pr.get('error','?') if isinstance(pr, dict) else str(pr)}"
                    print(f"[DEBUG] {err_msg}")
                    _debug_errors.append(err_msg)
            except Exception as pe:
                err_msg = f"Paper search exception: {type(pe).__name__}: {pe}"
                print(f"[DEBUG] {err_msg}")
                _debug_errors.append(err_msg)
        else:
            print(f"[DEBUG] Chat path: skipping papers, only {_chat_time_left2:.1f}s left")

        # Save AI response
        # Merge papers into KG as nodes before saving
        if chat_kg_viz and chat_papers:
            chat_kg_viz = _merge_papers_into_kg(chat_kg_viz, chat_papers)

        chat_metadata = {}
        if chat_kg_viz or chat_papers:
            chat_metadata = {
                "mode": mode,
                "kg_visualization": chat_kg_viz,
                "papers": chat_papers,
                "papers_query": chat_papers_query,
            }

        assistant_message = ConversationService.add_message(
            conv_id=conv_id,
            role="assistant",
            content=answer,
            content_type="markdown",
            metadata=chat_metadata if chat_metadata else None,
        )

        return jsonify({
            "status": "success",
            "data": {
                "userMessage": user_message,
                "assistantMessage": assistant_message,
                "model": model_name,
                "provider": "deepseek" if is_fallback else (provider if provider != "auto" else "claude"),
                "kgVisualization": chat_kg_viz,
                "papers": chat_papers,
                "papersQuery": chat_papers_query,
                "_debugErrors": _debug_errors if _debug_errors else None,
            },
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@assistant_bp.route("/summarize", methods=["POST"])
def summarize_conversation():
    try:
        body = request.get_json(silent=True) or {}
        messages = body.get("messages", [])

        if not messages:
            return jsonify({"status": "error", "message": "Messages list is empty"}), 400

        if not _any_ai_configured():
            return jsonify({"status": "error", "message": "No AI provider configured"}), 400

        # Build conversation text
        conversation_text = ""
        for msg in messages:
            role_label = "User" if msg.get("role") == "user" else "AI"
            msg_content = msg.get("content", "")
            conversation_text += f"{role_label}: {msg_content}\n\n"

        system_prompt = (
            "You are a conversation summarizer. Summarize the following conversation.\n"
            "Include: 1) Main questions (max 5), 2) Key answers (max 3), 3) Overall topic.\n"
            "Output in Chinese using Markdown with headings and lists."
        )

        user_content = f"Please summarize this conversation:\n\n{conversation_text}"

        try:
            answer, model_name, is_fallback = _call_ai(system_prompt, user_content, temperature=0.3)
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 502

        return jsonify({"status": "success", "data": {"summary": answer}})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
