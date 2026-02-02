import os
from typing import Any, Dict, Optional, Tuple

import requests
from flask import Blueprint, jsonify, request


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


@assistant_bp.route("/chat", methods=["POST"])
def assistant_chat():
    body = request.get_json(silent=True) or {}
    question = (body.get("question") or body.get("q") or "").strip()
    page_path = (body.get("pagePath") or body.get("page_path") or "").strip()
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

    user_content = f"当前页面：{page_path}\n\n问题：{question}" if page_path else question
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
