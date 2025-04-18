# modules/api/api_server.py
"""
监测系统API服务器
提供沉降监测、裂缝监测、温度监测、振动监测及视角数据管理等API接口
"""
import json
# =========================================================
# 导入部分：将所有导入聚合到文件顶部
# =========================================================
from datetime import datetime
import os
import sys
import threading
import uuid
from decimal import Decimal # <--- 新增导入

from flask import Flask, Blueprint, jsonify, request, send_from_directory, render_template
from flask_cors import CORS
import mysql.connector
import numpy as np
import pandas as pd
from sqlalchemy import create_engine
from werkzeug.utils import secure_filename

# 只添加一次项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# 导入沉降需要的模块
from modules.database.db_config import db_config # <-- 假设你的数据库配置在这里
from modules.data_import.settlement_data_import import import_excel_to_mysql
from modules.data_processing.process_settlement_data import process_data
from modules.data_processing.update_monitoring_points import update_monitoring_points
# 裂缝模块
from modules.data_import.crack_data_import import import_crack_excel, first_time_import
from modules.data_processing.process_crack_data import process_crack_data
# 温度模块
from modules.data_import.temperature_data_import import import_mdb_to_mysql
from modules.data_processing.process_temperature_data import process_data as process_temperature_data
# 振动模块
from modules.api.vibration_handler import vibration_bp

# =========================================================
# 应用初始化：创建Flask应用和Blueprint
# =========================================================
app = Flask(__name__, static_folder='../../static', template_folder='../../templates')
CORS(app)  # 允许跨域请求
# 设置上传文件夹路径
app.config['UPLOAD_FOLDER'] = os.path.join(os.getcwd(), 'temp_uploads')

# 创建裂缝API蓝图
crack_api = Blueprint('crack_api', __name__, url_prefix='/api')

# 创建温度API蓝图
temperature_api = Blueprint('temperature_api', __name__, url_prefix='/api')

# =========================================================
# 辅助函数
# =========================================================
def get_db_connection():
    """创建数据库连接"""
    try:
        # 使用从 db_config 模块导入的配置
        conn = mysql.connector.connect(**db_config)
        return conn
    except mysql.connector.Error as err:
        print(f"数据库连接错误: {err}")
        return None

# 允许的文件类型
ALLOWED_EXTENSIONS = {'xlsx', 'xls'}

# 检查文件扩展名是否允许
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# 存储任务状态的字典
processing_tasks = {}

# modules/api/api_server.py

# --- 导入 datetime (如果尚未导入) ---
from datetime import date, datetime # 确保导入了 date 和 datetime

# --- 辅助函数：扩展 Decimal 类型转换器 ---
def decimal_default(obj):
    if isinstance(obj, Decimal):
        # 处理 Decimal 类型
        return float(round(obj, 3))
    elif isinstance(obj, (datetime, date)): # 新增：处理 datetime 和 date 对象
        # 将日期时间对象转换为 ISO 8601 格式的字符串
        return obj.isoformat()
    # 如果遇到其他无法处理的类型，则抛出错误
    raise TypeError(f"类型 {type(obj)} 不能被序列化为 JSON")

# ... (文件的其余部分保持不变) ...


# =========================================================
# 沉降监测API路由 (保持不变)
# =========================================================
@app.route('/')
def index():
    # Render the main cover page
    return render_template('index.html')

@app.route('/api/points')
def get_all_points():
    """获取所有监测点信息"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query = """
    SELECT mp.*, sa.alert_level, sa.trend_type
    FROM monitoring_points mp
    LEFT JOIN settlement_analysis sa ON mp.point_id = sa.point_id
    """

    cursor.execute(query)
    points = cursor.fetchall()

    cursor.close()
    conn.close()

    return jsonify(points)

@app.route('/api/point/<point_id>')
def get_point_data(point_id):
    """获取特定监测点的详细数据"""
    conn = get_db_connection()

    # 获取时间序列数据
    time_series_query = f"""
        SELECT measurement_date, value, daily_change, cumulative_change
        FROM processed_settlement_data
        WHERE point_id = %s  -- 使用参数化查询
        ORDER BY measurement_date
    """
    # 使用参数化查询防止SQL注入
    time_series_df = pd.read_sql(time_series_query, conn, params=(point_id,))


    # 转换datetime为字符串以便JSON序列化
    time_series_df['measurement_date'] = time_series_df['measurement_date'].astype(str)

    # 将 NaN 替换为 None
    time_series_data = time_series_df.replace({np.nan: None}).to_dict('records')

    # 获取分析结果
    analysis_query = f"""
        SELECT *
        FROM settlement_analysis
        WHERE point_id = %s -- 使用参数化查询
    """
    analysis_df = pd.read_sql(analysis_query, conn, params=(point_id,))

    # 同样替换分析数据中的 NaN
    analysis_data_dict = {}
    if not analysis_df.empty:
        analysis_data_dict = analysis_df.replace({np.nan: None}).to_dict('records')[0]


    conn.close()

    # 返回JSON结果
    response = {
        'timeSeriesData': time_series_data,
        'analysisData': analysis_data_dict
    }

    return jsonify(response)

@app.route('/api/summary')
def get_summary():
    """获取所有监测点的汇总分析"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query = """
    SELECT * FROM settlement_analysis
    ORDER BY CAST(REGEXP_REPLACE(point_id, '[^0-9]+', '') AS UNSIGNED), point_id
    """ # 改进排序，先按数字部分，再按原字符串

    cursor.execute(query)
    summary = cursor.fetchall()

    cursor.close()
    conn.close()

    # 使用json.dumps处理可能存在的Decimal类型
    return json.dumps(summary, default=decimal_default)

@app.route('/api/trends')
def get_trends():
    """获取所有监测点的趋势分类统计"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query = """
    SELECT trend_type, COUNT(*) as count
    FROM settlement_analysis
    GROUP BY trend_type
    """

    cursor.execute(query)
    trends = cursor.fetchall()

    cursor.close()
    conn.close()

    return jsonify(trends)

# 静态文件服务（用于前端页面）
@app.route('/static/<path:path>')
def serve_static(path):
    # 使用绝对路径指向静态文件
    static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../static'))
    return send_from_directory(static_dir, path)

# =========================================================
# 文件上传和处理API (保持不变)
# =========================================================
@app.route('/api/upload', methods=['POST'])
def upload_file():
    """处理文件上传请求"""
    # ... (代码保持不变) ...
    if 'file' not in request.files:
        return jsonify({'error': '没有文件'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '未选择文件'}), 400
    if not allowed_file(file.filename):
        return jsonify({'error': '不支持的文件类型，请上传.xlsx或.xls文件'}), 400
    try:
        upload_folder = os.path.join(os.getcwd(), 'temp_uploads')
        os.makedirs(upload_folder, exist_ok=True)
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        unique_filename = f"{timestamp}_{filename}"
        file_path = os.path.join(upload_folder, unique_filename)
        file.save(file_path)
        task_id = str(uuid.uuid4())
        processing_tasks[task_id] = {
            'status': 'pending',
            'message': '准备处理数据...',
            'file_path': file_path,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        process_thread = threading.Thread(
            target=process_uploaded_file,
            args=(task_id, file_path)
        )
        process_thread.daemon = True
        process_thread.start()
        return jsonify({
            'success': True,
            'message': '文件上传成功，开始处理数据',
            'task_id': task_id
        })
    except Exception as e:
        return jsonify({'error': f'文件上传失败: {str(e)}'}), 500

# @app.route('/api/process-status', methods=['GET']) # <-- 重复定义，移除这个，保留下面的
# def get_process_status():
#     """获取数据处理状态"""
#     # ... (代码保持不变) ...

def process_uploaded_file(task_id, file_path):
    """后台处理上传的文件"""
    # ... (代码保持不变) ...
    task = processing_tasks[task_id]
    try:
        task['status'] = 'importing'
        task['message'] = '正在导入数据到数据库...'
        task['updated_at'] = datetime.now().isoformat()
        success = import_excel_to_mysql(file_path)
        if not success: raise Exception("导入失败")

        task['status'] = 'processing'
        task['message'] = '正在处理和分析数据...'
        task['updated_at'] = datetime.now().isoformat()
        success = process_data()
        if not success: raise Exception("处理失败")

        task['status'] = 'updating_coordinates'
        task['message'] = '正在更新监测点坐标...'
        task['updated_at'] = datetime.now().isoformat()
        success = update_monitoring_points()
        if not success: raise Exception("更新坐标失败")

        task['status'] = 'completed'
        task['message'] = '数据处理完成'
        task['updated_at'] = datetime.now().isoformat()
        try: os.remove(file_path)
        except: pass
    except Exception as e:
        task['status'] = 'failed'
        task['message'] = f'处理过程中出错: {str(e)}'
        task['updated_at'] = datetime.now().isoformat()


# =========================================================
# 裂缝监测API路由 (保持不变)
# =========================================================

def clean_nan_values(df):
    """将DataFrame中的NaN值替换为None"""
    return df.where(pd.notna(df), None)

@crack_api.route('/crack/upload', methods=['POST'])
def upload_crack_data():
    """上传裂缝数据Excel文件"""
    # ... (代码保持不变) ...
    if 'file' not in request.files: return jsonify({'status': 'error','message': '没有发现文件'}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({'status': 'error','message': '没有选择文件'}), 400
    if not file.filename.endswith(('.xlsx', '.xls')): return jsonify({'status': 'error','message': '只支持Excel文件(.xlsx, .xls)'}), 400
    try:
        temp_dir = 'temp_uploads'; os.makedirs(temp_dir, exist_ok=True)
        upload_path = os.path.join(temp_dir, secure_filename(file.filename)) # 使用secure_filename
        file.save(upload_path)
        engine = create_engine(f"mysql+mysqlconnector://{db_config['user']}:{db_config['password']}@{db_config['host']}") # 使用mysqlconnector
        conn = engine.connect()
        try: conn.execute(f"USE {db_config['database']}"); database_exists = True
        except: database_exists = False
        conn.close()
        if not database_exists: success = first_time_import(upload_path); action = "首次导入"
        else: success = import_crack_excel(upload_path); action = "更新导入"
        if success:
            process_success = process_crack_data()
            if process_success: return jsonify({'status': 'success','message': f'成功{action}并处理裂缝数据文件'})
            else: return jsonify({'status': 'warning','message': f'{action}成功，但处理数据失败'}), 500
        else: return jsonify({'status': 'error','message': f'{action}裂缝数据失败'}), 500
    except Exception as e: return jsonify({'status': 'error','message': f'处理上传文件时出错: {str(e)}'}), 500
    finally:
        if 'upload_path' in locals() and os.path.exists(upload_path):
            try: os.remove(upload_path)
            except: pass

@crack_api.route('/crack/monitoring_points', methods=['GET'])
def get_crack_monitoring_points():
    """获取所有裂缝监测点信息"""
    # ... (代码保持不变) ...
    try:
        engine = create_engine(f"mysql+mysqlconnector://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")
        query = "SELECT * FROM crack_monitoring_points WHERE status = 'active'"
        df = pd.read_sql(query, engine)
        if 'monitoring_start_date' in df.columns: df['monitoring_start_date'] = df['monitoring_start_date'].dt.strftime('%Y-%m-%d %H:%M:%S')
        if 'monitoring_end_date' in df.columns: df['monitoring_end_date'] = df['monitoring_end_date'].dt.strftime('%Y-%m-%d %H:%M:%S')
        df = clean_nan_values(df)
        result = df.to_dict(orient='records')
        return jsonify({'status': 'success','data': result,'message': f'成功获取{len(result)}个裂缝监测点'})
    except Exception as e: return jsonify({'status': 'error','message': f'获取裂缝监测点失败: {str(e)}'}), 500

@crack_api.route('/crack/data', methods=['GET'])
def get_crack_data():
    """获取裂缝数据"""
    # ... (代码保持不变) ...
    try:
        engine = create_engine(f"mysql+mysqlconnector://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")
        query = "SELECT * FROM raw_crack_data ORDER BY measurement_date"
        df = pd.read_sql(query, engine)
        df['measurement_date'] = df['measurement_date'].dt.strftime('%Y-%m-%d %H:%M:%S')
        df = clean_nan_values(df)
        result = df.to_dict(orient='records')
        # 使用 json.dumps 处理 Decimal 和 NaN
        return json.dumps({'status': 'success', 'data': result, 'message': f'成功获取{len(result)}行裂缝数据'}, default=str)
    except Exception as e: return jsonify({'status': 'error','message': f'获取裂缝数据失败: {str(e)}'}), 500

@crack_api.route('/crack/analysis_results', methods=['GET'])
def get_crack_analysis_results():
    """获取裂缝分析结果"""
    # ... (代码保持不变) ...
    try:
        engine = create_engine(f"mysql+mysqlconnector://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")
        query = "SELECT r.*, p.trend_type, p.change_type FROM crack_analysis_results r JOIN crack_monitoring_points p ON r.point_id = p.point_id ORDER BY r.analysis_date DESC"
        df = pd.read_sql(query, engine)
        df['analysis_date'] = df['analysis_date'].dt.strftime('%Y-%m-%d %H:%M:%S')
        df = clean_nan_values(df)
        result = df.to_dict(orient='records')
        return jsonify({'status': 'success','data': result,'message': f'成功获取{len(result)}条裂缝分析结果'})
    except Exception as e: return jsonify({'status': 'error','message': f'获取裂缝分析结果失败: {str(e)}'}), 500

@crack_api.route('/crack/trend_data', methods=['GET'])
def get_crack_trend_data():
    """获取裂缝趋势数据，适用于前端图表展示"""
    # ... (代码保持不变) ...
    try:
        engine = create_engine(f"mysql+mysqlconnector://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")
        query = "SELECT * FROM raw_crack_data ORDER BY measurement_date"
        df = pd.read_sql(query, engine)
        if 'id' in df.columns: df.drop(columns=['id'], inplace=True)
        point_columns = [col for col in df.columns if col != 'measurement_date']
        dates = df['measurement_date'].dt.strftime('%Y-%m-%d %H:%M:%S').tolist()
        df = clean_nan_values(df)
        series_data = [{'name': point, 'data': [None if pd.isna(val) else val for val in df[point].tolist()]} for point in point_columns]
        trend_data = {'dates': dates,'series': series_data}
        # 使用 json.dumps 处理可能存在的 Decimal/NaN
        return json.dumps({'status': 'success','data': trend_data,'message': '成功获取裂缝趋势数据'}, default=str)
    except Exception as e: return jsonify({'status': 'error','message': f'获取裂缝趋势数据失败: {str(e)}'}), 500

@crack_api.route('/crack/stats_overview', methods=['GET'])
def get_crack_stats_overview():
    """获取裂缝监测点统计概况"""
    # ... (代码保持不变) ...
    try:
        engine = create_engine(f"mysql+mysqlconnector://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")
        query = "SELECT * FROM crack_monitoring_points WHERE status = 'active'"
        df = pd.read_sql(query, engine)
        if df.empty: return jsonify({'status': 'warning','message': '没有找到裂缝监测点数据'})
        overview = {
            'total_points': len(df),
            'expanding_points': len(df[df['change_type'] == '扩展']),
            'shrinking_points': len(df[df['change_type'] == '收缩']),
            'stable_points': len(df[df['change_type'] == '稳定']),
            'avg_slope': float(df['trend_slope'].mean()) if not pd.isna(df['trend_slope'].mean()) else None,
            'max_change_rate': float(df['average_change_rate'].abs().max()) if not pd.isna(df['average_change_rate'].abs().max()) else None,
            'trend_types': df['trend_type'].value_counts().to_dict()
        }
        return jsonify({'status': 'success','data': overview,'message': '成功获取裂缝统计概况'})
    except Exception as e: return jsonify({'status': 'error','message': f'获取裂缝统计概况失败: {str(e)}'}), 500

# =========================================================
# 温度监测API路由 (保持不变)
# =========================================================
@temperature_api.route('/temperature/points', methods=['GET'])
def get_temperature_points():
    """获取所有温度监测点信息"""
    # ... (代码保持不变) ...
    try:
        engine = create_engine(f"mysql+mysqlconnector://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")
        query = "SELECT * FROM temperature_monitoring_points WHERE status = 'active'"
        df = pd.read_sql(query, engine)
        df = clean_nan_values(df)
        result = df.to_dict(orient='records')
        return jsonify({'status': 'success','data': result,'message': f'成功获取{len(result)}个温度监测点'})
    except Exception as e: return jsonify({'status': 'error','message': f'获取温度监测点失败: {str(e)}'}), 500

@temperature_api.route('/temperature/summary', methods=['GET'])
def get_temperature_summary():
    """获取温度监测点的汇总分析"""
    # ... (代码保持不变) ...
    try:
        engine = create_engine(f"mysql+mysqlconnector://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")
        query = "SELECT * FROM temperature_analysis ORDER BY CAST(REGEXP_REPLACE(sensor_id, '[^0-9]+', '') AS UNSIGNED), sensor_id"
        df = pd.read_sql(query, engine)
        if 'last_updated' in df.columns: df['last_updated'] = df['last_updated'].dt.strftime('%Y-%m-%d %H:%M:%S')
        df = clean_nan_values(df)
        result = df.to_dict(orient='records')
        # 使用 json.dumps 处理 Decimal
        return json.dumps({'status': 'success','data': result,'message': f'成功获取{len(result)}个温度监测点的分析结果'}, default=str)
    except Exception as e: return jsonify({'status': 'error','message': f'获取温度分析结果失败: {str(e)}'}), 500

@temperature_api.route('/temperature/data/<sensor_id>', methods=['GET'])
def get_temperature_data(sensor_id):
    """获取特定传感器的温度数据"""
    # ... (代码保持不变) ...
    try:
        engine = create_engine(f"mysql+mysqlconnector://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")
        query = "SELECT * FROM processed_temperature_data WHERE SID = %s ORDER BY measurement_date" # 使用参数化
        data_df = pd.read_sql(query, engine, params=(sensor_id,))
        data_df['measurement_date'] = data_df['measurement_date'].dt.strftime('%Y-%m-%d')
        data_df = clean_nan_values(data_df)
        analysis_query = "SELECT * FROM temperature_analysis WHERE sensor_id = %s" # 使用参数化
        analysis_df = pd.read_sql(analysis_query, engine, params=(sensor_id,))
        analysis_data = {}
        if not analysis_df.empty:
            if 'last_updated' in analysis_df.columns: analysis_df['last_updated'] = analysis_df['last_updated'].dt.strftime('%Y-%m-%d %H:%M:%S')
            analysis_data = clean_nan_values(analysis_df).to_dict(orient='records')[0]
        # 使用 json.dumps 处理 Decimal
        return json.dumps({'status': 'success','data': {'timeSeriesData': data_df.to_dict(orient='records'),'analysisData': analysis_data},'message': f'成功获取传感器 {sensor_id} 的温度数据'}, default=str)
    except Exception as e: return jsonify({'status': 'error','message': f'获取温度数据失败: {str(e)}'}), 500

@temperature_api.route('/temperature/trends', methods=['GET'])
def get_temperature_trends():
    """获取温度趋势分类统计"""
    # ... (代码保持不变) ...
    try:
        engine = create_engine(f"mysql+mysqlconnector://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")
        query = "SELECT trend_type, COUNT(*) as count FROM temperature_analysis GROUP BY trend_type"
        df = pd.read_sql(query, engine)
        df = clean_nan_values(df)
        result = df.to_dict(orient='records')
        return jsonify({'status': 'success','data': result,'message': f'成功获取温度趋势分类统计'})
    except Exception as e: return jsonify({'status': 'error','message': f'获取温度趋势分类统计失败: {str(e)}'}), 500

@temperature_api.route('/temperature/stats', methods=['GET'])
def get_temperature_stats():
    """获取温度数据的统计概览"""
    # ... (代码基本保持不变, 清理和格式化略作调整) ...
    try:
        engine = create_engine(f"mysql+mysqlconnector://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")
        latest_query = "SELECT AVG(avg_temperature) as current_avg_temp, MAX(avg_temperature) as current_max_temp, MIN(avg_temperature) as current_min_temp FROM processed_temperature_data WHERE measurement_date = (SELECT MAX(measurement_date) FROM processed_temperature_data)"
        latest_df = pd.read_sql(latest_query, engine)
        sensor_count_query = "SELECT COUNT(DISTINCT sensor_id) as sensor_count FROM temperature_analysis"
        sensor_count_df = pd.read_sql(sensor_count_query, engine)
        total_sensors = int(sensor_count_df['sensor_count'].iloc[0]) if not sensor_count_df.empty else 0
        date_range_query = "SELECT MIN(measurement_date) as min_date, MAX(measurement_date) as max_date FROM processed_temperature_data"
        date_range_df = pd.read_sql(date_range_query, engine)
        min_date_str = date_range_df['min_date'].iloc[0].strftime('%Y-%m-%d') if not date_range_df.empty and pd.notna(date_range_df['min_date'].iloc[0]) else None
        max_date_str = date_range_df['max_date'].iloc[0].strftime('%Y-%m-%d') if not date_range_df.empty and pd.notna(date_range_df['max_date'].iloc[0]) else None
        date_range_display = f"{min_date_str} ~ {max_date_str}" if min_date_str and max_date_str and min_date_str != max_date_str else (min_date_str or max_date_str)
        trends_query = "SELECT trend_type, COUNT(*) as count FROM temperature_analysis GROUP BY trend_type"
        trends_df = pd.read_sql(trends_query, engine)
        alerts_query = "SELECT alert_level, COUNT(*) as count FROM temperature_analysis GROUP BY alert_level"
        alerts_df = pd.read_sql(alerts_query, engine)

        stats = {
            'current_temperature': {
                'avg': float(latest_df['current_avg_temp'].iloc[0]) if not latest_df.empty and pd.notna(latest_df['current_avg_temp'].iloc[0]) else None,
                'max': float(latest_df['current_max_temp'].iloc[0]) if not latest_df.empty and pd.notna(latest_df['current_max_temp'].iloc[0]) else None,
                'min': float(latest_df['current_min_temp'].iloc[0]) if not latest_df.empty and pd.notna(latest_df['current_min_temp'].iloc[0]) else None,
                'sensor_count': total_sensors,
                'date_range': date_range_display
            },
            'trends': trends_df.set_index('trend_type')['count'].to_dict() if not trends_df.empty else {},
            'alerts': alerts_df.set_index('alert_level')['count'].to_dict() if not alerts_df.empty else {}
        }
        # 使用 json.dumps 处理 Decimal/NaN
        return json.dumps({'status': 'success', 'data': stats, 'message': '成功获取温度统计概览'}, default=str)
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'status': 'error','message': f'获取温度统计概览失败: {str(e)}'}), 500

@temperature_api.route('/temperature/upload', methods=['POST'])
def upload_temperature_data():
    """处理MDB文件上传请求"""
    # ... (代码保持不变) ...
    if 'file' not in request.files: return jsonify({'status': 'error','message': '没有发现文件'}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({'status': 'error','message': '没有选择文件'}), 400
    if not file.filename.endswith(('.mdb', '.accdb')): return jsonify({'status': 'error','message': '只支持Access数据库文件(.mdb, .accdb)'}), 400
    try:
        upload_folder = os.path.join(os.getcwd(), 'temp_uploads')
        os.makedirs(upload_folder, exist_ok=True)
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        unique_filename = f"{timestamp}_{filename}"
        file_path = os.path.join(upload_folder, unique_filename)
        file.save(file_path)
        task_id = str(uuid.uuid4())
        processing_tasks[task_id] = {
            'status': 'pending',
            'message': '准备处理温度数据...',
            'file_path': file_path,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        process_thread = threading.Thread(target=process_temperature_file, args=(task_id, file_path))
        process_thread.daemon = True
        process_thread.start()
        return jsonify({'status': 'success','message': '文件上传成功，开始处理温度数据','task_id': task_id})
    except Exception as e: return jsonify({'status': 'error','message': f'文件上传失败: {str(e)}'}), 500


def process_temperature_file(task_id, file_path):
    """后台处理上传的MDB文件"""
    # ... (代码保持不变) ...
    task = processing_tasks[task_id]
    try:
        task['status'] = 'importing'
        task['message'] = '正在导入温度数据到数据库...'
        task['updated_at'] = datetime.now().isoformat()
        success = import_mdb_to_mysql(file_path)
        if not success: raise Exception("导入失败")

        task['status'] = 'processing'
        task['message'] = '正在处理和分析温度数据...'
        task['updated_at'] = datetime.now().isoformat()
        success = process_temperature_data()
        if not success: raise Exception("处理失败")

        task['status'] = 'completed'
        task['message'] = '温度数据处理完成'
        task['updated_at'] = datetime.now().isoformat()
        try: os.remove(file_path)
        except: pass
    except Exception as e:
        task['status'] = 'failed'
        task['message'] = f'处理过程中出错: {str(e)}'
        task['updated_at'] = datetime.now().isoformat()

# =========================================================
# 视角数据 API 路由 (新增)
# =========================================================
@app.route('/api/viewpoints', methods=['POST'])
def save_viewpoint():
    """保存或更新单个视角数据"""
    data = request.get_json()
    if not data or 'point_id' not in data or 'position' not in data or 'target' not in data:
        return jsonify({'success': False, 'message': '缺少必要的数据 (point_id, position, target)'}), 400

    point_id = data['point_id']
    pos = data['position']
    tgt = data['target']

    # 数据格式验证
    if not isinstance(pos, list) or len(pos) != 3 or not all(isinstance(n, (int, float)) for n in pos):
         return jsonify({'success': False, 'message': 'position 数据格式错误 (应为包含3个数字的列表)'}), 400
    if not isinstance(tgt, list) or len(tgt) != 3 or not all(isinstance(n, (int, float)) for n in tgt):
         return jsonify({'success': False, 'message': 'target 数据格式错误 (应为包含3个数字的列表)'}), 400

    conn = get_db_connection() # 使用已有的辅助函数
    if not conn:
         return jsonify({'success': False, 'message': '数据库连接失败'}), 500

    cursor = conn.cursor()
    try:
        # 使用 INSERT ... ON DUPLICATE KEY UPDATE 保存或更新
        # 要求 viewpoints 表的 point_id 是 PRIMARY KEY 或 UNIQUE KEY
        sql = """
        INSERT INTO viewpoints (point_id, pos_x, pos_y, pos_z, tgt_x, tgt_y, tgt_z)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
        pos_x = VALUES(pos_x), pos_y = VALUES(pos_y), pos_z = VALUES(pos_z),
        tgt_x = VALUES(tgt_x), tgt_y = VALUES(tgt_y), tgt_z = VALUES(tgt_z)
        """
        cursor.execute(sql, (point_id, pos[0], pos[1], pos[2], tgt[0], tgt[1], tgt[2]))
        conn.commit()
        print(f"视角数据已保存/更新: {point_id}") # 在后端打印日志
        return jsonify({'success': True, 'message': f'视角 {point_id} 已保存/更新'})

    except mysql.connector.Error as err:
        conn.rollback()
        print(f"数据库错误 (保存视角): {err}")
        return jsonify({'success': False, 'message': '数据库操作失败'}), 500
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()

@app.route('/api/viewpoints', methods=['GET'])
def get_viewpoints():
    """获取所有已保存的视角数据"""
    conn = get_db_connection() # 使用已有的辅助函数
    if not conn:
         return jsonify({'success': False, 'message': '数据库连接失败'}), 500

    cursor = conn.cursor(dictionary=True) # 返回字典形式的结果
    try:
        cursor.execute("SELECT point_id, pos_x, pos_y, pos_z, tgt_x, tgt_y, tgt_z FROM viewpoints ORDER BY point_id")
        viewpoints_data = cursor.fetchall()

        # 将数据库结果转换为前端需要的格式: {'S1': {position: [...], target: [...]}, ...}
        formatted_viewpoints = {}
        for row in viewpoints_data:
            formatted_viewpoints[row['point_id']] = {
                # 确保从数据库读出的也是浮点数，或者在查询时转换
                'position': [float(row['pos_x']), float(row['pos_y']), float(row['pos_z'])],
                'target': [float(row['tgt_x']), float(row['tgt_y']), float(row['tgt_z'])]
            }

        # 使用 json.dumps 处理 Decimal（如果数据库字段是 Decimal 且未在上面转为 float）
        # 如果上面已转为float，可以直接 jsonify
        # 注意: 之前的 get_summary 返回了 json string, 这里保持一致也用 json.dumps
        return json.dumps({'success': True, 'data': formatted_viewpoints}, default=decimal_default)


    except mysql.connector.Error as err:
        print(f"数据库错误 (获取视角): {err}")
        return jsonify({'success': False, 'message': '数据库查询失败'}), 500
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


# =========================================================
# 注册Blueprint并启动应用
# =========================================================
# 注册蓝图 - 这是最重要的修改，确保裂缝API路由能够被访问
app.register_blueprint(crack_api)
# 注册温度API蓝图
app.register_blueprint(temperature_api)
# 注册振动API蓝图
app.register_blueprint(vibration_bp)

# 健康检查路由
@app.route('/api/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    })

# 处理状态路由 - 确保只有一个定义
@app.route('/api/process-status', methods=['GET'])
def process_status():
    task_id = request.args.get('task_id')
    if not task_id or task_id not in processing_tasks:
        return jsonify({
            'status': 'unknown',
            'message': '未找到任务状态'
        })

    task = processing_tasks[task_id]
    # 添加任务清理逻辑（如果需要）
    # ...

    return jsonify(processing_tasks.get(task_id, {'status':'unknown', 'message':'任务已过期或未找到'})) # 使用get更安全

if __name__ == '__main__':
    # 初始化振动数据库表 (保持不变)
    try:
        print("正在初始化振动数据库表...")
        conn = get_db_connection()
        if conn: # 检查连接是否成功
            cursor = conn.cursor()
            schema_path = os.path.join(os.path.dirname(__file__), 'schema', 'vibration_schema.sql')
            if os.path.exists(schema_path):
                with open(schema_path, 'r', encoding='utf-8') as f:
                    sql_script = f.read()
                    # 使用 execute 执行多语句（如果驱动支持）或分割
                    for result in cursor.execute(sql_script, multi=True):
                        pass # 消耗结果
                conn.commit()
                print("振动数据库表初始化完成")
            else:
                print(f"警告：找不到振动表结构文件 {schema_path}")
            cursor.close()
            conn.close()
        else:
            print("错误：无法连接数据库，跳过振动表初始化。")
    except Exception as e:
        print(f"初始化振动数据库表时出错: {str(e)}")

    # 确保static目录存在 (保持不变)
    static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../static'))
    os.makedirs(static_dir, exist_ok=True)

    print(f"静态文件目录: {static_dir}")

    # 运行API服务
    # 注意：将 host 设置为 '0.0.0.0' 使其可以从局域网访问
    print("启动Flask应用...")
    app.run(debug=True, host='0.0.0.0', port=5000)
