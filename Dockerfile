FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY chat_server.py demo_genie_responses.py .
COPY static ./static

ENV DEMO_MODE=public

ENV HOST=0.0.0.0
EXPOSE 8000
CMD ["python3", "chat_server.py"]
