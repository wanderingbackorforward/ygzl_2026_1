# -*- coding: utf-8 -*-
"""
模型自动选择器
根据数据特征自动选择最优预测模型
"""
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error
import warnings
warnings.filterwarnings('ignore')

# 导入各个预测模型
from .time_series_predictor import TimeSeriesPredictor
try:
    from .prophet_predictor import ProphetPredictor, PROPHET_AVAILABLE
except:
    PROPHET_AVAILABLE = False


class ModelSelector:
    """模型自动选择器"""

    def __init__(self):
        self.models = {}
        self.best_model = None
        self.best_model_name = None
        self.evaluation_results = {}

    def analyze_data_characteristics(self, data):
        """
        分析数据特征

        Args:
            data: 时间序列数据（一维数组）

        Returns:
            characteristics: 数据特征字典
        """
        n = len(data)

        # 特征1: 数据量
        data_size = n

        # 特征2: 趋势强度（线性回归R²）
        x = np.arange(n)
        coeffs = np.polyfit(x, data, 1)
        trend_line = np.polyval(coeffs, x)
        ss_res = np.sum((data - trend_line) ** 2)
        ss_tot = np.sum((data - np.mean(data)) ** 2)
        trend_strength = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0

        # 特征3: 波动性（变异系数）
        volatility = np.std(data) / np.mean(data) if np.mean(data) != 0 else 0

        # 特征4: 季节性检测（简化版：检查7天周期）
        if n >= 14:
            weekly_pattern = []
            for i in range(7):
                weekly_data = data[i::7]
                if len(weekly_data) > 1:
                    weekly_pattern.append(np.mean(weekly_data))

            seasonality_strength = np.std(weekly_pattern) / np.mean(data) if np.mean(data) != 0 else 0
        else:
            seasonality_strength = 0

        # 特征5: 平稳性（一阶差分的方差比）
        if n > 1:
            diff_data = np.diff(data)
            stationarity = np.var(diff_data) / np.var(data) if np.var(data) > 0 else 1
        else:
            stationarity = 1

        # 特征6: 异常值比例
        q1, q3 = np.percentile(data, [25, 75])
        iqr = q3 - q1
        outliers = np.sum((data < q1 - 1.5 * iqr) | (data > q3 + 1.5 * iqr))
        outlier_ratio = outliers / n

        return {
            'data_size': data_size,
            'trend_strength': float(trend_strength),
            'volatility': float(volatility),
            'seasonality_strength': float(seasonality_strength),
            'stationarity': float(stationarity),
            'outlier_ratio': float(outlier_ratio)
        }

    def recommend_model(self, characteristics):
        """
        根据数据特征推荐模型

        Args:
            characteristics: 数据特征字典

        Returns:
            recommended_models: 推荐的模型列表（按优先级排序）
        """
        recommendations = []

        data_size = characteristics['data_size']
        trend_strength = characteristics['trend_strength']
        seasonality = characteristics['seasonality_strength']
        volatility = characteristics['volatility']

        # 规则1: 数据量小，使用简单模型
        if data_size < 30:
            recommendations.append({
                'model': 'linear_regression',
                'reason': '数据量较少，适合简单线性模型',
                'priority': 1
            })

        # 规则2: 趋势强且数据量适中，使用ARIMA
        if 30 <= data_size < 100 and trend_strength > 0.7:
            recommendations.append({
                'model': 'arima',
                'reason': '数据呈现强趋势，ARIMA适合捕捉',
                'priority': 2
            })

        # 规则3: 有季节性，使用SARIMA或Prophet
        if seasonality > 0.1 and data_size >= 30:
            recommendations.append({
                'model': 'sarima',
                'reason': '检测到季节性模式，SARIMA可以建模',
                'priority': 2
            })

            if PROPHET_AVAILABLE and data_size >= 50:
                recommendations.append({
                    'model': 'prophet',
                    'reason': '数据有季节性和趋势变化，Prophet表现优秀',
                    'priority': 1
                })

        # 规则4: 数据量大且复杂，优先Prophet
        if data_size >= 100 and PROPHET_AVAILABLE:
            recommendations.append({
                'model': 'prophet',
                'reason': '数据量充足，Prophet可以捕捉复杂模式',
                'priority': 1
            })

        # 规则5: 波动性大，使用ARIMA
        if volatility > 0.3 and data_size >= 30:
            recommendations.append({
                'model': 'arima',
                'reason': '数据波动较大，ARIMA可以处理',
                'priority': 2
            })

        # 默认推荐
        if not recommendations:
            recommendations.append({
                'model': 'arima',
                'reason': '通用场景，ARIMA是稳健选择',
                'priority': 3
            })

        # 按优先级排序
        recommendations.sort(key=lambda x: x['priority'])

        return recommendations

    def evaluate_models(self, data, test_size=0.2):
        """
        评估多个模型的性能

        Args:
            data: 时间序列数据
            test_size: 测试集比例

        Returns:
            results: 评估结果
        """
        n = len(data)
        split_idx = int(n * (1 - test_size))

        train_data = data[:split_idx]
        test_data = data[split_idx:]

        results = {}

        # 评估线性回归（基准模型）
        try:
            x_train = np.arange(len(train_data))
            coeffs = np.polyfit(x_train, train_data, 1)

            x_test = np.arange(len(train_data), len(train_data) + len(test_data))
            predictions = np.polyval(coeffs, x_test)

            mae = mean_absolute_error(test_data, predictions)
            rmse = np.sqrt(mean_squared_error(test_data, predictions))

            results['linear_regression'] = {
                'mae': float(mae),
                'rmse': float(rmse),
                'status': 'success'
            }
        except Exception as e:
            results['linear_regression'] = {
                'status': 'failed',
                'error': str(e)
            }

        # 评估ARIMA
        try:
            predictor = TimeSeriesPredictor(model_type='arima')
            predictor.fit_arima(train_data, auto_select=True)
            metrics = predictor.evaluate(test_data)

            results['arima'] = {
                'mae': metrics['mae'],
                'rmse': metrics['rmse'],
                'mape': metrics['mape'],
                'status': 'success'
            }
        except Exception as e:
            results['arima'] = {
                'status': 'failed',
                'error': str(e)
            }

        # 评估SARIMA
        try:
            predictor = TimeSeriesPredictor(model_type='sarima')
            predictor.fit_sarima(train_data, auto_select=True)
            metrics = predictor.evaluate(test_data)

            results['sarima'] = {
                'mae': metrics['mae'],
                'rmse': metrics['rmse'],
                'mape': metrics['mape'],
                'status': 'success'
            }
        except Exception as e:
            results['sarima'] = {
                'status': 'failed',
                'error': str(e)
            }

        # 评估Prophet
        if PROPHET_AVAILABLE and len(train_data) >= 20:
            try:
                dates = pd.date_range(start='2024-01-01', periods=len(data), freq='D')
                train_df = pd.DataFrame({
                    'ds': dates[:split_idx],
                    'y': train_data
                })
                test_df = pd.DataFrame({
                    'ds': dates[split_idx:],
                    'y': test_data
                })

                predictor = ProphetPredictor()
                predictor.fit(train_df)
                metrics = predictor.evaluate(test_df)

                results['prophet'] = {
                    'mae': metrics['mae'],
                    'rmse': metrics['rmse'],
                    'mape': metrics['mape'],
                    'status': 'success'
                }
            except Exception as e:
                results['prophet'] = {
                    'status': 'failed',
                    'error': str(e)
                }

        self.evaluation_results = results
        return results

    def select_best_model(self, data, metric='mae'):
        """
        自动选择最优模型

        Args:
            data: 时间序列数据
            metric: 评估指标 ('mae', 'rmse', 'mape')

        Returns:
            best_model_info: 最优模型信息
        """
        # 分析数据特征
        characteristics = self.analyze_data_characteristics(data)

        # 获取推荐模型
        recommendations = self.recommend_model(characteristics)

        # 评估模型性能
        evaluation = self.evaluate_models(data)

        # 选择最优模型
        best_score = float('inf')
        best_model_name = None

        for model_name, result in evaluation.items():
            if result['status'] == 'success' and metric in result:
                score = result[metric]
                if score < best_score:
                    best_score = score
                    best_model_name = model_name

        # 如果所有模型都失败，使用线性回归
        if best_model_name is None:
            best_model_name = 'linear_regression'

        self.best_model_name = best_model_name

        return {
            'best_model': best_model_name,
            'best_score': float(best_score) if best_score != float('inf') else None,
            'metric': metric,
            'data_characteristics': characteristics,
            'recommendations': recommendations,
            'all_results': evaluation
        }


def auto_predict(point_id, conn, steps=30, metric='mae'):
    """
    自动选择最优模型并预测

    Args:
        point_id: 监测点ID
        conn: 数据库连接
        steps: 预测步数
        metric: 评估指标

    Returns:
        result: 预测结果
    """
    # 查询数据
    query = """
        SELECT measurement_date as date, cumulative_change as settlement
        FROM processed_settlement_data
        WHERE point_id = %s
        ORDER BY measurement_date
    """

    df = pd.read_sql(query, conn, params=(point_id,))

    if len(df) < 20:
        return {
            'success': False,
            'message': '数据量不足，至少需要20条记录',
            'point_id': point_id
        }

    settlement_data = df['settlement'].values

    # 创建模型选择器
    selector = ModelSelector()

    # 选择最优模型
    selection_result = selector.select_best_model(settlement_data, metric=metric)

    best_model = selection_result['best_model']

    # 使用最优模型进行预测
    if best_model == 'linear_regression':
        # 线性回归预测
        x = np.arange(len(settlement_data))
        coeffs = np.polyfit(x, settlement_data, 1)
        x_future = np.arange(len(settlement_data), len(settlement_data) + steps)
        predictions = np.polyval(coeffs, x_future)

        forecast = {
            'forecast': predictions.tolist(),
            'lower_bound': (predictions - 1.96 * np.std(settlement_data)).tolist(),
            'upper_bound': (predictions + 1.96 * np.std(settlement_data)).tolist()
        }

    elif best_model in ['arima', 'sarima']:
        predictor = TimeSeriesPredictor(model_type=best_model)
        if best_model == 'arima':
            predictor.fit_arima(settlement_data, auto_select=True)
        else:
            predictor.fit_sarima(settlement_data, auto_select=True)

        forecast = predictor.predict(steps=steps)

    elif best_model == 'prophet' and PROPHET_AVAILABLE:
        df_prophet = pd.DataFrame({
            'ds': pd.to_datetime(df['date']),
            'y': settlement_data
        })
        predictor = ProphetPredictor()
        predictor.fit(df_prophet)
        forecast = predictor.predict(periods=steps)

    else:
        return {
            'success': False,
            'message': f'模型 {best_model} 不可用',
            'point_id': point_id
        }

    # 生成预测日期
    last_date = pd.to_datetime(df['date'].iloc[-1])
    future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1),
                                periods=steps, freq='D')

    return {
        'success': True,
        'point_id': point_id,
        'selected_model': best_model,
        'model_selection_info': selection_result,
        'forecast': {
            'dates': future_dates.strftime('%Y-%m-%d').tolist(),
            'values': forecast['forecast'],
            'lower_bound': forecast['lower_bound'],
            'upper_bound': forecast['upper_bound']
        }
    }


# 测试代码
if __name__ == '__main__':
    print("[测试] 模型自动选择器")

    # 模拟不同类型的数据
    np.random.seed(42)

    # 数据1: 强趋势，低波动
    data1 = np.linspace(0, 5, 100) + np.random.randn(100) * 0.1
    print("\n[测试1] 强趋势数据")

    selector = ModelSelector()
    result = selector.select_best_model(data1, metric='mae')

    print(f"[最优模型] {result['best_model']}")
    print(f"[评估分数] MAE = {result['best_score']:.3f}")
    print(f"[数据特征] 趋势强度={result['data_characteristics']['trend_strength']:.3f}, "
          f"波动性={result['data_characteristics']['volatility']:.3f}")

    # 数据2: 季节性模式
    data2 = np.linspace(0, 3, 100) + np.sin(np.arange(100) * 2 * np.pi / 7) * 0.5
    print("\n[测试2] 季节性数据")

    selector = ModelSelector()
    result = selector.select_best_model(data2, metric='mae')

    print(f"[最优模型] {result['best_model']}")
    print(f"[评估分数] MAE = {result['best_score']:.3f}")
    print(f"[数据特征] 季节性强度={result['data_characteristics']['seasonality_strength']:.3f}")

    # 数据3: 小样本
    data3 = np.linspace(0, 2, 25) + np.random.randn(25) * 0.1
    print("\n[测试3] 小样本数据")

    selector = ModelSelector()
    result = selector.select_best_model(data3, metric='mae')

    print(f"[最优模型] {result['best_model']}")
    print(f"[数据特征] 数据量={result['data_characteristics']['data_size']}")

    print("\n[测试完成]")
