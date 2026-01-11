# Kairos ML Service (Python)

This service is a **stateless forecasting compute backend** for Kairos.

- The Kairos Next.js app remains the UI + orchestration layer (auth, DB, runs, permissions).
- This service only receives time-series data + model config and returns forecast points.

## Run locally

1) Create a virtual environment and install deps:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2) Start the API:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8050 --reload
```

3) Point Kairos to it:

Set `KAIROS_ML_URL=http://localhost:8050` for the Kairos app server environment.

## Notes

- The initial implementation is intentionally minimal; model implementations will evolve as Kairos moves toward heavier ML workflows.

