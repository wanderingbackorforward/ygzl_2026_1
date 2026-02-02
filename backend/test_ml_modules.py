# -*- coding: utf-8 -*-
"""
ML模块测试脚本
测试所有机器学习模块的功能和性能
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import numpy as np
import pandas as pd
import mysql.connector
from datetime import datetime

from modules.database.db_config import db_config
from modules.ml_models.anomaly_detector import detect_anomalies_for_point
from modules.ml_models.time_series_predictor import predict_settlement
from modules.ml_models.spatial_correlation import analyze_spatial_correlation
from modules.ml_models.model_selector import auto_predict

try:
    from modules.ml_models.prophet_predictor import predict_with_prophet, PROPHET_AVAILABLE
except:
    PROPHET_AVAILABLE = False


def get_db_connection():
    """创建数据库连接"""
    try:
        conn = mysql.connector.connect(**db_config)
        return conn
    except Exception as e:
        print(f"[错误] 数据库连接失败: {str(e)}")
        return None


def test_anomaly_detection():
    """测试异常检测模块"""
    print("\n" + "="*60)
    print("[测试1] 异常检测模块")
    print("="*60)

    conn = get_db_connection()
    if not conn:
        print("[失败] 无法连接数据库")
        return False

    try:
        # 获取第一个监测点
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT point_id FROM processed_settlement_data LIMIT 1")
        result = cursor.fetchone()

        if not result:
            print("[失败] 数据库中没有沉降数据")
            return False

        point_id = result[0]
        print(f"[测试点位] {point_id}")

        # 执行异常检测
        print("[执行] 孤立森林异常检测...")
        result = detect_anomalies_for_point(point_id, conn, method='isolation_forest', contamination=0.05)

        if result['success']:
            print(f"[成功] 检测完成")
            print(f"  - 总数据点: {result['total_points']}")
            print(f"  - 异常点数: {result['anomaly_count']}")
            print(f"  - 异常率: {result['anomaly_rate']:.2f}%")

            if result['anomaly_count'] > 0:
                print(f"  - 前3个异常点:")
                for i, anomaly in enumerate(result['anomalies'][:3], 1):
                    print(f"    {i}. 日期: {anomaly['date']}, "
                          f"沉降: {anomaly['settlement']:.2f}mm, "
                          f"严重程度: {anomaly['severity']}, "
                          f"类型: {anomaly['anomaly_type']}")
            return True
        else:
            print(f"[失败] {result.get('message', '未知错误')}")
            return False

    except Exception as e:
        print(f"[错误] {str(e)}")
        return False
    finally:
        conn.close()


def test_time_series_prediction():
    """测试时间序列预测模块"""
    print("\n" + "="*60)
    print("[测试2] 时间序列预测模块")
    print("="*60)

    conn = get_db_connection()
    if not conn:
        print("[失败] 无法连接数据库")
        return False

    try:
        # 获取第一个监测点
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT point_id FROM processed_settlement_data LIMIT 1")
        result = cursor.fetchone()

        if not result:
            print("[失败] 数据库中没有沉降数据")
            return False

        point_id = result[0]
        print(f"[测试点位] {point_id}")

        # 测试ARIMA预测
        print("[执行] ARIMA预测...")
        result = predict_settlement(point_id, conn, model_type='arima', steps=30)

        if result['success']:
            print(f"[成功] ARIMA预测完成")
            print(f"  - 模型参数: {result['model_info']['order']}")
            print(f"  - AIC: {result['model_info']['aic']:.2f}")
            print(f"  - 最后实际值: {result['last_actual_value']:.2f}mm ({result['last_actual_date']})")
            print(f"  - 预测未来30天")
            print(f"  - 预测值范围: {min(result['forecast']['values']):.2f} ~ {max(result['forecast']['values']):.2f}mm")

            # 测试SARIMA预测
            print("\n[执行] SARIMA预测...")
            result2 = predict_settlement(point_id, conn, model_type='sarima', steps=30)

            if result2['success']:
                print(f"[成功] SARIMA预测完成")
                print(f"  - 模型参数: {result2['model_info']['order']}")
                print(f"  - AIC: {result2['model_info']['aic']:.2f}")

            return True
        else:
            print(f"[失败] {result.get('message', '未知错误')}")
            return False

    except Exception as e:
        print(f"[错误] {str(e)}")
        return False
    finally:
        conn.close()


def test_prophet_prediction():
    """测试Prophet预测模块"""
    print("\n" + "="*60)
    print("[测试3] Prophet预测模块")
    print("="*60)

    if not PROPHET_AVAILABLE:
        print("[跳过] Prophet未安装")
        return None

    conn = get_db_connection()
    if not conn:
        print("[失败] 无法连接数据库")
        return False

    try:
        # 获取第一个监测点
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT point_id FROM processed_settlement_data LIMIT 1")
        result = cursor.fetchone()

        if not result:
            print("[失败] 数据库中没有沉降数据")
            return False

        point_id = result[0]
        print(f"[测试点位] {point_id}")

        # 执行Prophet预测
        print("[执行] Prophet预测...")
        result = predict_with_prophet(point_id, conn, steps=30)

        if result['success']:
            print(f"[成功] Prophet预测完成")
            print(f"  - 最后实际值: {result['last_actual_value']:.2f}mm ({result['last_actual_date']})")
            print(f"  - 预测未来30天")
            print(f"  - 预测值范围: {min(result['forecast']['values']):.2f} ~ {max(result['forecast']['values']):.2f}mm")
            print(f"  - 检测到 {len(result['changepoints'])} 个趋势变化点")
            return True
        else:
            print(f"[失败] {result.get('message', '未知错误')}")
            return False

    except Exception as e:
        print(f"[错误] {str(e)}")
        return False
    finally:
        conn.close()


def test_auto_model_selection():
    """测试自动模型选择"""
    print("\n" + "="*60)
    print("[测试4] 自动模型选择")
    print("="*60)

    conn = get_db_connection()
    if not conn:
        print("[失败] 无法连接数据库")
        return False

    try:
        # 获取第一个监测点
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT point_id FROM processed_settlement_data LIMIT 1")
        result = cursor.fetchone()

        if not result:
            print("[失败] 数据库中没有沉降数据")
            return False

        point_id = result[0]
        print(f"[测试点位] {point_id}")

        # 执行自动模型选择
        print("[执行] 自动选择最优模型...")
        result = auto_predict(point_id, conn, steps=30, metric='mae')

        if result['success']:
            print(f"[成功] 自动选择完成")
            print(f"  - 选择的模型: {result['selected_model']}")
            print(f"  - 评估分数(MAE): {result['model_selection_info']['best_score']:.3f}")

            print(f"\n  [数据特征]")
            chars = result['model_selection_info']['data_characteristics']
            print(f"    - 数据量: {chars['data_size']}")
            print(f"    - 趋势强度: {chars['trend_strength']:.3f}")
            print(f"    - 波动性: {chars['volatility']:.3f}")
            print(f"    - 季节性强度: {chars['seasonality_strength']:.3f}")

            print(f"\n  [所有模型评估结果]")
            for model_name, eval_result in result['model_selection_info']['all_results'].items():
                if eval_result['status'] == 'success':
                    print(f"    - {model_name}: MAE={eval_result['mae']:.3f}, RMSE={eval_result['rmse']:.3f}")
                else:
                    print(f"    - {model_name}: 失败 ({eval_result.get('error', '未知错误')})")

            return True
        else:
            print(f"[失败] {result.get('message', '未知错误')}")
            return False

    except Exception as e:
        print(f"[错误] {str(e)}")
        return False
    finally:
        conn.close()


def test_spatial_correlation():
    """测试空间关联分析"""
    print("\n" + "="*60)
    print("[测试5] 空间关联分析")
    print("="*60)

    conn = get_db_connection()
    if not conn:
        print("[失败] 无法连接数据库")
        return False

    try:
        print("[执行] 分析监测点空间关联...")
        result = analyze_spatial_correlation(conn, distance_threshold=50.0)

        if result['success']:
            print(f"[成功] 空间关联分析完成")
            print(f"  - 监测点数量: {len(result['points'])}")
            print(f"  - 发现聚类数: {result['cluster_count']}")

            if result['cluster_count'] > 0:
                print(f"  - 聚类详情:")
                for i, cluster in enumerate(result['clusters'], 1):
                    print(f"    聚类{i}: 包含 {len(cluster)} 个点")

            return True
        else:
            print(f"[失败] {result.get('message', '未知错误')}")
            return False

    except Exception as e:
        print(f"[错误] {str(e)}")
        return False
    finally:
        conn.close()


def main():
    """主测试函数"""
    print("\n" + "="*60)
    print("机器学习模块测试套件")
    print("="*60)
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    results = {}

    # 执行所有测试
    results['异常检测'] = test_anomaly_detection()
    results['时间序列预测'] = test_time_series_prediction()
    results['Prophet预测'] = test_prophet_prediction()
    results['自动模型选择'] = test_auto_model_selection()
    results['空间关联分析'] = test_spatial_correlation()

    # 汇总结果
    print("\n" + "="*60)
    print("测试结果汇总")
    print("="*60)

    for test_name, result in results.items():
        if result is True:
            status = "[通过]"
        elif result is False:
            status = "[失败]"
        else:
            status = "[跳过]"
        print(f"{status} {test_name}")

    # 统计
    passed = sum(1 for r in results.values() if r is True)
    failed = sum(1 for r in results.values() if r is False)
    skipped = sum(1 for r in results.values() if r is None)
    total = len(results)

    print(f"\n总计: {total} 个测试")
    print(f"通过: {passed}")
    print(f"失败: {failed}")
    print(f"跳过: {skipped}")

    if failed == 0:
        print("\n[成功] 所有测试通过！")
    else:
        print(f"\n[警告] {failed} 个测试失败")


if __name__ == '__main__':
    main()
