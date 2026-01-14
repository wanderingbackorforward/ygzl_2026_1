import os
import psycopg2
from psycopg2.extras import RealDictCursor

TYPE_NAMES = [
    "auto_ticket_rules_monitoring_type_enum",
    "tbm_monitoring_points_status_enum",
    "work_order_comments_comment_type_enum",
    "work_order_templates_ticket_type_enum",
    "work_order_templates_default_priority_enum",
    "work_orders_ticket_type_enum",
    "work_orders_priority_enum",
    "work_orders_status_enum",
    "work_orders_monitoring_type_enum",
    "work_orders_resolution_type_enum",
]

TABLE_NAMES = [
    "auto_ticket_rules",
    "work_orders",
    "work_order_templates",
    "work_order_comments",
    "ticket_comments",
    "tickets",
]

def main():
    dsn = os.getenv("SUPABASE_DB_URL")
    if not dsn:
        raise RuntimeError("缺少 SUPABASE_DB_URL 环境变量")
    conn = psycopg2.connect(dsn)
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "SELECT typname FROM pg_type WHERE typname = ANY(%s)",
            (TYPE_NAMES,)
        )
        types = {row["typname"] for row in cur.fetchall()}

        cur.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(%s)",
            (TABLE_NAMES,)
        )
        tables = {row["table_name"] for row in cur.fetchall()}

        missing_types = [t for t in TYPE_NAMES if t not in types]
        missing_tables = [t for t in TABLE_NAMES if t not in tables]

        print("类型检查通过" if not missing_types else f"缺失类型: {missing_types}")
        print("表检查通过" if not missing_tables else f"缺失表: {missing_tables}")
    finally:
        conn.close()

if __name__ == "__main__":
    main()

