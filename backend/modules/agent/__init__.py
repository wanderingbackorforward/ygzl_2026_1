# -*- coding: utf-8 -*-
"""Ops patrol Agent (insights, badge, cron).

HTTP surface: ``/api/agent`` via ``agent_bp``.

Independent from the floating chat assistant (``modules.assistant`` /
``/api/assistant``). Do not alias or merge the two blueprints — the frontend
``agentStore`` and chat UI each depend on their own prefix.
"""
