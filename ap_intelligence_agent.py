"""AP Intelligence planning agent — Databricks model serving with governed fallbacks."""

from __future__ import annotations

import json
import os
from typing import Any

DEFAULT_ENDPOINT = os.getenv(
    "DATABRICKS_CLAUDE_ENDPOINT", "databricks-claude-opus-4-7"
)

SYSTEM_PROMPT = """You are the AP Intelligence planning assistant for Nike AP marketplace planners.
You help interpret the on-screen workspace: demand history, hierarchy share, weeks of supply,
style-color disaggregation, assignment gaps, and assortment signals.

Behavior:
- Ground every number and conclusion in the dashboard context JSON the user provides.
- Write 2–4 short paragraphs in plain language (no markdown tables, no HTML).
- Explain unconstrained demand vs inventory/receipts/o9 when asked.
- NDDC: net demand (direct). NMP/stores: net sales (MCCF or POS as stated in filters).
- You MAY give planning insights: WOS risk, allocate-hold-shift focus, assignment revisit,
  assortment emphasis by geo — framed as insights the planner can accept or ignore.
- You MUST NOT recommend or apply forecast overrides, or claim SNLE/SNAP/SAP/o9 writes occurred.
- You MUST NOT invent metrics absent from context. If context is insufficient, say what is missing.
- Model training and pipeline operations are out of scope — refer to the model path panel only.
"""


def agent_status() -> dict[str, Any]:
    demo = os.getenv("DEMO_MODE", "").strip().lower() in ("1", "true", "public", "yes")
    workers = os.getenv("DEMO_MODE", "").strip().lower() in ("workers", "workers_ai", "cloudflare")
    has_token = bool(os.getenv("DATABRICKS_TOKEN", "").strip())
    has_sp = bool(os.getenv("DATABRICKS_CLIENT_ID", "").strip())
    mode = "demo" if demo else "workers-ai" if workers else "serving"
    return {
        "agent": "ap-intelligence",
        "chat_mode": mode,
        "serving_endpoint": DEFAULT_ENDPOINT,
        "databricks_configured": has_token or has_sp,
        "fallback_rules_enabled": os.getenv("CHAT_FALLBACK_DEMO", "1").strip() != "0",
    }


def run_agent(
    question: str,
    segment: dict[str, Any],
    *,
    call_serving,
    call_workers,
    call_demo,
    demo_mode: bool,
    workers_mode: bool,
) -> tuple[str, str]:
    """Return (answer_text, mode_label)."""
    if demo_mode:
        return _demo_reply(call_demo, question, segment), "demo"

    if workers_mode:
        return str(call_workers(question, segment)), "workers-ai"

    try:
        return str(call_serving(question, segment)), "serving"
    except Exception as exc:
        if os.getenv("CHAT_FALLBACK_DEMO", "1").strip() == "0":
            raise
        ruled = call_demo(question, segment)
        if ruled:
            return ruled, "demo-fallback"
        return (
            f"I could not reach the model endpoint ({DEFAULT_ENDPOINT}): {exc}. "
            "Set DATABRICKS_TOKEN on the server or use DEMO_MODE=public for rule-based chat."
        ), "error-fallback"


def _demo_reply(call_demo, question: str, segment: dict[str, Any]) -> str:
    hit = call_demo(question, segment)
    if hit:
        return hit
    return (
        "AP Intelligence demo — use the dashboard tabs and context chips (WOS, assignment, "
        "assortment, disaggregation). Ask about values shown on screen; synthetic data only."
    )


def build_serving_user_message(question: str, segment: dict[str, Any]) -> str:
    return (
        "Dashboard context JSON (authoritative for this turn):\n"
        f"{json.dumps(segment, indent=2, default=str)}\n\n"
        f"Planner question:\n{question}"
    )