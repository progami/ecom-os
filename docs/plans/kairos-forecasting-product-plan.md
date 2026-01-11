# Kairos Forecasting Product Plan (Detailed)

This document captures the current product direction for Kairos forecasting (what we’re forecasting, why, and how), plus the concrete next steps to address gaps discovered after the UI overhaul and during recent discussions.

It is meant to complement (not replace) the existing Amazon SP-API plan: `docs/plans/amazon-sp-api-integration.md`.

---

## 1) What Kairos Is Forecasting (and why)

Kairos should ultimately forecast **unit demand** (units sold / units demanded) at the product level (e.g., ASIN), because:
- Units are the cleanest “base” metric for planning and can be converted into higher-level financial metrics.
- **Revenue** and **net proceeds** can be derived downstream via simple multiplications once we have units and per-unit economics.

### Derived metrics (post-forecast)
- **Revenue** = `units_forecast * selling_price`
- **Net proceeds** (simplified) = `units_forecast * net_proceeds_per_unit`  
  (Net proceeds per unit can come from Amazon Seller Economics / bookkeeping inputs.)

### Where Google Trends fits
Google Trends (and similar signals) are **leading indicators** that can be used to forecast future *demand signals*, and then:
- Either forecast units directly using these signals as exogenous regressors, or
- Forecast signals first and map them into units via a downstream “bridge” model.

---

## 2) Key product decisions (confirmed)

### 2.1 Target metric
- Primary: **Units**
- Derived: revenue/net proceeds (not separate forecast targets initially)

### 2.2 Time granularity
- Support **daily or weekly**, but the “native” frequency should follow the **lowest available frequency per source**.
- Store at the source-native granularity and provide rollups:
  - Daily → weekly aggregates (by region’s week start)
  - Weekly remains weekly (no forced daily interpolation unless explicitly requested)

### 2.3 Amazon connection type
- Amazon connection is to **Seller Central** (SP-API).

### 2.4 Scale & storage choice
- Expected scale: **~30–40 ASINs** (initially).
- A time-series DB (e.g., Timescale) is **not worth it** at this scale.
- Use **Postgres only**, with sane indexing/partitioning if needed later.

---

## 3) Problems to fix (product + UX)

### 3.1 “What is this app forecasting?”
Current UX does not clearly explain:
- Whether a forecast is for a signal (e.g., Google Trends) vs. for units (demand)
- How signals map to business outcomes

**Fix:** Introduce a clear “Forecast target” concept in UI + data model:
- Signal forecast (e.g., Trends index)
- Unit forecast (units)
- (Later) Financial forecast (derived or direct)

### 3.2 One forecast = one model limitation
Today, each forecast run is effectively locked to a single model. This blocks:
- Model comparison (accuracy vs. interpretability)
- Ensembles / weighted averages
- Robustness across different products and regimes

**Fix:** Make “forecast” a container and “model runs” the unit of execution (details in §4).

### 3.3 No way to delete forecasts
We need the ability to remove clutter and correct mistakes.

**Fix:** Add “archive” / soft-delete (preferred) + optional hard-delete for admins.

### 3.4 Combine forecasts vs keep them separate
We should support both:
- Keep separate when they represent different targets/sources/models.
- Combine when creating an ensemble or when stacking signals into a unit forecast.

**Fix:** Introduce “composite forecasts” (details in §4.4).

---

## 4) Forecasting architecture plan

### 4.1 Entities (conceptual)
- **Time Series**: a source-native series (Google Trends keyword, ASIN units, etc.)
- **Forecast**: user-visible object that defines the target and scope (series, date range, horizon, granularity, region)
- **Forecast Run**: an execution of a specific model/config against the forecast definition
- **Forecast Output**: the predicted values + confidence intervals + evaluation metrics

### 4.2 Multi-model support (required)
For each Forecast, allow running multiple models:
- Baselines: seasonal naive, moving average
- Classical: ETS, ARIMA/SARIMA (where appropriate)
- ML: gradient boosting with lag features, Prophet-like models (if supported in stack)
- Deep learning (optional later): only if it materially improves accuracy and ops cost is acceptable

**UI expectation:**
- “Run models” action produces multiple runs under the same forecast
- Results view shows a comparison table (MAPE/WAPE/SMAPE, bias, coverage) + chart overlay

### 4.3 Backtesting & evaluation (required)
Add consistent backtesting:
- Train/validation split(s) appropriate for time series (rolling window)
- Metric computed per series and aggregated:
  - WAPE or MAPE (units), SMAPE, bias
  - Coverage for prediction intervals (if available)

### 4.4 Combining forecasts (ensembles + stacked pipelines)
Support:
1) **Ensembles for the same target**  
   Example: unit forecast = weighted average of (ETS, XGBoost-lags, ARIMA)
2) **Stacking signals into a unit forecast**  
   Example:
   - Forecast Google Trends keyword(s) forward
   - Forecast Amazon search frequency forward (Brand Analytics)
   - Feed those into a unit demand model per ASIN

**Rule of thumb:**
- Keep raw signal forecasts separate and immutable.
- Create a composite/derived forecast object for “unit forecast” that references its upstream inputs.

### 4.5 Deletion behavior
Prefer soft-delete:
- “Archive forecast” hides it from default lists but retains auditability.
- Add restore flow.
- Optional admin hard-delete that also deletes runs/outputs.

### 4.6 Forecast compute architecture (Python backend, required)
Kairos forecasting should run in a **Python ML service** (not in-browser / WASM) to avoid tech debt and unlock heavier ML workflows.

- **Next.js Kairos app responsibilities:** auth, permissions, time series storage, run orchestration, UI/UX.
- **Python service responsibilities:** model execution + evaluation, returning forecast points + metrics.

**Interface (high-level):**
- Kairos app sends `{ model, ds, y, horizon, config }` to the service.
- Service returns `{ points, meta }` where `points` includes future predictions and `meta` includes horizon/history + metrics.

**Deployment notes (current direction):**
- Service runs via PM2 as `dev-kairos-ml` and `main-kairos-ml` on localhost-only ports.
- Kairos app calls it via `KAIROS_ML_URL` configured per environment.

---

## 5) Data ingestion plan (Amazon + other)

### 5.1 Amazon SP-API integration (Seller Central)
Reference: `docs/plans/amazon-sp-api-integration.md`.

Clarifications applied:
- Connection is **Seller Central**.
- Time series should be stored at the lowest available source granularity (daily/weekly depends on endpoint/report).
- Scale is modest (30–40 ASINs), so keep storage in Postgres.

**Implementation phases (complete plan, not only P0/P1):**
- Auth + account connection UX
- Permissions + token storage
- Background sync jobs + status
- Source-specific import (Brand Analytics, Seller Economics/Data Kiosk, etc.)
- Normalization into Kairos time-series schema (with rollups)
- “Use in forecast” selection flows

### 5.2 Google Trends
Keep as a first-class source:
- Keyword series as signals
- Allow mapping a keyword series (or bundle) to an ASIN/forecast target

---

## 6) Storage design (Postgres-only)

### 6.1 Storage principles
- Store at lowest available granularity per source.
- Provide rollups (weekly) via:
  - Materialized views, or
  - Cached rollup tables keyed by (series_id, period_start, granularity)

### 6.2 Scale note (why no Timescale)
At ~30–40 ASINs (plus a handful of signal series), Postgres with indexes is sufficient:
- Lower operational complexity
- Easier migrations and CI/CD
- Faster iteration on schema

Re-evaluate only if:
- We add 1000s of ASINs or many high-frequency series, or
- Query patterns show consistent pain (slow rollups, heavy retention policies, etc.)

---

## 7) Delivery milestones (suggested)

1) **Forecast UX clarity**
   - Explicit target type (signal vs units)
   - Better “what this means” copy in UI

2) **Forecast lifecycle**
   - Archive/delete forecasts
   - Status and history

3) **Multi-model + evaluation**
   - Multiple runs per forecast
   - Backtesting metrics + comparison UI

4) **Composite forecasts**
   - Ensemble forecasts
   - Stacked signal → units pipelines

5) **Amazon SP-API**
   - Implement full plan in `docs/plans/amazon-sp-api-integration.md` with the constraints above
