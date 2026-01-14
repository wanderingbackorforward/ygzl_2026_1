import mysql.connector
import numpy as np
import os
import sys

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# 导入数据库配置
from modules.database.db_config import db_config

def update_monitoring_points():
    """更新监测点的3D坐标信息"""
    print("开始更新监测点坐标信息...")

    try:
        # 连接到MySQL
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()

        # 获取所有监测点
        cursor.execute("SELECT point_id FROM monitoring_points")
        points = cursor.fetchall()

        if not points:
            print("未找到监测点信息，请先确保monitoring_points表中有数据")
            return False

        print(f"发现{len(points)}个监测点，准备更新坐标")

        # 创建一个简单的坐标分布（可根据实际情况调整）
        # 这里使用一个简单的网格布局
        grid_size = int(np.ceil(np.sqrt(len(points))))
        spacing = 1.0  # 点之间的间距

        for i, (point_id,) in enumerate(points):
            # 计算行和列位置
            row = i // grid_size
            col = i % grid_size

            # 设置x, y, z坐标
            x_coord = col * spacing
            z_coord = row * spacing
            y_coord = 0.5  # 默认高度

            # 更新数据库
            update_query = """
            UPDATE monitoring_points
            SET x_coord = %s, y_coord = %s, z_coord = %s
            WHERE point_id = %s
            """
            cursor.execute(update_query, (x_coord, y_coord, z_coord, point_id))

            print(f"更新监测点 {point_id} 坐标为 ({x_coord}, {y_coord}, {z_coord})")

        # 提交事务
        conn.commit()

        # 验证更新
        cursor.execute("SELECT point_id, x_coord, y_coord, z_coord FROM monitoring_points")
        updated_points = cursor.fetchall()
        print("\n更新后的监测点坐标:")
        for point in updated_points:
            print(f"{point[0]}: ({point[1]}, {point[2]}, {point[3]})")

        cursor.close()
        conn.close()

        print("监测点坐标更新完成")
        return True

    except mysql.connector.Error as err:
        print(f"数据库操作失败: {err}")
        return False

if __name__ == "__main__":
    update_monitoring_points()