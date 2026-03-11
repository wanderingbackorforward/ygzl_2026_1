# -*- coding: utf-8 -*-
import os
from typing import Any, Dict, Optional, Tuple

import requests
from flask import Blueprint, jsonify, request

from .db_service import ConversationService
from .prompts import get_role_prompt


assistant_bp = Blueprint("assistant", __name__, url_prefix="/api/assistant")


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

    system_prompt = get_role_prompt("researcher")
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

        # Call AI with provider selection
        system_prompt = get_role_prompt(role)
        user_content = _build_user_content(content, page_path, page_context)

        try:
            answer, model_name, is_fallback = _call_ai(
                system_prompt, user_content, temperature=0.2, provider=provider
            )
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 502

        # Save AI response
        assistant_message = ConversationService.add_message(
            conv_id=conv_id,
            role="assistant",
            content=answer,
            content_type="markdown",
        )

        return jsonify({
            "status": "success",
            "data": {
                "userMessage": user_message,
                "assistantMessage": assistant_message,
                "model": model_name,
                "provider": "deepseek" if is_fallback else (provider if provider != "auto" else "claude"),
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
