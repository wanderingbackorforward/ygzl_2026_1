import os
import re
from pathlib import Path
from typing import List

import psycopg2

BASE_DIR = Path(__file__).resolve().parent.parent
SQL_DIR = BASE_DIR / "supabase" / "sql"

def load_env():
    env_path = BASE_DIR / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

def expand_includes(sql_path: Path) -> str:
    content_lines: List[str] = []
    base = sql_path.parent
    for line in sql_path.read_text(encoding="utf-8").splitlines():
        m = re.match(r'^\s*\\i\s+(.+)$', line)
        if m:
            inc = m.group(1).strip()
            inc_path = (base / inc).resolve()
            content_lines.append(Path(inc_path).read_text(encoding="utf-8"))
        else:
            content_lines.append(line)
    return "\n".join(content_lines)

def collect_sql_files() -> List[Path]:
    if not SQL_DIR.exists():
        raise FileNotFoundError(f"SQL 目录不存在: {SQL_DIR}")
    files = [p for p in SQL_DIR.iterdir() if p.suffix.lower() == ".sql"]
    def order_key(p: Path):
        name = p.name
        m = re.match(r'^(\d+)_', name)
        return int(m.group(1)) if m else 99999
    return sorted(files, key=order_key)

def run():
    load_env()
    dsn = os.getenv("SUPABASE_DB_URL")
    if not dsn:
        raise RuntimeError("缺少 SUPABASE_DB_URL 环境变量")
    conn = psycopg2.connect(dsn)
    try:
        conn.autocommit = True
        cur = conn.cursor()
        for sql_file in collect_sql_files():
            print(f"执行迁移: {sql_file.name}")
            sql_text = expand_includes(sql_file)
            cur.execute(sql_text)
        print("全部迁移执行完成")
        cur.close()
    finally:
        conn.close()

if __name__ == "__main__":
    run()

