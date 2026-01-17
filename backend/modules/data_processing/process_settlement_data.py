# -*- coding: utf-8 -*-
import pandas as pd
import numpy as np
from sqlalchemy import create_engine
from datetime import datetime, timedelta
import mysql.connector
import os
import sys

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# 导入数据库配置
from modules.database.db_config import db_config
from modules.db.vendor import get_repo

# 预测配置
PREDICTION_DAYS = 30  # 预测未来30天
CONFIDENCE_LEVEL = 0.95  # 95%置信区间


def calculate_prediction(valid_days, valid_values, slope, intercept, prediction_days=PREDICTION_DAYS):
    """
    基于线性回归计算未来趋势预测和置信区间

    参数:
        valid_days: 有效的天数数组
        valid_values: 有效的测量值数组
        slope: 线性回归斜率
        intercept: 线性回归截距
        prediction_days: 预测天数

    返回:
        dict: 包含预测值、置信区间、预警等级等信息
    """
    n = len(valid_days)
    if n < 3:
        return None

    # 计算残差和标准误差
    predicted_values = slope * valid_days + intercept
    residuals = valid_values - predicted_values
    sse = np.sum(residuals ** 2)  # 残差平方和
    mse = sse / (n - 2)  # 均方误差
    se = np.sqrt(mse)  # 标准误差

    # t值 (95%置信区间, df = n-2)
    # 简化处理: 当n较大时t约等于1.96
    if n > 30:
        t_value = 1.96
    elif n > 10:
        t_value = 2.1
    else:
        t_value = 2.5

    # 计算x的均值和方差
    x_mean = np.mean(valid_days)
    ss_x = np.sum((valid_days - x_mean) ** 2)

    # 最后一个观测日
    last_day = valid_days[-1]
    last_value = valid_values[-1]

    # 生成预测点
    future_days = np.arange(1, prediction_days + 1) + last_day
    future_predictions = slope * future_days + intercept

    # 计算每个预测点的置信区间
    confidence_intervals = []
    for x_pred in future_days:
        # 预测区间的标准误差
        se_pred = se * np.sqrt(1 + 1/n + (x_pred - x_mean)**2 / ss_x)
        margin = t_value * se_pred
        confidence_intervals.append({
            'day': float(x_pred),
            'lower': float(future_predictions[np.where(future_days == x_pred)[0][0]] - margin),
            'upper': float(future_predictions[np.where(future_days == x_pred)[0][0]] + margin)
        })

    # 计算预测终点值
    end_day = future_days[-1]
    end_prediction = float(slope * end_day + intercept)

    # 计算预测变化量
    predicted_change = end_prediction - last_value

    # 风险等级评估 (基于预测的变化速率和总变化量)
    daily_rate = abs(slope)
    total_predicted_change = abs(predicted_change)

    if daily_rate > 0.15 or total_predicted_change > 5.0:
        risk_level = "critical"  # 严重风险
        risk_score = 90
    elif daily_rate > 0.08 or total_predicted_change > 3.0:
        risk_level = "high"  # 高风险
        risk_score = 70
    elif daily_rate > 0.03 or total_predicted_change > 1.5:
        risk_level = "medium"  # 中等风险
        risk_score = 50
    elif daily_rate > 0.01 or total_predicted_change > 0.5:
        risk_level = "low"  # 低风险
        risk_score = 30
    else:
        risk_level = "normal"  # 正常
        risk_score = 10

    # 预警阈值检查
    warning_threshold = -3.0  # mm, 累计沉降警戒值
    alert_threshold = -5.0   # mm, 累计沉降报警值

    warnings = []
    if slope < -0.1:
        warnings.append("沉降速率过快")
    if end_prediction < warning_threshold:
        warnings.append("预测将超过警戒阈值")
    if end_prediction < alert_threshold:
        warnings.append("预测将超过报警阈值")

    return {
        'prediction_days': prediction_days,
        'future_days': future_days.tolist(),
        'future_predictions': future_predictions.tolist(),
        'confidence_intervals': confidence_intervals,
        'end_prediction': end_prediction,
        'predicted_change': float(predicted_change),
        'standard_error': float(se),
        'risk_level': risk_level,
        'risk_score': risk_score,
        'warnings': warnings,
        'model_quality': {
            'mse': float(mse),
            'rmse': float(np.sqrt(mse)),
            'data_points': n
        }
    }


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
    long_data['point_number'] = long_data['point_id'].str.extract(r'(\d+)').astype(int)
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

        # 线性回归（使用 numpy 计算斜率与相关系数）
        if len(valid_days) > 1:
            slope, intercept = np.polyfit(valid_days, valid_values, 1)
            if np.std(valid_days) > 0 and np.std(valid_values) > 0:
                r_value = float(np.corrcoef(valid_days, valid_values)[0, 1])
            else:
                r_value = 0.0
            p_value = None
        else:
            slope = 0.0
            intercept = 0.0
            r_value = 0.0
            p_value = None

        # 计算趋势预测
        prediction_data = None
        if len(valid_days) >= 3:
            prediction_data = calculate_prediction(valid_days, valid_values, slope, intercept)

        # 判断趋势类型
        if slope < -0.1:
            trend_type = "显著下沉"
            alert_level = "高风险"
        elif slope > 0.1:
            trend_type = "显著隆起"
            alert_level = "中风险"
        elif abs(slope) > 0.02:
            trend_type = "轻微变化"
            alert_level = "低风险"
        else:
            trend_type = "无显著趋势"
            alert_level = "正常"

        # 从预测数据中获取风险评分和预警信息
        risk_score = prediction_data['risk_score'] if prediction_data else 0
        risk_level = prediction_data['risk_level'] if prediction_data else 'normal'
        predicted_change = prediction_data['predicted_change'] if prediction_data else 0
        end_prediction = prediction_data['end_prediction'] if prediction_data else 0
        warnings_json = str(prediction_data['warnings']) if prediction_data else '[]'

        # 保存分析结果
        analysis_results.append({
            'point_id': point_id,
            'min_value': min_value,
            'max_value': max_value,
            'avg_value': avg_value,
            'std_deviation': std_dev,
            'trend_slope': slope,
            'intercept': intercept,
            'r_squared': r_value ** 2,
            'p_value': p_value,
            'trend_type': trend_type,
            'total_change': total_change,
            'avg_daily_rate': avg_daily_rate,
            'max_daily_rate': max_daily_rate,
            'alert_level': alert_level,
            'risk_score': risk_score,
            'risk_level': risk_level,
            'predicted_change_30d': predicted_change,
            'predicted_value_30d': end_prediction,
            'warnings': warnings_json,
            'last_updated': datetime.now()
        })

    # 转换为DataFrame
    analysis_df = pd.DataFrame(analysis_results)

    # 添加用于排序的临时列，提取point_id的数字部分
    analysis_df['point_number'] = analysis_df['point_id'].str.extract(r'(\d+)').astype(int)
    
    # 按照编号排序
    analysis_df = analysis_df.sort_values('point_number')
    
    # 删除临时排序列
    analysis_df = analysis_df.drop(columns=['point_number'])

    # 保存分析结果到MySQL
    analysis_df.to_sql('settlement_analysis', engine, if_exists='replace', index=False)

    print(f"成功保存 {len(analysis_df)} 个监测点的分析结果")

    return True

def get_point_prediction(point_id, prediction_days=30):
    """
    获取特定监测点的趋势预测数据（向后兼容旧数据库结构）

    参数:
        point_id: 监测点ID
        prediction_days: 预测天数

    返回:
        dict: 包含历史数据、拟合线、预测数据、置信区间等
    """
    print(f"获取监测点 {point_id} 的趋势预测数据...")

    v = os.environ.get('DB_VENDOR', '').strip().lower()
    if v == 'supabase_http':
        repo = get_repo()
        detail = repo.get_point_detail(point_id)
        ts_rows = detail.get('timeSeriesData') if isinstance(detail, dict) else None
        analysis = detail.get('analysisData') if isinstance(detail, dict) else None
        ts_rows = ts_rows if isinstance(ts_rows, list) else []
        analysis = analysis if isinstance(analysis, dict) else {}

        if len(ts_rows) < 3:
            return None

        point_data = pd.DataFrame(ts_rows)
        if point_data.empty:
            return None

        if 'measurement_date' not in point_data.columns or 'value' not in point_data.columns:
            return None

        point_data['measurement_date'] = pd.to_datetime(point_data['measurement_date'], errors='coerce')
        point_data = point_data.dropna(subset=['measurement_date'])
        if point_data.empty:
            return None

        point_data['value'] = pd.to_numeric(point_data['value'], errors='coerce')

        first_date = point_data['measurement_date'].min()
        days = (point_data['measurement_date'] - first_date).dt.total_seconds() / (24 * 3600)

        valid_mask = ~point_data['value'].isna()
        valid_days = days[valid_mask].values
        valid_values = point_data['value'][valid_mask].values
        valid_dates = point_data['measurement_date'][valid_mask].tolist()

        if len(valid_days) < 3:
            return None

        slope, intercept = np.polyfit(valid_days, valid_values, 1)
        slope = float(slope)
        intercept = float(intercept)
        r_squared = float(analysis.get('r_squared') or 0)

        fitted_values = (slope * valid_days + intercept).tolist()

        prediction = calculate_prediction(valid_days, valid_values, slope, intercept, prediction_days)
        if prediction is None:
            return None

        last_valid_date = valid_dates[-1]
        future_dates = [(last_valid_date + timedelta(days=i)).isoformat() for i in range(1, prediction_days + 1)]

        return {
            'point_id': point_id,
            'historical': {
                'dates': [d.isoformat() for d in valid_dates],
                'days': valid_days.tolist(),
                'values': valid_values.tolist(),
                'fitted_values': fitted_values
            },
            'regression': {
                'slope': slope,
                'intercept': intercept,
                'r_squared': r_squared,
                'equation': f"y = {slope:.6f}x + {intercept:.4f}"
            },
            'prediction': {
                'dates': future_dates,
                'days': prediction['future_days'],
                'values': prediction['future_predictions'],
                'confidence_intervals': prediction['confidence_intervals'],
                'end_prediction': prediction['end_prediction'],
                'predicted_change': prediction['predicted_change']
            },
            'risk_assessment': {
                'risk_level': prediction['risk_level'],
                'risk_score': prediction['risk_score'],
                'warnings': prediction['warnings'],
                'trend_type': str(analysis.get('trend_type') or '未知'),
                'alert_level': str(analysis.get('alert_level') or '正常')
            },
            'model_quality': prediction['model_quality']
        }

    # 使用 mysql.connector 直接查询
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)

    # 读取处理后的数据
    query = """
        SELECT measurement_date, value, daily_change, cumulative_change
        FROM processed_settlement_data
        WHERE point_id = %s
        ORDER BY measurement_date
    """
    cursor.execute(query, (point_id,))
    rows = cursor.fetchall()

    if len(rows) < 3:
        cursor.close()
        conn.close()
        return None

    point_data = pd.DataFrame(rows)

    # 读取分析结果（仅使用基础字段）
    analysis_query = """
        SELECT trend_slope, r_squared, trend_type, alert_level
        FROM settlement_analysis
        WHERE point_id = %s
    """
    cursor.execute(analysis_query, (point_id,))
    analysis_row = cursor.fetchone()

    cursor.close()
    conn.close()

    if not analysis_row:
        return None

    analysis = analysis_row

    # 转换日期为数值型(天数)
    point_data['measurement_date'] = pd.to_datetime(point_data['measurement_date'])
    first_date = point_data['measurement_date'].min()
    days = (point_data['measurement_date'] - first_date).dt.total_seconds() / (24 * 3600)

    # 获取有效数据
    valid_mask = ~point_data['value'].isna()
    valid_days = days[valid_mask].values
    valid_values = point_data['value'][valid_mask].values
    valid_dates = point_data['measurement_date'][valid_mask].tolist()

    if len(valid_days) < 3:
        return None

    # 重新计算线性回归（确保有 intercept）
    slope, intercept = np.polyfit(valid_days, valid_values, 1)
    slope = float(slope)
    intercept = float(intercept)
    r_squared = float(analysis['r_squared']) if analysis.get('r_squared') else 0

    # 计算拟合线
    fitted_values = slope * valid_days + intercept

    # 计算预测
    prediction = calculate_prediction(valid_days, valid_values, slope, intercept, prediction_days)

    if prediction is None:
        return None

    # 生成预测日期
    last_date = point_data['measurement_date'].max()
    future_dates = [(last_date + timedelta(days=int(d - valid_days[-1]))).isoformat()
                    for d in prediction['future_days']]

    return {
        'point_id': point_id,
        'historical': {
            'dates': [d.isoformat() for d in valid_dates],
            'days': valid_days.tolist(),
            'values': valid_values.tolist(),
            'fitted_values': fitted_values.tolist()
        },
        'regression': {
            'slope': slope,
            'intercept': intercept,
            'r_squared': r_squared,
            'equation': f"y = {slope:.6f}x + {intercept:.4f}"
        },
        'prediction': {
            'dates': future_dates,
            'days': prediction['future_days'],
            'values': prediction['future_predictions'],
            'confidence_intervals': prediction['confidence_intervals'],
            'end_prediction': prediction['end_prediction'],
            'predicted_change': prediction['predicted_change']
        },
        'risk_assessment': {
            'risk_level': prediction['risk_level'],
            'risk_score': prediction['risk_score'],
            'warnings': prediction['warnings'],
            'trend_type': str(analysis.get('trend_type') or '未知'),
            'alert_level': str(analysis.get('alert_level') or '正常')
        },
        'model_quality': prediction['model_quality']
    }


def get_all_predictions_summary():
    """
    获取所有监测点的预测汇总数据（向后兼容旧数据库结构）

    返回:
        list: 包含所有监测点的风险评分和预警信息
    """
    print("获取所有监测点的预测汇总...")

    v = os.environ.get('DB_VENDOR', '').strip().lower()
    if v == 'supabase_http':
        repo = get_repo()
        rows = repo.get_summary()
        if not rows:
            return []

        results = []
        for row in rows:
            slope = float(row.get('trend_slope') or 0)

            daily_rate = abs(slope)
            if daily_rate > 0.15:
                risk_level = "critical"
                risk_score = 90
            elif daily_rate > 0.08:
                risk_level = "high"
                risk_score = 70
            elif daily_rate > 0.03:
                risk_level = "medium"
                risk_score = 50
            elif daily_rate > 0.01:
                risk_level = "low"
                risk_score = 30
            else:
                risk_level = "normal"
                risk_score = 10

            predicted_change_30d = slope * 30

            warnings = []
            if slope < -0.1:
                warnings.append("沉降速率过快")
            if predicted_change_30d < -3.0:
                warnings.append("预测将超过警戒阈值")

            avg_value = row.get('avg_value')
            try:
                avg_value = float(avg_value) if avg_value is not None else 0.0
            except Exception:
                avg_value = 0.0

            results.append({
                'point_id': row.get('point_id'),
                'trend_slope': slope,
                'r_squared': float(row.get('r_squared') or 0),
                'trend_type': str(row.get('trend_type') or '未知'),
                'alert_level': str(row.get('alert_level') or '正常'),
                'risk_score': risk_score,
                'risk_level': risk_level,
                'predicted_change_30d': predicted_change_30d,
                'predicted_value_30d': avg_value + predicted_change_30d,
                'warnings': str(warnings)
            })

        results.sort(key=lambda x: x['risk_score'], reverse=True)
        return results

    # 使用 mysql.connector 直接查询
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)

    # 使用基础字段查询，兼容旧数据库
    query = """
        SELECT point_id, trend_slope, r_squared, trend_type, alert_level,
               avg_value, total_change, avg_daily_rate
        FROM settlement_analysis
        ORDER BY ABS(trend_slope) DESC
    """
    cursor.execute(query)
    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    if not rows:
        return []

    results = []
    for row in rows:
        slope = float(row['trend_slope']) if row.get('trend_slope') else 0

        # 基于斜率动态计算风险等级
        daily_rate = abs(slope)
        if daily_rate > 0.15:
            risk_level = "critical"
            risk_score = 90
        elif daily_rate > 0.08:
            risk_level = "high"
            risk_score = 70
        elif daily_rate > 0.03:
            risk_level = "medium"
            risk_score = 50
        elif daily_rate > 0.01:
            risk_level = "low"
            risk_score = 30
        else:
            risk_level = "normal"
            risk_score = 10

        # 预测30天变化量
        predicted_change_30d = slope * 30

        # 生成预警信息
        warnings = []
        if slope < -0.1:
            warnings.append("沉降速率过快")
        if predicted_change_30d < -3.0:
            warnings.append("预测将超过警戒阈值")

        results.append({
            'point_id': row['point_id'],
            'trend_slope': slope,
            'r_squared': float(row['r_squared']) if row.get('r_squared') else 0,
            'trend_type': str(row.get('trend_type') or '未知'),
            'alert_level': str(row.get('alert_level') or '正常'),
            'risk_score': risk_score,
            'risk_level': risk_level,
            'predicted_change_30d': predicted_change_30d,
            'predicted_value_30d': float(row.get('avg_value') or 0) + predicted_change_30d,
            'warnings': str(warnings)
        })

    # 按风险分数降序排列
    results.sort(key=lambda x: x['risk_score'], reverse=True)
    return results


if __name__ == "__main__":
    process_data()
