#!/usr/bin/env python3
"""Serve AP Intelligence UI + planning agent at POST /api/chat."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Any

from ap_intelligence_agent import (
    DEFAULT_ENDPOINT,
    SYSTEM_PROMPT,
    _chat_provider,
    agent_status,
    build_serving_user_message,
    run_agent,
)

STATIC_DIR = Path(__file__).resolve().parent / "static"
DEFAULT_PORT = int(os.getenv("PORT", "8000"))
_CHAT_MODE = os.getenv("DEMO_MODE", "").strip().lower()
DEMO_MODE = _CHAT_MODE in ("1", "true", "public", "yes")
WORKERS_MODE = _CHAT_MODE in ("workers", "workers_ai", "cloudflare")
GROQ_MODE = _chat_provider() == "groq"
WORKERS_CHAT_URL = os.getenv("WORKERS_CHAT_URL", "").strip()
GROQ_API_BASE = os.getenv("GROQ_API_BASE", "https://api.groq.com/openai/v1").rstrip("/")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")


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
    saved = {
        k: os.environ.pop(k)
        for k in ("DATABRICKS_CONFIG_PROFILE", "DATABRICKS_PROFILE", "DATABRICKS_AUTH_TYPE")
        if k in os.environ
    }
    try:
        return WorkspaceClient(host=host, token=token)
    finally:
        os.environ.update(saved)


def call_demo(question: str, segment: dict[str, Any]) -> str | None:
    from demo_genie_responses import answer

    return answer(question, segment)


def call_workers_proxy(question: str, segment: dict[str, Any]) -> str:
    import urllib.error
    import urllib.request

    url = WORKERS_CHAT_URL or os.getenv(
        "WORKERS_CHAT_FALLBACK",
        "https://ap-fi-genie-chat.huyun0317.workers.dev",
    )
    body = json.dumps({"question": question, "segment": segment}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    answer = data.get("answer")
    if not answer:
        raise RuntimeError(data.get("error") or "Workers chat returned no answer")
    return str(answer)


def call_groq(question: str, segment: dict[str, Any]) -> str:
    import urllib.error
    import urllib.request

    key = os.getenv("GROQ_API_KEY", "").strip()
    if not key:
        raise RuntimeError("GROQ_API_KEY not set (free key at console.groq.com).")
    body = json.dumps(
        {
            "model": GROQ_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": build_serving_user_message(question, segment)},
            ],
            "max_tokens": 900,
            "temperature": 0.3,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{GROQ_API_BASE}/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"Groq HTTP {exc.code}: {detail}") from exc
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("Groq returned no choices.")
    message = choices[0].get("message") or {}
    content = message.get("content")
    if not content:
        raise RuntimeError("Groq returned an empty message.")
    return str(content)


def call_serving(question: str, segment: dict[str, Any]) -> str:
    from databricks.sdk.service.serving import ChatMessage, ChatMessageRole

    user_body = build_serving_user_message(question, segment)
    client = workspace_client()
    response = client.serving_endpoints.query(
        name=DEFAULT_ENDPOINT,
        messages=[
            ChatMessage(role=ChatMessageRole.SYSTEM, content=SYSTEM_PROMPT),
            ChatMessage(role=ChatMessageRole.USER, content=user_body),
        ],
        max_tokens=900,
    )
    return message_content(response)


class UIHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        if args and str(args[0]).startswith("GET /api"):
            return
        super().log_message(format, *args)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path == "/api/agent/status":
            body = json.dumps(agent_status()).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if DEMO_MODE and path in ("", "/"):
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
            reply, mode = run_agent(
                question,
                segment,
                call_serving=call_serving,
                call_workers=call_workers_proxy,
                call_groq=call_groq,
                call_demo=call_demo,
                demo_mode=DEMO_MODE,
                workers_mode=WORKERS_MODE,
                groq_mode=GROQ_MODE,
            )
            body = json.dumps({"answer": reply, "mode": mode}).encode("utf-8")
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
    st = agent_status()
    print(f"Serving {STATIC_DIR} at http://{host}:{DEFAULT_PORT}/")
    print(f"Agent status: {json.dumps(st)}")
    print(f"Open: http://{host}:{DEFAULT_PORT}/genie-demo.html")
    if DEMO_MODE:
        print("Chat: rule-based DEMO_MODE=public")
    elif WORKERS_MODE:
        print(f"Chat: Workers proxy → {WORKERS_CHAT_URL or 'default'}")
    elif GROQ_MODE:
        print(f"Chat: Groq OSS → {GROQ_MODEL}")
    else:
        print(f"Chat: Databricks serving → {DEFAULT_ENDPOINT}")
    server.serve_forever()


if __name__ == "__main__":
    main()