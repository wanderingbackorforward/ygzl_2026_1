import os
from .repos.mysql_repo import MySQLRepo
from .repos.supabase_http_repo import SupabaseHttpRepo

def get_repo():
    v = os.environ.get('DB_VENDOR', '').strip().lower()
    if v == 'supabase_http':
        return SupabaseHttpRepo()
    return MySQLRepo()
