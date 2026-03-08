# -*- coding: utf-8 -*-
"""
初始化悬浮小助手数据库表
"""
import sys
import os

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from modules.database.db_config import get_db_connection

def init_assistant_tables():
    """初始化悬浮小助手数据库表"""
    conn = get_db_connection()
    if not conn:
        print("[错误] 无法连接数据库")
        return False

    cursor = conn.cursor()

    try:
        # 读取 SQL 文件
        sql_file = os.path.join(os.path.dirname(__file__), 'modules', 'assistant', 'schema.sql')
        with open(sql_file, 'r', encoding='utf-8') as f:
            sql_content = f.read()

        # 分割并执行每个 SQL 语句
        statements = sql_content.split(';')
        for statement in statements:
            statement = statement.strip()
            if statement:
                cursor.execute(statement)
                print(f"[成功] 执行 SQL: {statement[:50]}...")

        conn.commit()
        print("[成功] 悬浮小助手数据库表初始化完成")
        return True

    except Exception as e:
        conn.rollback()
        print(f"[错误] 初始化失败: {e}")
        return False

    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    print("开始初始化悬浮小助手数据库表...")
    success = init_assistant_tables()
    sys.exit(0 if success else 1)
