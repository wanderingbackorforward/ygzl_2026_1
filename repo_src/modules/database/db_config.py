# 数据库连接配置
db_config = {
    'user': 'root',
    'password': '123456',
    'host': 'localhost',
    'database': 'settlement_monitoring'
}

import mysql.connector
from contextlib import contextmanager

def get_db_connection():
    """创建数据库连接"""
    try:
        conn = mysql.connector.connect(**db_config)
        return conn
    except mysql.connector.Error as err:
        print(f"数据库连接错误: {err}")
        return None

@contextmanager
def get_db_cursor():
    """创建数据库连接和游标的上下文管理器"""
    conn = get_db_connection()
    if conn is None:
        raise Exception("无法建立数据库连接")

    try:
        cursor = conn.cursor(dictionary=True)
        yield cursor
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()