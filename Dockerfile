FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY chat_server.py ap_intelligence_agent.py demo_genie_responses.py .
COPY static ./static

ENV DEMO_MODE=off
ENV CHAT_PROVIDER=groq
ENV GROQ_MODEL=llama-3.1-8b-instant
ENV CHAT_FALLBACK_DEMO=1
ENV DATABRICKS_HOST=https://nike-sole-react.cloud.databricks.com
ENV DATABRICKS_CLAUDE_ENDPOINT=databricks-claude-opus-4-7

ENV HOST=0.0.0.0
EXPOSE 8000
CMD ["python3", "chat_server.py"]