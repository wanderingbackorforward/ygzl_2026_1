# -*- coding: utf-8 -*-
"""
Supabase HTTP data access for ML modules
Replaces MySQL connections with Supabase REST API calls
"""
import os
import requests
import pandas as pd
import numpy as np


def _headers():
    anon_key = os.environ.get('SUPABASE_ANON_KEY', '')
    return {
        'apikey': anon_key,
        'Accept': 'application/json',
        'Authorization': f'Bearer {anon_key}'
    }


def _base_url():
    return os.environ.get('SUPABASE_URL', '').rstrip('/')


def fetch_point_settlement(point_id):
    """
    Fetch settlement data for a single point.
    Returns DataFrame with columns: date, settlement
    (compatible with ML function expectations)
    """
    url = f"{_base_url()}/rest/v1/processed_settlement_data"
    params = {
        'select': 'measurement_date,cumulative_change',
        'point_id': f'eq.{point_id}',
        'order': 'measurement_date.asc',
        'limit': '1000',
    }
    r = requests.get(url, headers=_headers(), params=params, timeout=15)
    r.raise_for_status()
    data = r.json()

    if not data:
        return pd.DataFrame(columns=['date', 'settlement'])

    df = pd.DataFrame(data)
    df = df.rename(columns={
        'measurement_date': 'date',
        'cumulative_change': 'settlement'
    })
    df['date'] = pd.to_datetime(df['date'])
    return df


def fetch_point_raw(point_id):
    """
    Fetch raw settlement data for a single point.
    Returns DataFrame with columns: measurement_date, cumulative_change
    (for causal inference)
    """
    url = f"{_base_url()}/rest/v1/processed_settlement_data"
    params = {
        'select': 'measurement_date,cumulative_change',
        'point_id': f'eq.{point_id}',
        'order': 'measurement_date.asc',
        'limit': '1000',
    }
    r = requests.get(url, headers=_headers(), params=params, timeout=15)
    r.raise_for_status()
    data = r.json()

    if not data:
        return pd.DataFrame(columns=['measurement_date', 'cumulative_change'])

    df = pd.DataFrame(data)
    df['measurement_date'] = pd.to_datetime(df['measurement_date'])
    return df


def fetch_all_settlement():
    """
    Fetch all settlement data (all points).
    Returns DataFrame with columns: point_id, measurement_date, cumulative_change
    (for spatial correlation)
    """
    url = f"{_base_url()}/rest/v1/processed_settlement_data"
    all_rows = []
    offset = 0
    page_size = 1000

    while True:
        params = {
            'select': 'point_id,measurement_date,cumulative_change',
            'order': 'point_id.asc,measurement_date.asc',
            'offset': str(offset),
            'limit': str(page_size),
        }
        r = requests.get(url, headers=_headers(), params=params, timeout=15)
        r.raise_for_status()
        batch = r.json()
        if not batch:
            break
        all_rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    if not all_rows:
        return pd.DataFrame(columns=['point_id', 'measurement_date', 'cumulative_change'])

    df = pd.DataFrame(all_rows)
    df['measurement_date'] = pd.to_datetime(df['measurement_date'])
    return df


def fetch_monitoring_points():
    """
    Fetch monitoring point coordinates.
    Returns DataFrame with columns: point_id, x_coord, y_coord
    Falls back gracefully if table/columns don't exist.
    """
    # Try with x_coord, y_coord first
    url = f"{_base_url()}/rest/v1/monitoring_points"
    try:
        # First try select=* to discover available columns
        params = {'select': '*', 'limit': '1000'}
        r = requests.get(url, headers=_headers(), params=params, timeout=15)
        r.raise_for_status()
        data = r.json()

        if not data:
            return pd.DataFrame(columns=['point_id', 'x_coord', 'y_coord'])

        df = pd.DataFrame(data)

        # Ensure x_coord, y_coord exist; fill with 0 if not
        if 'x_coord' not in df.columns:
            df['x_coord'] = 0.0
        if 'y_coord' not in df.columns:
            df['y_coord'] = 0.0

        return df[['point_id', 'x_coord', 'y_coord']]

    except Exception as e:
        print(f"[WARN] fetch_monitoring_points failed: {e}")
        return pd.DataFrame(columns=['point_id', 'x_coord', 'y_coord'])


def find_distant_points(point_id, points_df, n=3):
    """
    Find the n most distant monitoring points from a given point.
    Pure Python replacement for the MySQL SQRT(POW()) query.

    Returns list of point_ids.
    """
    if point_id not in points_df['point_id'].values:
        return []

    target = points_df[points_df['point_id'] == point_id].iloc[0]
    others = points_df[points_df['point_id'] != point_id].copy()

    if others.empty:
        return []

    others['distance'] = np.sqrt(
        (others['x_coord'] - target['x_coord']) ** 2 +
        (others['y_coord'] - target['y_coord']) ** 2
    )
    others = others.sort_values('distance', ascending=False)
    return others.head(n)['point_id'].tolist()
