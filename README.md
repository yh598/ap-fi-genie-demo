# AP Forecast Intelligence — public Genie demo

Synthetic Lakeview-style dashboard + chat for stakeholder demos.

## Render

1. Push this repo to your personal GitHub (e.g. Cornell account).
2. [Render](https://dashboard.render.com) → **New** → **Blueprint** → connect that repo.
3. **Public demo:** leave `DEMO_MODE=public` (default in `render.yaml`).
4. **Live Claude:** set `DEMO_MODE=off`, add `DATABRICKS_TOKEN` or SP secrets — see parent Nike repo `poc/ap-forecast-intelligence-ui/README.md`.

Open `https://<service>.onrender.com/genie-demo.html`.
