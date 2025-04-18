import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta
import os


def generate_settlement_data():
    """生成沉降监测的示例数据"""
    # 创建日期范围 - 每周一个测量点，持续一年
    start_date = datetime(2023, 1, 1)  # 2024年数据
    dates = [start_date + timedelta(days=i * 7) for i in range(52)]

    # 创建一个DataFrame，第一列是日期
    df = pd.DataFrame({'measurement_date': dates})

    # 定义不同类型的趋势模式
    trend_patterns = {
        'stable': lambda i: 0,  # 稳定，无趋势
        'significant_subsidence': lambda i: -0.2 * i / 52,  # 显著下沉
        'significant_rise': lambda i: 0.2 * i / 52,  # 显著隆起
        'minor_change': lambda i: 0.05 * i / 52 if random.random() > 0.5 else -0.05 * i / 52  # 轻微变化
    }

    # 假设有25个监测点 S1-S25
    n_points = 25
    point_types = {}

    # 分配趋势类型，确保各种类型都有代表
    for i in range(1, n_points + 1):
        if i <= 8:
            trend_type = 'significant_subsidence'  # 8个点显著下沉
        elif i <= 16:
            trend_type = 'stable'  # 8个点稳定
        elif i <= 24:
            trend_type = 'minor_change'  # 8个点轻微变化
        else:
            trend_type = 'significant_rise'  # 6个点显著隆起

        point_types[f"S{i}"] = trend_type

    # 这里不再打乱监测点的顺序，而是保持S1, S2, S3...的顺序
    # 移除下面这两行代码:
    # items = list(point_types.items())
    # random.shuffle(items)
    # point_types = dict(items)

    # 为每个监测点生成数据
    for point_id, trend_type in point_types.items():
        # 基础值 - 在15到25之间随机
        base_value = random.uniform(15, 25)

        # 获取该点的趋势函数
        trend_func = trend_patterns[trend_type]

        # 生成该监测点的时间序列数据
        values = []
        for i, date in enumerate(dates):
            # 应用趋势和随机波动
            trend = trend_func(i)
            # 随机波动较小，以便观察趋势
            random_factor = random.uniform(-0.05, 0.05)
            value = base_value * (1 + trend + random_factor)
            values.append(round(value, 3))  # 保留3位小数

        # 添加到DataFrame
        df[point_id] = values

    return df


def save_excel(df, filename='新_沉降分析原始数据_2023.xlsx'):
    # 保存为Excel文件
    df.to_excel(filename, index=False)
    print(f"已生成沉降分析示例数据并保存到: {filename}")
    print(
        f"数据中包含 {len(df.columns) - 1} 个监测点，时间跨度为 {df['measurement_date'].min().strftime('%Y-%m-%d')} 到 {df['measurement_date'].max().strftime('%Y-%m-%d')}")

    # 打印趋势分布统计
    print("\n生成的数据趋势分布:")
    print("- 显著下沉的监测点：7个")
    print("- 显著隆起的监测点：4个")
    print("- 轻微变化的监测点：7个")
    print("- 稳定无变化的监测点：7个")


def create_monitoring_points_table():
    """创建监测点表SQL语句"""
    sql = """
    -- 创建monitoring_points表（如果不存在）
    CREATE TABLE IF NOT EXISTS monitoring_points (
        id INT AUTO_INCREMENT PRIMARY KEY,
        point_id VARCHAR(10) NOT NULL UNIQUE,
        x_coord FLOAT DEFAULT 0,
        y_coord FLOAT DEFAULT 0,
        z_coord FLOAT DEFAULT 0,
        installation_date DATE,
        description TEXT
    );

    -- 插入监测点数据
    INSERT IGNORE INTO monitoring_points (point_id, installation_date, description)
    VALUES 
    """

    # 生成25个监测点的插入语句
    values = []
    for i in range(1, 31):
        install_date = datetime(2023, 12, 15) + timedelta(days=random.randint(0, 10))
        desc = f"监测点{i} - {'地面' if i % 2 == 0 else '结构'}"
        values.append(f"('S{i}', '{install_date.strftime('%Y-%m-%d')}', '{desc}')")

    sql += ",\n    ".join(values) + ";"

    # 保存SQL文件
    with open("create_monitoring_points.sql", "w", encoding="utf-8") as f:
        f.write(sql)

    print("已生成监测点表创建SQL脚本: create_monitoring_points.sql")


if __name__ == "__main__":
    # 生成Excel数据
    df = generate_settlement_data()
    save_excel(df)

    # 生成监测点表SQL
    create_monitoring_points_table()

    print("\n使用说明:")
    print("1. 先将SQL脚本导入MySQL数据库，创建监测点表")
    print("2. 启动沉降监测系统")
    print("3. 使用上传功能上传生成的Excel文件")