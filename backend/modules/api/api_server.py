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

from flask import Flask, Blueprint, jsonify, request, send_from_directory, render_template, redirect
from flask_cors import CORS
import mysql.connector
import numpy as np
import pandas as pd
from sqlalchemy import create_engine
from werkzeug.utils import secure_filename

# 只添加一次项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# 加载 .env 环境变量
try:
    from dotenv import load_dotenv
    # api_server.py 位于 backend/modules/api/, .env 位于 python_scripts/
    _env_path = os.path.join(os.path.dirname(__file__), '../../../.env')
    if os.path.exists(_env_path):
        load_dotenv(_env_path)
except ImportError:
    pass

# 导入沉降需要的模块
from modules.database.db_config import db_config
from modules.db.vendor import get_repo
import requests
repo = get_repo()
from modules.data_import.settlement_data_import import import_excel_to_mysql
from modules.data_processing.process_settlement_data import process_data, get_point_prediction, get_all_predictions_summary
from modules.data_processing.update_monitoring_points import update_monitoring_points
# 裂缝模块
from modules.data_import.crack_data_import import import_crack_excel, first_time_import
from modules.data_processing.process_crack_data import process_crack_data
# 温度模块
try:
    from modules.data_import.temperature_data_import import import_mdb_to_mysql
except Exception:
    def import_mdb_to_mysql(*args, **kwargs):
        raise RuntimeError("pyodbc 不可用：服务器环境不支持 MDB/ACCDB 导入")
from modules.data_processing.process_temperature_data import process_data as process_temperature_data
# 振动模块
from modules.api.vibration_handler import vibration_bp

# 工单系统模块
from modules.ticket_system.api import ticket_bp, user_bp

# 二级数据分析模块
from modules.analysis_v2.api import analysis_v2_bp
from modules.insar.api import insar_bp
from modules.tunnel.api import tunnel_bp
from modules.advanced_analysis.api import advanced_bp
from modules.assistant.api import assistant_bp

# 机器学习模块
from modules.ml_models.api import ml_api

# =========================================================
# 应用初始化：创建Flask应用和Blueprint
# =========================================================
app = Flask(__name__, static_folder='../../static', template_folder='../../templates')
CORS(app)  # 允许跨域请求
IS_VERCEL = os.environ.get('VERCEL') == '1'
if IS_VERCEL:
    upload_folder = '/tmp'
else:
    upload_folder = os.path.join(os.getcwd(), 'temp_uploads')
    os.makedirs(upload_folder, exist_ok=True)
app.config['UPLOAD_FOLDER'] = upload_folder
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 31536000

# React 构建产物目录（若存在则用于前端路由）
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
WEB_DIST_DIR = os.path.join(PROJECT_ROOT, 'web', 'dist')
WEB_INDEX_PATH = os.path.join(WEB_DIST_DIR, 'index.html')

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

def json_dumps_response(payload, status_code=200):
    return app.response_class(
        json.dumps(payload, default=decimal_default),
        status=status_code,
        mimetype='application/json'
    )

# ... (文件的其余部分保持不变) ...


# =========================================================
# 静态文件路由 - GLB文件专用处理
# =========================================================
@app.route('/static/glb/<path:filename>')
def serve_glb(filename):
    """
    专门处理GLB文件的路由，支持大文件传输
    设置正确的MIME类型和缓存头，启用分块传输
    """
    try:
        primary_glb_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../static/glb'))
        fallback_glb_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../static/glb'))
        glb_dir = primary_glb_dir if os.path.isdir(primary_glb_dir) else fallback_glb_dir
        file_path = os.path.join(glb_dir, filename)

        # 检查文件是否存在
        if not os.path.exists(file_path):
            print(f"GLB文件不存在: {file_path}")
            return jsonify({'error': '文件不存在'}), 404

        # 获取文件大小
        file_size = os.path.getsize(file_path)
        print(f"开始传输GLB文件: {filename} (大小: {file_size / 1024 / 1024:.1f} MB)")

        response = send_from_directory(glb_dir, filename, mimetype='model/gltf-binary', as_attachment=False, conditional=True)

        # 设置响应头，优化大文件传输
        response.headers['Cache-Control'] = 'public, max-age=31536000'
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Range'
        response.headers['Accept-Ranges'] = 'bytes'  # 支持断点续传
        response.headers['Connection'] = 'keep-alive'

        return response
    except Exception as e:
        print(f"GLB文件加载错误: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'文件加载失败: {str(e)}'}), 500

# =========================================================
# 沉降监测API路由 (保持不变)
# =========================================================
@app.route('/')
def index():
    if os.path.exists(WEB_INDEX_PATH):
        return send_from_directory(WEB_DIST_DIR, 'index.html')
    return app.send_static_file('cover.html')

# 为 React 构建产物提供静态资源访问（如 /assets/*）
@app.route('/assets/<path:filename>')
def react_assets(filename):
    if os.path.exists(WEB_DIST_DIR):
        return send_from_directory(os.path.join(WEB_DIST_DIR, 'assets'), filename)
    return jsonify({'error': 'React 构建资源不存在'}), 404

# 前端 SPA 路由兜底：当构建存在时，将非 /api 与非 /static 的路径交给 React
SPA_ROUTES = {
    'cover',
    'settlement', 'temperature', 'cracks', 'vibration',
    'insar', 'overview', 'three', 'tickets', 'tunnel'
}

# 为每个 SPA 路由创建专门的处理函数，避免 catch-all 拦截 API 请求
def _serve_spa():
    if os.path.exists(WEB_INDEX_PATH):
        return send_from_directory(WEB_DIST_DIR, 'index.html')
    return app.send_static_file('cover.html')

# 注册 SPA 路由
for _route in SPA_ROUTES:
    app.add_url_rule(f'/{_route}', f'spa_{_route}', _serve_spa)
    app.add_url_rule(f'/{_route}/<path:subpath>', f'spa_{_route}_sub', _serve_spa)

@app.route('/health')
def health():
    print("[API] GET /health")
    v = os.environ.get('DB_VENDOR', '').strip().lower()
    return jsonify({'status': 'healthy', 'vendor': v, 'timestamp': datetime.now().isoformat()})

@app.route('/api/points')
def get_all_points():
    print("[API] GET /api/points")
    """获取所有监测点信息"""
    points = repo.get_all_points()
    return jsonify(points)

@app.route('/api/point/<point_id>')
def get_point_data(point_id):
    print(f"[API] GET /api/point/{point_id}")
    """获取特定监测点的详细数据"""
    data = repo.get_point_detail(point_id)
    return jsonify(data)

@app.route('/api/summary')
def get_summary():
    print("[API] GET /api/summary")
    """获取所有监测点的汇总分析"""
    summary = repo.get_summary()
    return json.dumps(summary, default=decimal_default)

@app.route('/api/trends')
def get_trends():
    print("[API] GET /api/trends")
    """获取所有监测点的趋势分类统计"""
    trends = repo.get_trends()
    return jsonify(trends)

@app.route('/api/prediction/<point_id>')
def get_prediction(point_id):
    print(f"[API] GET /api/prediction/{point_id}")
    """获取特定监测点的趋势预测数据"""
    try:
        # 获取预测天数参数，默认30天
        days = request.args.get('days', 30, type=int)
        days = max(7, min(days, 90))  # 限制在7-90天之间

        prediction = get_point_prediction(point_id, days)
        if prediction is None:
            return jsonify({'error': f'未找到监测点 {point_id} 的数据或数据不足'}), 404

        return json.dumps(prediction, default=decimal_default)
    except Exception as e:
        print(f"获取预测数据失败: {str(e)}")
        return jsonify({'error': f'获取预测数据失败: {str(e)}'}), 500

@app.route('/api/predictions/summary')
def get_predictions_summary():
    print("[API] GET /api/predictions/summary")
    """获取所有监测点的预测汇总和风险评估"""
    try:
        summary = get_all_predictions_summary()
        return json.dumps(summary, default=decimal_default)
    except Exception as e:
        print(f"获取预测汇总失败: {str(e)}")
        return jsonify({'error': f'获取预测汇总失败: {str(e)}'}), 500

@app.route('/api/risk/alerts')
def get_risk_alerts():
    print("[API] GET /api/risk/alerts")
    """获取风险预警列表，按风险等级排序"""
    try:
        summary = get_all_predictions_summary()
        # 过滤出有风险的监测点
        alerts = [
            item for item in summary
            if item.get('risk_level') in ['critical', 'high', 'medium']
        ]
        # 按风险评分降序排列
        alerts.sort(key=lambda x: x.get('risk_score', 0), reverse=True)

        # 统计各风险等级数量
        stats = {
            'critical': len([a for a in alerts if a.get('risk_level') == 'critical']),
            'high': len([a for a in alerts if a.get('risk_level') == 'high']),
            'medium': len([a for a in alerts if a.get('risk_level') == 'medium']),
            'low': len([a for a in summary if a.get('risk_level') == 'low']),
            'normal': len([a for a in summary if a.get('risk_level') == 'normal']),
            'total': len(summary)
        }

        return json.dumps({
            'alerts': alerts,
            'stats': stats
        }, default=decimal_default)
    except Exception as e:
        print(f"获取风险预警失败: {str(e)}")
        return jsonify({'error': f'获取风险预警失败: {str(e)}'}), 500

# 使用 Flask 内置静态文件服务，并添加响应头处理
@app.after_request
def add_header(response):
    # 为所有响应添加 CORS 头
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Range'

    # 为 GLB/GLTF 文件添加特殊处理
    if request.path.endswith(('.glb', '.gltf')):
        response.headers['Content-Type'] = 'model/gltf-binary'
        response.headers['Accept-Ranges'] = 'bytes'
        response.headers['Cache-Control'] = 'public, max-age=31536000'

    # 为 JavaScript 文件设置正确的 MIME 类型
    elif request.path.endswith(('.js', '.mjs')):
        response.headers['Content-Type'] = 'application/javascript; charset=utf-8'

    return response

@app.route('/api/source')
def api_source():
    print("[API] GET /api/source")
    v = os.environ.get('DB_VENDOR', '').strip().lower()
    url = os.environ.get('SUPABASE_URL', '')
    def ok(fn):
        try:
            fn()
            return True
        except Exception:
            return False
    diagnostics = {
        'settlement': {'supabase_ok': ok(lambda: repo.get_all_points())},
        'crack': {'supabase_ok': ok(lambda: repo.crack_get_monitoring_points())},
        'temperature': {'supabase_ok': ok(lambda: repo.temperature_get_points())},
        'tickets': {'supabase_ok': ok(lambda: __import__('modules.ticket_system.models').ticket_system.models.ticket_model.get_tickets({}, 1, 0))}
    }
    return jsonify({'db_vendor': v, 'source': v or 'mysql', 'supabase_url': url, 'diagnostics': diagnostics})

@app.route('/api/source/diagnostics')
def api_source_diagnostics():
    print("[API] GET /api/source/diagnostics")
    v = os.environ.get('DB_VENDOR', '').strip().lower()
    url = os.environ.get('SUPABASE_URL', '')
    result = {'vendor': v, 'supabase_url': url, 'domains': {}}
    def ok(fn):
        try:
            r = fn()
            return True
        except Exception:
            return False
    result['domains']['settlement'] = {'supabase_ok': ok(lambda: repo.get_all_points())}
    result['domains']['crack'] = {'supabase_ok': ok(lambda: repo.crack_get_monitoring_points())}
    result['domains']['temperature'] = {'supabase_ok': ok(lambda: repo.temperature_get_points())}
    result['domains']['tickets'] = {'supabase_ok': ok(lambda: __import__('modules.ticket_system.models').ticket_system.models.ticket_model.get_tickets({}, 1, 0))}
    return jsonify(result)

@app.route('/api/cover/cameras')
def cover_cameras():
    print("[API] GET /api/cover/cameras")
    def infer_format(url: str):
        u = (url or '').lower()
        if u.endswith(('.jpg', '.jpeg', '.png', '.webp', '.gif')):
            return 'image'
        if u.endswith('.m3u8'):
            return 'm3u8'
        return 'mp4'

    def infer_kind(url: str):
        u = (url or '')
        if u.startswith('/static/videos/') or u.startswith('videos/'):
            return 'demo'
        return 'external'

    cameras = []
    raw = (os.environ.get('COVER_CAMERAS_JSON') or '').strip()
    if raw:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                cameras = parsed
        except Exception:
            cameras = []

    if not cameras:
        entrance_url = (os.environ.get('COVER_CAMERA_ENTRANCE_URL') or '/static/videos/entrance.mp4').strip()
        middle_url = (os.environ.get('COVER_CAMERA_MIDDLE_URL') or '/static/videos/middle.mp4').strip()
        cameras = [
            {'id': 'entrance', 'label': '入口摄像头', 'url': entrance_url},
            {'id': 'middle', 'label': '中段摄像头', 'url': middle_url},
        ]

    normalized = []
    for cam in cameras:
        if not isinstance(cam, dict):
            continue
        cam_id = (cam.get('id') or cam.get('key') or '').strip()
        label = (cam.get('label') or cam.get('name') or cam_id or '').strip()
        url = (cam.get('url') or cam.get('src') or '').strip()
        if not cam_id or not url:
            continue
        fmt = (cam.get('format') or cam.get('type') or infer_format(url)).strip().lower()
        kind = (cam.get('kind') or infer_kind(url)).strip().lower()
        normalized.append({'id': cam_id, 'label': label, 'url': url, 'format': fmt, 'kind': kind})

    static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../static'))
    def local_exists(url: str):
        u = (url or '').strip()
        if u.startswith('/static/'):
            rel = u[len('/static/'):].lstrip('/\\')
            return os.path.exists(os.path.join(static_dir, rel))
        if u.startswith('videos/'):
            rel = u.lstrip('/\\')
            return os.path.exists(os.path.join(static_dir, rel))
        return True

    if normalized:
        for cam in normalized:
            if cam.get('kind') == 'demo' and not local_exists(cam.get('url') or ''):
                cam['url'] = 'https://cwwp2.dot.ca.gov/data/d4/cctv/image/tvd32i80baybridgesastowereast/tvd32i80baybridgesastowereast.jpg' if cam.get('id') == 'entrance' else 'https://cwwp2.dot.ca.gov/data/d2/cctv/image/vollmers/vollmers.jpg'
                cam['format'] = 'image'
                cam['kind'] = 'external'
                cam['label'] = f"{cam.get('label') or cam.get('id')}（外部源）"

    return jsonify({'cameras': normalized})

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
        upload_folder = app.config['UPLOAD_FOLDER']
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
        if IS_VERCEL:
            process_uploaded_file(task_id, file_path)
        else:
            process_thread = threading.Thread(
                target=process_uploaded_file,
                args=(task_id, file_path)
            )
            process_thread.daemon = True
            process_thread.start()
        return jsonify({
            'success': True,
            'message': '文件上传成功，开始处理数据' if not IS_VERCEL else '文件上传成功，已处理完成',
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
    print("[API] GET /api/crack/monitoring_points")
    result = repo.crack_get_monitoring_points()
    return jsonify({'status': 'success','data': result,'message': f'成功获取{len(result)}个裂缝监测点'})

@crack_api.route('/crack/data', methods=['GET'])
def get_crack_data():
    print("[API] GET /api/crack/data")
    result = repo.crack_get_data()
    return json.dumps({'status': 'success', 'data': result, 'message': f'成功获取{len(result)}行裂缝数据'}, default=str)

@crack_api.route('/crack/analysis_results', methods=['GET'])
def get_crack_analysis_results():
    print("[API] GET /api/crack/analysis_results")
    result = repo.crack_get_analysis_results()
    return jsonify({'status': 'success','data': result,'message': f'成功获取{len(result)}条裂缝分析结果'})

@crack_api.route('/crack/trend_data', methods=['GET'])
def get_crack_trend_data():
    print("[API] GET /api/crack/trend_data")
    trend_data = repo.crack_get_trend_data()
    return json.dumps({'status': 'success','data': trend_data,'message': '成功获取裂缝趋势数据'}, default=str)

@crack_api.route('/crack/stats_overview', methods=['GET'])
def get_crack_stats_overview():
    print("[API] GET /api/crack/stats_overview")
    """获取裂缝监测点统计概况"""
    try:
        conn = mysql.connector.connect(**db_config)
        query = "SELECT * FROM crack_monitoring_points WHERE status = 'active'"
        df = pd.read_sql(query, conn)
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
    except Exception as e:
        return jsonify({'status': 'error','message': f'获取裂缝统计概况失败: {str(e)}'}), 500

# =========================================================
# 温度监测API路由 (保持不变)
# =========================================================
@temperature_api.route('/temperature/points', methods=['GET'])
def get_temperature_points():
    print("[API] GET /api/temperature/points")
    result = repo.temperature_get_points()
    return jsonify({'status': 'success','data': result,'message': f'成功获取{len(result)}个温度监测点'})

@temperature_api.route('/temperature/summary', methods=['GET'])
def get_temperature_summary():
    print("[API] GET /api/temperature/summary")
    result = repo.temperature_get_summary()
    return json_dumps_response({'status': 'success','data': result,'message': f'成功获取{len(result)}个温度监测点的分析结果'})

@temperature_api.route('/temperature/data/<sensor_id>', methods=['GET'])
def get_temperature_data(sensor_id):
    print(f"[API] GET /api/temperature/data/{sensor_id}")
    data = repo.temperature_get_data(sensor_id)
    return json_dumps_response({'status': 'success','data': data,'message': f'成功获取传感器 {sensor_id} 的温度数据'})

@temperature_api.route('/temperature/data/multi', methods=['GET'])
def get_temperature_data_multi():
    print("[API] GET /api/temperature/data/multi")
    ids_param = request.args.get('ids', '')
    sensor_ids = [sid.strip() for sid in ids_param.split(',') if sid.strip()]
    if not sensor_ids:
        return jsonify({'status': 'error','message': '缺少传感器ID参数 ids'}), 400
    result = repo.temperature_get_data_multi(sensor_ids)
    return jsonify({'status': 'success','data': result})

@temperature_api.route('/temperature/trends', methods=['GET'])
def get_temperature_trends():
    print("[API] GET /api/temperature/trends")
    result = repo.temperature_get_trends()
    return jsonify({'status': 'success','data': result,'message': f'成功获取温度趋势分类统计'})

@temperature_api.route('/temperature/stats', methods=['GET'])
def get_temperature_stats():
    print("[API] GET /api/temperature/stats")
    stats = repo.temperature_get_stats()
    return json_dumps_response({'status': 'success', 'data': stats, 'message': '成功获取温度统计概览'})

@temperature_api.route('/temperature/upload', methods=['POST'])
def upload_temperature_data():
    print("[API] POST /api/temperature/upload")
    """处理MDB文件上传请求"""
    # ... (代码保持不变) ...
    if 'file' not in request.files: return jsonify({'status': 'error','message': '没有发现文件'}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({'status': 'error','message': '没有选择文件'}), 400
    if not file.filename.endswith(('.mdb', '.accdb')): return jsonify({'status': 'error','message': '只支持Access数据库文件(.mdb, .accdb)'}), 400
    try:
        upload_folder = app.config['UPLOAD_FOLDER']
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
        if IS_VERCEL:
            process_temperature_file(task_id, file_path)
            return jsonify({'status': 'success','message': '文件上传成功，已处理完成','task_id': task_id})
        else:
            process_thread = threading.Thread(target=process_temperature_file, args=(task_id, file_path))
            process_thread.daemon = True
            process_thread.start()
            return jsonify({'status': 'success','message': '文件上传成功，开始处理温度数据','task_id': task_id})
    except Exception as e: return jsonify({'status': 'error','message': f'文件上传失败: {str(e)}'}), 500

@app.route('/temperature/points', methods=['GET'])
def get_temperature_points_alias():
    return get_temperature_points()

@app.route('/temperature/summary', methods=['GET'])
def get_temperature_summary_alias():
    return get_temperature_summary()

@app.route('/temperature/data/<sensor_id>', methods=['GET'])
def get_temperature_data_alias(sensor_id):
    return get_temperature_data(sensor_id)

@app.route('/temperature/data/multi', methods=['GET'])
def get_temperature_data_multi_alias():
    return get_temperature_data_multi()

@app.route('/temperature/trends', methods=['GET'])
def get_temperature_trends_alias():
    return get_temperature_trends()

@app.route('/temperature/stats', methods=['GET'])
def get_temperature_stats_alias():
    return get_temperature_stats()

@app.route('/temperature/upload', methods=['POST'])
def upload_temperature_data_alias():
    return upload_temperature_data()


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
    print("[API] POST /api/viewpoints")
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
    print("[API] GET /api/viewpoints")
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
        return json_dumps_response({'success': True, 'data': formatted_viewpoints})


    except mysql.connector.Error as err:
        print(f"数据库错误 (获取视角): {err}")
        return jsonify({'success': False, 'message': '数据库查询失败'}), 500
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()

# =========================================================
# 数据汇总页API路由 (Overview)
# =========================================================
@app.route('/api/overview/summary')
def get_overview_summary():
    """
    获取仪表盘汇总数据，聚合沉降、裂缝、温度、振动四个领域的关键指标
    """
    print("[API] GET /api/overview/summary")
    result = {
        'settlement': {},
        'cracks': {},
        'temperature': {},
        'vibration': {},
        'safety_score': 0
    }
    
    try:
        # --- 沉降数据 ---
        try:
            settlement_points = repo.get_all_points()
            settlement_summary = repo.get_summary()
            settlement_trends = repo.get_trends()
            
            total_points = len(settlement_points) if settlement_points else 0
            max_value = 0
            alert_count = 0
            if settlement_summary:
                for item in settlement_summary:
                    val = float(item.get('current_value', 0) or 0)
                    if abs(val) > abs(max_value):
                        max_value = val
                    rate = float(item.get('change_rate', 0) or 0)
                    if abs(rate) > 1.0:
                        alert_count += 1
            
            trend_distribution = {}
            if settlement_trends:
                for t in settlement_trends:
                    trend_distribution[t.get('trend_type', '未知')] = t.get('count', 0)
            
            result['settlement'] = {
                'total_points': total_points,
                'max_value': round(max_value, 2),
                'alert_count': alert_count,
                'trend_distribution': trend_distribution
            }
        except Exception as e:
            print(f"[Overview] 沉降数据聚合失败: {e}")
            result['settlement'] = {'error': str(e)}

        # --- 裂缝数据 ---
        try:
            crack_points = repo.crack_get_monitoring_points()
            total_cracks = len(crack_points) if crack_points else 0
            expanding = shrinking = stable = 0
            
            if crack_points:
                for pt in crack_points:
                    ct = pt.get('change_type', '')
                    if ct == '扩展':
                        expanding += 1
                    elif ct == '收缩':
                        shrinking += 1
                    elif ct == '稳定':
                        stable += 1
            
            result['cracks'] = {
                'total_points': total_cracks,
                'expanding_count': expanding,
                'shrinking_count': shrinking,
                'stable_count': stable,
                'critical_count': expanding
            }
        except Exception as e:
            print(f"[Overview] 裂缝数据聚合失败: {e}")
            result['cracks'] = {'error': str(e)}

        # --- 温度数据 ---
        try:
            temp_points = repo.temperature_get_points()
            temp_summary = repo.temperature_get_summary()
            temp_trends = repo.temperature_get_trends()
            
            total_sensors = len(temp_points) if temp_points else 0
            avg_temp = min_temp = max_temp = 0
            
            if temp_summary:
                temps = [float(s.get('avg_temp', 0) or 0) for s in temp_summary if s.get('avg_temp')]
                mins = [float(s.get('min_temp', 0) or 0) for s in temp_summary if s.get('min_temp')]
                maxs = [float(s.get('max_temp', 0) or 0) for s in temp_summary if s.get('max_temp')]
                if temps:
                    avg_temp = round(sum(temps) / len(temps), 1)
                if mins:
                    min_temp = round(min(mins), 1)
                if maxs:
                    max_temp = round(max(maxs), 1)
            
            trend_distribution = {}
            if temp_trends:
                for t in temp_trends:
                    trend_distribution[t.get('trend_type', '未知')] = t.get('count', 0)
            
            result['temperature'] = {
                'total_sensors': total_sensors,
                'avg_temp': avg_temp,
                'min_temp': min_temp,
                'max_temp': max_temp,
                'trend_distribution': trend_distribution
            }
        except Exception as e:
            print(f"[Overview] 温度数据聚合失败: {e}")
            result['temperature'] = {'error': str(e)}

        # --- 振动数据 ---
        try:
            conn = get_db_connection()
            if conn:
                try:
                    cursor = conn.cursor(dictionary=True)
                    cursor.execute("SELECT COUNT(*) as cnt FROM vibration_datasets")
                    row = cursor.fetchone()
                    dataset_count = row['cnt'] if row else 0
                    cursor.close()
                    conn.close()
                except Exception:
                    dataset_count = 0
            else:
                dataset_count = 0
            result['vibration'] = {
                'total_datasets': dataset_count,
                'status': 'normal'
            }
        except Exception as e:
            print(f"[Overview] 振动数据聚合失败: {e}")
            result['vibration'] = {'error': str(e), 'total_datasets': 0}

        # --- 计算综合安全评分 ---
        score = 100
        score -= result['settlement'].get('alert_count', 0) * 2
        score -= result['cracks'].get('expanding_count', 0) * 3
        score -= result['cracks'].get('critical_count', 0) * 2
        score = max(0, min(100, score))
        result['safety_score'] = round(score, 1)
        
        return json.dumps(result, default=decimal_default), 200, {'Content-Type': 'application/json'}
    
    except Exception as e:
        print(f"[Overview] 汇总数据获取失败: {e}")
        return jsonify({'error': str(e)}), 500


# =========================================================
# 注册Blueprint并启动应用
# =========================================================
# 注册蓝图 - 这是最重要的修改，确保裂缝API路由能够被访问
app.register_blueprint(crack_api)
# 注册温度API蓝图
app.register_blueprint(temperature_api)
# 注册振动API蓝图
app.register_blueprint(vibration_bp)
# 注册工单系统API蓝图
app.register_blueprint(ticket_bp)
# 注册用户管理API蓝图
app.register_blueprint(user_bp)
# 注册二级数据分析API蓝图
app.register_blueprint(analysis_v2_bp)
app.register_blueprint(assistant_bp)
@app.route('/api/modules', methods=['GET'])
@app.route('/api/modules/', methods=['GET'])
def modules_list():
    try:
        getter = getattr(repo, 'modules_get_all', None)
        default_modules = [
            {"module_key": "cover", "route_path": "/cover", "display_name": "封面", "icon_class": "fas fa-home", "sort_order": 10, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
            {"module_key": "settlement", "route_path": "/settlement", "display_name": "沉降", "icon_class": "fas fa-chart-area", "sort_order": 20, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
            {"module_key": "temperature", "route_path": "/temperature", "display_name": "温度", "icon_class": "fas fa-thermometer-half", "sort_order": 30, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
            {"module_key": "cracks", "route_path": "/cracks", "display_name": "裂缝", "icon_class": "fas fa-bug", "sort_order": 40, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
            {"module_key": "vibration", "route_path": "/vibration", "display_name": "振动", "icon_class": "fas fa-wave-square", "sort_order": 50, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
            {"module_key": "insar", "route_path": "/insar", "display_name": "InSAR", "icon_class": "fas fa-satellite", "sort_order": 60, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
            {"module_key": "overview", "route_path": "/overview", "display_name": "数据总览", "icon_class": "fas fa-chart-line", "sort_order": 70, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
            {"module_key": "three", "route_path": "/three", "display_name": "3D模型", "icon_class": "fas fa-cubes", "sort_order": 80, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
            {"module_key": "tickets", "route_path": "/tickets", "display_name": "工单", "icon_class": "fas fa-ticket-alt", "sort_order": 90, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
            {"module_key": "tunnel", "route_path": "/tunnel", "display_name": "隧道", "icon_class": "fas fa-subway", "sort_order": 95, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
            {"module_key": "advanced", "route_path": "/advanced", "display_name": "高级分析", "icon_class": "fas fa-microscope", "sort_order": 100, "status": "developed", "pending_badge_text": "新功能", "pending_popup_title": "高级分析", "pending_popup_body": "隧道剖面、沉降裂缝联合分析、施工事件影响", "is_visible": True},
        ]
        if callable(getter):
            rows = getter()
            if isinstance(rows, list) and rows:
                by_key = {m.get("module_key"): m for m in rows if isinstance(m, dict) and m.get("module_key")}
                for dm in default_modules:
                    k = dm.get("module_key")
                    if k and k not in by_key:
                        rows.append(dm)
                rows.sort(key=lambda x: int(x.get("sort_order") or 0))
                return jsonify({"success": True, "message": "ok", "data": rows, "timestamp": datetime.now().isoformat()}), 200
        return jsonify({"success": True, "message": "fallback", "data": default_modules, "timestamp": datetime.now().isoformat()}), 200
    except Exception as e:
        return jsonify({"success": True, "message": str(e), "data": [], "timestamp": datetime.now().isoformat()}), 200


@app.route('/api/modules', methods=['PATCH'])
@app.route('/api/modules/', methods=['PATCH'])
def modules_update():
    body = request.get_json(silent=True) or {}
    module_key = (body.get('module_key') or '').strip()
    status = body.get('status')
    if not module_key:
        return jsonify({"success": False, "message": "missing module_key", "data": None, "timestamp": datetime.now().isoformat()}), 400
    if status not in ('developed', 'pending'):
        return jsonify({"success": False, "message": "invalid status", "data": None, "timestamp": datetime.now().isoformat()}), 400

    updater = getattr(repo, 'modules_update_status', None)
    if not callable(updater):
        return jsonify({"success": False, "message": "not supported", "data": None, "timestamp": datetime.now().isoformat()}), 501

    updated_by = body.get('updated_by')
    reason = body.get('reason') if 'reason' in body else body.get('update_reason')
    try:
        row = updater(module_key, status, updated_by=updated_by, update_reason=reason)
        return jsonify({"success": True, "message": "ok", "data": row, "timestamp": datetime.now().isoformat()}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e), "data": None, "timestamp": datetime.now().isoformat()}), 500


@app.route('/api/modules/<module_key>', methods=['PATCH'])
def modules_update_by_key(module_key):
    body = request.get_json(silent=True) or {}
    status = body.get('status')
    if status not in ('developed', 'pending'):
        return jsonify({"success": False, "message": "invalid status", "data": None, "timestamp": datetime.now().isoformat()}), 400

    updater = getattr(repo, 'modules_update_status', None)
    if not callable(updater):
        return jsonify({"success": False, "message": "not supported", "data": None, "timestamp": datetime.now().isoformat()}), 501

    updated_by = body.get('updated_by')
    reason = body.get('reason') if 'reason' in body else body.get('update_reason')
    try:
        row = updater(module_key, status, updated_by=updated_by, update_reason=reason)
        return jsonify({"success": True, "message": "ok", "data": row, "timestamp": datetime.now().isoformat()}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e), "data": None, "timestamp": datetime.now().isoformat()}), 500
app.register_blueprint(insar_bp)
app.register_blueprint(tunnel_bp)
app.register_blueprint(advanced_bp)
app.register_blueprint(ml_api)  # 机器学习API

# 健康检查路由
@app.route('/api/health')
def health_check():
    print("[API] GET /api/health")
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    })
@app.route('/api/source')
def source_check():
    print("[API] GET /api/source")
    vendor = os.getenv('DB_VENDOR', 'mysql').lower()
    http_flag = os.getenv('SUPABASE_USE_HTTP', '0') == '1' or vendor == 'supabase_http'
    src = 'supabase_http' if http_flag else ('supabase' if vendor == 'supabase' else 'mysql')
    return jsonify({'source': src, 'db_vendor': os.getenv('DB_VENDOR'), 'supabase_url': os.getenv('SUPABASE_URL')})

# 处理状态路由 - 确保只有一个定义
@app.route('/api/process-status', methods=['GET'])
def process_status():
    print("[API] GET /api/process-status")
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
                statements = [s.strip() for s in sql_script.split(';') if s.strip()]
                for stmt in statements:
                    if stmt.upper().startswith('CREATE INDEX'):
                        import re
                        m = re.search(r'CREATE\s+INDEX\s+(\w+)\s+ON\s+(\w+)', stmt, re.IGNORECASE)
                        if m:
                            idx_name, table_name = m.group(1), m.group(2)
                            cursor.execute(f"SHOW INDEX FROM {table_name} WHERE Key_name = %s", (idx_name,))
                            exists = cursor.fetchone() is not None
                            if exists:
                                continue
                    cursor.execute(stmt)
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

    try:
        flag = os.environ.get('TICKET_SCHEDULER_ENABLED', '0').strip().lower()
        if flag in ('1', 'true', 'yes', 'on'):
            from modules.ticket_system.services import start_scheduler, stop_scheduler
            start_scheduler()
            import atexit
            atexit.register(stop_scheduler)
            print("[OK] Ticket scheduler started")
    except Exception as e:
        print(f"[WARN] Start ticket scheduler failed: {e}")

    # 运行API服务
    # 注意：将 host 设置为 '0.0.0.0' 使其可以从局域网访问
    print("启动Flask应用...")
    print("注意：大文件传输已优化，支持354MB GLB文件")

    # 使用Werkzeug服务器，增加超时配置
    from werkzeug.serving import run_simple
    run_simple(
        '0.0.0.0',
        5000,
        app,
        use_reloader=False,
        use_debugger=False,
        threaded=True,
        request_handler=None
    )
