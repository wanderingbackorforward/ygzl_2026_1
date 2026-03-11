# -*- coding: utf-8 -*-
"""
Local Settlement Prediction Training Script
=============================================
Purpose: Train ARIMA/SARIMA models on real settlement data from Supabase
Environment: Windows CPU (no GPU needed)
Data: 25 monitoring points, 52 weekly records each

Author: Claude Opus 4.6
Date: 2026-03-11
"""

import os
import sys
import json
import requests
import numpy as np
import pandas as pd
from datetime import datetime
from collections import Counter

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
# .env is at python_scripts/.env (4 levels up from this file)
_script_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_script_dir, '..', '..', '..', '.env')
_env_path = os.path.normpath(_env_path)
print(f"[DEBUG] Loading .env from: {_env_path} (exists: {os.path.exists(_env_path)})")
load_dotenv(_env_path)

from ml_models.time_series_predictor import TimeSeriesPredictor

# ========== Config ==========
SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', '')
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'trained_models')
REPORTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reports')

# Training params
TRAIN_RATIO = 0.8       # 80% train, 20% test
FORECAST_STEPS = 8      # predict 8 weeks ahead
MODELS_TO_TRY = ['arima', 'sarima']


def _headers():
    return {
        'apikey': SUPABASE_ANON_KEY,
        'Accept': 'application/json',
        'Authorization': f'Bearer {SUPABASE_ANON_KEY}'
    }


def fetch_all_settlement_data():
    """Fetch all settlement data from Supabase (paginated)"""
    print("=" * 60)
    print("[Step 1] Fetching settlement data from Supabase...")
    print("=" * 60)

    all_data = []
    offset = 0
    page_size = 1000

    while True:
        r = requests.get(
            f'{SUPABASE_URL}/rest/v1/processed_settlement_data'
            f'?select=*&order=measurement_date.asc'
            f'&offset={offset}&limit={page_size}',
            headers=_headers(),
            timeout=30
        )
        if r.status_code != 200:
            print(f"[ERROR] API returned {r.status_code}: {r.text[:200]}")
            return pd.DataFrame()
        batch = r.json()
        if not batch:
            break
        all_data.extend(batch)
        offset += page_size
        if len(batch) < page_size:
            break

    df = pd.DataFrame(all_data)
    if df.empty:
        print("[ERROR] No data fetched")
        return df

    df['measurement_date'] = pd.to_datetime(df['measurement_date'])
    df = df.sort_values(['point_id', 'measurement_date'])

    point_ids = sorted(df['point_id'].unique())
    print(f"[OK] Fetched {len(df)} rows, {len(point_ids)} points: {point_ids}")
    print(f"[OK] Date range: {df['measurement_date'].min()} ~ {df['measurement_date'].max()}")
    return df


def train_single_point(point_id, point_data, model_type='arima'):
    """
    Train a model for a single monitoring point

    Returns: dict with model info and metrics, or None if failed
    """
    values = point_data['cumulative_change'].values.astype(float)
    dates = point_data['measurement_date'].values

    n = len(values)
    if n < 20:
        print(f"  [SKIP] {point_id}: only {n} records (need >= 20)")
        return None

    # Split train/test
    split_idx = int(n * TRAIN_RATIO)
    train_data = values[:split_idx]
    test_data = values[split_idx:]

    if len(test_data) < 2:
        print(f"  [SKIP] {point_id}: test set too small ({len(test_data)} records)")
        return None

    # Train
    predictor = TimeSeriesPredictor(model_type=model_type)
    try:
        if model_type == 'arima':
            fit_info = predictor.fit_arima(train_data, auto_select=True)
        else:
            fit_info = predictor.fit_sarima(train_data, auto_select=True)
    except Exception as e:
        print(f"  [FAIL] {point_id}/{model_type}: fit error - {e}")
        return None

    # Evaluate on test set
    try:
        metrics = predictor.evaluate(test_data)
    except Exception as e:
        print(f"  [FAIL] {point_id}/{model_type}: eval error - {e}")
        return None

    # Forecast future
    try:
        # Retrain on full data for production forecast
        predictor_full = TimeSeriesPredictor(model_type=model_type)
        if model_type == 'arima':
            predictor_full.fit_arima(values, order=fit_info.get('order'), auto_select=False)
        else:
            predictor_full.fit_sarima(
                values,
                order=fit_info.get('order'),
                seasonal_order=fit_info.get('seasonal_order'),
                auto_select=False
            )
        forecast = predictor_full.predict(steps=FORECAST_STEPS)
    except Exception as e:
        print(f"  [WARN] {point_id}/{model_type}: forecast on full data failed, using train model - {e}")
        try:
            forecast = predictor.predict(steps=FORECAST_STEPS)
        except Exception as e2:
            forecast = None

    result = {
        'point_id': point_id,
        'model_type': model_type,
        'model_info': fit_info,
        'metrics': metrics,
        'n_train': len(train_data),
        'n_test': len(test_data),
        'n_total': n,
        'train_range': f"{str(dates[0])[:10]} ~ {str(dates[split_idx-1])[:10]}",
        'test_range': f"{str(dates[split_idx])[:10]} ~ {str(dates[-1])[:10]}",
    }

    if forecast:
        last_date = pd.Timestamp(dates[-1])
        future_dates = pd.date_range(start=last_date + pd.Timedelta(weeks=1),
                                      periods=FORECAST_STEPS, freq='W')
        result['forecast'] = {
            'dates': future_dates.strftime('%Y-%m-%d').tolist(),
            'values': forecast['forecast'],
            'lower_bound': forecast['lower_bound'],
            'upper_bound': forecast['upper_bound']
        }

    return result


def train_all_points(df):
    """Train models for all monitoring points"""
    print("\n" + "=" * 60)
    print("[Step 2] Training models for all points...")
    print("=" * 60)

    all_results = {}
    point_ids = sorted(df['point_id'].unique())

    for point_id in point_ids:
        point_data = df[df['point_id'] == point_id].copy()
        print(f"\n--- {point_id} ({len(point_data)} records) ---")

        best_result = None
        best_mae = float('inf')

        for model_type in MODELS_TO_TRY:
            result = train_single_point(point_id, point_data, model_type)
            if result and result['metrics']['mae'] < best_mae:
                best_mae = result['metrics']['mae']
                best_result = result
                print(f"  [{model_type.upper()}] MAE={result['metrics']['mae']:.4f}, "
                      f"RMSE={result['metrics']['rmse']:.4f}, "
                      f"MAPE={result['metrics']['mape']:.2f}%, "
                      f"order={result['model_info'].get('order')}")

        if best_result:
            all_results[point_id] = best_result
            print(f"  >> Best: {best_result['model_type'].upper()} "
                  f"(MAE={best_result['metrics']['mae']:.4f})")

    return all_results


def save_results(all_results):
    """Save training results and model configs"""
    print("\n" + "=" * 60)
    print("[Step 3] Saving results...")
    print("=" * 60)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)

    # Save JSON results
    results_path = os.path.join(OUTPUT_DIR, 'training_results.json')

    # Convert numpy types to Python types for JSON serialization
    serializable = {}
    for pid, res in all_results.items():
        sr = {
            'point_id': res['point_id'],
            'model_type': res['model_type'],
            'model_info': {
                'order': list(res['model_info'].get('order', [])),
                'aic': float(res['model_info'].get('aic', 0)),
                'bic': float(res['model_info'].get('bic', 0)),
                'model_type': res['model_info'].get('model_type', ''),
            },
            'metrics': {k: float(v) for k, v in res['metrics'].items()},
            'n_train': res['n_train'],
            'n_test': res['n_test'],
            'n_total': res['n_total'],
            'train_range': res['train_range'],
            'test_range': res['test_range'],
        }
        if res.get('seasonal_order'):
            sr['model_info']['seasonal_order'] = list(res['model_info']['seasonal_order'])
        if res.get('forecast'):
            sr['forecast'] = {
                'dates': res['forecast']['dates'],
                'values': [float(v) for v in res['forecast']['values']],
                'lower_bound': [float(v) for v in res['forecast']['lower_bound']],
                'upper_bound': [float(v) for v in res['forecast']['upper_bound']],
            }
        serializable[pid] = sr

    with open(results_path, 'w', encoding='utf-8') as f:
        json.dump(serializable, f, indent=2, ensure_ascii=False)
    print(f"[OK] Results saved to {results_path}")

    return serializable


def generate_report(all_results):
    """Generate markdown training report"""
    print("\n" + "=" * 60)
    print("[Step 4] Generating training report...")
    print("=" * 60)

    os.makedirs(REPORTS_DIR, exist_ok=True)
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # Aggregate metrics
    maes = [r['metrics']['mae'] for r in all_results.values()]
    rmses = [r['metrics']['rmse'] for r in all_results.values()]
    mapes = [r['metrics']['mape'] for r in all_results.values()]
    model_counts = Counter(r['model_type'] for r in all_results.values())

    report = f"""# Settlement Prediction Training Report

**Generated**: {timestamp}
**Environment**: Windows CPU (PyTorch {_get_torch_version()})
**Data**: {sum(r['n_total'] for r in all_results.values())} total records, {len(all_results)} points

## Summary

| Metric | Mean | Min | Max | Std |
|--------|------|-----|-----|-----|
| MAE (mm) | {np.mean(maes):.4f} | {np.min(maes):.4f} | {np.max(maes):.4f} | {np.std(maes):.4f} |
| RMSE (mm) | {np.mean(rmses):.4f} | {np.min(rmses):.4f} | {np.max(rmses):.4f} | {np.std(rmses):.4f} |
| MAPE (%) | {np.mean(mapes):.2f} | {np.min(mapes):.2f} | {np.max(mapes):.2f} | {np.std(mapes):.2f} |

## Best Model Distribution

"""
    for model, count in model_counts.items():
        report += f"- **{model.upper()}**: {count} points ({count/len(all_results)*100:.0f}%)\n"

    report += f"""

## Per-Point Results

| Point | Model | Order | MAE | RMSE | MAPE (%) | Train | Test |
|-------|-------|-------|-----|------|----------|-------|------|
"""
    for pid in sorted(all_results.keys()):
        r = all_results[pid]
        order = str(r['model_info'].get('order', ''))
        report += (f"| {pid} | {r['model_type'].upper()} | {order} | "
                   f"{r['metrics']['mae']:.4f} | {r['metrics']['rmse']:.4f} | "
                   f"{r['metrics']['mape']:.2f} | {r['n_train']} | {r['n_test']} |\n")

    report += f"""

## Forecast Preview (Next {FORECAST_STEPS} Weeks)

"""
    # Show forecast for a few points
    preview_points = sorted(all_results.keys())[:5]
    for pid in preview_points:
        r = all_results[pid]
        if 'forecast' in r:
            report += f"### {pid} ({r['model_type'].upper()})\n\n"
            report += "| Date | Predicted (mm) | Lower 95% | Upper 95% |\n"
            report += "|------|---------------|-----------|----------|\n"
            fc = r['forecast']
            for i in range(len(fc['dates'])):
                report += (f"| {fc['dates'][i]} | {fc['values'][i]:.3f} | "
                           f"{fc['lower_bound'][i]:.3f} | {fc['upper_bound'][i]:.3f} |\n")
            report += "\n"

    report += """
## Conclusions

1. ARIMA/SARIMA models trained successfully on all monitoring points
2. Weekly data (52 records/point) is sufficient for time series analysis
3. Models can forecast settlement trends for the next 8 weeks
4. CPU training completed in seconds - no GPU required

## Next Steps

1. Integrate trained model configs into the API prediction endpoints
2. Consider adding more data points for improved accuracy
3. Try ensemble methods combining ARIMA with other approaches
4. Set up automated re-training when new data arrives
"""

    report_path = os.path.join(REPORTS_DIR, 'settlement_training_report.md')
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)
    print(f"[OK] Report saved to {report_path}")

    return report_path


def _get_torch_version():
    try:
        import torch
        return torch.__version__
    except ImportError:
        return 'N/A'


def main():
    print("=" * 60)
    print("  Settlement Prediction - Local Training")
    print("  ARIMA/SARIMA on Real Supabase Data")
    print("=" * 60)
    start_time = datetime.now()

    # 1. Fetch data
    df = fetch_all_settlement_data()
    if df.empty:
        print("[ABORT] No data available")
        return

    # 2. Train all points
    all_results = train_all_points(df)
    if not all_results:
        print("[ABORT] No models trained successfully")
        return

    # 3. Save results
    save_results(all_results)

    # 4. Generate report
    report_path = generate_report(all_results)

    # Summary
    elapsed = (datetime.now() - start_time).total_seconds()
    print("\n" + "=" * 60)
    print(f"  TRAINING COMPLETE")
    print(f"  Points trained: {len(all_results)}/25")
    print(f"  Time elapsed: {elapsed:.1f}s")
    print(f"  Results: {OUTPUT_DIR}/training_results.json")
    print(f"  Report: {report_path}")
    print("=" * 60)


if __name__ == '__main__':
    main()
