import os

def is_supabase_http():
    return os.getenv('SUPABASE_USE_HTTP', '0') == '1' or os.getenv('DB_VENDOR', '').lower() == 'supabase_http'

