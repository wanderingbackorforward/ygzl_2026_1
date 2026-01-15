import pandas as pd
import numpy as np
import mysql.connector
from sqlalchemy import create_engine
import os
import sys
import datetime

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# 导入数据库配置
from modules.database.db_config import db_config


def process_crack_data():
    """
    处理裂缝数据并更新监测点信息

    1. 从raw_crack_data表读取数据
    2. 计算每个监测点的统计信息
    3. 更新crack_monitoring_points表
    4. 更新crack_analysis_results表
    """
    try:
        # 创建数据库连接
        engine = create_engine(
            f"mysql+pymysql://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")

        # 从数据库读取原始数据
        query = "SELECT * FROM raw_crack_data ORDER BY measurement_date"
        df = pd.read_sql(query, engine)

        if df.empty:
            print("没有找到裂缝数据")
            return False

        # 设置日期索引
        df.set_index('measurement_date', inplace=True)

        # 删除id列
        if 'id' in df.columns:
            df.drop(columns=['id'], inplace=True)

        print(f"成功读取 {len(df)} 行裂缝数据，包含 {len(df.columns)} 个监测点")

        # 计算基础统计信息
        stats_df = calculate_basic_stats(df)

        # 分析趋势
        trend_df = analyze_trends(df)

        # 合并统计和趋势信息
        monitoring_points_df = pd.DataFrame(index=df.columns)
        for col in stats_df.columns:
            monitoring_points_df[col] = stats_df[col]
        for col in trend_df.columns:
            monitoring_points_df[col] = trend_df[col]

        # 更新监测点表
        update_monitoring_points(monitoring_points_df, engine)

        # 更新分析结果表
        update_analysis_results(stats_df, engine)

        print("裂缝数据处理完成")
        return True

    except Exception as e:
        print(f"处理裂缝数据失败: {str(e)}")
        return False


def calculate_basic_stats(df):
    """计算裂缝数据的基础统计指标"""
    # 类似于crack_analyze.py中的calculate_basic_stats函数
    stats_df = pd.DataFrame(index=df.columns)

    # 计算监测总时长（天）
    first_valid_date = {}
    last_valid_date = {}
    monitoring_duration = {}

    for column in df.columns:
        non_null = df[column].dropna()
        if len(non_null) >= 2:
            first_valid_date[column] = non_null.index[0]
            last_valid_date[column] = non_null.index[-1]
            monitoring_duration[column] = (last_valid_date[column] - first_valid_date[column]).total_seconds() / (
                        24 * 3600)
        else:
            first_valid_date[column] = None
            last_valid_date[column] = None
            monitoring_duration[column] = np.nan

    # 计算基本统计量
    stats_df['数据点数'] = df.count()
    stats_df['最小值'] = df.min()
    stats_df['最大值'] = df.max()
    stats_df['平均值'] = df.mean()
    stats_df['中位数'] = df.median()
    stats_df['标准差'] = df.std()
    stats_df['变异系数'] = stats_df['标准差'] / stats_df['平均值'].abs()
    stats_df['25%分位数'] = df.quantile(0.25)
    stats_df['75%分位数'] = df.quantile(0.75)
    stats_df['IQR'] = stats_df['75%分位数'] - stats_df['25%分位数']

    # 计算起止值和变化量
    for column in df.columns:
        if first_valid_date[column] is not None and last_valid_date[column] is not None:
            stats_df.loc[column, '初始值'] = df.loc[first_valid_date[column], column]
            stats_df.loc[column, '最终值'] = df.loc[last_valid_date[column], column]
            stats_df.loc[column, '总变化量'] = stats_df.loc[column, '最终值'] - stats_df.loc[column, '初始值']

            # 计算平均变化率（每天）
            if monitoring_duration[column] > 0:
                stats_df.loc[column, '平均变化率(每天)'] = stats_df.loc[column, '总变化量'] / monitoring_duration[
                    column]
            else:
                stats_df.loc[column, '平均变化率(每天)'] = np.nan

            # 标记变化类型
            if abs(stats_df.loc[column, '总变化量']) < 0.01:  # 变化量小于0.01mm视为稳定
                stats_df.loc[column, '变化类型'] = '稳定'
            elif stats_df.loc[column, '总变化量'] > 0:
                stats_df.loc[column, '变化类型'] = '扩展'
            else:
                stats_df.loc[column, '变化类型'] = '收缩'

            # 添加监测时长信息
            stats_df.loc[column, '监测起始日期'] = first_valid_date[column]
            stats_df.loc[column, '监测结束日期'] = last_valid_date[column]
            stats_df.loc[column, '监测天数'] = monitoring_duration[column]
        else:
            stats_df.loc[column, '初始值'] = np.nan
            stats_df.loc[column, '最终值'] = np.nan
            stats_df.loc[column, '总变化量'] = np.nan
            stats_df.loc[column, '平均变化率(每天)'] = np.nan
            stats_df.loc[column, '变化类型'] = '数据不足'
            stats_df.loc[column, '监测起始日期'] = np.nan
            stats_df.loc[column, '监测结束日期'] = np.nan
            stats_df.loc[column, '监测天数'] = np.nan

    return stats_df


def analyze_trends(df):
    """分析每个监测点的趋势，计算斜率和确定趋势类型"""
    # 类似于crack_analyze.py中的analyze_trends函数
    trends = pd.DataFrame(index=df.columns)

    for column in df.columns:
        valid_data = df[column].dropna()
        if len(valid_data) < 2:
            trends.loc[column, '斜率(mm/天)'] = np.nan
            trends.loc[column, '趋势类型'] = "数据不足"
            trends.loc[column, 'R值'] = np.nan
            trends.loc[column, 'P值'] = np.nan
            continue

        # 计算有效数据点的时间差（以天为单位）
        time_deltas = (valid_data.index - valid_data.index[0]).total_seconds() / (24 * 3600)

        # 线性回归（使用 numpy 计算斜率与相关系数）
        slope, intercept = np.polyfit(time_deltas, valid_data.values, 1)
        if np.std(time_deltas) > 0 and np.std(valid_data.values) > 0:
            r_value = float(np.corrcoef(time_deltas, valid_data.values)[0, 1])
        else:
            r_value = 0.0
        p_value = None

        trends.loc[column, '斜率(mm/天)'] = slope
        trends.loc[column, 'R值'] = r_value
        trends.loc[column, 'P值'] = p_value

        # 判断趋势类型
        if slope > 0.1:
            tt = '显著扩展'
        elif slope < -0.1:
            tt = '显著收缩'
        elif abs(slope) > 0.02:
            tt = '轻微变化'
        else:
            tt = '无显著趋势'
        trends.loc[column, '趋势类型'] = tt

    return trends


def update_monitoring_points(df, engine):
    """更新裂缝监测点表"""
    conn = engine.connect()

    # 将DataFrame转置，让每个point_id成为行索引
    df_transposed = df.transpose()

    # 逐行处理每个监测点
    for point_id in df.index:
        try:
            # 检查该监测点是否已存在
            check_sql = f"SELECT COUNT(*) FROM crack_monitoring_points WHERE point_id = '{point_id}'"
            result = conn.execute(check_sql)
            exists = result.fetchone()[0] > 0

            # 准备数据
            data = {
                'point_id': point_id,
                'description': f'裂缝监测点 {point_id}',
                'location': '未知',
                'initial_value': df.loc[point_id, '初始值'] if '初始值' in df.columns else None,
                '`last_value`': df.loc[point_id, '最终值'] if '最终值' in df.columns else None,  # 注意这里的转义
                'total_change': df.loc[point_id, '总变化量'] if '总变化量' in df.columns else None,
                'average_change_rate': df.loc[
                    point_id, '平均变化率(每天)'] if '平均变化率(每天)' in df.columns else None,
                'change_type': df.loc[point_id, '变化类型'] if '变化类型' in df.columns else None,
                'monitoring_start_date': df.loc[point_id, '监测起始日期'] if '监测起始日期' in df.columns else None,
                'monitoring_end_date': df.loc[point_id, '监测结束日期'] if '监测结束日期' in df.columns else None,
                'trend_slope': df.loc[point_id, '斜率(mm/天)'] if '斜率(mm/天)' in df.columns else None,
                'trend_type': df.loc[point_id, '趋势类型'] if '趋势类型' in df.columns else None,
                'r_value': df.loc[point_id, 'R值'] if 'R值' in df.columns else None,
                'p_value': df.loc[point_id, 'P值'] if 'P值' in df.columns else None,
                'status': 'active'
            }

            # 构建SQL查询
            if exists:
                # 更新现有记录
                set_parts = []
                params = []

                for key, value in data.items():
                    if key != 'point_id':
                        # 处理带反引号的key
                        if key.startswith('`') and key.endswith('`'):
                            set_parts.append(f"{key} = %s")
                        else:
                            set_parts.append(f"{key} = %s")
                        params.append(value)

                params.append(point_id)  # WHERE条件的参数

                update_sql = f"UPDATE crack_monitoring_points SET {', '.join(set_parts)} WHERE point_id = %s"
                conn.execute(update_sql, params)
                print(f"更新了监测点: {point_id}")
            else:
                # 插入新记录
                columns = []
                for key in data.keys():
                    # 处理带反引号的key
                    if key.startswith('`') and key.endswith('`'):
                        columns.append(key)
                    else:
                        columns.append(key)

                placeholders = ['%s'] * len(columns)

                insert_sql = f"INSERT INTO crack_monitoring_points ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
                conn.execute(insert_sql, list(data.values()))
                print(f"添加了新监测点: {point_id}")
        except Exception as e:
            print(f"处理监测点 {point_id} 时出错: {str(e)}")

    conn.close()
    print(f"更新了 {len(df)} 个裂缝监测点")


def update_analysis_results(stats_df, engine):
    """更新裂缝分析结果表"""
    conn = engine.connect()

    # 添加最新的分析结果
    for point_id in stats_df.index:
        try:
            # 准备数据
            data = {
                'analysis_date': datetime.datetime.now(),
                'point_id': point_id,
                'min_value': stats_df.loc[point_id, '最小值'] if '最小值' in stats_df.columns else None,
                'max_value': stats_df.loc[point_id, '最大值'] if '最大值' in stats_df.columns else None,
                'mean_value': stats_df.loc[point_id, '平均值'] if '平均值' in stats_df.columns else None,
                'median_value': stats_df.loc[point_id, '中位数'] if '中位数' in stats_df.columns else None,
                'std_value': stats_df.loc[point_id, '标准差'] if '标准差' in stats_df.columns else None,
                'coefficient_of_variation': stats_df.loc[
                    point_id, '变异系数'] if '变异系数' in stats_df.columns else None,
                'q25_value': stats_df.loc[point_id, '25%分位数'] if '25%分位数' in stats_df.columns else None,
                'q75_value': stats_df.loc[point_id, '75%分位数'] if '75%分位数' in stats_df.columns else None,
                'iqr_value': stats_df.loc[point_id, 'IQR'] if 'IQR' in stats_df.columns else None,
                'anomaly_count': 0  # 这里可以添加异常值检测的逻辑
            }

            # 构建SQL查询
            columns = list(data.keys())
            placeholders = ['%s'] * len(columns)

            insert_sql = f"INSERT INTO crack_analysis_results ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
            conn.execute(insert_sql, list(data.values()))
            print(f"添加了分析结果: {point_id}")
        except Exception as e:
            print(f"添加分析结果 {point_id} 时出错: {str(e)}")

    conn.close()
    print(f"添加了 {len(stats_df)} 条裂缝分析结果")


if __name__ == "__main__":
    # 处理裂缝数据
    process_crack_data()
