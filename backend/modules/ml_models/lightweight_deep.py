# -*- coding: utf-8 -*-
"""
Lightweight alternatives for deep learning models.
Uses sklearn (GradientBoosting/RandomForest) instead of PyTorch.
All models work within Vercel's 1024MB / 60s constraints.
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.model_selection import train_test_split
import warnings
warnings.filterwarnings('ignore')


def _build_ts_features(values, n_lags=7):
    """Build time-series features from raw values."""
    n = len(values)
    s = pd.Series(values)
    feats = {}
    for lag in range(1, min(n_lags + 1, n)):
        feats[f'lag_{lag}'] = s.shift(lag).fillna(method='bfill').values
    feats['roll_mean_3'] = s.rolling(3, min_periods=1).mean().values
    feats['roll_std_3'] = s.rolling(3, min_periods=1).std().fillna(0).values
    feats['roll_mean_7'] = s.rolling(7, min_periods=1).mean().values
    feats['diff_1'] = s.diff().fillna(0).values
    feats['time_idx'] = np.arange(n, dtype=float) / max(n - 1, 1)
    X = np.column_stack(list(feats.values()))
    return X, list(feats.keys())


def _format_prediction_output(point_id, model_name, hist_dates, hist_vals,
                               fc_dates, fc_vals, fc_lower, fc_upper,
                               train_r2, test_r2):
    """Format output to match frontend PredictionResult interface."""
    return {
        'success': True,
        'point_id': point_id,
        'selected_model': model_name,
        'model_variant': 'lightweight',
        'model_selection_info': {
            'best_score': round(test_r2, 4),
            'metric': 'r2',
            'data_characteristics': {
                'data_size': len(hist_vals),
                'trend_strength': round(abs(np.polyfit(range(len(hist_vals)), hist_vals, 1)[0]), 4),
                'volatility': round(float(np.std(np.diff(hist_vals))), 4),
                'seasonality_strength': 0.0,
            },
        },
        'historical': [{'date': d, 'value': round(v, 3)} for d, v in zip(hist_dates, hist_vals)],
        'forecast': {
            'dates': fc_dates,
            'values': [round(v, 3) for v in fc_vals],
            'lower_bound': [round(v, 3) for v in fc_lower],
            'upper_bound': [round(v, 3) for v in fc_upper],
        },
        'model_performance': {
            'train_r2': round(train_r2, 4),
            'test_r2': round(test_r2, 4),
        },
    }


class LightweightInformer:
    """
    GradientBoosting + rich time-series features.
    Replaces Transformer-based Informer for small datasets.
    """

    def predict(self, settlement_df, point_id, steps=30):
        df = settlement_df.sort_values('date').reset_index(drop=True)
        values = df['settlement'].values
        dates = pd.to_datetime(df['date'])

        if len(values) < 15:
            raise ValueError("Need at least 15 data points")

        X, feat_names = _build_ts_features(values)
        y = values

        # Train/test split
        split = max(int(len(X) * 0.8), 10)
        X_train, X_test = X[:split], X[split:]
        y_train, y_test = y[:split], y[split:]

        model = GradientBoostingRegressor(
            n_estimators=150, max_depth=4, learning_rate=0.08,
            subsample=0.8, random_state=42
        )
        model.fit(X_train, y_train)
        train_r2 = model.score(X_train, y_train)
        test_r2 = model.score(X_test, y_test) if len(X_test) > 0 else train_r2

        # Iterative forecasting
        current_vals = list(values)
        last_date = dates.iloc[-1]
        fc_dates, fc_vals = [], []

        for i in range(steps):
            X_next, _ = _build_ts_features(np.array(current_vals))
            pred = model.predict(X_next[-1:])
            fc_val = float(pred[0])
            current_vals.append(fc_val)
            fc_date = last_date + timedelta(days=i + 1)
            fc_dates.append(fc_date.strftime('%Y-%m-%d'))
            fc_vals.append(fc_val)

        # Confidence interval (based on test residuals)
        if len(X_test) > 0:
            residuals = y_test - model.predict(X_test)
            std_err = float(np.std(residuals))
        else:
            std_err = float(np.std(np.diff(values))) * 0.5

        fc_lower = [v - 1.96 * std_err * (1 + 0.02 * i) for i, v in enumerate(fc_vals)]
        fc_upper = [v + 1.96 * std_err * (1 + 0.02 * i) for i, v in enumerate(fc_vals)]

        hist_dates = [d.strftime('%Y-%m-%d') for d in dates]
        return _format_prediction_output(
            point_id, 'lightweight_informer',
            hist_dates, values.tolist(),
            fc_dates, fc_vals, fc_lower, fc_upper,
            train_r2, test_r2
        )


class LightweightSTGCN:
    """
    RandomForest + spatial neighbor features.
    Replaces Graph Convolutional Network for multi-point prediction.
    """

    def predict(self, all_settlement_data, steps=30, fetch_point_fn=None):
        """
        Args:
            all_settlement_data: dict of {point_id: DataFrame} or single DataFrame with point_id column
            steps: forecast steps
            fetch_point_fn: function to fetch data for a point_id
        """
        from modules.ml_models.supabase_data import fetch_all_settlement

        settlement_df = fetch_all_settlement()
        if len(settlement_df) == 0:
            raise ValueError("No settlement data available")

        point_ids = sorted(settlement_df['point_id'].unique().tolist())

        # Build pivot table (dates x points)
        pivot = settlement_df.pivot_table(
            index='measurement_date', columns='point_id',
            values='cumulative_change', aggfunc='mean'
        ).sort_index()
        pivot = pivot.ffill().bfill()

        predictions = {}
        for pid in point_ids[:10]:  # Limit to 10 points for speed
            if pid not in pivot.columns:
                continue
            target = pivot[pid].values
            # Use other points as spatial features
            other_cols = [c for c in pivot.columns if c != pid][:5]
            spatial_feats = pivot[other_cols].values if other_cols else np.zeros((len(target), 1))

            # Combine with temporal features
            X_ts, _ = _build_ts_features(target, n_lags=5)
            X = np.hstack([X_ts, spatial_feats])
            y = target

            split = max(int(len(X) * 0.8), 10)
            model = RandomForestRegressor(n_estimators=100, max_depth=6, random_state=42)
            model.fit(X[:split], y[:split])

            # Forecast
            current = list(target)
            fc_vals = []
            for _ in range(steps):
                X_next_ts, _ = _build_ts_features(np.array(current), n_lags=5)
                # Use last known spatial values
                X_next = np.hstack([X_next_ts[-1:], spatial_feats[-1:]])
                pred = float(model.predict(X_next)[0])
                current.append(pred)
                fc_vals.append(pred)

            dates = pivot.index
            hist_dates = [d.strftime('%Y-%m-%d') if hasattr(d, 'strftime') else str(d) for d in dates]
            last_date = pd.to_datetime(dates[-1])
            fc_dates = [(last_date + timedelta(days=i+1)).strftime('%Y-%m-%d') for i in range(steps)]

            std_err = float(np.std(np.diff(target))) * 0.5
            predictions[pid] = {
                'historical': [{'date': d, 'value': round(float(v), 3)} for d, v in zip(hist_dates, target)],
                'forecast': {
                    'dates': fc_dates,
                    'values': [round(v, 3) for v in fc_vals],
                    'lower_bound': [round(v - 1.96*std_err*(1+0.02*i), 3) for i, v in enumerate(fc_vals)],
                    'upper_bound': [round(v + 1.96*std_err*(1+0.02*i), 3) for i, v in enumerate(fc_vals)],
                },
            }

        return {
            'success': True,
            'model_variant': 'lightweight',
            'selected_model': 'lightweight_stgcn',
            'predictions': predictions,
            'spatial_info': {
                'total_points': len(point_ids),
                'predicted_points': len(predictions),
                'method': 'RandomForest + spatial neighbor features',
            },
        }


class LightweightPINN:
    """
    GradientBoosting + Terzaghi consolidation post-processing.
    Replaces Physics-Informed Neural Network.
    """

    def predict(self, settlement_df, point_id, steps=30, physics_weight=0.1):
        df = settlement_df.sort_values('date').reset_index(drop=True)
        values = df['settlement'].values
        dates = pd.to_datetime(df['date'])

        if len(values) < 15:
            raise ValueError("Need at least 15 data points")

        X, feat_names = _build_ts_features(values)
        y = values

        split = max(int(len(X) * 0.8), 10)
        model = GradientBoostingRegressor(
            n_estimators=120, max_depth=4, learning_rate=0.1, random_state=42
        )
        model.fit(X[:split], y[:split])
        train_r2 = model.score(X[:split], y[:split])
        test_r2 = model.score(X[split:], y[split:]) if split < len(X) else train_r2

        # ML forecast
        current_vals = list(values)
        fc_vals_ml = []
        for _ in range(steps):
            X_next, _ = _build_ts_features(np.array(current_vals))
            pred = float(model.predict(X_next[-1:])[0])
            current_vals.append(pred)
            fc_vals_ml.append(pred)

        # Terzaghi consolidation physics constraint
        # U(t) = 1 - exp(-cv * t / H^2), settlement = S_final * U(t)
        last_val = values[-1]
        trend = np.polyfit(range(len(values)), values, 1)[0]
        s_final = last_val + trend * steps * 2  # estimated final settlement
        cv_H2 = 0.01  # consolidation parameter (simplified)

        fc_vals_physics = []
        for i in range(steps):
            t = len(values) + i
            U = 1 - np.exp(-cv_H2 * t)
            physics_pred = s_final * U
            fc_vals_physics.append(physics_pred)

        # Blend ML + physics
        fc_vals = [
            (1 - physics_weight) * ml + physics_weight * ph
            for ml, ph in zip(fc_vals_ml, fc_vals_physics)
        ]

        # Confidence interval
        residuals = y[split:] - model.predict(X[split:]) if split < len(X) else np.array([0])
        std_err = max(float(np.std(residuals)), float(np.std(np.diff(values))) * 0.3)

        last_date = dates.iloc[-1]
        fc_dates = [(last_date + timedelta(days=i+1)).strftime('%Y-%m-%d') for i in range(steps)]
        fc_lower = [v - 1.96 * std_err * (1 + 0.015 * i) for i, v in enumerate(fc_vals)]
        fc_upper = [v + 1.96 * std_err * (1 + 0.015 * i) for i, v in enumerate(fc_vals)]

        hist_dates = [d.strftime('%Y-%m-%d') for d in dates]
        result = _format_prediction_output(
            point_id, 'lightweight_pinn',
            hist_dates, values.tolist(),
            fc_dates, fc_vals, fc_lower, fc_upper,
            train_r2, test_r2
        )
        result['physics_info'] = {
            'physics_weight': physics_weight,
            'method': 'Terzaghi consolidation correction',
            'estimated_final_settlement': round(s_final, 3),
        }
        return result


class LightweightEnsemble:
    """
    Weighted average of ARIMA + GradientBoosting + RandomForest.
    Replaces deep learning ensemble.
    """

    def predict(self, settlement_df, point_id, steps=30):
        df = settlement_df.sort_values('date').reset_index(drop=True)
        values = df['settlement'].values
        dates = pd.to_datetime(df['date'])

        if len(values) < 15:
            raise ValueError("Need at least 15 data points")

        # Model 1: GradientBoosting
        X, _ = _build_ts_features(values)
        split = max(int(len(X) * 0.8), 10)

        gbr = GradientBoostingRegressor(n_estimators=120, max_depth=4, random_state=42)
        gbr.fit(X[:split], values[:split])

        # Model 2: RandomForest
        rfr = RandomForestRegressor(n_estimators=100, max_depth=6, random_state=42)
        rfr.fit(X[:split], values[:split])

        # Model 3: Linear trend
        trend_coef = np.polyfit(range(len(values)), values, 2)

        # Forecast each model
        def forecast_sklearn(model, vals, n):
            current = list(vals)
            preds = []
            for _ in range(n):
                X_next, _ = _build_ts_features(np.array(current))
                pred = float(model.predict(X_next[-1:])[0])
                current.append(pred)
                preds.append(pred)
            return preds

        fc_gbr = forecast_sklearn(gbr, values, steps)
        fc_rfr = forecast_sklearn(rfr, values, steps)
        fc_trend = [float(np.polyval(trend_coef, len(values) + i)) for i in range(steps)]

        # Weighted average (weights based on test performance)
        if split < len(X):
            score_gbr = max(gbr.score(X[split:], values[split:]), 0.01)
            score_rfr = max(rfr.score(X[split:], values[split:]), 0.01)
        else:
            score_gbr, score_rfr = 0.5, 0.5
        score_trend = 0.2

        total = score_gbr + score_rfr + score_trend
        w_gbr = score_gbr / total
        w_rfr = score_rfr / total
        w_trend = score_trend / total

        fc_vals = [
            w_gbr * g + w_rfr * r + w_trend * t
            for g, r, t in zip(fc_gbr, fc_rfr, fc_trend)
        ]

        # Confidence interval (ensemble variance)
        fc_std = [
            np.std([g, r, t]) for g, r, t in zip(fc_gbr, fc_rfr, fc_trend)
        ]
        residual_std = float(np.std(np.diff(values))) * 0.4
        fc_lower = [v - 1.96 * max(s, residual_std) for v, s in zip(fc_vals, fc_std)]
        fc_upper = [v + 1.96 * max(s, residual_std) for v, s in zip(fc_vals, fc_std)]

        train_r2 = gbr.score(X[:split], values[:split])
        test_r2 = gbr.score(X[split:], values[split:]) if split < len(X) else train_r2

        last_date = dates.iloc[-1]
        fc_dates = [(last_date + timedelta(days=i+1)).strftime('%Y-%m-%d') for i in range(steps)]
        hist_dates = [d.strftime('%Y-%m-%d') for d in dates]

        result = _format_prediction_output(
            point_id, 'lightweight_ensemble',
            hist_dates, values.tolist(),
            fc_dates, fc_vals, fc_lower, fc_upper,
            train_r2, test_r2
        )
        result['ensemble_info'] = {
            'base_models': ['GradientBoosting', 'RandomForest', 'PolynomialTrend'],
            'weights': {
                'GradientBoosting': round(w_gbr, 3),
                'RandomForest': round(w_rfr, 3),
                'PolynomialTrend': round(w_trend, 3),
            },
            'method': 'weighted_average',
        }
        return result
