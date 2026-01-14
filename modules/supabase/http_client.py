import os
import requests

def _headers():
    url = os.getenv('SUPABASE_URL')
    anon = os.getenv('SUPABASE_ANON_KEY')
    service = os.getenv('SUPABASE_SERVICE_ROLE')
    if not url or not anon:
        raise RuntimeError('缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY')
    h = {'apikey': anon, 'Content-Type': 'application/json'}
    token = service or anon
    if '.' in token:
        h['Authorization'] = f'Bearer {token}'
    return url, h

def get(table, params=None):
    url, h = _headers()
    base = url.rstrip('/') + '/rest/v1/' + table
    r = requests.get(base, headers=h, params=params or {})
    if r.status_code >= 400:
        raise RuntimeError(f'HTTP {r.status_code}: {r.text}')
    return r.json()

def upsert(table, payload, on_conflict=None):
    url, h = _headers()
    base = url.rstrip('/') + '/rest/v1/' + table
    q = {}
    if on_conflict:
        q['on_conflict'] = on_conflict
    r = requests.post(base, headers={**h, 'Prefer': 'resolution=merge-duplicates'}, params=q, json=payload)
    if r.status_code >= 400:
        raise RuntimeError(f'HTTP {r.status_code}: {r.text}')
    return r.json() if r.text else {}
