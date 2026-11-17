#!/usr/bin/env python3
"""Serve AP Forecast Intelligence UI + POST /api/chat via Databricks model serving."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Any

STATIC_DIR = Path(__file__).resolve().parent / "static"
DEFAULT_PORT = int(os.getenv("PORT", "8000"))
DEMO_MODE = os.getenv("DEMO_MODE", "").strip().lower() in ("1", "true", "public", "yes")
DEFAULT_ENDPOINT = os.getenv(
    "DATABRICKS_CLAUDE_ENDPOINT", "databricks-claude-opus-4-7"
)

SYSTEM_PROMPT = """You are the AP Forecast Intelligence assistant for Nike marketplace planners (Genie-style).
Answer in clear business language (2–4 short paragraphs, no markdown tables).

Rules:
- Use only the dashboard context JSON in the user message (synthetic UAT demo on public hosts).
- Explain NDDC vs NMP, net demand vs net sales, MCCF when relevant.
- Unconstrained demand is for planning — not o9 supply, receipts, or inventory actions.
- Do not invent numbers beyond the supplied context.
- Do not recommend forecast overrides, replenishment, allocation, or commercial decisions.
"""


def message_content(response: Any) -> str:
    choices = getattr(response, "choices", None) or []
    if not choices and isinstance(response, dict):
        choices = response.get("choices") or []
    if not choices:
        return "The model returned an empty response."
    choice = choices[0]
    message = choice.get("message") if isinstance(choice, dict) else getattr(choice, "message", None)
    if isinstance(message, dict):
        return message.get("content") or "The model returned an empty message."
    return getattr(message, "content", None) or "The model returned an empty message."


def _access_token() -> tuple[str, str]:
    profile = os.getenv("DATABRICKS_CONFIG_PROFILE") or os.getenv("DATABRICKS_PROFILE") or "sole-react"
    host = os.getenv("DATABRICKS_HOST", "https://nike-sole-react.cloud.databricks.com").rstrip("/")
    token = os.getenv("DATABRICKS_TOKEN", "").strip()
    if not token:
        cli = os.getenv("DATABRICKS_CLI_PATH", os.path.expanduser("~/bin/databricks"))
        if not os.path.isfile(cli):
            raise RuntimeError(
                "Set DATABRICKS_TOKEN (cloud deploy) or install Databricks CLI for local dev."
            )
        raw = subprocess.check_output(
            [cli, "auth", "token", "--profile", profile, "-o", "json"],
            text=True,
        )
        token = json.loads(raw)["access_token"]
    return host, token


def workspace_client():
    from databricks.sdk import WorkspaceClient

    if os.getenv("DATABRICKS_CLIENT_ID"):
        return WorkspaceClient()

    host, token = _access_token()
    # ponytail: SDK re-reads profile from env and breaks PAT/OAuth token auth
    saved = {
        k: os.environ.pop(k)
        for k in ("DATABRICKS_CONFIG_PROFILE", "DATABRICKS_PROFILE", "DATABRICKS_AUTH_TYPE")
        if k in os.environ
    }
    try:
        return WorkspaceClient(host=host, token=token)
    finally:
        os.environ.update(saved)


def call_demo(question: str, segment: dict[str, Any]) -> str:
    from demo_genie_responses import answer

    hit = answer(question, segment)
    if hit:
        return hit
    return (
        "This public demo matches the standard Genie walkthrough prompts (Analytics 101, "
        "Vomero NDDC trend, NMP Running MCCF trend, style-color seasonality, and planning "
        "refusals). Use a demo chip or rephrase along those lines. Synthetic data only — "
        "not live Forecast Intelligence SQL."
    )


def call_serving(question: str, segment: dict[str, Any]) -> str:
    from databricks.sdk.service.serving import ChatMessage, ChatMessageRole

    user_body = (
        f"Selected segment context (synthetic demo UI):\n{json.dumps(segment, indent=2)}\n\n"
        f"Planner question:\n{question}"
    )
    client = workspace_client()
    response = client.serving_endpoints.query(
        name=DEFAULT_ENDPOINT,
        messages=[
            ChatMessage(role=ChatMessageRole.SYSTEM, content=SYSTEM_PROMPT),
            ChatMessage(role=ChatMessageRole.USER, content=user_body),
        ],
        max_tokens=700,
    )
    return message_content(response)


class UIHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        if args and args[0].startswith("GET /api"):
            return
        super().log_message(format, *args)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if DEMO_MODE and self.path.split("?", 1)[0] in ("", "/"):
            self.path = "/genie-demo.html"
        return super().do_GET()

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.end_headers()

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/api/chat":
            self.send_error(404, "Not found")
            return
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return
        question = str(payload.get("question", "")).strip()
        segment = payload.get("segment") or {}
        if not question:
            self.send_error(400, "question required")
            return
        try:
            if DEMO_MODE:
                reply = call_demo(question, segment)
            else:
                reply = call_serving(question, segment)
            body = json.dumps({"answer": reply, "mode": "demo" if DEMO_MODE else "serving"}).encode(
                "utf-8",
            )
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as exc:
            err = json.dumps({"error": str(exc)}).encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(err)))
            self.end_headers()
            self.wfile.write(err)


def main() -> None:
    if not STATIC_DIR.is_dir():
        sys.exit(f"Missing static dir: {STATIC_DIR}")
    host = os.getenv("HOST", "0.0.0.0")
    server = ThreadingHTTPServer((host, DEFAULT_PORT), UIHandler)
    print(f"Serving {STATIC_DIR} at http://{host}:{DEFAULT_PORT}/")
    if DEMO_MODE:
        print("Chat API: POST /api/chat (DEMO_MODE=public — synthetic Genie rules)")
        print(f"Open: http://{host}:{DEFAULT_PORT}/genie-demo.html")
    else:
        print(f"Chat API: POST /api/chat (endpoint={DEFAULT_ENDPOINT})")
    server.serve_forever()


if __name__ == "__main__":
    main()
