# -*- coding: utf-8 -*-
"""
Data import script for advanced analysis module
Imports:
1. Settlement point -> chainage mapping
2. Geological layer data
3. Crack monitoring data
"""

import os
import requests
import pandas as pd
from docx import Document

def _headers():
    anon = os.environ.get('SUPABASE_ANON_KEY', '')
    h = {
        'apikey': anon,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }
    if anon:
        h['Authorization'] = f'Bearer {anon}'
    return h

def _url(path):
    base = os.environ.get('SUPABASE_URL', '').rstrip('/')
    return f'{base}{path}'


def import_profile_config():
    """
    Import settlement point -> chainage mapping
    Assumes uniform distribution along 565m tunnel
    """
    tunnel_length = 565.0  # meters
    points = []

    # S0-S25: 26 points uniformly distributed
    for i in range(26):
        point_id = f'S{i}'
        chainage = (i / 25) * tunnel_length
        points.append({
            'point_id': point_id,
            'chainage_m': round(chainage, 2),
            'section_name': f'Section {i}',
            'description': f'Settlement monitoring point {point_id}'
        })

    # Also handle special points with left/right variants
    special_points = ['S6', 'S11', 'S13', 'S16', 'S18']
    for sp in special_points:
        base_idx = int(sp[1:])
        base_chainage = (base_idx / 25) * tunnel_length
        # Left variant (slightly before)
        points.append({
            'point_id': f'{sp}L',
            'chainage_m': round(base_chainage - 1, 2),
            'section_name': f'Section {base_idx} Left',
            'description': f'Settlement monitoring point {sp} Left side'
        })
        # Right variant (slightly after)
        points.append({
            'point_id': f'{sp}R',
            'chainage_m': round(base_chainage + 1, 2),
            'section_name': f'Section {base_idx} Right',
            'description': f'Settlement monitoring point {sp} Right side'
        })

    # Upsert to Supabase
    for p in points:
        try:
            r = requests.post(
                _url('/rest/v1/tunnel_profile_config?on_conflict=point_id'),
                headers={**_headers(), 'Prefer': 'return=representation,resolution=merge-duplicates'},
                json=p
            )
            r.raise_for_status()
            print(f"[OK] Imported {p['point_id']} at {p['chainage_m']}m")
        except Exception as e:
            print(f"[ERROR] Failed to import {p['point_id']}: {e}")

    return points


def import_geological_layers(docx_path=None):
    """
    Import geological layer data from docx or use default values
    """
    # Default geological layers from the document
    layers = [
        {'layer_number': '1', 'layer_name': 'Fill', 'depth_top': 0, 'depth_bottom': 2.6,
         'thickness': 2.6, 'unit_weight': 18, 'cohesion': None, 'friction_angle': None,
         'compression_modulus': 4.39, 'poisson_ratio': 0.37, 'color': '#8B4513'},
        {'layer_number': '2', 'layer_name': 'Silty Clay', 'depth_top': 2.6, 'depth_bottom': 3.9,
         'thickness': 1.3, 'unit_weight': 18.4, 'cohesion': 21, 'friction_angle': 14,
         'compression_modulus': 4.39, 'poisson_ratio': 0.35, 'color': '#CD853F'},
        {'layer_number': '3', 'layer_name': 'Mucky Silty Clay', 'depth_top': 3.9, 'depth_bottom': 9.0,
         'thickness': 5.1, 'unit_weight': 17.9, 'cohesion': 11, 'friction_angle': 15,
         'compression_modulus': 3.10, 'poisson_ratio': 0.36, 'color': '#556B2F'},
        {'layer_number': '3t', 'layer_name': 'Clay Silt', 'depth_top': 9.0, 'depth_bottom': 10.0,
         'thickness': 1.0, 'unit_weight': 18.6, 'cohesion': 7, 'friction_angle': 33,
         'compression_modulus': 8.87, 'poisson_ratio': 0.38, 'color': '#6B8E23'},
        {'layer_number': '4', 'layer_name': 'Mucky Clay', 'depth_top': 10.0, 'depth_bottom': 18.9,
         'thickness': 8.9, 'unit_weight': 16.8, 'cohesion': 13, 'friction_angle': 10.5,
         'compression_modulus': 2.23, 'poisson_ratio': 0.37, 'color': '#2F4F4F'},
        {'layer_number': '5', 'layer_name': 'Clay', 'depth_top': 18.9, 'depth_bottom': 25.0,
         'thickness': 6.1, 'unit_weight': 17.9, 'cohesion': 19, 'friction_angle': 15.5,
         'compression_modulus': 3.70, 'poisson_ratio': 0.35, 'color': '#708090'},
        {'layer_number': '6', 'layer_name': 'Silty Clay', 'depth_top': 25.0, 'depth_bottom': 29.1,
         'thickness': 4.1, 'unit_weight': 19.7, 'cohesion': 50, 'friction_angle': 17,
         'compression_modulus': 7.77, 'poisson_ratio': 0.37, 'color': '#A0522D'},
        {'layer_number': '7', 'layer_name': 'Sandy Silt', 'depth_top': 29.1, 'depth_bottom': 38.9,
         'thickness': 9.8, 'unit_weight': 19.0, 'cohesion': 6, 'friction_angle': 34,
         'compression_modulus': 11, 'poisson_ratio': 0.36, 'color': '#DEB887'},
    ]

    for layer in layers:
        try:
            r = requests.post(
                _url('/rest/v1/geological_layers'),
                headers=_headers(),
                json=layer
            )
            r.raise_for_status()
            print(f"[OK] Imported layer {layer['layer_number']}: {layer['layer_name']}")
        except Exception as e:
            print(f"[ERROR] Failed to import layer {layer['layer_number']}: {e}")

    return layers


def import_crack_data(excel_path):
    """
    Import crack monitoring data from Excel
    """
    try:
        df = pd.read_excel(excel_path, sheet_name=None)

        # Find the crack data sheet
        crack_sheet = None
        for name in df.keys():
            if 'crack' in name.lower() or 'fissure' in name.lower():
                crack_sheet = name
                break

        # Try sheet with F1-1, F1-2 pattern
        for name, sheet_df in df.items():
            cols = sheet_df.columns.tolist()
            if any('F1-1' in str(c) or 'F1-2' in str(c) for c in cols):
                crack_sheet = name
                break

        if not crack_sheet:
            # Use the sheet with most F columns
            for name, sheet_df in df.items():
                cols = [str(c) for c in sheet_df.columns]
                f_cols = [c for c in cols if c.startswith('F') and '-' in c]
                if len(f_cols) > 10:
                    crack_sheet = name
                    break

        if not crack_sheet:
            print("[WARNING] No crack data sheet found")
            return []

        crack_df = df[crack_sheet]
        print(f"[INFO] Using sheet: {crack_sheet}")
        print(f"[INFO] Columns: {crack_df.columns.tolist()[:10]}...")

        # Find date column
        date_col = None
        for col in crack_df.columns:
            col_str = str(col).lower()
            if 'date' in col_str or 'time' in col_str:
                date_col = col
                break
        if not date_col:
            date_col = crack_df.columns[0]

        # Get crack point columns (F1-1, F1-2, etc.)
        crack_cols = [c for c in crack_df.columns if str(c).startswith('F') and '-' in str(c)]

        records = []
        for _, row in crack_df.iterrows():
            date_val = row[date_col]
            if pd.isna(date_val):
                continue

            for col in crack_cols:
                value = row[col]
                if pd.isna(value):
                    continue

                point_id = str(col)
                crack_id = point_id.split('-')[0] if '-' in point_id else point_id

                records.append({
                    'measurement_date': str(date_val),
                    'point_id': point_id,
                    'crack_id': crack_id,
                    'value': float(value)
                })

        # Batch insert
        batch_size = 100
        for i in range(0, len(records), batch_size):
            batch = records[i:i+batch_size]
            try:
                r = requests.post(
                    _url('/rest/v1/crack_monitoring_data'),
                    headers=_headers(),
                    json=batch
                )
                r.raise_for_status()
                print(f"[OK] Imported batch {i//batch_size + 1}: {len(batch)} records")
            except Exception as e:
                print(f"[ERROR] Failed to import batch: {e}")

        return records

    except Exception as e:
        print(f"[ERROR] Failed to import crack data: {e}")
        return []


def import_settlement_crack_mapping():
    """
    Create mapping between settlement points and crack points
    Based on assumed spatial proximity
    """
    # Design mapping: assume cracks F1-F11 are distributed along tunnel
    # S0-S25 = 26 points, F1-F11 = 11 cracks
    # Rough mapping: each crack covers ~2-3 settlement points

    mappings = [
        # F1 near S1-S2
        {'settlement_point': 'S1', 'crack_point': 'F1-1', 'distance_m': 5, 'correlation_strength': 'strong'},
        {'settlement_point': 'S1', 'crack_point': 'F1-2', 'distance_m': 6, 'correlation_strength': 'strong'},
        {'settlement_point': 'S1', 'crack_point': 'F1-3', 'distance_m': 7, 'correlation_strength': 'medium'},
        {'settlement_point': 'S2', 'crack_point': 'F1-1', 'distance_m': 8, 'correlation_strength': 'medium'},

        # F2 near S3-S4
        {'settlement_point': 'S3', 'crack_point': 'F2-1', 'distance_m': 5, 'correlation_strength': 'strong'},
        {'settlement_point': 'S3', 'crack_point': 'F2-2', 'distance_m': 6, 'correlation_strength': 'strong'},
        {'settlement_point': 'S4', 'crack_point': 'F2-3', 'distance_m': 7, 'correlation_strength': 'medium'},

        # F3 near S5-S6
        {'settlement_point': 'S5', 'crack_point': 'F3-1', 'distance_m': 4, 'correlation_strength': 'strong'},
        {'settlement_point': 'S5', 'crack_point': 'F3-2', 'distance_m': 5, 'correlation_strength': 'strong'},
        {'settlement_point': 'S6', 'crack_point': 'F3-3', 'distance_m': 6, 'correlation_strength': 'medium'},

        # F4 near S7-S8
        {'settlement_point': 'S7', 'crack_point': 'F4-1', 'distance_m': 5, 'correlation_strength': 'strong'},
        {'settlement_point': 'S8', 'crack_point': 'F4-2', 'distance_m': 5, 'correlation_strength': 'strong'},

        # F5 near S9-S10
        {'settlement_point': 'S9', 'crack_point': 'F5-1', 'distance_m': 4, 'correlation_strength': 'strong'},
        {'settlement_point': 'S10', 'crack_point': 'F5-2', 'distance_m': 5, 'correlation_strength': 'strong'},

        # F6 near S11-S12
        {'settlement_point': 'S11', 'crack_point': 'F6-1', 'distance_m': 5, 'correlation_strength': 'strong'},
        {'settlement_point': 'S12', 'crack_point': 'F6-2', 'distance_m': 6, 'correlation_strength': 'medium'},

        # F7 near S13-S14
        {'settlement_point': 'S13', 'crack_point': 'F7-1', 'distance_m': 5, 'correlation_strength': 'strong'},
        {'settlement_point': 'S14', 'crack_point': 'F7-2', 'distance_m': 5, 'correlation_strength': 'strong'},

        # F8 near S15-S16
        {'settlement_point': 'S15', 'crack_point': 'F8-1', 'distance_m': 4, 'correlation_strength': 'strong'},
        {'settlement_point': 'S16', 'crack_point': 'F8-2', 'distance_m': 5, 'correlation_strength': 'strong'},

        # F9 near S17-S18
        {'settlement_point': 'S17', 'crack_point': 'F9-1', 'distance_m': 5, 'correlation_strength': 'strong'},
        {'settlement_point': 'S18', 'crack_point': 'F9-2', 'distance_m': 6, 'correlation_strength': 'medium'},

        # F10 near S19-S21
        {'settlement_point': 'S19', 'crack_point': 'F10-1', 'distance_m': 5, 'correlation_strength': 'strong'},
        {'settlement_point': 'S20', 'crack_point': 'F10-2', 'distance_m': 5, 'correlation_strength': 'strong'},
        {'settlement_point': 'S21', 'crack_point': 'F10-3', 'distance_m': 6, 'correlation_strength': 'medium'},

        # F11 near S22-S25
        {'settlement_point': 'S22', 'crack_point': 'F11-1', 'distance_m': 5, 'correlation_strength': 'strong'},
        {'settlement_point': 'S23', 'crack_point': 'F11-2', 'distance_m': 5, 'correlation_strength': 'strong'},
        {'settlement_point': 'S24', 'crack_point': 'F11-3', 'distance_m': 6, 'correlation_strength': 'medium'},
    ]

    for m in mappings:
        try:
            r = requests.post(
                _url('/rest/v1/settlement_crack_mapping?on_conflict=settlement_point,crack_point'),
                headers={**_headers(), 'Prefer': 'return=representation,resolution=merge-duplicates'},
                json=m
            )
            r.raise_for_status()
            print(f"[OK] Mapped {m['settlement_point']} -> {m['crack_point']}")
        except Exception as e:
            print(f"[ERROR] Failed to map: {e}")

    return mappings


def run_all_imports(crack_excel_path=None):
    """
    Run all data imports
    """
    print("=" * 60)
    print("Starting Advanced Analysis Data Import")
    print("=" * 60)

    print("\n[1/4] Importing tunnel profile config...")
    import_profile_config()

    print("\n[2/4] Importing geological layers...")
    import_geological_layers()

    print("\n[3/4] Importing settlement-crack mapping...")
    import_settlement_crack_mapping()

    if crack_excel_path:
        print("\n[4/4] Importing crack monitoring data...")
        import_crack_data(crack_excel_path)
    else:
        print("\n[4/4] Skipping crack data import (no path provided)")

    print("\n" + "=" * 60)
    print("Import Complete!")
    print("=" * 60)


if __name__ == '__main__':
    import sys
    crack_path = sys.argv[1] if len(sys.argv) > 1 else None
    run_all_imports(crack_path)
