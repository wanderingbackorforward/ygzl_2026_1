# -*- coding: utf-8 -*-
import os
from typing import Any, Dict, Optional, Tuple

import requests
from flask import Blueprint, jsonify, request

from .db_service import ConversationService


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


def _deepseek_settings() -> Tuple[str, str, str, float]:
    api_key = (os.getenv("DEEPSEEK_API_KEY") or os.getenv("DEEPSEEK_KEY") or os.getenv("DEEPSEEK_TOKEN") or "").strip()
    api_base = (os.getenv("DEEPSEEK_API_BASE") or "https://api.deepseek.com").strip().rstrip("/")
    model = (os.getenv("DEEPSEEK_MODEL") or "deepseek-chat").strip()
    try:
        timeout_s = float((os.getenv("DEEPSEEK_TIMEOUT_SECONDS") or "30").strip())
    except Exception:
        timeout_s = 30.0
    return api_key, api_base, model, timeout_s


def _extract_answer(payload: Dict[str, Any]) -> str:
    choices = payload.get("choices") or []
    if not isinstance(choices, list) or not choices:
        raise ValueError("DeepSeek 返回缺少 choices")
    msg = (choices[0] or {}).get("message") or {}
    content = msg.get("content")
    if isinstance(content, str) and content.strip():
        return content
    reasoning = msg.get("reasoning_content")
    if isinstance(reasoning, str) and reasoning.strip():
        return reasoning
    text = (choices[0] or {}).get("text")
    if isinstance(text, str) and text.strip():
        return text
    raise ValueError("DeepSeek 返回缺少可用内容（message.content / message.reasoning_content / choice.text）")


def _request_id() -> str:
    return (request.headers.get("x-request-id") or request.headers.get("x-vercel-id") or "").strip()


def _format_context(ctx: Any) -> str:
    if not ctx or not isinstance(ctx, dict):
        return ""

    lines = []
    page_title = ctx.get("pageTitle") or "未知页面"

    lines.append(f"### 当前页面数据：{page_title}")

    snapshot = ctx.get("dataSnapshot") or {}
    summary = snapshot.get("summary") or {}
    stats = snapshot.get("statistics") or {}
    metadata = ctx.get("metadata") or {}

    if summary:
        lines.append("\n**数据摘要**：")
        for key, val in summary.items():
            if val is not None:
                lines.append(f"- {key}: {val}")

    if stats:
        lines.append("\n**统计信息**：")
        total = stats.get("totalCount")
        anomaly = stats.get("anomalyCount")
        normal = stats.get("normalCount")
        if total is not None:
            lines.append(f"- 总数: {total}")
        if anomaly is not None:
            lines.append(f"- 异常数: {anomaly}")
        if normal is not None:
            lines.append(f"- 正常数: {normal}")

    if metadata:
        has_anomalies = metadata.get("hasAnomalies")
        if has_anomalies is not None:
            status = "存在异常" if has_anomalies else "全部正常"
            lines.append(f"\n**状态**: {status}")

    return "\n".join(lines) if lines else ""


@assistant_bp.route("/chat", methods=["POST"])
def assistant_chat():
    body = request.get_json(silent=True) or {}
    question = (body.get("question") or body.get("q") or "").strip()
    page_path = (body.get("pagePath") or body.get("page_path") or "").strip()
    page_context = body.get("pageContext")
    if not question:
        return jsonify({"status": "error", "message": "missing question"}), 400
    if not _is_meaningful_question(question):
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "问题太短或不明确。请用一句话描述你要问什么（例如：‘/insar 页面 velocity 字段代表什么？’）。",
                }
            ),
            400,
        )

    api_key, api_base, model, timeout_s = _deepseek_settings()
    if not api_key:
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "DeepSeek 未配置：请在 Vercel 环境变量中设置 DEEPSEEK_API_KEY（或 DEEPSEEK_KEY / DEEPSEEK_TOKEN）后重新部署。",
                }
            ),
            400,
        )

    system_prompt = (
        "你是本系统的悬浮小助手（只做一问一答）。\n"
        "请直接回答用户问题，不要输出任何“页面路径/问题编号/后续步骤/需要提供XXX”的模板化内容。\n"
        "如果用户问题不够明确：只提出 1-2 个最关键的追问，并给出可选示例问题。\n"
        "输出必须是可直接渲染的 Markdown，并且排版清晰：\n"
        "- 用短标题（###）组织\n"
        "- 用列表（-）表达步骤/要点\n"
        "- 代码用 ``` 包裹\n"
        "- 中文为主，简洁明确\n"
    )

    context_text = _format_context(page_context)
    if context_text:
        user_content = f"当前页面：{page_path}\n\n{context_text}\n\n问题：{question}"
    elif page_path:
        user_content = f"当前页面：{page_path}\n\n问题：{question}"
    else:
        user_content = question
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.2,
    }

    url = f"{api_base}/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=timeout_s)
    except Exception as e:
        return jsonify({"status": "error", "message": "DeepSeek request failed", "detail": str(e)}), 502

    if not resp.ok:
        detail: Optional[str] = None
        try:
            detail = resp.text[:2000]
        except Exception:
            detail = None
        out: Dict[str, Any] = {
            "status": "error",
            "message": "DeepSeek response not ok",
            "http_status": resp.status_code,
        }
        if detail:
            out["detail"] = detail
        rid = _request_id()
        if rid:
            out["request_id"] = rid
        return jsonify(out), 502

    try:
        data = resp.json()
        answer = _extract_answer(data)
    except Exception as e:
        return jsonify({"status": "error", "message": "DeepSeek response parse failed", "detail": str(e)}), 502

    return jsonify({"status": "success", "data": {"answerMarkdown": answer, "model": model}})


# ==================== 对话管理 API ====================


@assistant_bp.route("/conversations", methods=["GET"])
def get_conversations():
    """获取对话列表"""
    try:
        limit = int(request.args.get("limit", 100))
        conversations = ConversationService.get_conversations(limit=limit)
        return jsonify({"status": "success", "data": conversations})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@assistant_bp.route("/conversations", methods=["POST"])
def create_conversation():
    """创建新对话"""
    try:
        body = request.get_json(silent=True) or {}
        title = body.get("title", "新对话")
        role = body.get("role", "researcher")

        if role not in ["researcher", "worker", "reporter"]:
            return jsonify({"status": "error", "message": "无效的角色类型"}), 400

        conversation = ConversationService.create_conversation(title=title, role=role)
        return jsonify({"status": "success", "data": conversation})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@assistant_bp.route("/conversations/<conv_id>", methods=["GET"])
def get_conversation(conv_id: str):
    """获取对话详情（包含所有消息）"""
    try:
        conversation = ConversationService.get_conversation(conv_id)
        if not conversation:
            return jsonify({"status": "error", "message": "对话不存在"}), 404
        return jsonify({"status": "success", "data": conversation})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@assistant_bp.route("/conversations/<conv_id>", methods=["PUT"])
def update_conversation(conv_id: str):
    """更新对话（重命名、切换角色）"""
    try:
        body = request.get_json(silent=True) or {}
        title = body.get("title")
        role = body.get("role")

        if role and role not in ["researcher", "worker", "reporter"]:
            return jsonify({"status": "error", "message": "无效的角色类型"}), 400

        success = ConversationService.update_conversation(conv_id, title=title, role=role)
        if not success:
            return jsonify({"status": "error", "message": "对话不存在或更新失败"}), 404

        return jsonify({"status": "success", "data": {"id": conv_id}})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@assistant_bp.route("/conversations/<conv_id>", methods=["DELETE"])
def delete_conversation(conv_id: str):
    """删除对话"""
    try:
        success = ConversationService.delete_conversation(conv_id)
        if not success:
            return jsonify({"status": "error", "message": "对话不存在或删除失败"}), 404

        return jsonify({"status": "success", "data": {"id": conv_id}})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@assistant_bp.route("/conversations/<conv_id>/messages", methods=["POST"])
def send_message(conv_id: str):
    """发送消息到对话"""
    try:
        body = request.get_json(silent=True) or {}
        content = (body.get("content") or body.get("question") or "").strip()
        role = body.get("role", "researcher")
        page_path = (body.get("pagePath") or "").strip()
        page_context = body.get("pageContext")

        if not content:
            return jsonify({"status": "error", "message": "消息内容不能为空"}), 400

        if not _is_meaningful_question(content):
            return jsonify({"status": "error", "message": "问题太短或不明确"}), 400

        # 验证对话是否存在
        conversation = ConversationService.get_conversation(conv_id)
        if not conversation:
            return jsonify({"status": "error", "message": "对话不存在"}), 404

        # 保存用户消息
        user_message = ConversationService.add_message(
            conv_id=conv_id,
            role="user",
            content=content,
            content_type="text",
        )

        # 调用 AI 生成回答
        api_key, api_base, model, timeout_s = _deepseek_settings()
        if not api_key:
            return jsonify({"status": "error", "message": "DeepSeek 未配置"}), 400

        # 根据角色调整 system prompt
        system_prompt = _get_role_system_prompt(role)

        context_text = _format_context(page_context)
        if context_text:
            user_content = f"当前页面：{page_path}\n\n{context_text}\n\n问题：{content}"
        elif page_path:
            user_content = f"当前页面：{page_path}\n\n问题：{content}"
        else:
            user_content = content

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0.2,
        }

        url = f"{api_base}/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        resp = requests.post(url, headers=headers, json=payload, timeout=timeout_s)

        if not resp.ok:
            return jsonify({"status": "error", "message": "DeepSeek 请求失败"}), 502

        data = resp.json()
        answer = _extract_answer(data)

        # 保存 AI 回答
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
            }
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


def _get_role_system_prompt(role: str) -> str:
    """根据角色返回不同的 system prompt"""
    base_prompt = (
        "你是本系统的悬浮小助手。\n"
        "请直接回答用户问题，不要输出任何"页面路径/问题编号/后续步骤/需要提供XXX"的模板化内容。\n"
        "输出必须是可直接渲染的 Markdown，并且排版清晰：\n"
        "- 用短标题（###）组织\n"
        "- 用列表（-）表达步骤/要点\n"
        "- 代码用 ``` 包裹\n"
        "- 中文为主，简洁明确\n"
    )

    if role == "researcher":
        return (
            base_prompt
            + "\n你当前处于【科研人员模式】：\n"
            "- 回答要专业、详细，引用数据和算法原理\n"
            "- 可以使用专业术语，提供公式和统计指标\n"
            "- 引用相关论文和标准\n"
            "- 提供置信区间、p 值等统计指标\n"
        )
    elif role == "worker":
        return (
            base_prompt
            + "\n你当前处于【施工人员模式】：\n"
            "- 回答要简单、直白、可操作\n"
            "- 避免专业术语，用通俗语言解释\n"
            "- 给出明确的操作步骤（第一步、第二步...）\n"
            "- 用颜色标注严重程度（严重/中等/轻微）\n"
        )
    elif role == "reporter":
        return (
            base_prompt
            + "\n你当前处于【项目汇报模式】：\n"
            "- 回答要总结性、结构化、适合展示\n"
            "- 自动生成摘要、关键指标、趋势分析\n"
            "- 输出格式适合导出为报告（标题、摘要、详情）\n"
            "- 突出关键数据和结论\n"
        )
    else:
        return base_prompt

