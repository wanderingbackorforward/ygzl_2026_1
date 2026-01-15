import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
from datetime import datetime
import os
import sys

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# 导入数据库配置
from modules.database.db_config import db_config

def process_data():
    """处理和分析温度数据"""
    print("开始温度数据处理与分析...")

    # 创建数据库连接
    engine = create_engine(
        f"mysql+pymysql://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")

    # 1. 读取原始温度数据
    query = "SELECT * FROM raw_temperature_data ORDER BY measurement_date"
    try:
        raw_data = pd.read_sql(query, engine)
    except Exception as e:
        print(f"读取原始温度数据失败: {str(e)}")
        return False

    if raw_data.empty:
        print("未找到温度数据，请先导入数据")
        return False

    print(f"成功读取 {len(raw_data)} 行原始温度数据")

    # 2. 读取传感器信息
    try:
        sensors = pd.read_sql("SELECT * FROM temperature_sensors", engine)
        print(f"成功读取 {len(sensors)} 个传感器信息")
    except Exception as e:
        print(f"读取传感器信息失败: {str(e)}")
        sensors = pd.DataFrame()

    # 3. 清理和预处理数据
    # 移除重复记录
    raw_data = raw_data.drop_duplicates(subset=['SID', 'measurement_date'])
    
    # 确保温度值为数值型
    raw_data['temperature'] = pd.to_numeric(raw_data['temperature'], errors='coerce')
    
    # 移除异常值 (超出合理范围的温度，例如小于-30°C或大于70°C)
    raw_data = raw_data[(raw_data['temperature'] >= -30) & (raw_data['temperature'] <= 70)]
    
    print(f"数据清理后剩余 {len(raw_data)} 行记录")

    # 4. 创建处理后的温度数据表
    # 按照传感器ID和测量日期对数据进行分组，计算每天的平均温度
    processed_data = raw_data.copy()
    
    # 转换测量日期格式，只保留日期部分用于分组
    processed_data['date'] = processed_data['measurement_date'].dt.date
    
    # 按照传感器ID和日期分组，计算日均温度
    daily_avg = processed_data.groupby(['SID', 'date'])['temperature'].agg(['mean', 'min', 'max', 'std']).reset_index()
    daily_avg.columns = ['SID', 'date', 'avg_temperature', 'min_temperature', 'max_temperature', 'std_temperature']
    
    # 将日期转换回datetime格式
    daily_avg['date'] = pd.to_datetime(daily_avg['date'])
    
    # 重命名列以保持一致性
    daily_avg.rename(columns={'date': 'measurement_date'}, inplace=True)
    
    # 计算日温差
    daily_avg['temperature_range'] = daily_avg['max_temperature'] - daily_avg['min_temperature']
    
    # 将处理后的数据保存到数据库
    daily_avg.to_sql('processed_temperature_data', engine, if_exists='replace', index=False)
    
    print(f"成功保存 {len(daily_avg)} 行处理后温度数据")

    # 5. 对每个传感器进行温度趋势分析
    analysis_results = []
    
    # 获取所有传感器ID
    sensor_ids = daily_avg['SID'].unique()
    
    for sid in sensor_ids:
        # 获取该传感器的所有数据
        sensor_data = daily_avg[daily_avg['SID'] == sid]
        
        # 获取有效的温度值（排除NaN）
        temperatures = sensor_data['avg_temperature'].dropna()
        
        if len(temperatures) < 2:
            print(f"警告: 传感器 {sid} 数据不足，跳过分析")
            continue
        
        # 计算基本统计量
        min_temp = temperatures.min()
        max_temp = temperatures.max()
        avg_temp = temperatures.mean()
        std_dev = temperatures.std()
        
        # 计算平均日温差
        avg_temp_range = sensor_data['temperature_range'].mean()
        
        # 线性回归分析温度趋势
        # 转换日期为数值型(天数)
        days = (sensor_data['measurement_date'] - sensor_data['measurement_date'].min()).dt.total_seconds() / (24 * 3600)
        
        # 排除NaN值
        valid_mask = ~sensor_data['avg_temperature'].isna()
        valid_days = days[valid_mask].values
        valid_temps = sensor_data['avg_temperature'][valid_mask].values
        
        # 线性回归（使用 numpy 计算斜率与相关系数）
        if len(valid_days) > 1:
            slope, intercept = np.polyfit(valid_days, valid_temps, 1)
            if np.std(valid_days) > 0 and np.std(valid_temps) > 0:
                r_value = float(np.corrcoef(valid_days, valid_temps)[0, 1])
            else:
                r_value = 0.0
            p_value = None
        else:
            slope = 0.0
            r_value = 0.0
            p_value = None
        
        # 获取传感器名称
        sensor_name = "未知"
        if not sensors.empty and sid in sensors['SID'].values:
            sensor_name = sensors[sensors['SID'] == sid]['SName'].iloc[0]
        
        # 判断温度趋势类型
        if slope > 0.2:
            trend_type = "显著升温"
            alert_level = "需关注"
        elif slope < -0.2:
            trend_type = "显著降温"
            alert_level = "需关注"
        elif slope > 0:
            trend_type = "缓慢升温"
            alert_level = "正常"
        elif slope < 0:
            trend_type = "缓慢降温"
            alert_level = "正常"
        else:
            trend_type = "温度稳定"
            alert_level = "正常"
        
        # 保存分析结果
        analysis_results.append({
            'sensor_id': sid,
            'sensor_name': sensor_name,
            'min_temperature': min_temp,
            'max_temperature': max_temp,
            'avg_temperature': avg_temp,
            'std_deviation': std_dev,
            'avg_daily_range': avg_temp_range,
            'trend_slope': slope,
            'r_squared': r_value ** 2,
            'p_value': p_value,
            'trend_type': trend_type,
            'alert_level': alert_level,
            'last_updated': datetime.now()
        })
    
    # 转换为DataFrame
    analysis_df = pd.DataFrame(analysis_results)
    
    # 添加用于排序的临时列，提取sensor_id的数字部分
    if not analysis_df.empty:
        # 尝试提取数字部分，如果不是形如"Sxx"格式，则保留原始排序
        try:
            analysis_df['sensor_number'] = analysis_df['sensor_id'].astype(str).str.extract(r'(\d+)').astype(int)
            # 按照编号排序
            analysis_df = analysis_df.sort_values('sensor_number')
            # 删除临时排序列
            analysis_df = analysis_df.drop(columns=['sensor_number'])
        except:
            print("无法按传感器编号排序，使用原始顺序")
    
    # 保存分析结果到MySQL
    if not analysis_df.empty:
        analysis_df.to_sql('temperature_analysis', engine, if_exists='replace', index=False)
        print(f"成功保存 {len(analysis_df)} 个传感器的温度分析结果")
    else:
        print("没有生成分析结果")

    # 6. 创建温度监测点表
    # 如果传感器表不为空，利用其信息创建监测点表
    if not sensors.empty:
        monitoring_points = []
        
        for _, sensor in sensors.iterrows():
            # 提取相关信息
            sid = sensor['SID']
            sname = sensor['SName']
            
            # 查找该传感器的分析结果
            analysis = None
            if not analysis_df.empty:
                matching = analysis_df[analysis_df['sensor_id'] == sid]
                if not matching.empty:
                    analysis = matching.iloc[0]
            
            # 设置坐标（此处为示例，实际应根据真实数据设置）
            # 在实际应用中，可能需要通过其他方式获取监测点的坐标
            x_coord = np.random.uniform(-50, 50)  # 示例随机坐标
            y_coord = np.random.uniform(-10, 10)   # 示例随机坐标
            z_coord = np.random.uniform(0, 5)      # 示例随机坐标
            
            point_data = {
                'point_id': str(sid),
                'point_name': sname,
                'x_coord': x_coord,
                'y_coord': y_coord,
                'z_coord': z_coord,
                'point_type': 'temperature',
                'status': 'active'
            }
            
            # 添加分析结果中的部分字段
            if analysis is not None:
                point_data.update({
                    'trend_type': analysis['trend_type'],
                    'alert_level': analysis['alert_level']
                })
            
            monitoring_points.append(point_data)
        
        # 创建DataFrame并保存到数据库
        monitoring_df = pd.DataFrame(monitoring_points)
        monitoring_df.to_sql('temperature_monitoring_points', engine, if_exists='replace', index=False)
        print(f"成功创建 {len(monitoring_df)} 个温度监测点")

    print("温度数据处理与分析完成")
    return True

if __name__ == "__main__":
    process_data()
