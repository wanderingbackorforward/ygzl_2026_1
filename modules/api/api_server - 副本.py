"""
监测系统API服务器
提供沉降监测和裂缝监测数据的API接口
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
from modules.database.db_config import db_config
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

# 创建裂缝API蓝图 - 使用统一的前缀/api保持一致性
crack_api = Blueprint('crack_api', __name__, url_prefix='/api')

# 创建温度API蓝图
temperature_api = Blueprint('temperature_api', __name__, url_prefix='/api')

# =========================================================
# 辅助函数
# =========================================================
def get_db_connection():
    """创建数据库连接"""
    return mysql.connector.connect(**db_config)

# 允许的文件类型
ALLOWED_EXTENSIONS = {'xlsx', 'xls'}

# 检查文件扩展名是否允许
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# 存储任务状态的字典
processing_tasks = {}

# =========================================================
# 沉降监测API路由
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
        WHERE point_id = '{point_id}'
        ORDER BY measurement_date
    """
    time_series_data = pd.read_sql(time_series_query, conn)

    # 转换datetime为字符串以便JSON序列化
    time_series_data['measurement_date'] = time_series_data['measurement_date'].astype(str)

    # 将 NaN 替换为 None
    time_series_data = time_series_data.replace({np.nan: None})

    # 获取分析结果
    analysis_query = f"""
        SELECT *
        FROM settlement_analysis
        WHERE point_id = '{point_id}'
    """
    analysis_data = pd.read_sql(analysis_query, conn)

    # 同样替换分析数据中的 NaN
    analysis_data = analysis_data.replace({np.nan: None})

    conn.close()

    # 返回JSON结果
    response = {
        'timeSeriesData': time_series_data.to_dict('records'),
        'analysisData': analysis_data.to_dict('records')[0] if not analysis_data.empty else {}
    }

    return jsonify(response)

@app.route('/api/summary')
def get_summary():
    """获取所有监测点的汇总分析"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query = """
    SELECT * FROM settlement_analysis
    ORDER BY CAST(REGEXP_REPLACE(point_id, '[^0-9]', '') AS UNSIGNED)
    """

    cursor.execute(query)
    summary = cursor.fetchall()

    cursor.close()
    conn.close()

    return jsonify(summary)

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
# 文件上传和处理API
# =========================================================
@app.route('/api/upload', methods=['POST'])
def upload_file():
    """处理文件上传请求"""
    # 检查是否有文件在请求中
    if 'file' not in request.files:
        return jsonify({'error': '没有文件'}), 400

    file = request.files['file']

    # 检查文件名是否为空
    if file.filename == '':
        return jsonify({'error': '未选择文件'}), 400

    # 检查文件类型
    if not allowed_file(file.filename):
        return jsonify({'error': '不支持的文件类型，请上传.xlsx或.xls文件'}), 400

    try:
        # 创建临时目录（如果不存在）
        upload_folder = os.path.join(os.getcwd(), 'temp_uploads')
        os.makedirs(upload_folder, exist_ok=True)

        # 保存文件
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        unique_filename = f"{timestamp}_{filename}"
        file_path = os.path.join(upload_folder, unique_filename)
        file.save(file_path)

        # 创建处理任务
        task_id = str(uuid.uuid4())
        processing_tasks[task_id] = {
            'status': 'pending',
            'message': '准备处理数据...',
            'file_path': file_path,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }

        # 启动后台处理线程
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

@app.route('/api/process-status', methods=['GET'])
def get_process_status():
    """获取数据处理状态"""
    task_id = request.args.get('task_id')

    if not task_id or task_id not in processing_tasks:
        return jsonify({'error': '无效的任务ID'}), 404

    task = processing_tasks[task_id]

    # 如果任务已完成并且超过1小时，从字典中移除以释放内存
    if task['status'] in ['completed', 'failed']:
        created_time = datetime.fromisoformat(task['created_at'])
        current_time = datetime.now()
        time_diff = (current_time - created_time).total_seconds() / 3600  # 小时
        if time_diff > 1:
            # 返回信息前删除任务
            result = {
                'status': task['status'],
                'message': task['message']
            }
            del processing_tasks[task_id]
            return jsonify(result)

    return jsonify({
        'status': task['status'],
        'message': task['message'],
        'updated_at': task['updated_at']
    })

def process_uploaded_file(task_id, file_path):
    """后台处理上传的文件"""
    task = processing_tasks[task_id]

    try:
        # 更新任务状态
        task['status'] = 'importing'
        task['message'] = '正在导入数据到数据库...'
        task['updated_at'] = datetime.now().isoformat()

        # 步骤1: 导入Excel到MySQL
        success = import_excel_to_mysql(file_path)
        if not success:
            task['status'] = 'failed'
            task['message'] = '数据导入失败'
            task['updated_at'] = datetime.now().isoformat()
            return

        # 更新任务状态
        task['status'] = 'processing'
        task['message'] = '正在处理和分析数据...'
        task['updated_at'] = datetime.now().isoformat()

        # 步骤2: 处理数据
        success = process_data()
        if not success:
            task['status'] = 'failed'
            task['message'] = '数据处理失败'
            task['updated_at'] = datetime.now().isoformat()
            return

        # 更新任务状态
        task['status'] = 'updating_coordinates'
        task['message'] = '正在更新监测点坐标...'
        task['updated_at'] = datetime.now().isoformat()

        # 步骤3: 更新监测点坐标
        success = update_monitoring_points()
        if not success:
            task['status'] = 'failed'
            task['message'] = '监测点坐标更新失败'
            task['updated_at'] = datetime.now().isoformat()
            return

        # 处理完成
        task['status'] = 'completed'
        task['message'] = '数据处理完成'
        task['updated_at'] = datetime.now().isoformat()

        # 删除临时文件
        try:
            os.remove(file_path)
        except:
            pass

    except Exception as e:
        task['status'] = 'failed'
        task['message'] = f'处理过程中出错: {str(e)}'
        task['updated_at'] = datetime.now().isoformat()

# =========================================================
# 裂缝监测API路由
# =========================================================

def clean_nan_values(df):
    """将DataFrame中的NaN值替换为None，这样在转换为JSON时会变成null"""
    return df.where(pd.notna(df), None)

@crack_api.route('/crack/upload', methods=['POST'])
def upload_crack_data():
    """上传裂缝数据Excel文件"""
    print("upload_crack_data()被调用")
    if 'file' not in request.files:
        return jsonify({
            'status': 'error',
            'message': '没有发现文件'
        }), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({
            'status': 'error',
            'message': '没有选择文件'
        }), 400

    if not file.filename.endswith(('.xlsx', '.xls')):
        return jsonify({
            'status': 'error',
            'message': '只支持Excel文件(.xlsx, .xls)'
        }), 400

    try:
        # 保存文件到临时目录
        temp_dir = 'temp_uploads'
        os.makedirs(temp_dir, exist_ok=True)
        upload_path = os.path.join(temp_dir, file.filename)
        file.save(upload_path)

        # 检查数据库是否存在
        try:
            engine = create_engine(
                f"mysql+pymysql://{db_config['user']}:{db_config['password']}@{db_config['host']}")

            # 尝试连接到数据库
            conn = engine.connect()
            try:
                conn.execute(f"USE {db_config['database']}")
                database_exists = True
            except:
                database_exists = False
            conn.close()
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': f'数据库连接失败: {str(e)}'
            }), 500

        if not database_exists:
            # 首次导入
            print("首次导入")
            success = first_time_import(upload_path)
            action = "首次导入"
        else:
            # 更新导入
            print("更新导入")
            success = import_crack_excel(upload_path)  # 使用重命名后的函数
            action = "更新导入"

        if success:
            # 处理导入的数据
            process_success = process_crack_data()

            if process_success:
                return jsonify({
                    'status': 'success',
                    'message': f'成功{action}并处理裂缝数据文件'
                })
            else:
                return jsonify({
                    'status': 'warning',
                    'message': f'{action}成功，但处理数据失败'
                }), 500
        else:
            return jsonify({
                'status': 'error',
                'message': f'{action}裂缝数据失败，请查看服务器日志'
            }), 500

    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'处理上传文件时出错: {str(e)}'
        }), 500
    finally:
        # 清理临时文件
        if os.path.exists(upload_path):
            try:
                os.remove(upload_path)
            except:
                pass

@crack_api.route('/crack/monitoring_points', methods=['GET'])
def get_crack_monitoring_points():
    """获取所有裂缝监测点信息"""
    try:
        engine = create_engine(
            f"mysql+pymysql://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")

        query = "SELECT * FROM crack_monitoring_points WHERE status = 'active'"
        df = pd.read_sql(query, engine)

        # 格式化日期
        if 'monitoring_start_date' in df.columns:
            df['monitoring_start_date'] = df['monitoring_start_date'].dt.strftime('%Y-%m-%d %H:%M:%S')
        if 'monitoring_end_date' in df.columns:
            df['monitoring_end_date'] = df['monitoring_end_date'].dt.strftime('%Y-%m-%d %H:%M:%S')

        # 清理NaN值
        df = clean_nan_values(df)

        # 将DataFrame转换为JSON
        result = df.to_dict(orient='records')

        return jsonify({
            'status': 'success',
            'data': result,
            'message': f'成功获取{len(result)}个裂缝监测点'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'获取裂缝监测点失败: {str(e)}'
        }), 500


@crack_api.route('/crack/data', methods=['GET'])
def get_crack_data():
    """获取裂缝数据"""
    try:
        engine = create_engine(
            f"mysql+pymysql://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")

        query = "SELECT * FROM raw_crack_data ORDER BY measurement_date"
        df = pd.read_sql(query, engine)

        # 转换日期格式
        df['measurement_date'] = df['measurement_date'].dt.strftime('%Y-%m-%d %H:%M:%S')

        # 清理NaN值
        df = clean_nan_values(df)

        # 将DataFrame转换为JSON
        result = df.to_dict(orient='records')

        # 确保没有任何NaN值
        result_str = json.dumps(result)
        result_str = result_str.replace('NaN', 'null')
        result = json.loads(result_str)

        return jsonify({
            'status': 'success',
            'data': result,
            'message': f'成功获取{len(result)}行裂缝数据'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'获取裂缝数据失败: {str(e)}'
        }), 500

@crack_api.route('/crack/analysis_results', methods=['GET'])
def get_crack_analysis_results():
    """获取裂缝分析结果"""
    try:
        engine = create_engine(
            f"mysql+pymysql://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")

        query = """
        SELECT r.*, p.trend_type, p.change_type
        FROM crack_analysis_results r
        JOIN crack_monitoring_points p ON r.point_id = p.point_id
        ORDER BY r.analysis_date DESC
        """
        df = pd.read_sql(query, engine)

        # 转换日期格式
        df['analysis_date'] = df['analysis_date'].dt.strftime('%Y-%m-%d %H:%M:%S')

        # 清理NaN值
        df = clean_nan_values(df)

        # 将DataFrame转换为JSON
        result = df.to_dict(orient='records')

        return jsonify({
            'status': 'success',
            'data': result,
            'message': f'成功获取{len(result)}条裂缝分析结果'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'获取裂缝分析结果失败: {str(e)}'
        }), 500


@crack_api.route('/crack/trend_data', methods=['GET'])
def get_crack_trend_data():
    """获取裂缝趋势数据，适用于前端图表展示"""
    try:
        engine = create_engine(
            f"mysql+pymysql://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")

        # 获取原始数据
        query = "SELECT * FROM raw_crack_data ORDER BY measurement_date"
        df = pd.read_sql(query, engine)

        if 'id' in df.columns:
            df.drop(columns=['id'], inplace=True)

        # 获取所有监测点列
        point_columns = [col for col in df.columns if col != 'measurement_date']

        # 转换日期格式
        dates = df['measurement_date'].dt.strftime('%Y-%m-%d %H:%M:%S').tolist()

        # 清理NaN值
        df = clean_nan_values(df)

        # 准备图表数据
        series_data = []
        for point in point_columns:
            # 确保列表中没有None或NaN值
            point_values = df[point].tolist()
            cleaned_values = [None if pd.isna(val) else val for val in point_values]

            point_data = {
                'name': point,
                'data': cleaned_values
            }
            series_data.append(point_data)

        trend_data = {
            'dates': dates,
            'series': series_data
        }

        # 最后一层保险：将整个JSON转为字符串，替换任何遗漏的NaN
        trend_data_str = json.dumps(trend_data)
        trend_data_str = trend_data_str.replace('NaN', 'null')
        trend_data = json.loads(trend_data_str)

        return jsonify({
            'status': 'success',
            'data': trend_data,
            'message': '成功获取裂缝趋势数据'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'获取裂缝趋势数据失败: {str(e)}'
        }), 500

@crack_api.route('/crack/stats_overview', methods=['GET'])
def get_crack_stats_overview():
    """获取裂缝监测点统计概况"""
    try:
        engine = create_engine(
            f"mysql+pymysql://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")

        # 获取监测点信息
        query = "SELECT * FROM crack_monitoring_points WHERE status = 'active'"
        df = pd.read_sql(query, engine)

        if df.empty:
            return jsonify({
                'status': 'warning',
                'message': '没有找到裂缝监测点数据'
            })

        # 计算统计概况
        total_points = len(df)
        expanding_points = len(df[df['change_type'] == '扩展'])
        shrinking_points = len(df[df['change_type'] == '收缩'])
        stable_points = len(df[df['change_type'] == '稳定'])

        # 计算平均斜率和最大变化率
        avg_slope = df['trend_slope'].mean()
        max_change_rate = df['average_change_rate'].abs().max()

        # 按趋势类型分组
        trend_types = df['trend_type'].value_counts().to_dict()

        # 确保没有NaN值在结果中
        overview = {
            'total_points': total_points,
            'expanding_points': expanding_points,
            'shrinking_points': shrinking_points,
            'stable_points': stable_points,
            'avg_slope': float(avg_slope) if not pd.isna(avg_slope) else None,
            'max_change_rate': float(max_change_rate) if not pd.isna(max_change_rate) else None,
            'trend_types': trend_types
        }

        return jsonify({
            'status': 'success',
            'data': overview,
            'message': '成功获取裂缝统计概况'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'获取裂缝统计概况失败: {str(e)}'
        }), 500

# =========================================================
# 温度监测API路由
# =========================================================

@temperature_api.route('/temperature/points', methods=['GET'])
def get_temperature_points():
    """获取所有温度监测点信息"""
    try:
        engine = create_engine(
            f"mysql+pymysql://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")

        query = "SELECT * FROM temperature_monitoring_points WHERE status = 'active'"
        df = pd.read_sql(query, engine)

        # 清理NaN值
        df = clean_nan_values(df)

        # 将DataFrame转换为JSON
        result = df.to_dict(orient='records')

        return jsonify({
            'status': 'success',
            'data': result,
            'message': f'成功获取{len(result)}个温度监测点'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'获取温度监测点失败: {str(e)}'
        }), 500

@temperature_api.route('/temperature/summary', methods=['GET'])
def get_temperature_summary():
    """获取温度监测点的汇总分析"""
    try:
        engine = create_engine(
            f"mysql+pymysql://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")

        query = """
        SELECT * FROM temperature_analysis
        ORDER BY CAST(REGEXP_REPLACE(sensor_id, '[^0-9]', '') AS UNSIGNED)
        """
        df = pd.read_sql(query, engine)

        # 将last_updated转换为字符串
        if 'last_updated' in df.columns:
            df['last_updated'] = df['last_updated'].dt.strftime('%Y-%m-%d %H:%M:%S')

        # 清理NaN值
        df = clean_nan_values(df)

        # 将DataFrame转换为JSON
        result = df.to_dict(orient='records')

        return jsonify({
            'status': 'success',
            'data': result,
            'message': f'成功获取{len(result)}个温度监测点的分析结果'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'获取温度分析结果失败: {str(e)}'
        }), 500

@temperature_api.route('/temperature/data/<sensor_id>', methods=['GET'])
def get_temperature_data(sensor_id):
    """获取特定传感器的温度数据"""
    try:
        engine = create_engine(
            f"mysql+pymysql://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")

        # 获取传感器的处理后的温度数据
        query = f"""
        SELECT * FROM processed_temperature_data
        WHERE SID = '{sensor_id}'
        ORDER BY measurement_date
        """
        data_df = pd.read_sql(query, engine)

        # 格式化日期
        data_df['measurement_date'] = data_df['measurement_date'].dt.strftime('%Y-%m-%d')

        # 清理NaN值
        data_df = clean_nan_values(data_df)

        # 获取传感器的分析结果
        analysis_query = f"""
        SELECT * FROM temperature_analysis
        WHERE sensor_id = '{sensor_id}'
        """
        try:
            analysis_df = pd.read_sql(analysis_query, engine)
            if not analysis_df.empty:
                # 格式化日期
                if 'last_updated' in analysis_df.columns:
                    analysis_df['last_updated'] = analysis_df['last_updated'].dt.strftime('%Y-%m-%d %H:%M:%S')
                analysis_data = clean_nan_values(analysis_df).to_dict(orient='records')[0]
            else:
                analysis_data = {}
        except:
            analysis_data = {}

        return jsonify({
            'status': 'success',
            'data': {
                'timeSeriesData': data_df.to_dict(orient='records'),
                'analysisData': analysis_data
            },
            'message': f'成功获取传感器 {sensor_id} 的温度数据'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'获取温度数据失败: {str(e)}'
        }), 500

@temperature_api.route('/temperature/trends', methods=['GET'])
def get_temperature_trends():
    """获取温度趋势分类统计"""
    try:
        engine = create_engine(
            f"mysql+pymysql://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")

        query = """
        SELECT trend_type, COUNT(*) as count
        FROM temperature_analysis
        GROUP BY trend_type
        """
        df = pd.read_sql(query, engine)

        # 清理NaN值
        df = clean_nan_values(df)

        # 将DataFrame转换为JSON
        result = df.to_dict(orient='records')

        return jsonify({
            'status': 'success',
            'data': result,
            'message': f'成功获取温度趋势分类统计'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'获取温度趋势分类统计失败: {str(e)}'
        }), 500

@temperature_api.route('/temperature/stats', methods=['GET'])
def get_temperature_stats():
    """获取温度数据的统计概览"""
    try:
        engine = create_engine(
            f"mysql+pymysql://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")

        # 获取最新一天的平均温度
        latest_query = """
        SELECT AVG(avg_temperature) as current_avg_temp, 
               MAX(avg_temperature) as current_max_temp,
               MIN(avg_temperature) as current_min_temp
        FROM processed_temperature_data
        WHERE measurement_date = (SELECT MAX(measurement_date) FROM processed_temperature_data)
        """
        latest_df = pd.read_sql(latest_query, engine)

        # 获取传感器总数
        sensor_count_query = """
        SELECT COUNT(DISTINCT sensor_id) as sensor_count 
        FROM temperature_analysis
        """
        sensor_count_df = pd.read_sql(sensor_count_query, engine)
        total_sensors = int(sensor_count_df['sensor_count'].iloc[0]) if not sensor_count_df.empty else 0

        # 获取最早和最晚测量日期
        date_range_query = """
        SELECT MIN(measurement_date) as min_date, MAX(measurement_date) as max_date
        FROM processed_temperature_data
        """
        date_range_df = pd.read_sql(date_range_query, engine)
        min_date_str = date_range_df['min_date'].iloc[0].strftime('%Y-%m-%d') if not date_range_df.empty and not pd.isna(date_range_df['min_date'].iloc[0]) else None
        max_date_str = date_range_df['max_date'].iloc[0].strftime('%Y-%m-%d') if not date_range_df.empty and not pd.isna(date_range_df['max_date'].iloc[0]) else None

        date_range_display = None
        if min_date_str and max_date_str:
            if min_date_str == max_date_str:
                date_range_display = min_date_str
            else:
                date_range_display = f"{min_date_str} ~ {max_date_str}"
        elif min_date_str:
             date_range_display = min_date_str
        elif max_date_str: # Should not happen if min_date is null, but included for completeness
             date_range_display = max_date_str

        # 获取趋势分类统计
        trends_query = """
        SELECT trend_type, COUNT(*) as count
        FROM temperature_analysis
        GROUP BY trend_type
        """
        trends_df = pd.read_sql(trends_query, engine)

        # 获取告警等级统计
        alerts_query = """
        SELECT alert_level, COUNT(*) as count
        FROM temperature_analysis
        GROUP BY alert_level
        """
        alerts_df = pd.read_sql(alerts_query, engine)

        # 清理NaN值
        latest_df = clean_nan_values(latest_df)
        trends_df = clean_nan_values(trends_df)
        alerts_df = clean_nan_values(alerts_df)

        # 汇总统计结果
        stats = {
            'current_temperature': {
                'avg': float(latest_df['current_avg_temp'].iloc[0]) if not latest_df.empty and not pd.isna(latest_df['current_avg_temp'].iloc[0]) else None,
                'max': float(latest_df['current_max_temp'].iloc[0]) if not latest_df.empty and not pd.isna(latest_df['current_max_temp'].iloc[0]) else None,
                'min': float(latest_df['current_min_temp'].iloc[0]) if not latest_df.empty and not pd.isna(latest_df['current_min_temp'].iloc[0]) else None,
                'sensor_count': total_sensors,
                'date_range': date_range_display
            },
            'trends': trends_df.set_index('trend_type')['count'].to_dict() if not trends_df.empty else {},
            'alerts': alerts_df.set_index('alert_level')['count'].to_dict() if not alerts_df.empty else {}
        }

        return jsonify({
            'status': 'success',
            'data': stats,
            'message': '成功获取温度统计概览'
        })
    except Exception as e:
        # Log the exception for debugging
        print(f"Error in get_temperature_stats: {str(e)}")
        import traceback
        traceback.print_exc()

        return jsonify({
            'status': 'error',
            'message': f'获取温度统计概览失败: {str(e)}'
        }), 500

@temperature_api.route('/temperature/upload', methods=['POST'])
def upload_temperature_data():
    """处理MDB文件上传请求"""
    if 'file' not in request.files:
        return jsonify({
            'status': 'error',
            'message': '没有发现文件'
        }), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({
            'status': 'error',
            'message': '没有选择文件'
        }), 400

    if not file.filename.endswith(('.mdb', '.accdb')):
        return jsonify({
            'status': 'error',
            'message': '只支持Access数据库文件(.mdb, .accdb)'
        }), 400

    try:
        # 创建临时目录（如果不存在）
        upload_folder = os.path.join(os.getcwd(), 'temp_uploads')
        os.makedirs(upload_folder, exist_ok=True)

        # 保存文件
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        unique_filename = f"{timestamp}_{filename}"
        file_path = os.path.join(upload_folder, unique_filename)
        file.save(file_path)

        # 创建处理任务
        task_id = str(uuid.uuid4())
        processing_tasks[task_id] = {
            'status': 'pending',
            'message': '准备处理温度数据...',
            'file_path': file_path,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }

        # 启动后台处理线程
        process_thread = threading.Thread(
            target=process_temperature_file,
            args=(task_id, file_path)
        )
        process_thread.daemon = True
        process_thread.start()

        return jsonify({
            'status': 'success',
            'message': '文件上传成功，开始处理温度数据',
            'task_id': task_id
        })

    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'文件上传失败: {str(e)}'
        }), 500

def process_temperature_file(task_id, file_path):
    """后台处理上传的MDB文件"""
    task = processing_tasks[task_id]

    try:
        # 更新任务状态
        task['status'] = 'importing'
        task['message'] = '正在导入温度数据到数据库...'
        task['updated_at'] = datetime.now().isoformat()

        # 步骤1: 导入MDB到MySQL
        success = import_mdb_to_mysql(file_path)
        if not success:
            task['status'] = 'failed'
            task['message'] = '温度数据导入失败'
            task['updated_at'] = datetime.now().isoformat()
            return

        # 更新任务状态
        task['status'] = 'processing'
        task['message'] = '正在处理和分析温度数据...'
        task['updated_at'] = datetime.now().isoformat()

        # 步骤2: 处理温度数据
        success = process_temperature_data()
        if not success:
            task['status'] = 'failed'
            task['message'] = '温度数据处理失败'
            task['updated_at'] = datetime.now().isoformat()
            return

        # 处理完成
        task['status'] = 'completed'
        task['message'] = '温度数据处理完成'
        task['updated_at'] = datetime.now().isoformat()

        # 删除临时文件
        try:
            os.remove(file_path)
        except:
            pass

    except Exception as e:
        task['status'] = 'failed'
        task['message'] = f'处理过程中出错: {str(e)}'
        task['updated_at'] = datetime.now().isoformat()

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

# 上传文件状态信息
upload_status = {}

# 处理状态路由
@app.route('/api/process-status', methods=['GET'])
def process_status():
    task_id = request.args.get('task_id')
    if not task_id or task_id not in processing_tasks:
        return jsonify({
            'status': 'unknown',
            'message': '未找到任务状态'
        })

    return jsonify(processing_tasks[task_id])

if __name__ == '__main__':
    # 初始化振动数据库表
    try:
        print("正在初始化振动数据库表...")
        conn = get_db_connection()
        cursor = conn.cursor()

        # 读取并执行振动表结构SQL文件
        schema_path = os.path.join(os.path.dirname(__file__), 'schema', 'vibration_schema.sql')
        if os.path.exists(schema_path):
            with open(schema_path, 'r', encoding='utf-8') as f:
                sql_commands = f.read()
                # 由于SQL文件中可能包含多条语句，需要分别执行
                for command in sql_commands.split(';'):
                    if command.strip():
                        cursor.execute(command)
            conn.commit()
            print("振动数据库表初始化完成")
        else:
            print(f"警告：找不到振动表结构文件 {schema_path}")

        cursor.close()
        conn.close()
    except Exception as e:
        print(f"初始化振动数据库表时出错: {str(e)}")

    # 确保static目录存在
    static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../static'))
    os.makedirs(static_dir, exist_ok=True)

    print(f"静态文件目录: {static_dir}")

    # 运行API服务
    app.run(debug=True, host='0.0.0.0', port=5000)