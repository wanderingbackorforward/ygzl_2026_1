import pandas as pd
import numpy as np
from sqlalchemy import create_engine
from scipy import stats
from datetime import datetime
import mysql.connector
import os
import sys

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# 导入数据库配置
from modules.database.db_config import db_config

def process_data():
    print("开始数据处理与分析...")

    # 创建数据库连接
    engine = create_engine(
        f"mysql+pymysql://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")

    # 读取原始数据
    query = "SELECT * FROM raw_settlement_data ORDER BY measurement_date"
    raw_data = pd.read_sql(query, engine)

    if raw_data.empty:
        print("未找到数据，请先导入数据")
        return False

    print(f"成功读取 {len(raw_data)} 行原始数据")

    # 1. 将宽格式数据转换为长格式（便于处理）
    long_data = pd.melt(
        raw_data,
        id_vars=['measurement_date'],
        value_vars=[col for col in raw_data.columns if col.startswith('S')],
        var_name='point_id',
        value_name='value'
    )

    # 提取point_id中的数字部分用于正确排序
    long_data['point_number'] = long_data['point_id'].str.extract('(\d+)').astype(int)
    long_data = long_data.sort_values(['point_number', 'measurement_date'])
    # 完成排序后可以删除临时列
    long_data = long_data.drop(columns=['point_number'])

    # 2. 计算日变化率和累积变化
    # 为每个监测点计算首次测量值
    baseline = long_data.groupby('point_id')['value'].first().reset_index()
    baseline_dict = dict(zip(baseline['point_id'], baseline['value']))

    # 添加基准值列
    long_data['baseline'] = long_data['point_id'].map(baseline_dict)

    # 计算累积变化（当前值 - 基准值）
    long_data['cumulative_change'] = long_data['value'] - long_data['baseline']

    # 计算日变化率（当前值 - 前一天值）
    long_data['daily_change'] = long_data.groupby('point_id')['value'].diff()

    # 3. 保存处理后的数据
    # 选择需要的列
    processed_data = long_data[['measurement_date', 'point_id', 'value', 'daily_change', 'cumulative_change']]

    # 写入MySQL
    processed_data.to_sql('processed_settlement_data', engine, if_exists='replace', index=False)

    print(f"成功保存 {len(processed_data)} 行处理后数据")

    # 4. 进行统计分析
    analysis_results = []

    # 获取所有监测点
    point_ids = processed_data['point_id'].unique()

    for point_id in point_ids:
        # 获取该监测点的所有数据
        point_data = processed_data[processed_data['point_id'] == point_id]

        # 获取有效的测量值（排除NaN）
        values = point_data['value'].dropna()

        if len(values) < 2:
            print(f"警告: 监测点 {point_id} 数据不足，跳过分析")
            continue

        # 计算基本统计量
        min_value = values.min()
        max_value = values.max()
        avg_value = values.mean()
        std_dev = values.std()
        total_change = values.iloc[-1] - values.iloc[0]

        # 计算平均日变化率
        time_diff = (point_data['measurement_date'].max() - point_data['measurement_date'].min()).total_seconds() / (
                    24 * 3600)
        avg_daily_rate = total_change / max(time_diff, 1)

        # 计算最大日变化率
        daily_changes = point_data['daily_change'].abs().dropna()
        max_daily_rate = daily_changes.max() if not daily_changes.empty else 0

        # 线性回归分析趋势
        # 转换日期为数值型(天数)
        days = (point_data['measurement_date'] - point_data['measurement_date'].min()).dt.total_seconds() / (24 * 3600)

        # 排除NaN值
        valid_mask = ~point_data['value'].isna()
        valid_days = days[valid_mask].values
        valid_values = point_data['value'][valid_mask].values

        # 执行线性回归
        if len(valid_days) > 1:
            slope, intercept, r_value, p_value, std_err = stats.linregress(valid_days, valid_values)
        else:
            slope = r_value = p_value = 0

        # 判断趋势类型
        if p_value < 0.05:
            if slope < -0.1:
                trend_type = "显著下沉"
                alert_level = "高风险"
            elif slope > 0.1:
                trend_type = "显著隆起"
                alert_level = "中风险"
            else:
                trend_type = "轻微变化"
                alert_level = "低风险"
        else:
            trend_type = "无显著趋势"
            alert_level = "正常"

        # 保存分析结果
        analysis_results.append({
            'point_id': point_id,
            'min_value': min_value,
            'max_value': max_value,
            'avg_value': avg_value,
            'std_deviation': std_dev,
            'trend_slope': slope,
            'r_squared': r_value ** 2,
            'p_value': p_value,
            'trend_type': trend_type,
            'total_change': total_change,
            'avg_daily_rate': avg_daily_rate,
            'max_daily_rate': max_daily_rate,
            'alert_level': alert_level,
            'last_updated': datetime.now()
        })

    # 转换为DataFrame
    analysis_df = pd.DataFrame(analysis_results)

    # 添加用于排序的临时列，提取point_id的数字部分
    analysis_df['point_number'] = analysis_df['point_id'].str.extract('(\d+)').astype(int)
    
    # 按照编号排序
    analysis_df = analysis_df.sort_values('point_number')
    
    # 删除临时排序列
    analysis_df = analysis_df.drop(columns=['point_number'])

    # 保存分析结果到MySQL
    analysis_df.to_sql('settlement_analysis', engine, if_exists='replace', index=False)

    print(f"成功保存 {len(analysis_df)} 个监测点的分析结果")

    return True

if __name__ == "__main__":
    process_data()