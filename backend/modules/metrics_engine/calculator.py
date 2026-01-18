# -*- coding: utf-8 -*-
"""
Metrics Calculator

Core calculation logic for engineering metrics.
Supports multiple calculation methods:
- difference: Simple difference between values
- cumulative: Running total from baseline
- average: Moving average calculation
- regression: Linear regression for trend analysis
- custom: User-defined calculation logic
"""

import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass


@dataclass
class CalculationResult:
    """Result of a metric calculation"""
    value: float
    unit: str
    threshold_status: str  # normal / warning / critical
    calculation_method: str
    calculation_params: Dict[str, Any]
    data_range_start: Optional[datetime]
    data_range_end: Optional[datetime]
    data_point_count: int
    quality_score: float
    change_from_previous: Optional[float] = None
    change_percentage: Optional[float] = None
    error: Optional[str] = None


class MetricsCalculator:
    """
    Core metrics calculation engine.

    Design principles:
    - Configurable: formulas, thresholds, weights can be configured
    - Extensible: new metric types without modifying core code
    - Traceable: complete calculation chain preserved
    - Auditable: input/output of each calculation recorded
    """

    def __init__(self):
        self.calculation_methods = {
            'difference': self._calculate_difference,
            'cumulative': self._calculate_cumulative,
            'average': self._calculate_average,
            'regression': self._calculate_regression,
            'rate': self._calculate_rate,
            'custom': self._calculate_custom
        }

    def calculate(
        self,
        raw_data: List[Dict[str, Any]],
        metric_config: Dict[str, Any],
        previous_value: Optional[float] = None,
        baseline_value: Optional[float] = None
    ) -> CalculationResult:
        """
        Calculate a metric from raw data.

        Args:
            raw_data: List of raw data points with 'measured_at' and 'raw_value'
            metric_config: Configuration for this metric type
            previous_value: Previous calculated value (for change calculation)
            baseline_value: Baseline value (for cumulative calculations)

        Returns:
            CalculationResult with computed value and metadata
        """
        if not raw_data:
            return CalculationResult(
                value=0.0,
                unit=metric_config.get('unit', ''),
                threshold_status='normal',
                calculation_method=metric_config.get('calculation_method', 'unknown'),
                calculation_params={},
                data_range_start=None,
                data_range_end=None,
                data_point_count=0,
                quality_score=0.0,
                error='No raw data provided'
            )

        method = metric_config.get('calculation_method', 'difference')
        if method not in self.calculation_methods:
            method = 'difference'

        # Sort data by time
        sorted_data = sorted(raw_data, key=lambda x: x.get('measured_at', datetime.min))

        # Extract values and timestamps
        values = [float(d.get('raw_value', 0)) for d in sorted_data]
        timestamps = [d.get('measured_at') for d in sorted_data]

        # Check minimum data points
        min_points = metric_config.get('min_data_points', 1)
        if len(values) < min_points:
            return CalculationResult(
                value=0.0,
                unit=metric_config.get('unit', ''),
                threshold_status='normal',
                calculation_method=method,
                calculation_params={'min_points_required': min_points, 'actual_points': len(values)},
                data_range_start=timestamps[0] if timestamps else None,
                data_range_end=timestamps[-1] if timestamps else None,
                data_point_count=len(values),
                quality_score=0.0,
                error=f'Insufficient data points: {len(values)} < {min_points}'
            )

        # Calculate quality score
        quality_score = self._calculate_quality_score(sorted_data)

        # Perform calculation
        calc_func = self.calculation_methods[method]
        try:
            computed_value, calc_params = calc_func(
                values=values,
                timestamps=timestamps,
                config=metric_config,
                baseline=baseline_value
            )
        except Exception as e:
            return CalculationResult(
                value=0.0,
                unit=metric_config.get('unit', ''),
                threshold_status='normal',
                calculation_method=method,
                calculation_params={},
                data_range_start=timestamps[0] if timestamps else None,
                data_range_end=timestamps[-1] if timestamps else None,
                data_point_count=len(values),
                quality_score=quality_score,
                error=str(e)
            )

        # Evaluate threshold status
        threshold_status = self._evaluate_threshold(
            value=computed_value,
            warning_threshold=metric_config.get('warning_threshold'),
            critical_threshold=metric_config.get('critical_threshold'),
            threshold_direction=metric_config.get('threshold_direction', 'above')
        )

        # Calculate change from previous
        change_from_previous = None
        change_percentage = None
        if previous_value is not None:
            change_from_previous = computed_value - previous_value
            if previous_value != 0:
                change_percentage = (change_from_previous / abs(previous_value)) * 100

        return CalculationResult(
            value=computed_value,
            unit=metric_config.get('unit', ''),
            threshold_status=threshold_status,
            calculation_method=method,
            calculation_params=calc_params,
            data_range_start=timestamps[0] if timestamps else None,
            data_range_end=timestamps[-1] if timestamps else None,
            data_point_count=len(values),
            quality_score=quality_score,
            change_from_previous=change_from_previous,
            change_percentage=change_percentage
        )

    def _calculate_difference(
        self,
        values: List[float],
        timestamps: List[datetime],
        config: Dict[str, Any],
        baseline: Optional[float] = None
    ) -> Tuple[float, Dict[str, Any]]:
        """Calculate difference between first and last value"""
        if len(values) < 2:
            return values[-1] if values else 0.0, {'method': 'single_value'}

        first_value = baseline if baseline is not None else values[0]
        last_value = values[-1]
        diff = last_value - first_value

        return diff, {
            'method': 'difference',
            'first_value': first_value,
            'last_value': last_value,
            'baseline_used': baseline is not None
        }

    def _calculate_cumulative(
        self,
        values: List[float],
        timestamps: List[datetime],
        config: Dict[str, Any],
        baseline: Optional[float] = None
    ) -> Tuple[float, Dict[str, Any]]:
        """Calculate cumulative value from baseline"""
        if not values:
            return 0.0, {'method': 'cumulative', 'error': 'no_values'}

        base = baseline if baseline is not None else values[0]
        cumulative = values[-1] - base

        return cumulative, {
            'method': 'cumulative',
            'baseline': base,
            'current': values[-1],
            'cumulative': cumulative
        }

    def _calculate_average(
        self,
        values: List[float],
        timestamps: List[datetime],
        config: Dict[str, Any],
        baseline: Optional[float] = None
    ) -> Tuple[float, Dict[str, Any]]:
        """Calculate moving average"""
        window_size = config.get('calculation_params', {}).get('window_size', len(values))
        window_values = values[-window_size:]

        avg = np.mean(window_values)

        return float(avg), {
            'method': 'average',
            'window_size': len(window_values),
            'min': float(np.min(window_values)),
            'max': float(np.max(window_values)),
            'std': float(np.std(window_values))
        }

    def _calculate_regression(
        self,
        values: List[float],
        timestamps: List[datetime],
        config: Dict[str, Any],
        baseline: Optional[float] = None
    ) -> Tuple[float, Dict[str, Any]]:
        """Calculate linear regression slope (trend)"""
        if len(values) < 2:
            return 0.0, {'method': 'regression', 'error': 'insufficient_data'}

        # Convert timestamps to numeric (hours from first timestamp)
        base_time = timestamps[0]
        x = np.array([(t - base_time).total_seconds() / 3600 for t in timestamps])
        y = np.array(values)

        # Linear regression
        n = len(x)
        sum_x = np.sum(x)
        sum_y = np.sum(y)
        sum_xy = np.sum(x * y)
        sum_x2 = np.sum(x ** 2)

        denominator = n * sum_x2 - sum_x ** 2
        if abs(denominator) < 1e-10:
            return 0.0, {'method': 'regression', 'error': 'singular_matrix'}

        slope = (n * sum_xy - sum_x * sum_y) / denominator
        intercept = (sum_y - slope * sum_x) / n

        # Calculate R-squared
        y_pred = slope * x + intercept
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0

        # Convert slope to per day
        slope_per_day = slope * 24

        return float(slope_per_day), {
            'method': 'regression',
            'slope_per_hour': float(slope),
            'slope_per_day': float(slope_per_day),
            'intercept': float(intercept),
            'r_squared': float(r_squared),
            'time_span_hours': float(x[-1]) if len(x) > 0 else 0
        }

    def _calculate_rate(
        self,
        values: List[float],
        timestamps: List[datetime],
        config: Dict[str, Any],
        baseline: Optional[float] = None
    ) -> Tuple[float, Dict[str, Any]]:
        """Calculate rate of change"""
        if len(values) < 2 or len(timestamps) < 2:
            return 0.0, {'method': 'rate', 'error': 'insufficient_data'}

        time_diff = (timestamps[-1] - timestamps[0]).total_seconds() / 86400  # days
        if time_diff <= 0:
            return 0.0, {'method': 'rate', 'error': 'zero_time_span'}

        value_diff = values[-1] - values[0]
        rate = value_diff / time_diff

        return float(rate), {
            'method': 'rate',
            'value_change': float(value_diff),
            'time_span_days': float(time_diff),
            'rate_per_day': float(rate)
        }

    def _calculate_custom(
        self,
        values: List[float],
        timestamps: List[datetime],
        config: Dict[str, Any],
        baseline: Optional[float] = None
    ) -> Tuple[float, Dict[str, Any]]:
        """Execute custom calculation formula"""
        formula = config.get('formula', '')
        if not formula:
            return values[-1] if values else 0.0, {'method': 'custom', 'error': 'no_formula'}

        # Simple eval with limited scope (for safety, use proper parser in production)
        try:
            local_vars = {
                'values': values,
                'timestamps': timestamps,
                'np': np,
                'baseline': baseline,
                'min': min,
                'max': max,
                'sum': sum,
                'len': len,
                'abs': abs
            }
            result = eval(formula, {"__builtins__": {}}, local_vars)
            return float(result), {'method': 'custom', 'formula': formula}
        except Exception as e:
            return 0.0, {'method': 'custom', 'error': str(e)}

    def _evaluate_threshold(
        self,
        value: float,
        warning_threshold: Optional[float],
        critical_threshold: Optional[float],
        threshold_direction: str = 'above'
    ) -> str:
        """Evaluate threshold status"""
        if critical_threshold is not None:
            if threshold_direction == 'above' and value >= critical_threshold:
                return 'critical'
            elif threshold_direction == 'below' and value <= critical_threshold:
                return 'critical'

        if warning_threshold is not None:
            if threshold_direction == 'above' and value >= warning_threshold:
                return 'warning'
            elif threshold_direction == 'below' and value <= warning_threshold:
                return 'warning'

        return 'normal'

    def _calculate_quality_score(self, data: List[Dict[str, Any]]) -> float:
        """Calculate data quality score (0-1)"""
        if not data:
            return 0.0

        valid_count = sum(1 for d in data if d.get('quality_flag') == 'valid')
        total_count = len(data)

        return valid_count / total_count if total_count > 0 else 0.0
