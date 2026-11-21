# -*- coding: utf-8 -*-
"""
PostgREST -> MySQL 兼容层

背景：后端有一批模块（ML、悬浮助手、工单、高级分析、巡检）直接按 Supabase
PostgREST 的写法调 `{SUPABASE_URL}/rest/v1/<table>?...`。为了彻底摆脱 Supabase，
这里提供一个 requests 兼容对象：凡是 `/rest/v1/` 的请求，直接翻译成 MySQL 查询；
其余请求（大模型、Webhook 等）原样转发给真正的 requests。

用法：把这些模块里的 `import requests` 换成
      `from modules.db.http_compat import requests`
其余代码一行不用改。
"""

import json
import re
import decimal
import datetime as _dt
from urllib.parse import urlparse, unquote

import requests as _real_requests
import mysql.connector

from modules.database.db_config import db_config


_TABLE_RE = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')
_SYS_KEYS = {'select', 'order', 'limit', 'offset', 'on_conflict'}
_meta_cache = {}


class Response:
    """极简 requests.Response 兼容对象"""

    def __init__(self, data=None, status_code=200, headers=None):
        self._data = data
        self.status_code = status_code
        self.headers = headers or {}
        try:
            self.text = json.dumps(data, ensure_ascii=False, default=str)
        except Exception:
            self.text = str(data)

    def json(self):
        return self._data

    @property
    def ok(self):
        return self.status_code < 400

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f'HTTP {self.status_code}: {self.text}')


def _connect():
    return mysql.connector.connect(**db_config)


def _meta(table):
    """返回 (列名->类型, 主键列列表)"""
    if table in _meta_cache:
        return _meta_cache[table]
    conn = _connect()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA=%s AND TABLE_NAME=%s ORDER BY ORDINAL_POSITION",
            (db_config['database'], table),
        )
        rows = cur.fetchall()
        cur.close()
    finally:
        conn.close()
    if not rows:
        raise LookupError(f"table `{table}` not found in {db_config['database']}")
    cols = {r[0].lower(): (r[1] or '').lower() for r in rows}
    pk = [r[0] for r in rows if (r[2] or '') == 'PRI']
    _meta_cache[table] = (cols, pk)
    return cols, pk


def _bind(coltype, value):
    """把 JSON 值转换成可以交给 mysql.connector 的参数"""
    if value is None:
        return None
    if isinstance(value, bool):
        return 1 if value else 0
    if coltype == 'json':
        if isinstance(value, str):
            try:
                json.loads(value)
                return value
            except Exception:
                return json.dumps(value, ensure_ascii=False)
        return json.dumps(value, ensure_ascii=False)
    if coltype in ('tinyint', 'smallint', 'mediumint', 'int', 'bigint', 'bit'):
        if isinstance(value, str):
            s = value.strip().lower()
            if s in ('true', 'false'):
                return 1 if s == 'true' else 0
            if s == '':
                return None
    if coltype in ('date', 'datetime', 'timestamp'):
        if isinstance(value, str):
            s = value.strip()
            if s.lower() in ('now()', 'now'):
                return _dt.datetime.now()
            if s.endswith('Z'):
                s = s[:-1]
            s = re.sub(r'([+-]\d{2}:?\d{2})$', '', s)
            s = s.replace('T', ' ')
            return s
    return value


def _clean_row(row, cols):
    out = {}
    for key, value in row.items():
        coltype = cols.get(key.lower())
        if value is None:
            out[key] = None
        elif coltype == 'json' and isinstance(value, str):
            try:
                out[key] = json.loads(value)
            except Exception:
                out[key] = value
        elif isinstance(value, _dt.datetime):
            out[key] = value.isoformat(sep='T')
        elif isinstance(value, _dt.date):
            out[key] = value.isoformat()
        elif isinstance(value, _dt.timedelta):
            out[key] = str(value)
        elif isinstance(value, decimal.Decimal):
            out[key] = float(value)
        elif isinstance(value, bytes):
            out[key] = value.decode('utf-8', 'ignore')
        else:
            out[key] = value
    return out


def _qval(pairs, key):
    for raw in pairs:
        if '=' not in raw:
            continue
        k, v = raw.split('=', 1)
        if k.strip() == key:
            return unquote(v)
    return None


def _build_where(pairs, cols):
    conds = []
    params = []
    for raw in pairs:
        if '=' not in raw:
            continue
        key, val = raw.split('=', 1)
        col = key.strip()
        if col in _SYS_KEYS or col.lower().startswith('not.'):
            if not col.lower().startswith('not.'):
                continue
            col = col[4:]
        if col.lower() not in cols:
            continue  # 列不存在就忽略，兼容老/新 schema 差异
        val = unquote(val)
        neg = False
        if val.startswith('not.'):
            neg = True
            val = val[4:]

        if val.startswith('is.'):
            target = val[3:].strip().lower()
            if target == 'null':
                conds.append(f"`{col}` IS {'NOT ' if neg else ''}NULL")
            elif target in ('true', 'false'):
                conds.append(f"`{col}` {'!=' if neg else '='} %s")
                params.append(1 if target == 'true' else 0)
            continue

        if val.startswith('in.(') and val.endswith(')'):
            items = [x for x in val[4:-1].split(',')]
            placeholders = ','.join(['%s'] * len(items))
            conds.append(f"`{col}` {'NOT ' if neg else ''}IN ({placeholders})")
            params.extend([_bind(cols[col.lower()], x) for x in items])
            continue

        if '.' not in val:
            continue
        op, v = val.split('.', 1)
        op = op.lower()
        v = unquote(v)
        sqlop = {
            'eq': '=', 'neq': '!=', 'gt': '>', 'gte': '>=',
            'lt': '<', 'lte': '<=', 'like': 'LIKE', 'ilike': 'LIKE',
        }.get(op)
        if not sqlop:
            continue
        if v.upper() == 'NULL':
            conds.append(f"`{col}` IS {'NOT ' if neg else ''}NULL")
            continue
        if op in ('like', 'ilike'):
            v = v.replace('*', '%')
        conds.append(f"`{col}` {sqlop} %s")
        params.append(_bind(cols[col.lower()], v))

    where = (' WHERE ' + ' AND '.join(conds)) if conds else ''
    return where, params


def _select_clause(pairs, cols):
    select = _qval(pairs, 'select') or '*'
    if select.strip() == '*':
        return '*'
    names = [n.strip() for n in select.split(',') if n.strip()]
    valid = [n for n in names if n.lower() in cols]
    if not valid:
        return '*'
    return ', '.join(f'`{n}`' for n in valid)


def _order_clause(pairs, cols):
    order = _qval(pairs, 'order')
    if not order:
        return ''
    parts = []
    for item in order.split(','):
        item = item.strip()
        if not item:
            continue
        bits = item.split('.')
        col = bits[0].strip()
        if col.lower() not in cols:
            continue
        direction = 'DESC' if len(bits) > 1 and bits[1].lower() == 'desc' else 'ASC'
        parts.append(f'`{col}` {direction}')
    return (' ORDER BY ' + ', '.join(parts)) if parts else ''


def _limit_clause(pairs):
    sql = ''
    limit = _qval(pairs, 'limit')
    offset = _qval(pairs, 'offset')
    if offset and str(offset).isdigit():
        sql += f' OFFSET {int(offset)}'
    if limit and str(limit).isdigit():
        # MySQL 要求 LIMIT 在 OFFSET 前面，这里重新拼
        sql = f' LIMIT {int(limit)}'
        if offset and str(offset).isdigit():
            sql += f' OFFSET {int(offset)}'
    return sql


def _prefer(kwargs):
    headers = kwargs.get('headers') or {}
    return str(headers.get('Prefer') or headers.get('prefer') or '')


def _do_get(table, pairs, kwargs):
    cols, _pk = _meta(table)
    where, params = _build_where(pairs, cols)
    sql = f"SELECT {_select_clause(pairs, cols)} FROM `{table}`{where}{_order_clause(pairs, cols)}{_limit_clause(pairs)}"
    conn = _connect()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, tuple(params)) if params else cur.execute(sql)
        rows = cur.fetchall()
        cur.close()
    finally:
        conn.close()
    data = [_clean_row(r, cols) for r in rows]
    return Response(data, 200, {'Content-Range': f'0-{max(len(data) - 1, 0)}/{len(data)}'})


def _do_post(table, pairs, kwargs):
    cols, pk = _meta(table)
    body = kwargs.get('json')
    if body is None and kwargs.get('data') is not None:
        raw = kwargs['data']
        body = json.loads(raw) if isinstance(raw, str) else raw
    if isinstance(body, dict):
        rows = [body]
        single = True
    elif isinstance(body, list):
        rows = body
        single = False
    else:
        rows = []
        single = False

    prefer = _prefer(kwargs)
    upsert = 'resolution=merge-duplicates' in prefer
    on_conflict = _qval(pairs, 'on_conflict')
    conflict_cols = [c.strip() for c in on_conflict.split(',')] if on_conflict else pk

    conn = _connect()
    results = []
    try:
        cur = conn.cursor(dictionary=True)
        for row in rows:
            keys = [k for k in row.keys() if k.lower() in cols]
            if not keys:
                continue
            values = [_bind(cols[k.lower()], row[k]) for k in keys]
            placeholders = ','.join(['%s'] * len(keys))
            sql = f"INSERT INTO `{table}` ({','.join(f'`{k}`' for k in keys)}) VALUES ({placeholders})"
            if upsert:
                non_conflict = [k for k in keys if k not in conflict_cols]
                if non_conflict:
                    updates = ','.join(f'`{k}`=VALUES(`{k}`)' for k in non_conflict)
                else:
                    anchor = conflict_cols[0] if conflict_cols else keys[0]
                    updates = f'`{anchor}`=`{anchor}`'
                sql += f' ON DUPLICATE KEY UPDATE {updates}'
            cur.execute(sql, values)

            crit = {}
            for c in conflict_cols:
                if c in row:
                    crit[c] = row[c]
            if not crit and len(pk) == 1:
                crit[pk[0]] = cur.lastrowid
            if not crit:
                for c in pk:
                    if c in row:
                        crit[c] = row[c]
            if crit:
                w = ' AND '.join(f'`{c}`=%s' for c in crit)
                cur.execute(
                    f"SELECT * FROM `{table}` WHERE {w}",
                    tuple(_bind(cols[c.lower()], v) for c, v in crit.items()),
                )
                got = cur.fetchone()
                results.append(_clean_row(got, cols) if got else _clean_row(row, cols))
            else:
                results.append(_clean_row(row, cols))
        conn.commit()
        cur.close()
    finally:
        conn.close()

    if 'return=representation' in prefer:
        return Response(results, 201)
    return Response(None, 201)


def _do_patch(table, pairs, kwargs):
    cols, _pk = _meta(table)
    body = kwargs.get('json')
    if body is None and kwargs.get('data') is not None:
        raw = kwargs['data']
        body = json.loads(raw) if isinstance(raw, str) else raw
    body = body or {}
    if not isinstance(body, dict) or not body:
        return Response([], 200)
    keys = [k for k in body.keys() if k.lower() in cols]
    if not keys:
        return Response([], 200)
    values = [_bind(cols[k.lower()], body[k]) for k in keys]
    where, where_params = _build_where(pairs, cols)
    sql = f"UPDATE `{table}` SET {','.join(f'`{k}`=%s' for k in keys)}{where}"
    conn = _connect()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, tuple(values + where_params))
        conn.commit()
        rows = []
        if 'return=representation' in _prefer(kwargs):
            cur.execute(f"SELECT * FROM `{table}`{where}", tuple(where_params)) if where_params else cur.execute(f"SELECT * FROM `{table}`{where}")
            rows = [_clean_row(r, cols) for r in cur.fetchall()]
        cur.close()
    finally:
        conn.close()
    return Response(rows, 200)


def _do_delete(table, pairs, kwargs):
    cols, _pk = _meta(table)
    where, params = _build_where(pairs, cols)
    conn = _connect()
    try:
        cur = conn.cursor()
        cur.execute(f"DELETE FROM `{table}`{where}", tuple(params)) if params else cur.execute(f"DELETE FROM `{table}`{where}")
        conn.commit()
        cur.close()
    finally:
        conn.close()
    return Response(None, 204)


def _merge_params(pairs, params):
    if not params:
        return pairs
    merged = list(pairs)
    for key, value in params.items():
        if value is None:
            merged.append(f'{key}=')
        else:
            merged.append(f'{key}={value}')
    return merged


def _dispatch(method, url, kwargs):
    parsed = urlparse(url)
    path = parsed.path or ''
    if '/rest/v1/' not in path:
        return getattr(_real_requests, method.lower())(url, **kwargs)

    table = path.split('/rest/v1/', 1)[1].strip('/').split('/')[0]
    if not _TABLE_RE.match(table):
        return Response({'message': f'invalid table {table}'}, 400)

    pairs = [p for p in (parsed.query or '').split('&') if p]
    pairs = _merge_params(pairs, kwargs.get('params'))

    try:
        if method == 'GET':
            return _do_get(table, pairs, kwargs)
        if method == 'POST':
            return _do_post(table, pairs, kwargs)
        if method == 'PATCH':
            return _do_patch(table, pairs, kwargs)
        if method == 'DELETE':
            return _do_delete(table, pairs, kwargs)
    except LookupError as e:
        return Response({'message': str(e)}, 404)
    except mysql.connector.Error as e:
        return Response({'message': str(e)}, 400)
    return Response({'message': f'unsupported method {method}'}, 405)


class _RequestsCompat:
    exceptions = _real_requests.exceptions
    RequestException = _real_requests.RequestException

    @staticmethod
    def get(url, **kwargs):
        return _dispatch('GET', url, kwargs)

    @staticmethod
    def post(url, **kwargs):
        return _dispatch('POST', url, kwargs)

    @staticmethod
    def patch(url, **kwargs):
        return _dispatch('PATCH', url, kwargs)

    @staticmethod
    def delete(url, **kwargs):
        return _dispatch('DELETE', url, kwargs)

    @staticmethod
    def put(url, **kwargs):
        return _dispatch('PUT', url, kwargs)


requests = _RequestsCompat()
