# -*- coding: utf-8 -*-
"""
Test Suite for Metrics Engine

Tests cover:
- MetricsCalculator calculations
- Data models
- Engine orchestration
- API endpoints
"""

import unittest
import sys
import os
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
import json

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend')))


class TestMetricsCalculator(unittest.TestCase):
    """Test cases for MetricsCalculator"""

    def setUp(self):
        """Set up test fixtures"""
        from backend.modules.metrics_engine.calculator import MetricsCalculator
        self.calculator = MetricsCalculator()

        # Sample raw data
        self.sample_data = [
            {'measured_at': datetime(2024, 1, 1, 0, 0), 'raw_value': 100.0, 'quality_flag': 'valid'},
            {'measured_at': datetime(2024, 1, 2, 0, 0), 'raw_value': 102.0, 'quality_flag': 'valid'},
            {'measured_at': datetime(2024, 1, 3, 0, 0), 'raw_value': 105.0, 'quality_flag': 'valid'},
            {'measured_at': datetime(2024, 1, 4, 0, 0), 'raw_value': 108.0, 'quality_flag': 'valid'},
            {'measured_at': datetime(2024, 1, 5, 0, 0), 'raw_value': 112.0, 'quality_flag': 'valid'},
        ]

        # Sample config
        self.sample_config = {
            'metric_type': 'cumulative_settlement',
            'calculation_method': 'cumulative',
            'unit': 'mm',
            'warning_threshold': 10.0,
            'critical_threshold': 20.0,
            'threshold_direction': 'above',
            'min_data_points': 2
        }

    def test_calculate_difference(self):
        """Test difference calculation"""
        config = {**self.sample_config, 'calculation_method': 'difference'}
        result = self.calculator.calculate(self.sample_data, config)

        self.assertIsNotNone(result)
        self.assertEqual(result.calculation_method, 'difference')
        self.assertEqual(result.value, 12.0)  # 112 - 100
        self.assertEqual(result.unit, 'mm')
        self.assertIsNone(result.error)

    def test_calculate_cumulative(self):
        """Test cumulative calculation"""
        result = self.calculator.calculate(self.sample_data, self.sample_config)

        self.assertIsNotNone(result)
        self.assertEqual(result.calculation_method, 'cumulative')
        self.assertEqual(result.value, 12.0)  # 112 - 100 (baseline)
        self.assertIsNone(result.error)

    def test_calculate_cumulative_with_baseline(self):
        """Test cumulative calculation with explicit baseline"""
        result = self.calculator.calculate(
            self.sample_data,
            self.sample_config,
            baseline_value=90.0
        )

        self.assertEqual(result.value, 22.0)  # 112 - 90

    def test_calculate_average(self):
        """Test average calculation"""
        config = {**self.sample_config, 'calculation_method': 'average'}
        result = self.calculator.calculate(self.sample_data, config)

        self.assertEqual(result.calculation_method, 'average')
        expected_avg = (100 + 102 + 105 + 108 + 112) / 5
        self.assertAlmostEqual(result.value, expected_avg, places=2)

    def test_calculate_regression(self):
        """Test regression (trend) calculation"""
        config = {**self.sample_config, 'calculation_method': 'regression'}
        result = self.calculator.calculate(self.sample_data, config)

        self.assertEqual(result.calculation_method, 'regression')
        # Data increases linearly, slope should be positive
        self.assertGreater(result.value, 0)
        self.assertIn('slope_per_day', result.calculation_params)
        self.assertIn('r_squared', result.calculation_params)

    def test_calculate_rate(self):
        """Test rate of change calculation"""
        config = {**self.sample_config, 'calculation_method': 'rate'}
        result = self.calculator.calculate(self.sample_data, config)

        self.assertEqual(result.calculation_method, 'rate')
        # 12 units over 4 days = 3 units/day
        self.assertAlmostEqual(result.value, 3.0, places=1)

    def test_threshold_evaluation_normal(self):
        """Test normal threshold status"""
        config = {
            **self.sample_config,
            'warning_threshold': 20.0,
            'critical_threshold': 30.0
        }
        result = self.calculator.calculate(self.sample_data, config)

        self.assertEqual(result.threshold_status, 'normal')

    def test_threshold_evaluation_warning(self):
        """Test warning threshold status"""
        config = {
            **self.sample_config,
            'warning_threshold': 10.0,
            'critical_threshold': 20.0
        }
        result = self.calculator.calculate(self.sample_data, config)

        self.assertEqual(result.threshold_status, 'warning')

    def test_threshold_evaluation_critical(self):
        """Test critical threshold status"""
        config = {
            **self.sample_config,
            'warning_threshold': 5.0,
            'critical_threshold': 10.0
        }
        result = self.calculator.calculate(self.sample_data, config)

        self.assertEqual(result.threshold_status, 'critical')

    def test_empty_data(self):
        """Test handling of empty data"""
        result = self.calculator.calculate([], self.sample_config)

        self.assertEqual(result.value, 0.0)
        self.assertIsNotNone(result.error)
        self.assertIn('No raw data', result.error)

    def test_insufficient_data(self):
        """Test handling of insufficient data points"""
        config = {**self.sample_config, 'min_data_points': 10}
        result = self.calculator.calculate(self.sample_data, config)

        self.assertIsNotNone(result.error)
        self.assertIn('Insufficient', result.error)

    def test_quality_score_calculation(self):
        """Test quality score calculation"""
        mixed_quality_data = [
            {'measured_at': datetime(2024, 1, 1), 'raw_value': 100.0, 'quality_flag': 'valid'},
            {'measured_at': datetime(2024, 1, 2), 'raw_value': 102.0, 'quality_flag': 'invalid'},
            {'measured_at': datetime(2024, 1, 3), 'raw_value': 105.0, 'quality_flag': 'valid'},
            {'measured_at': datetime(2024, 1, 4), 'raw_value': 108.0, 'quality_flag': 'valid'},
        ]

        result = self.calculator.calculate(mixed_quality_data, self.sample_config)

        self.assertEqual(result.quality_score, 0.75)  # 3/4 valid

    def test_change_from_previous(self):
        """Test change from previous value calculation"""
        result = self.calculator.calculate(
            self.sample_data,
            self.sample_config,
            previous_value=10.0
        )

        self.assertEqual(result.change_from_previous, 2.0)  # 12 - 10
        self.assertEqual(result.change_percentage, 20.0)  # 20%


class TestCalculationResult(unittest.TestCase):
    """Test CalculationResult dataclass"""

    def test_result_attributes(self):
        """Test CalculationResult has all required attributes"""
        from backend.modules.metrics_engine.calculator import CalculationResult

        result = CalculationResult(
            value=10.5,
            unit='mm',
            threshold_status='normal',
            calculation_method='difference',
            calculation_params={'key': 'value'},
            data_range_start=datetime(2024, 1, 1),
            data_range_end=datetime(2024, 1, 5),
            data_point_count=5,
            quality_score=1.0
        )

        self.assertEqual(result.value, 10.5)
        self.assertEqual(result.unit, 'mm')
        self.assertEqual(result.threshold_status, 'normal')
        self.assertEqual(result.calculation_method, 'difference')
        self.assertEqual(result.data_point_count, 5)
        self.assertEqual(result.quality_score, 1.0)
        self.assertIsNone(result.error)


class TestMetricsEngineIntegration(unittest.TestCase):
    """Integration tests for MetricsEngine"""

    def setUp(self):
        """Set up test fixtures with mocked models"""
        # Mock environment variables
        os.environ['SUPABASE_URL'] = 'https://test.supabase.co'
        os.environ['SUPABASE_ANON_KEY'] = 'test-key'

    @patch('backend.modules.metrics_engine.models.MonitoringPointModel')
    @patch('backend.modules.metrics_engine.models.RawDataModel')
    @patch('backend.modules.metrics_engine.models.EngineeringMetricModel')
    @patch('backend.modules.metrics_engine.models.MetricConfigModel')
    def test_engine_initialization(self, mock_config, mock_metric, mock_raw, mock_point):
        """Test engine initializes correctly"""
        from backend.modules.metrics_engine.engine import MetricsEngine

        engine = MetricsEngine()

        self.assertIsNotNone(engine.calculator)
        self.assertIsNotNone(engine.point_model)
        self.assertIsNotNone(engine.raw_data_model)


class TestAPIEndpoints(unittest.TestCase):
    """Test API endpoint functionality"""

    def setUp(self):
        """Set up Flask test client"""
        os.environ['SUPABASE_URL'] = 'https://test.supabase.co'
        os.environ['SUPABASE_ANON_KEY'] = 'test-key'

    @patch('backend.modules.metrics_engine.models.MonitoringPointModel.get_all')
    def test_get_monitoring_points_endpoint(self, mock_get_all):
        """Test GET /api/metrics/points endpoint"""
        mock_get_all.return_value = [
            {'point_id': 'S1', 'point_name': 'Test Point 1', 'point_type': 'settlement'},
            {'point_id': 'S2', 'point_name': 'Test Point 2', 'point_type': 'settlement'},
        ]

        from flask import Flask
        from backend.modules.metrics_engine.api import metrics_bp

        app = Flask(__name__)
        app.register_blueprint(metrics_bp)

        with app.test_client() as client:
            response = client.get('/api/metrics/points')
            data = json.loads(response.data)

            self.assertEqual(response.status_code, 200)
            self.assertTrue(data.get('success'))

    @patch('backend.modules.metrics_engine.models.MetricConfigModel.get_all')
    def test_get_metric_configs_endpoint(self, mock_get_all):
        """Test GET /api/metrics/configs endpoint"""
        mock_get_all.return_value = [
            {'metric_type': 'cumulative_settlement', 'metric_name': 'Cumulative Settlement'},
        ]

        from flask import Flask
        from backend.modules.metrics_engine.api import metrics_bp

        app = Flask(__name__)
        app.register_blueprint(metrics_bp)

        with app.test_client() as client:
            response = client.get('/api/metrics/configs')
            data = json.loads(response.data)

            self.assertEqual(response.status_code, 200)
            self.assertTrue(data.get('success'))


class TestDataModels(unittest.TestCase):
    """Test data model classes"""

    def setUp(self):
        """Set up test environment"""
        os.environ['SUPABASE_URL'] = 'https://test.supabase.co'
        os.environ['SUPABASE_ANON_KEY'] = 'test-key'

    def test_base_model_headers(self):
        """Test BaseModel generates correct headers"""
        from backend.modules.metrics_engine.models import BaseModel

        model = BaseModel()
        headers = model._get_headers()

        self.assertIn('apikey', headers)
        self.assertIn('Authorization', headers)
        self.assertIn('Content-Type', headers)
        self.assertEqual(headers['Content-Type'], 'application/json')


class TestSQLSchema(unittest.TestCase):
    """Test SQL schema validity"""

    def test_monitoring_points_sql_exists(self):
        """Test monitoring points SQL file exists"""
        sql_path = os.path.join(
            os.path.dirname(__file__),
            '../supabase/sql/03_monitoring_points.sql'
        )
        self.assertTrue(os.path.exists(sql_path))

    def test_sql_contains_required_tables(self):
        """Test SQL contains all required table definitions"""
        sql_path = os.path.join(
            os.path.dirname(__file__),
            '../supabase/sql/03_monitoring_points.sql'
        )

        with open(sql_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()

        required_tables = [
            'monitoring_points',
            'raw_data',
            'metric_configs',
            'engineering_metrics',
            'alert_rules',
            'metric_snapshots'
        ]

        for table in required_tables:
            self.assertIn(f'CREATE TABLE {table}', sql_content,
                          f"Missing table definition: {table}")

    def test_sql_contains_required_views(self):
        """Test SQL contains required view definitions"""
        sql_path = os.path.join(
            os.path.dirname(__file__),
            '../supabase/sql/03_monitoring_points.sql'
        )

        with open(sql_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()

        required_views = [
            'v_points_with_latest_metrics',
            'v_points_alert_status',
            'v_raw_data_stats'
        ]

        for view in required_views:
            self.assertIn(view, sql_content,
                          f"Missing view definition: {view}")


class TestEdgeCases(unittest.TestCase):
    """Test edge cases and error handling"""

    def test_calculator_handles_nan_values(self):
        """Test calculator handles NaN values gracefully"""
        from backend.modules.metrics_engine.calculator import MetricsCalculator
        import math

        calculator = MetricsCalculator()

        data_with_nan = [
            {'measured_at': datetime(2024, 1, 1), 'raw_value': 100.0, 'quality_flag': 'valid'},
            {'measured_at': datetime(2024, 1, 2), 'raw_value': float('nan'), 'quality_flag': 'invalid'},
            {'measured_at': datetime(2024, 1, 3), 'raw_value': 105.0, 'quality_flag': 'valid'},
        ]

        config = {
            'calculation_method': 'average',
            'unit': 'mm',
            'min_data_points': 1
        }

        # Should not raise an exception
        result = calculator.calculate(data_with_nan, config)
        self.assertIsNotNone(result)

    def test_calculator_handles_single_point(self):
        """Test calculator handles single data point"""
        from backend.modules.metrics_engine.calculator import MetricsCalculator

        calculator = MetricsCalculator()

        single_point = [
            {'measured_at': datetime(2024, 1, 1), 'raw_value': 100.0, 'quality_flag': 'valid'},
        ]

        config = {
            'calculation_method': 'difference',
            'unit': 'mm',
            'min_data_points': 1
        }

        result = calculator.calculate(single_point, config)
        self.assertIsNotNone(result)
        self.assertEqual(result.data_point_count, 1)

    def test_threshold_direction_below(self):
        """Test threshold evaluation with 'below' direction"""
        from backend.modules.metrics_engine.calculator import MetricsCalculator

        calculator = MetricsCalculator()

        data = [
            {'measured_at': datetime(2024, 1, 1), 'raw_value': 50.0, 'quality_flag': 'valid'},
            {'measured_at': datetime(2024, 1, 2), 'raw_value': 45.0, 'quality_flag': 'valid'},
        ]

        config = {
            'calculation_method': 'difference',
            'unit': 'mm',
            'warning_threshold': -3.0,
            'critical_threshold': -10.0,
            'threshold_direction': 'below',
            'min_data_points': 2
        }

        result = calculator.calculate(data, config)
        self.assertEqual(result.value, -5.0)
        self.assertEqual(result.threshold_status, 'warning')


def run_tests():
    """Run all tests"""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # Add test classes
    suite.addTests(loader.loadTestsFromTestCase(TestMetricsCalculator))
    suite.addTests(loader.loadTestsFromTestCase(TestCalculationResult))
    suite.addTests(loader.loadTestsFromTestCase(TestMetricsEngineIntegration))
    suite.addTests(loader.loadTestsFromTestCase(TestAPIEndpoints))
    suite.addTests(loader.loadTestsFromTestCase(TestDataModels))
    suite.addTests(loader.loadTestsFromTestCase(TestSQLSchema))
    suite.addTests(loader.loadTestsFromTestCase(TestEdgeCases))

    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
