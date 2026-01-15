import os
import requests

def _headers():
    anon = os.environ.get('SUPABASE_ANON_KEY', '')
    role = os.environ.get('SUPABASE_SERVICE_ROLE', '')
    h = {
        'apikey': anon,
        'Accept': 'application/json',
    }
    if role:
        h['Authorization'] = f'Bearer {role}'
    return h

def _url(path):
    base = os.environ.get('SUPABASE_URL', '').rstrip('/')
    return f'{base}{path}'

class SupabaseHttpRepo:
    def get_all_points(self):
        a = requests.get(_url('/rest/v1/settlement_analysis?select=*'), headers=_headers())
        mp = requests.get(_url('/rest/v1/monitoring_points?select=*'), headers=_headers())
        a.raise_for_status(); mp.raise_for_status()
        ana = {row.get('point_id'): row for row in a.json()}
        res = []
        for row in mp.json():
            pid = row.get('point_id')
            merged = dict(row)
            if pid in ana:
                sa = ana[pid]
                merged['alert_level'] = sa.get('alert_level')
                merged['trend_type'] = sa.get('trend_type')
            res.append(merged)
        return res

    def get_point_detail(self, point_id):
        ts = requests.get(
            _url(f'/rest/v1/processed_settlement_data?select=measurement_date,value,daily_change,cumulative_change&point_id=eq.{point_id}&order=measurement_date'),
            headers=_headers()
        )
        ts.raise_for_status()
        ana = requests.get(
            _url(f'/rest/v1/settlement_analysis?select=*&point_id=eq.{point_id}'),
            headers=_headers()
        )
        ana.raise_for_status()
        ts_rows = ts.json()
        for r in ts_rows:
            if 'measurement_date' in r and r['measurement_date'] is not None:
                r['measurement_date'] = str(r['measurement_date'])
        ana_rows = ana.json()
        ana_dict = ana_rows[0] if isinstance(ana_rows, list) and len(ana_rows) else {}
        return {'timeSeriesData': ts_rows, 'analysisData': ana_dict}

    def get_summary(self):
        r = requests.get(_url('/rest/v1/settlement_analysis?select=*'), headers=_headers())
        r.raise_for_status()
        rows = r.json()
        def key(x):
            pid = str(x.get('point_id', ''))
            import re
            nums = re.sub(r'[^0-9]+', '', pid)
            return (int(nums) if nums.isdigit() else 0, pid)
        rows.sort(key=key)
        return rows

    def get_trends(self):
        r = requests.get(_url('/rest/v1/settlement_analysis?select=trend_type'), headers=_headers())
        r.raise_for_status()
        rows = r.json()
        cnt = {}
        for row in rows:
            t = row.get('trend_type')
            cnt[t] = cnt.get(t, 0) + 1
        return [{'trend_type': k, 'count': v} for k, v in cnt.items()]
