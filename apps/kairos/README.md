# Kairos

Kairos is the forecasting workspace in the Targon ecosystem.

- Import Google Trends interest-over-time into Kairos as a stored time series.
- Create forecasts (Prophet, ETS) and view model output (historical fit + future horizon).
- Forecast execution runs via the Python ML service in `services/kairos-ml` (requires `KAIROS_ML_URL`).
- All data is stored in Kairos' own database schema (Prisma + migrations).
