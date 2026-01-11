from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Kairos ML Service", version="0.1.0")

ModelName = Literal["ETS", "PROPHET"]


class ForecastRequest(BaseModel):
    model: ModelName
    ds: List[int] = Field(..., description="Epoch seconds (UTC).")
    y: List[float]
    horizon: int = Field(..., ge=1)
    config: Optional[Dict[str, Any]] = None


class ForecastPoint(BaseModel):
    t: str
    yhat: float
    yhatLower: Optional[float] = None
    yhatUpper: Optional[float] = None
    isFuture: bool


class ForecastMetrics(BaseModel):
    sampleCount: int
    mae: Optional[float] = None
    rmse: Optional[float] = None
    mape: Optional[float] = None


class ForecastMeta(BaseModel):
    horizon: int
    historyCount: int
    intervalLevel: Optional[float] = None
    metrics: ForecastMetrics


class ForecastResponse(BaseModel):
    points: List[ForecastPoint]
    meta: ForecastMeta


def iso_from_seconds(seconds: int) -> str:
    return (
        datetime.fromtimestamp(seconds, tz=timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def infer_step_seconds(ds: List[int]) -> int:
    if len(ds) < 2:
        return 60 * 60 * 24

    diffs: List[int] = []
    for i in range(1, len(ds)):
        diff = ds[i] - ds[i - 1]
        if diff > 0:
            diffs.append(diff)

    if not diffs:
        return 60 * 60 * 24

    diffs.sort()
    mid = len(diffs) // 2
    if len(diffs) % 2 == 1:
        return diffs[mid]
    return int((diffs[mid - 1] + diffs[mid]) / 2)


def forecast_seasonal_naive(y: List[float], horizon: int, season_length: int) -> List[float]:
    if not y:
        return []

    if season_length < 1:
        season_length = 1

    if len(y) < season_length:
        last = y[-1]
        return [last for _ in range(horizon)]

    window = y[-season_length:]
    preds: List[float] = []
    for i in range(horizon):
        preds.append(window[i % season_length])
    return preds


def forecast_linear_trend(y: List[float], horizon: int) -> List[float]:
    if not y:
        return []

    n = len(y)
    if n == 1:
        return [y[0] for _ in range(horizon)]

    x_mean = (n - 1) / 2.0
    y_mean = sum(y) / n
    var = 0.0
    cov = 0.0
    for i, val in enumerate(y):
        dx = i - x_mean
        var += dx * dx
        cov += dx * (val - y_mean)

    slope = cov / var if var > 0 else 0.0
    intercept = y_mean - slope * x_mean

    preds: List[float] = []
    for j in range(horizon):
        x = n + j
        preds.append(intercept + slope * x)
    return preds


@app.get("/healthz")
def healthz() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/forecast", response_model=ForecastResponse)
def forecast(req: ForecastRequest) -> ForecastResponse:
    if len(req.ds) != len(req.y):
        raise HTTPException(status_code=400, detail="Training data length mismatch.")
    if len(req.ds) < 2:
        raise HTTPException(status_code=400, detail="At least 2 observations are required.")

    step = infer_step_seconds(req.ds)
    last_ds = req.ds[-1]

    if req.model == "ETS":
        season_length = int((req.config or {}).get("seasonLength", 7))
        preds = forecast_seasonal_naive(req.y, req.horizon, season_length)
    elif req.model == "PROPHET":
        preds = forecast_linear_trend(req.y, req.horizon)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported model: {req.model}")

    points: List[ForecastPoint] = []
    for i, yhat in enumerate(preds, start=1):
        points.append(
            ForecastPoint(
                t=iso_from_seconds(last_ds + step * i),
                yhat=yhat,
                yhatLower=None,
                yhatUpper=None,
                isFuture=True,
            )
        )

    return ForecastResponse(
        points=points,
        meta=ForecastMeta(
            horizon=req.horizon,
            historyCount=len(req.ds),
            intervalLevel=None,
            metrics=ForecastMetrics(sampleCount=0, mae=None, rmse=None, mape=None),
        ),
    )

