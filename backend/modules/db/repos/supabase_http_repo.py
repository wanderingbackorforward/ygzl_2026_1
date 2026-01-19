# -*- coding: utf-8 -*-
import os
import requests
import datetime

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
        r2 = requests.get(_url('/rest/v1/crack_monitoring_points?select=point_id,trend_type,change_type,total_change,average_change_rate,trend_slope'), headers=_headers())
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
                merged['total_change'] = x.get('total_change')
                merged['average_change_rate'] = x.get('average_change_rate')
                merged['trend_slope'] = x.get('trend_slope')
                merged['avg_daily_rate'] = x.get('average_change_rate')
                merged['slope'] = x.get('trend_slope')
            if 'avg_value' not in merged and 'mean_value' in merged:
                merged['avg_value'] = merged.get('mean_value')
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

    def temperature_get_processed_window(self, days: int = 90):
        days = int(days) if days is not None else 90
        days = 1 if days <= 0 else days

        latest = requests.get(
            _url('/rest/v1/processed_temperature_data?select=measurement_date&order=measurement_date.desc&limit=1'),
            headers=_headers()
        )
        latest.raise_for_status()
        latest_rows = latest.json()
        if not latest_rows:
            return []

        latest_date_raw = latest_rows[0].get('measurement_date')
        latest_date_str = str(latest_date_raw).split('T')[0] if latest_date_raw is not None else None
        if not latest_date_str:
            return []

        latest_dt = datetime.datetime.strptime(latest_date_str, '%Y-%m-%d').date()
        start_dt = latest_dt - datetime.timedelta(days=days)
        start_str = start_dt.isoformat()

        r = requests.get(
            _url(f'/rest/v1/processed_temperature_data?select=*&measurement_date=gte.{start_str}&order=measurement_date.asc'),
            headers=_headers()
        )
        r.raise_for_status()
        rows = r.json()
        for x in rows:
            if 'measurement_date' in x and x['measurement_date'] is not None:
                x['measurement_date'] = str(x['measurement_date']).split('T')[0]
            if 'avg_temp' in x and 'avg_temperature' not in x:
                x['avg_temperature'] = x.get('avg_temp')
            if 'min_temp' in x and 'min_temperature' not in x:
                x['min_temperature'] = x.get('min_temp')
            if 'max_temp' in x and 'max_temperature' not in x:
                x['max_temperature'] = x.get('max_temp')
            if 'temperature_range' not in x and x.get('max_temperature') is not None and x.get('min_temperature') is not None:
                x['temperature_range'] = x['max_temperature'] - x['min_temperature']
        return rows

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

    def tickets_get(self, filters=None, limit=50, offset=0):
        params = []
        if filters:
            if 'status' in filters: params.append(f"status=eq.{filters['status']}")
            if 'ticket_type' in filters: params.append(f"ticket_type=eq.{filters['ticket_type']}")
            if 'priority' in filters: params.append(f"priority=eq.{filters['priority']}")
            if 'creator_id' in filters: params.append(f"creator_id=eq.{filters['creator_id']}")
            if 'assignee_id' in filters: params.append(f"assignee_id=eq.{filters['assignee_id']}")
            if 'monitoring_point_id' in filters: params.append(f"monitoring_point_id=eq.{filters['monitoring_point_id']}")
            if 'search_keyword' in filters:
                kw = filters['search_keyword']
                params.append(f"title=ilike.*{kw}*")
        q = "/rest/v1/tickets?select=*&order=created_at.desc"
        if params: q += "&" + "&".join(params)
        q += f"&limit={limit}&offset={offset}"
        r = requests.get(_url(q), headers=_headers())
        r.raise_for_status()
        rows = r.json()
        return rows

    def ticket_create(self, ticket_data):
        h = _headers(); h['Prefer'] = 'return=representation'
        r = requests.post(_url('/rest/v1/tickets'), headers=h, json=ticket_data)
        r.raise_for_status()
        rows = r.json()
        return rows[0] if isinstance(rows, list) and rows else {}

    def ticket_get_by_id(self, ticket_id):
        r = requests.get(_url(f'/rest/v1/tickets?select=*&id=eq.{ticket_id}'), headers=_headers())
        r.raise_for_status()
        rows = r.json()
        return rows[0] if isinstance(rows, list) and rows else None

    def ticket_get_by_number(self, ticket_number):
        r = requests.get(_url(f'/rest/v1/tickets?select=*&ticket_number=eq.{ticket_number}'), headers=_headers())
        r.raise_for_status()
        rows = r.json()
        return rows[0] if isinstance(rows, list) and rows else None

    def ticket_update(self, ticket_id, update_data):
        h = _headers(); h['Prefer'] = 'return=representation'
        r = requests.patch(_url(f'/rest/v1/tickets?id=eq.{ticket_id}'), headers=h, json=update_data)
        r.raise_for_status()
        rows = r.json()
        return rows[0] if isinstance(rows, list) and rows else None

    def ticket_delete(self, ticket_id):
        r = requests.delete(_url(f'/rest/v1/tickets?id=eq.{ticket_id}'), headers=_headers())
        r.raise_for_status()
        return True

    def tickets_statistics(self):
        r = requests.get(_url('/rest/v1/tickets?select=status,ticket_type,priority,created_at'), headers=_headers())
        r.raise_for_status()
        rows = r.json()
        total = len(rows)
        by_status = {}
        by_type = {}
        by_priority = {}
        from datetime import datetime
        today = datetime.now().date()
        today_created = 0
        overdue = 0
        for x in rows:
            s = x.get('status')
            by_status[s] = by_status.get(s, 0) + 1
            t = x.get('ticket_type')
            by_type[t] = by_type.get(t, 0) + 1
            p = x.get('priority')
            by_priority[p] = by_priority.get(p, 0) + 1
            ca = x.get('created_at')
            if ca:
                try:
                    d = str(ca).split('T')[0]
                    if d == today.isoformat(): today_created += 1
                except: pass
        return {'total': total, 'by_status': by_status, 'by_type': by_type, 'by_priority': by_priority, 'today_created': today_created, 'overdue': overdue}

    def ticket_comments_get(self, ticket_id, limit=50):
        r = requests.get(_url(f'/rest/v1/ticket_comments?select=*&ticket_id=eq.{ticket_id}&order=created_at.asc&limit={limit}'), headers=_headers())
        r.raise_for_status()
        rows = r.json()
        return rows

    def ticket_comment_add(self, payload):
        h = _headers(); h['Prefer'] = 'return=representation'
        r = requests.post(_url('/rest/v1/ticket_comments'), headers=h, json=payload)
        r.raise_for_status()
        rows = r.json()
        return rows[0] if isinstance(rows, list) and rows else {}

    def ticket_comment_update(self, comment_id, author_id, content):
        h = _headers(); h['Prefer'] = 'return=representation'
        r = requests.patch(_url(f'/rest/v1/ticket_comments?id=eq.{comment_id}&author_id=eq.{author_id}'), headers=h, json={'content': content})
        r.raise_for_status()
        rows = r.json()
        return bool(rows)

    def ticket_comment_delete(self, comment_id, author_id=None, is_admin=False):
        if is_admin:
            r = requests.delete(_url(f'/rest/v1/ticket_comments?id=eq.{comment_id}'), headers=_headers())
        else:
            r = requests.delete(_url(f'/rest/v1/ticket_comments?id=eq.{comment_id}&author_id=eq.{author_id}'), headers=_headers())
        r.raise_for_status()
        return True

    # =========================================================================
    # Ticket Archive and Reminder Methods
    # =========================================================================

    def tickets_get_due_soon(self, hours=24):
        """Get tickets due within specified hours"""
        r = requests.get(_url(f'/rest/v1/v_tickets_due_soon?select=*'), headers=_headers())
        r.raise_for_status()
        return r.json()

    def tickets_get_overdue(self):
        """Get all overdue tickets"""
        r = requests.get(_url(f'/rest/v1/v_tickets_overdue?select=*'), headers=_headers())
        r.raise_for_status()
        return r.json()

    def tickets_get_to_archive(self):
        """Get tickets ready for archiving (closed/rejected > 7 days)"""
        r = requests.get(_url(f'/rest/v1/v_tickets_to_archive?select=*'), headers=_headers())
        r.raise_for_status()
        return r.json()

    def ticket_archive(self, ticket_id):
        """Archive a single ticket"""
        # First get the ticket with its comments
        ticket = self.ticket_get_by_id(ticket_id)
        if not ticket:
            return False

        comments = self.ticket_comments_get(ticket_id, limit=1000)

        # Prepare archive data
        archive_data = {
            'original_id': ticket['id'],
            'ticket_number': ticket.get('ticket_number'),
            'title': ticket.get('title'),
            'description': ticket.get('description'),
            'ticket_type': ticket.get('ticket_type'),
            'sub_type': ticket.get('sub_type'),
            'priority': ticket.get('priority'),
            'status': ticket.get('status'),
            'creator_id': ticket.get('creator_id'),
            'creator_name': ticket.get('creator_name'),
            'assignee_id': ticket.get('assignee_id'),
            'assignee_name': ticket.get('assignee_name'),
            'monitoring_point_id': ticket.get('monitoring_point_id'),
            'location_info': ticket.get('location_info'),
            'equipment_id': ticket.get('equipment_id'),
            'threshold_value': ticket.get('threshold_value'),
            'current_value': ticket.get('current_value'),
            'alert_data': ticket.get('alert_data'),
            'due_at': ticket.get('due_at'),
            'resolved_at': ticket.get('resolved_at'),
            'closed_at': ticket.get('closed_at'),
            'attachment_paths': ticket.get('attachment_paths'),
            'metadata': ticket.get('metadata'),
            'created_at': ticket.get('created_at'),
            'updated_at': ticket.get('updated_at'),
            'comments_snapshot': comments
        }

        # Insert into archive table
        h = _headers(); h['Prefer'] = 'return=representation'
        r = requests.post(_url('/rest/v1/ticket_archive'), headers=h, json=archive_data)
        r.raise_for_status()

        # Mark original ticket as archived
        self.ticket_update(ticket_id, {'is_archived': True, 'archived_at': datetime.datetime.now().isoformat()})
        return True

    def tickets_archive_batch(self, ticket_ids):
        """Archive multiple tickets"""
        results = {'success': [], 'failed': []}
        for tid in ticket_ids:
            try:
                if self.ticket_archive(tid):
                    results['success'].append(tid)
                else:
                    results['failed'].append(tid)
            except Exception as e:
                print(f"Archive ticket {tid} failed: {e}")
                results['failed'].append(tid)
        return results

    def tickets_auto_archive(self):
        """Auto archive all eligible tickets"""
        to_archive = self.tickets_get_to_archive()
        if not to_archive:
            return {'archived_count': 0, 'tickets': []}
        ticket_ids = [t['id'] for t in to_archive]
        results = self.tickets_archive_batch(ticket_ids)
        return {
            'archived_count': len(results['success']),
            'failed_count': len(results['failed']),
            'tickets': results
        }

    def tickets_get_active(self, filters=None, limit=50, offset=0):
        """Get active (non-archived) tickets only"""
        params = []
        # Try with is_archived filter first, fall back to all tickets if column doesn't exist
        try:
            test_url = _url('/rest/v1/tickets?select=is_archived&limit=1')
            test_r = requests.get(test_url, headers=_headers())
            if test_r.status_code == 200:
                params.append('is_archived=eq.false')
        except:
            pass

        if filters:
            if 'status' in filters: params.append(f"status=eq.{filters['status']}")
            if 'ticket_type' in filters: params.append(f"ticket_type=eq.{filters['ticket_type']}")
            if 'priority' in filters: params.append(f"priority=eq.{filters['priority']}")
            if 'creator_id' in filters: params.append(f"creator_id=eq.{filters['creator_id']}")
            if 'assignee_id' in filters: params.append(f"assignee_id=eq.{filters['assignee_id']}")
            if 'monitoring_point_id' in filters: params.append(f"monitoring_point_id=eq.{filters['monitoring_point_id']}")
            if 'search_keyword' in filters:
                kw = filters['search_keyword']
                params.append(f"title=ilike.*{kw}*")
        q = "/rest/v1/tickets?select=*&order=created_at.desc"
        if params: q += "&" + "&".join(params)
        q += f"&limit={limit}&offset={offset}"
        r = requests.get(_url(q), headers=_headers())
        r.raise_for_status()
        return r.json()

    def tickets_get_archived(self, limit=50, offset=0):
        """Get archived tickets from archive table"""
        r = requests.get(_url(f'/rest/v1/ticket_archive?select=*&order=archived_at.desc&limit={limit}&offset={offset}'), headers=_headers())
        r.raise_for_status()
        return r.json()

    # =========================================================================
    # User Management Methods
    # =========================================================================

    def users_get_all(self, active_only=True):
        """Get all system users"""
        q = '/rest/v1/system_users?select=*&order=created_at.desc'
        if active_only:
            q += '&is_active=eq.true'
        r = requests.get(_url(q), headers=_headers())
        r.raise_for_status()
        return r.json()

    def user_get_by_id(self, user_id):
        """Get user by user_id"""
        r = requests.get(_url(f'/rest/v1/system_users?select=*&user_id=eq.{user_id}'), headers=_headers())
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None

    def user_create(self, user_data):
        """Create a new user"""
        h = _headers(); h['Prefer'] = 'return=representation'
        r = requests.post(_url('/rest/v1/system_users'), headers=h, json=user_data)
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else {}

    def user_update(self, user_id, update_data):
        """Update user information"""
        h = _headers(); h['Prefer'] = 'return=representation'
        r = requests.patch(_url(f'/rest/v1/system_users?user_id=eq.{user_id}'), headers=h, json=update_data)
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None

    def user_delete(self, user_id):
        """Delete a user (soft delete by setting is_active=false)"""
        return self.user_update(user_id, {'is_active': False})

    def user_get_notification_settings(self, user_id):
        """Get user notification settings"""
        r = requests.get(_url(f'/rest/v1/user_notification_settings?select=*&user_id=eq.{user_id}'), headers=_headers())
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None

    def user_update_notification_settings(self, user_id, settings_data):
        """Update or create user notification settings"""
        existing = self.user_get_notification_settings(user_id)
        h = _headers(); h['Prefer'] = 'return=representation'

        if existing:
            r = requests.patch(_url(f'/rest/v1/user_notification_settings?user_id=eq.{user_id}'), headers=h, json=settings_data)
        else:
            settings_data['user_id'] = user_id
            r = requests.post(_url('/rest/v1/user_notification_settings'), headers=h, json=settings_data)

        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None

    def user_get_email(self, user_id):
        """Get notification email for a user"""
        # First try notification settings
        settings = self.user_get_notification_settings(user_id)
        if settings and settings.get('email_address') and settings.get('email_enabled', True):
            return settings['email_address']

        # Fall back to user's primary email
        user = self.user_get_by_id(user_id)
        if user:
            return user.get('email')

        return None

    def users_get_with_email(self):
        """Get all active users with their notification emails"""
        try:
            r = requests.get(_url('/rest/v1/v_users_with_email?select=*'), headers=_headers())
            r.raise_for_status()
            return r.json()
        except:
            # Fallback if view doesn't exist
            users = self.users_get_all(active_only=True)
            result = []
            for user in users:
                user_id = user.get('user_id')
                email = self.user_get_email(user_id)
                user['notification_email'] = email
                result.append(user)
            return result

    def users_get_by_role(self, role):
        """Get users by role"""
        r = requests.get(_url(f'/rest/v1/system_users?select=*&role=eq.{role}&is_active=eq.true'), headers=_headers())
        r.raise_for_status()
        return r.json()

    def users_get_emails_by_role(self, role):
        """Get email addresses of users with specific role"""
        users = self.users_get_by_role(role)
        emails = []
        for user in users:
            email = self.user_get_email(user.get('user_id'))
            if email:
                emails.append(email)
        return emails
