import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from modules.supabase.http_client import get

def main():
    url = os.getenv('SUPABASE_URL')
    anon = os.getenv('SUPABASE_ANON_KEY')
    if not url or not anon:
        raise RuntimeError('缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY')
    rows = get('settlement_analysis', params={'select':'point_id,trend_type', 'limit':'1'})
    print('HTTP 连接成功' if isinstance(rows, list) else 'HTTP 结果异常')
    print(rows)

if __name__ == '__main__':
    main()
