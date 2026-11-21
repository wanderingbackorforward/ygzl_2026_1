# -*- coding: utf-8 -*-
"""后端契约回归：规则口径、导入幂等、JSON 安全、接口不返回 500。

这些用例不依赖 MySQL：用 Flask test client 打真实路由，验证“数据库不可用时
也要返回可解析的 JSON，而不是 500 / 非法 JSON”。
"""

import math
import os
import sys

import numpy as np
import pandas as pd
import pytest
from sqlalchemy import create_engine, text

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from modules.rules import cracks, settlement, temperature  # noqa: E402
from modules.data_import.idempotent_io import append_new_rows  # noqa: E402


# ---------------- 规则口径 ----------------

def test_settlement_metrics_override_stale_level():
    # 实测 5.96mm 即使历史标成“低风险”，也必须判报警
    info = settlement.classify_point(total_change=-5.96, stored_level='低风险')
    assert info['level'] == 'alert'
    # 没有实测值时才沿用历史结论
    fallback = settlement.classify_point(total_change=None, trend_slope=None, stored_level='alert')
    assert fallback['level'] == 'alert'


def test_settlement_thresholds_boundary():
    assert settlement.classify_point(total_change=5.0)['level'] == 'alert'
    assert settlement.classify_point(total_change=3.0)['level'] == 'warning'
    assert settlement.classify_point(total_change=0.0)['level'] == 'normal'


def test_settlement_missing_data_is_unassessed():
    info = settlement.classify_point(total_change=None, trend_slope=None)
    assert info['level'] is None
    assert info['level_cn'] == '未评估'


def test_settlement_summary_counts_and_max():
    rows = [
        {'point_id': 'S1', 'total_change': -1.0, 'alert_level': 'normal'},
        {'point_id': 'S2', 'total_change': -6.0, 'alert_level': 'alert'},
        {'point_id': 'S3', 'total_change': -4.0, 'alert_level': 'warning'},
    ]
    info = settlement.summarize_points(rows)
    assert (info['normal_count'], info['warning_count'], info['alert_count']) == (1, 1, 1)
    assert info['max_settlement'] == -6.0
    assert info['max_settlement_point'] == 'S2'
    assert info['level'] == 'alert'


def test_settlement_summary_ignores_stale_label():
    rows = [
        {'point_id': 'S1', 'total_change': -5.96, 'alert_level': '低风险'},
        {'point_id': 'S2', 'total_change': -0.5, 'alert_level': '低风险'},
    ]
    info = settlement.summarize_points(rows)
    assert (info['normal_count'], info['warning_count'], info['alert_count']) == (1, 0, 1)


def test_temperature_metrics_override_stale_level():
    # 实测 50C 即使历史标成“正常”，也必须判报警
    assert temperature.classify_sensor(current_max=50, stored_level='normal')['level'] == 'alert'
    # 没有实测值时才沿用历史结论
    assert temperature.classify_sensor(stored_level='warning')['level'] == 'warning'
    assert temperature.classify_sensor(current_max=46)['level'] == 'alert'
    assert temperature.classify_sensor(current_max=40)['level'] == 'warning'
    assert temperature.classify_sensor(current_max=20)['level'] == 'normal'
    assert temperature.classify_sensor()['level'] is None


def test_crack_rules_summarize_is_stable():
    info = cracks.summarize_points([])
    assert info['total_points'] == 0


def test_risk_from_rate_keeps_legacy_tiers():
    assert settlement.risk_from_rate(-0.16) == ('critical', 90)
    assert settlement.risk_from_rate(0.09) == ('high', 70)
    assert settlement.risk_from_rate(0.05) == ('medium', 50)
    assert settlement.risk_from_rate(0.02) == ('low', 30)
    assert settlement.risk_from_rate(0.005) == ('normal', 10)
    assert settlement.risk_from_rate(None) == ('normal', 10)


def test_prediction_row_is_single_source():
    from modules.data_processing.process_settlement_data import _build_prediction_row

    row = _build_prediction_row({'point_id': 'S1', 'trend_slope': -0.16, 'avg_value': 1.0})
    assert row['risk_level'] == 'critical' and row['risk_score'] == 90
    assert '沉降速率过快' in row['warnings']
    assert '预测将超过警戒阈值' in row['warnings']
    assert row['predicted_value_30d'] == pytest.approx(1.0 - 0.16 * 30)


def test_crack_clean_converts_nan_to_none():
    import datetime as dt

    from modules.data_processing.process_crack_data import _clean

    assert _clean(float('nan')) is None
    assert _clean(np.float64('inf')) is None
    assert _clean(np.float64(1.5)) == 1.5
    assert _clean(np.int64(3)) == 3
    assert isinstance(_clean(pd.Timestamp('2024-08-10')), dt.datetime)


# ---------------- 导入幂等 ----------------

def test_import_is_idempotent():
    engine = create_engine('sqlite://')
    df = pd.DataFrame({
        'measurement_date': pd.to_datetime(['2021-01-01', '2021-01-02', '2021-01-02']),
        'S1': [1.0, 2.0, 3.0],
    })
    assert append_new_rows(df, engine, 'raw_settlement_data', ['measurement_date']) == (2, 1)
    assert append_new_rows(df, engine, 'raw_settlement_data', ['measurement_date']) == (0, 3)
    with engine.connect() as conn:
        count = conn.execute(text('SELECT COUNT(*) FROM raw_settlement_data')).scalar()
    assert count == 2


def test_import_composite_key():
    engine = create_engine('sqlite://')
    df = pd.DataFrame({
        'DID': [1, 1, 2],
        'measurement_date': pd.to_datetime(['2024-08-10', '2024-08-10', '2024-08-10']),
        'temperature': [25.1, 25.2, 26.0],
    })
    assert append_new_rows(df, engine, 'raw_temperature_data', ['DID', 'measurement_date']) == (2, 1)
    assert append_new_rows(df, engine, 'raw_temperature_data', ['DID', 'measurement_date']) == (0, 3)


# ---------------- JSON 安全 ----------------

def test_dumps_json_handles_nan_and_numpy():
    from modules.api.api_server import dumps_json

    payload = {'a': float('nan'), 'b': np.int64(3), 'c': np.float64(1.5), 'd': math.inf}
    out = dumps_json(payload)
    assert 'NaN' not in out and 'Infinity' not in out
    assert out == '{"a": null, "b": 3, "c": 1.5, "d": null}'


# ---------------- 接口契约：无 DB 也不 500 ----------------

@pytest.fixture(scope='module')
def client():
    from modules.api.api_server import app
    app.config.update(TESTING=True)
    return app.test_client()


@pytest.mark.parametrize('path', [
    '/api/health',
    '/api/meta/data-range',
    '/api/status/summary',
    '/api/overview/summary',
    '/api/source',
    '/api/trends',
    '/api/predictions/summary',
    '/api/risk/alerts',
    '/api/summary?days=5&with_summary=1',
    '/api/metrics/point/S1',
    '/api/points/ledger',
])
def test_get_endpoints_never_500(client, path):
    resp = client.get(path)
    assert resp.status_code < 500, f'{path} -> {resp.status_code}'
    # 能解析成 JSON（允许 4xx/5xx 的 JSON 错误体，但不允许非法 JSON）
    body = resp.get_data(as_text=True)
    if body.strip():
        import json
        json.loads(body)
