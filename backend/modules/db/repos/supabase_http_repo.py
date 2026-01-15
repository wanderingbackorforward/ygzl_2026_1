import os
import requests

def _headers():
    anon = os.environ.get('SUPABASE_ANON_KEY', '')
    h = {
        'apikey': anon,
        'Accept': 'application/json',
    }
    if anon:
        h['Authorization'] = f'Bearer {anon}'
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

    def crack_get_monitoring_points(self):
        r = requests.get(_url('/rest/v1/crack_monitoring_points?select=*&status=eq.active'), headers=_headers())
        r.raise_for_status()
        rows = r.json()
        for x in rows:
            for k in ('monitoring_start_date', 'monitoring_end_date'):
                if k in x and x[k] is not None:
                    try:
                        x[k] = str(x[k]).replace('T', ' ').split('.')[0]
                    except:
                        x[k] = str(x[k])
        return rows

    def crack_get_data(self):
        r = requests.get(_url('/rest/v1/raw_crack_data?select=*&order=measurement_date'), headers=_headers())
        r.raise_for_status()
        rows = r.json()
        for x in rows:
            if 'measurement_date' in x and x['measurement_date'] is not None:
                x['measurement_date'] = str(x['measurement_date']).replace('T', ' ').split('.')[0]
        return rows

    def crack_get_analysis_results(self):
        r1 = requests.get(_url('/rest/v1/crack_analysis_results?select=*'), headers=_headers())
        r2 = requests.get(_url('/rest/v1/crack_monitoring_points?select=point_id,trend_type,change_type'), headers=_headers())
        r1.raise_for_status(); r2.raise_for_status()
        ana = r1.json()
        mp = {row.get('point_id'): row for row in r2.json()}
        res = []
        for row in ana:
            pid = row.get('point_id')
            merged = dict(row)
            x = mp.get(pid)
            if x:
                merged['trend_type'] = x.get('trend_type')
                merged['change_type'] = x.get('change_type')
            if 'analysis_date' in merged and merged['analysis_date'] is not None:
                merged['analysis_date'] = str(merged['analysis_date']).replace('T', ' ').split('.')[0]
            res.append(merged)
        res.sort(key=lambda z: z.get('analysis_date') or '', reverse=True)
        return res

    def crack_get_trend_data(self):
        rows = self.crack_get_data()
        if not rows:
            return {'dates': [], 'series': []}
        keys = list(rows[0].keys())
        point_columns = [k for k in keys if k != 'measurement_date']
        dates = [r.get('measurement_date') for r in rows]
        series = []
        for p in point_columns:
            series.append({'name': p, 'data': [r.get(p) for r in rows]})
        return {'dates': dates, 'series': series}

    def temperature_get_points(self):
        r = requests.get(_url('/rest/v1/temperature_monitoring_points?select=*&status=eq.active'), headers=_headers())
        r.raise_for_status()
        rows = r.json()
        return rows

    def temperature_get_summary(self):
        r = requests.get(_url('/rest/v1/temperature_analysis?select=*'), headers=_headers())
        r.raise_for_status()
        rows = r.json()
        import re
        def key(x):
            sid = str(x.get('sensor_id', ''))
            nums = re.sub(r'[^0-9]+', '', sid)
            return (int(nums) if nums.isdigit() else 0, sid)
        rows.sort(key=key)
        for x in rows:
            if 'last_updated' in x and x['last_updated'] is not None:
                x['last_updated'] = str(x['last_updated']).replace('T', ' ').split('.')[0]
        return rows

    def temperature_get_data(self, sensor_id):
        d = requests.get(_url(f'/rest/v1/processed_temperature_data?select=*&SID=eq.{sensor_id}&order=measurement_date'), headers=_headers())
        a = requests.get(_url(f'/rest/v1/temperature_analysis?select=*&sensor_id=eq.{sensor_id}'), headers=_headers())
        d.raise_for_status(); a.raise_for_status()
        data_rows = d.json()
        for x in data_rows:
            if 'measurement_date' in x and x['measurement_date'] is not None:
                x['measurement_date'] = str(x['measurement_date']).split('T')[0]
        rename_map = {}
        if data_rows:
            x0 = data_rows[0]
            if 'avg_temp' in x0 and 'avg_temperature' not in x0: rename_map['avg_temp'] = 'avg_temperature'
            if 'min_temp' in x0 and 'min_temperature' not in x0: rename_map['min_temp'] = 'min_temperature'
            if 'max_temp' in x0 and 'max_temperature' not in x0: rename_map['max_temp'] = 'max_temperature'
        if rename_map:
            for x in data_rows:
                for k, v in rename_map.items():
                    if k in x and v not in x:
                        x[v] = x[k]
        if data_rows and 'temperature_range' not in data_rows[0] and {'max_temperature','min_temperature'}.issubset(data_rows[0].keys()):
            for x in data_rows:
                mt = x.get('max_temperature'); mn = x.get('min_temperature')
                x['temperature_range'] = (mt - mn) if mt is not None and mn is not None else None
        ana_rows = a.json()
        ana_dict = ana_rows[0] if isinstance(ana_rows, list) and len(ana_rows) else {}
        if ana_dict:
            if 'last_updated' in ana_dict and ana_dict['last_updated'] is not None:
                ana_dict['last_updated'] = str(ana_dict['last_updated']).replace('T', ' ').split('.')[0]
            if 'avg_temp' in ana_dict and 'avg_temperature' not in ana_dict:
                ana_dict['avg_temperature'] = ana_dict.get('avg_temp')
            if 'min_temp' in ana_dict and 'min_temperature' not in ana_dict:
                ana_dict['min_temperature'] = ana_dict.get('min_temp')
            if 'max_temp' in ana_dict and 'max_temperature' not in ana_dict:
                ana_dict['max_temperature'] = ana_dict.get('max_temp')
        return {'timeSeriesData': data_rows, 'analysisData': ana_dict}

    def temperature_get_data_multi(self, sensor_ids):
        result = {}
        for sid in sensor_ids:
            d = requests.get(_url(f'/rest/v1/processed_temperature_data?select=*&SID=eq.{sid}&order=measurement_date'), headers=_headers())
            d.raise_for_status()
            rows = d.json()
            for x in rows:
                if 'measurement_date' in x and x['measurement_date'] is not None:
                    x['measurement_date'] = str(x['measurement_date']).split('T')[0]
            result[sid] = rows
        return result

    def temperature_get_trends(self):
        r = requests.get(_url('/rest/v1/temperature_analysis?select=trend_type'), headers=_headers())
        r.raise_for_status()
        rows = r.json()
        cnt = {}
        for row in rows:
            t = row.get('trend_type')
            cnt[t] = cnt.get(t, 0) + 1
        return [{'trend_type': k, 'count': v} for k, v in cnt.items()]

    def temperature_get_stats(self):
        d = requests.get(_url('/rest/v1/processed_temperature_data?select=measurement_date,avg_temperature,max_temperature,min_temperature,SID'), headers=_headers())
        a = requests.get(_url('/rest/v1/temperature_analysis?select=sensor_id,trend_type,alert_level'), headers=_headers())
        d.raise_for_status(); a.raise_for_status()
        dr = d.json(); ar = a.json()
        import math
        dates = [x.get('measurement_date') for x in dr if x.get('measurement_date') is not None]
        def to_date_str(s):
            return str(s).split('T')[0] if s is not None else None
        date_strs = [to_date_str(x) for x in dates]
        min_date = min(date_strs) if date_strs else None
        max_date = max(date_strs) if date_strs else None
        latest = max_date
        latest_rows = [x for x in dr if to_date_str(x.get('measurement_date')) == latest] if latest else []
        vals = [x.get('avg_temperature') for x in latest_rows if x.get('avg_temperature') is not None]
        cur_avg = sum(vals)/len(vals) if vals else None
        cur_max = max([x.get('max_temperature') for x in latest_rows if x.get('max_temperature') is not None], default=None)
        cur_min = min([x.get('min_temperature') for x in latest_rows if x.get('min_temperature') is not None], default=None)
        sensor_count = len({x.get('sensor_id') or x.get('SID') for x in ar})
        trend_cnt = {}
        for x in ar:
            t = x.get('trend_type')
            trend_cnt[t] = trend_cnt.get(t, 0) + 1
        alert_cnt = {}
        for x in ar:
            t = x.get('alert_level')
            alert_cnt[t] = alert_cnt.get(t, 0) + 1
        stats = {
            'current_temperature': {
                'avg': cur_avg if cur_avg is None else float(cur_avg),
                'max': cur_max if cur_max is None else float(cur_max),
                'min': cur_min if cur_min is None else float(cur_min),
                'sensor_count': sensor_count,
                'date_range': f"{min_date} ~ {max_date}" if min_date and max_date and min_date != max_date else (min_date or max_date)
            },
            'trends': trend_cnt,
            'alerts': alert_cnt
        }
        return stats
