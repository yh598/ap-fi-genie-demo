# AP Forecast Intelligence — public Genie demo

Synthetic Lakeview-style dashboard + chat for stakeholder demos.

## Render

1. Push this repo to your personal GitHub (e.g. Cornell account).
2. [Render](https://dashboard.render.com) → **New** → **Blueprint** → connect that repo.
3. **Public demo:** leave `DEMO_MODE=public` (default in `render.yaml`).
4. **Live Claude:** `DEMO_MODE=off` (in `render.yaml`), add secret **`DATABRICKS_TOKEN`** with **`model-serving`** + **`model-serving-inference`** scopes (or SP `DATABRICKS_CLIENT_ID` / `DATABRICKS_CLIENT_SECRET`). Keep **`CHAT_FALLBACK_DEMO=1`** until serving works.

Open `https://<service>.onrender.com/genie-demo.html`.
