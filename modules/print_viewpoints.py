# print_viewpoints.py
import mysql.connector
from decimal import Decimal
import json
import os
import sys

# 将项目根目录添加到 Python 路径
# (假设 print_viewpoints.py 在项目根目录, modules 在根目录下)
project_root = os.path.abspath(os.path.dirname(__file__))
sys.path.insert(0, project_root)

# 从共享配置导入数据库信息
try:
    from modules.database.db_config import db_config
except ImportError:
    print("错误：无法导入数据库配置 'modules.database.db_config'。")
    print("请确保此脚本位于项目根目录，并且 'modules' 文件夹存在于根目录下。")
    sys.exit(1)

def format_float(value):
    """将 Decimal 或 float 格式化为保留3位小数的字符串"""
    if isinstance(value, Decimal):
        return f"{value:.3f}"
    elif isinstance(value, float):
        return f"{value:.3f}"
    return str(value) # Fallback

def main():
    conn = None
    try:
        # 使用导入的配置连接数据库
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT point_id, pos_x, pos_y, pos_z, tgt_x, tgt_y, tgt_z FROM viewpoints ORDER BY point_id")
        viewpoints = cursor.fetchall()

        if not viewpoints:
            print("数据库中没有找到视角数据。")
            return

        print("const viewpoints = {")
        for i, row in enumerate(viewpoints):
            point_id_str = json.dumps(row['point_id']) # 使用json.dumps处理引号和转义
            pos_x_str = format_float(row['pos_x'])
            pos_y_str = format_float(row['pos_y'])
            pos_z_str = format_float(row['pos_z'])
            tgt_x_str = format_float(row['tgt_x'])
            tgt_y_str = format_float(row['tgt_y'])
            tgt_z_str = format_float(row['tgt_z'])

            # 构建 JavaScript 对象字面量字符串
            js_object_line = f"    {point_id_str}: {{ position: [{pos_x_str}, {pos_y_str}, {pos_z_str}], target: [{tgt_x_str}, {tgt_y_str}, {tgt_z_str}] }}"
            if i < len(viewpoints) - 1:
                 js_object_line += "," # 添加逗号，除了最后一行

            print(js_object_line)

        print("};")
        print("\n// 将以上内容复制粘贴到 static/js/settlement_background_viewer.js 文件中替换 viewpoints 对象。")


    except mysql.connector.Error as err:
        print(f"数据库错误: {err}")
    finally:
        if conn and conn.is_connected():
            if cursor: # 确保 cursor 存在
                 cursor.close()
            conn.close()

if __name__ == '__main__':
    main()