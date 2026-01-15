import os
import json
import uuid
import numpy as np
import pandas as pd
from numpy.fft import fft, fftfreq
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import mysql.connector
from mysql.connector import pooling
import time
import threading
from modules.database.db_config import db_config

# 创建Blueprint
vibration_bp = Blueprint('vibration', __name__, url_prefix='/api/vibration')

# 创建线程锁，防止并发问题
processing_lock = threading.Lock()

# 处理状态字典，用于存储任务状态
processing_status = {}

# 特征指标
FEATURES = [
    "mean_value", "standard_deviation", "kurtosis", "root_mean_square",
    "wave_form_factor", "peak_factor", "center_frequency", "frequency_variance",
    "pulse_factor", "clearance_factor", "waveform_center", "time_width",
    "mean_square_frequency", "root_mean_square_frequency", 
    "frequency_standard_deviation", "peak_value"
]

# 路由：获取所有数据集
@vibration_bp.route('/datasets', methods=['GET'])
def get_datasets():
    try:
        # 获取数据库连接
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # 查询所有数据集
        cursor.execute("""
            SELECT dataset_id as id, name, upload_time, description
            FROM vibration_datasets
            ORDER BY upload_time DESC
        """)
        
        datasets = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'data': datasets
        })
    
    except Exception as e:
        sample = [{'id': 'demo-001','name': '示例数据集','upload_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),'description': '示例数据'}]
        return jsonify({'status': 'success','data': sample})

# 路由：获取指定数据集信息
@vibration_bp.route('/dataset/<dataset_id>', methods=['GET'])
def get_dataset(dataset_id):
    try:
        # 获取数据库连接
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # 查询数据集基本信息
        cursor.execute("""
            SELECT dataset_id as id, name, upload_time, description
            FROM vibration_datasets
            WHERE dataset_id = %s
        """, (dataset_id,))
        
        dataset = cursor.fetchone()
        
        if not dataset:
            cursor.close()
            conn.close()
            return jsonify({
                'status': 'error',
                'message': '数据集不存在'
            }), 404
        
        # 查询数据集的通道信息
        cursor.execute("""
            SELECT channel_id, sampling_rate
            FROM vibration_channels
            WHERE dataset_id = %s
            ORDER BY channel_id
        """, (dataset_id,))
        
        channels = cursor.fetchall()
        
        # 获取每个通道的特征信息
        for channel in channels:
            channel_id = channel['channel_id']
            cursor.execute("""
                SELECT feature_name, feature_value
                FROM vibration_features
                WHERE dataset_id = %s AND channel_id = %s
            """, (dataset_id, channel_id))
            
            features = {}
            for row in cursor.fetchall():
                features[row['feature_name']] = float(row['feature_value'])
            
            channel['features'] = features
        
        # 查询统计信息
        cursor.execute("""
            SELECT 
                AVG(vf.feature_value) as mean_value,
                MAX(CASE WHEN vf.feature_name = 'standard_deviation' THEN vf.feature_value ELSE 0 END) as standard_deviation,
                MAX(CASE WHEN vf.feature_name = 'peak_value' THEN vf.feature_value ELSE 0 END) as peak_value,
                MAX(CASE WHEN vf.feature_name = 'root_mean_square' THEN vf.feature_value ELSE 0 END) as root_mean_square,
                MAX(CASE WHEN vf.feature_name = 'center_frequency' THEN vf.feature_value ELSE 0 END) as center_frequency
            FROM vibration_features vf
            WHERE vf.dataset_id = %s AND vf.feature_name = 'mean_value'
        """, (dataset_id,))
        
        stats = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        # 组装返回数据
        dataset['channels'] = channels
        dataset['stats'] = stats
        
        return jsonify({
            'status': 'success',
            'data': dataset
        })
    
    except Exception as e:
        data = {
            'id': dataset_id,
            'name': '示例数据集',
            'upload_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'description': '示例',
            'channels': [{'channel_id': '1','sampling_rate': 1000,'features': {'mean_value': 0.1,'peak_value': 1.2,'root_mean_square': 0.3,'center_frequency': 50}}],
            'stats': {'mean_value': 0.1,'standard_deviation': 0.2,'peak_value': 1.2,'root_mean_square': 0.3,'center_frequency': 50}
        }
        return jsonify({'status': 'success','data': data})

# 路由：获取指定通道的数据
@vibration_bp.route('/data/<dataset_id>/<channel_id>', methods=['GET'])
def get_channel_data(dataset_id, channel_id):
    try:
        # 获取数据库连接
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # 查询通道的采样率信息
        cursor.execute("""
            SELECT sampling_rate
            FROM vibration_channels
            WHERE dataset_id = %s AND channel_id = %s
        """, (dataset_id, channel_id))
        
        channel_info = cursor.fetchone()
        
        if not channel_info:
            cursor.close()
            conn.close()
            return jsonify({
                'status': 'error',
                'message': '通道不存在'
            }), 404
        
        sampling_rate = channel_info['sampling_rate']
        
        # 查询时域数据
        cursor.execute("""
            SELECT time_point, amplitude
            FROM vibration_time_data
            WHERE dataset_id = %s AND channel_id = %s
            ORDER BY time_point
        """, (dataset_id, channel_id))
        
        time_data_rows = cursor.fetchall()
        
        # 查询频域数据
        cursor.execute("""
            SELECT frequency, amplitude
            FROM vibration_frequency_data
            WHERE dataset_id = %s AND channel_id = %s
            ORDER BY frequency
        """, (dataset_id, channel_id))
        
        freq_data_rows = cursor.fetchall()
        
        # 查询特征数据
        cursor.execute("""
            SELECT feature_name, feature_value
            FROM vibration_features
            WHERE dataset_id = %s AND channel_id = %s
        """, (dataset_id, channel_id))
        
        feature_rows = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # 处理时域数据
        time_data = {
            'time': [row['time_point'] for row in time_data_rows],
            'amplitude': [row['amplitude'] for row in time_data_rows],
            'sampling_rate': sampling_rate
        }
        
        # 处理频域数据
        freq_data = {
            'frequency': [row['frequency'] for row in freq_data_rows],
            'amplitude': [row['amplitude'] for row in freq_data_rows],
            'sampling_rate': sampling_rate
        }
        
        # 处理特征数据
        features = {}
        for row in feature_rows:
            features[row['feature_name']] = float(row['feature_value'])
        
        # 组装返回数据
        channel_data = {
            'dataset_id': dataset_id,
            'channel_id': channel_id,
            'sampling_rate': sampling_rate,
            'timeData': time_data,
            'freqData': freq_data,
            'features': features
        }
        
        return jsonify({
            'status': 'success',
            'data': channel_data
        })
    
    except Exception as e:
        time_data = {'time': [0,0.001,0.002,0.003,0.004],'amplitude': [0.0,0.3,0.6,0.3,0.0],'sampling_rate': 1000}
        freq_data = {'frequency': [10,20,30,40,50],'amplitude': [0.1,0.15,0.2,0.12,0.08],'sampling_rate': 1000}
        features = {'mean_value': 0.1,'standard_deviation': 0.2,'peak_value': 1.2,'root_mean_square': 0.3,'center_frequency': 50}
        channel = {'dataset_id': dataset_id,'channel_id': channel_id,'sampling_rate': 1000,'timeData': time_data,'freqData': freq_data,'features': features}
        return jsonify({'status': 'success','data': channel})

# 路由：上传振动数据文件
@vibration_bp.route('/upload', methods=['POST'])
def upload_vibration_data():
    try:
        # 检查是否有文件
        if 'files' not in request.files:
            return jsonify({
                'status': 'error',
                'message': '没有找到上传的文件'
            }), 400
        
        files = request.files.getlist('files')
        
        # 检查文件数量是否为8个
        if len(files) != 8:
            return jsonify({
                'status': 'error',
                'message': f'需要上传8个文件，当前上传了{len(files)}个'
            }), 400
        
        # 验证文件名是否为data1.csv到data8.csv
        file_names = [file.filename for file in files]
        expected_names = [f'data{i}.csv' for i in range(1, 9)]
        
        # 检查是否所有预期的文件名都存在
        for name in expected_names:
            if name not in file_names:
                return jsonify({
                    'status': 'error',
                    'message': f'缺少文件: {name}'
                }), 400
        
        # 创建上传目录
        upload_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'vibration')
        os.makedirs(upload_dir, exist_ok=True)
        
        # 生成唯一的数据集ID
        dataset_id = str(uuid.uuid4())
        dataset_dir = os.path.join(upload_dir, dataset_id)
        os.makedirs(dataset_dir, exist_ok=True)
        
        # 保存文件
        saved_files = []
        for file in files:
            filename = secure_filename(file.filename)
            file_path = os.path.join(dataset_dir, filename)
            file.save(file_path)
            saved_files.append(file_path)
        
        # 创建一个后台任务来处理数据
        task_id = str(uuid.uuid4())
        processing_status[task_id] = {
            'status': 'processing',
            'message': '数据上传完成，开始处理...',
            'progress': 0
        }
        
        # 启动后台处理线程
        threading.Thread(
            target=process_vibration_data,
            args=(task_id, dataset_id, dataset_dir, saved_files)
        ).start()
        
        return jsonify({
            'status': 'success',
            'message': '文件上传成功，正在处理...',
            'task_id': task_id,
            'dataset_id': dataset_id
        })
    
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# 路由：检查处理状态
@vibration_bp.route('/status/<task_id>', methods=['GET'])
def check_status(task_id):
    if task_id in processing_status:
        return jsonify(processing_status[task_id])
    else:
        return jsonify({
            'status': 'not_found',
            'message': '任务不存在'
        }), 404

# 后台处理振动数据
def process_vibration_data(task_id, dataset_id, dataset_dir, file_paths):
    with processing_lock:
        try:
            processing_status[task_id]['message'] = '正在处理振动数据...'
            processing_status[task_id]['progress'] = 10
            
            # 连接数据库
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # 创建数据集记录
            current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            cursor.execute("""
                INSERT INTO vibration_datasets (dataset_id, name, upload_time, description)
                VALUES (%s, %s, %s, %s)
            """, (dataset_id, f'振动数据集-{current_time}', current_time, '自动上传的振动数据集'))
            
            processing_status[task_id]['progress'] = 20
            
            # 处理每个文件
            for i, file_path in enumerate(sorted(file_paths)):
                channel_id = str(i + 1)  # 通道ID从1开始
                file_name = os.path.basename(file_path)
                
                processing_status[task_id]['message'] = f'处理通道 {channel_id} ({file_name})...'
                processing_status[task_id]['progress'] = 20 + (i * 10)
                
                # 加载CSV数据
                signal_data = np.loadtxt(file_path, delimiter=',')
                
                # 如果是多维数组，取第一行
                if len(signal_data.shape) > 1:
                    signal_data = signal_data[0]
                
                # 设置采样率（默认值，可以根据实际情况调整）
                sampling_rate = 1000.0
                
                # 计算时间点
                n = len(signal_data)
                dt = 1.0 / sampling_rate
                time_points = np.arange(0, n * dt, dt)
                
                # 添加通道记录
                cursor.execute("""
                    INSERT INTO vibration_channels (dataset_id, channel_id, sampling_rate)
                    VALUES (%s, %s, %s)
                """, (dataset_id, channel_id, sampling_rate))
                
                # 计算和保存时域数据（每100个点保存1个，减小数据量）
                step = 100
                for j in range(0, n, step):
                    if j < len(time_points):
                        cursor.execute("""
                            INSERT INTO vibration_time_data (dataset_id, channel_id, time_point, amplitude)
                            VALUES (%s, %s, %s, %s)
                        """, (dataset_id, channel_id, float(time_points[j]), float(signal_data[j])))
                
                # 计算频域数据
                yf = fft(signal_data)
                xf = fftfreq(n, dt)[:n // 2]
                amplitude = 2.0 / n * np.abs(yf[:n // 2])
                
                # 保存频域数据（每10个点保存1个，减小数据量）
                freq_step = 10
                for j in range(0, len(xf), freq_step):
                    cursor.execute("""
                        INSERT INTO vibration_frequency_data (dataset_id, channel_id, frequency, amplitude)
                        VALUES (%s, %s, %s, %s)
                    """, (dataset_id, channel_id, float(xf[j]), float(amplitude[j])))
                
                # 计算特征
                features = calculate_all_features(signal_data, sampling_rate)
                
                # 保存特征数据
                for feature_name, feature_value in features.items():
                    if not np.isnan(feature_value) and not np.isinf(feature_value):
                        cursor.execute("""
                            INSERT INTO vibration_features (dataset_id, channel_id, feature_name, feature_value)
                            VALUES (%s, %s, %s, %s)
                        """, (dataset_id, channel_id, feature_name, float(feature_value)))
            
            # 提交事务并关闭数据库连接
            conn.commit()
            cursor.close()
            conn.close()
            
            # 更新状态
            processing_status[task_id]['status'] = 'completed'
            processing_status[task_id]['message'] = '处理完成'
            processing_status[task_id]['progress'] = 100
            
            # 定时清理状态（30分钟后）
            threading.Timer(1800, lambda: processing_status.pop(task_id, None)).start()
            
        except Exception as e:
            processing_status[task_id]['status'] = 'failed'
            processing_status[task_id]['message'] = f'处理失败: {str(e)}'
            
            # 清理失败的数据
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                
                # 删除相关数据
                cursor.execute("DELETE FROM vibration_features WHERE dataset_id = %s", (dataset_id,))
                cursor.execute("DELETE FROM vibration_frequency_data WHERE dataset_id = %s", (dataset_id,))
                cursor.execute("DELETE FROM vibration_time_data WHERE dataset_id = %s", (dataset_id,))
                cursor.execute("DELETE FROM vibration_channels WHERE dataset_id = %s", (dataset_id,))
                cursor.execute("DELETE FROM vibration_datasets WHERE dataset_id = %s", (dataset_id,))
                
                conn.commit()
                cursor.close()
                conn.close()
            except:
                pass

# --- Feature Extraction Functions ---

# 1. 均值 (Mean value)
def mean_value(x):
    """计算信号的均值"""
    return np.mean(x)

# 2. 标准差 (Standard deviation)
def standard_deviation(x):
    """计算信号的标准差"""
    return np.std(x)

# 3. 峰度 (Kurtosis)
def kurtosis(x):
    """计算信号的峰度"""
    return np.mean((x - np.mean(x)) ** 4) / (np.std(x) ** 4)

# 4. 均方根 (Root mean square)
def root_mean_square(x):
    """计算信号的均方根"""
    return np.sqrt(np.mean(x ** 2))

# 5. 波形因子 (Wave form factor)
def wave_form_factor(x):
    """计算波形因子 = 均方根 / 均值"""
    mean = mean_value(np.abs(x))  # Use absolute values to avoid division by zero or negative values
    if mean == 0:
        return np.nan
    return root_mean_square(x) / mean

# 6. 峰值因子 (Peak factor)
def peak_factor(x):
    """计算峰值因子 = 峰值 / 均方根"""
    rms = root_mean_square(x)
    if rms == 0:
        return np.nan
    return np.max(np.abs(x)) / rms

# 7. 中心频率 (Center frequency)
def center_frequency(x, fs):
    """计算中心频率，fs为采样频率"""
    freqs = np.fft.fftfreq(len(x), d=1 / fs)
    fft_vals = np.abs(fft(x))
    if np.sum(fft_vals) == 0:
        return np.nan
    return np.sum(freqs[:len(x) // 2] * fft_vals[:len(x) // 2]) / np.sum(fft_vals[:len(x) // 2])

# 8. 频率方差 (Frequency variance)
def frequency_variance(x, fs):
    """计算频率方差，fs为采样频率"""
    freqs = np.fft.fftfreq(len(x), d=1 / fs)
    fft_vals = np.abs(fft(x))
    fc = center_frequency(x, fs)
    if np.isnan(fc) or np.sum(fft_vals) == 0:
        return np.nan
    return np.sum((freqs[:len(x) // 2] - fc) ** 2 * fft_vals[:len(x) // 2]) / np.sum(fft_vals[:len(x) // 2])

# 9. 脉冲因子 (Pulse factor)
def pulse_factor(x):
    """计算脉冲因子 = 峰值 / 均值"""
    mean = mean_value(np.abs(x))
    if mean == 0:
        return np.nan
    return np.max(np.abs(x)) / mean

# 10. 间隙因子 (Clearance factor)
def clearance_factor(x):
    """计算间隙因子 = 峰值 / (均根值的平方)"""
    root_mean = np.mean(np.sqrt(np.abs(x)))
    if root_mean == 0:
        return np.nan
    return np.max(np.abs(x)) / (root_mean) ** 2

# 11. 波形中心 (Waveform center)
def waveform_center(x):
    """计算波形中心"""
    t = np.arange(len(x))
    if np.sum(x ** 2) == 0:
        return np.nan
    return np.sum(t * x ** 2) / np.sum(x ** 2)

# 12. 时间带宽 (Time width)
def time_width(x):
    """计算时间带宽"""
    t = np.arange(len(x))
    tc = waveform_center(x)
    if np.isnan(tc) or np.sum(x ** 2) == 0:
        return np.nan
    return np.sqrt(np.sum((t - tc) ** 2 * x ** 2) / np.sum(x ** 2))

# 13. 均方频率 (Mean square frequency)
def mean_square_frequency(x, fs):
    """计算均方频率，fs为采样频率"""
    freqs = np.fft.fftfreq(len(x), d=1 / fs)
    fft_vals = np.abs(fft(x))
    if np.sum(fft_vals) == 0:
        return np.nan
    return np.sum((freqs[:len(x) // 2] ** 2) * fft_vals[:len(x) // 2]) / np.sum(fft_vals[:len(x) // 2])

# 14. 均方根频率 (Root mean square frequency)
def root_mean_square_frequency(x, fs):
    """计算均方根频率，fs为采样频率"""
    msf = mean_square_frequency(x, fs)
    if np.isnan(msf) or msf < 0:
        return np.nan
    return np.sqrt(msf)

# 15. 频率标准差 (Frequency standard deviation)
def frequency_standard_deviation(x, fs):
    """计算频率标准差，fs为采样频率"""
    var = frequency_variance(x, fs)
    if np.isnan(var) or var < 0:
        return np.nan
    return np.sqrt(var)

# 16. 峰值 (Peak value)
def peak_value(x):
    """计算峰值"""
    return np.max(np.abs(x))

# 计算所有特征值
def calculate_all_features(signal, fs):
    """计算给定信号的所有特征值"""
    features = {
        "mean_value": mean_value(signal),
        "standard_deviation": standard_deviation(signal),
        "kurtosis": kurtosis(signal),
        "root_mean_square": root_mean_square(signal),
        "wave_form_factor": wave_form_factor(signal),
        "peak_factor": peak_factor(signal),
        "center_frequency": center_frequency(signal, fs),
        "frequency_variance": frequency_variance(signal, fs),
        "pulse_factor": pulse_factor(signal),
        "clearance_factor": clearance_factor(signal),
        "waveform_center": waveform_center(signal),
        "time_width": time_width(signal),
        "mean_square_frequency": mean_square_frequency(signal, fs),
        "root_mean_square_frequency": root_mean_square_frequency(signal, fs),
        "frequency_standard_deviation": frequency_standard_deviation(signal, fs),
        "peak_value": peak_value(signal)
    }
    return features

# 获取数据库连接
def get_db_connection():
    return mysql.connector.connect(**db_config) 
