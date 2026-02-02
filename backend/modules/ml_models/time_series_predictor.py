# -*- coding: utf-8 -*-
"""
时间序列预测模块 - ARIMA/SARIMA
适用于沉降数据的高级预测
"""
import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.tsa.stattools import adfuller
import warnings
warnings.filterwarnings('ignore')


class TimeSeriesPredictor:
    """时间序列预测器"""

    def __init__(self, model_type='arima'):
        """
        初始化预测器

        Args:
            model_type: 'arima' 或 'sarima'
        """
        self.model_type = model_type
        self.model = None
        self.fitted_model = None
        self.best_order = None

    def check_stationarity(self, data):
        """
        检查时间序列平稳性（ADF检验）

        Returns:
            bool: True表示平稳，False表示非平稳
            p_value: p值
        """
        result = adfuller(data, autolag='AIC')
        p_value = result[1]
        return p_value < 0.05, p_value

    def auto_difference(self, data, max_d=2):
        """
        自动差分使序列平稳

        Returns:
            differenced_data: 差分后的数据
            d: 差分阶数
        """
        d = 0
        temp_data = data.copy()

        while d <= max_d:
            is_stationary, p_value = self.check_stationarity(temp_data)
            if is_stationary:
                break
            temp_data = np.diff(temp_data)
            d += 1

        return temp_data, d

    def fit_arima(self, data, order=None, auto_select=True):
        """
        拟合ARIMA模型

        Args:
            data: 时间序列数据（一维数组）
            order: (p, d, q) 参数，None则自动选择
            auto_select: 是否自动选择最优参数

        Returns:
            fit_info: 拟合信息
        """
        if order is None and auto_select:
            # 自动确定差分阶数
            _, d = self.auto_difference(data)

            # 网格搜索最优p和q
            best_aic = np.inf
            best_order = (1, d, 1)

            # 限制搜索范围以提高速度
            p_range = range(0, min(4, len(data) // 10))
            q_range = range(0, min(4, len(data) // 10))

            for p in p_range:
                for q in q_range:
                    try:
                        model = ARIMA(data, order=(p, d, q))
                        fitted = model.fit()
                        if fitted.aic < best_aic:
                            best_aic = fitted.aic
                            best_order = (p, d, q)
                    except:
                        continue

            order = best_order
        elif order is None:
            order = (1, 1, 1)

        # 拟合最优模型
        self.model = ARIMA(data, order=order)
        self.fitted_model = self.model.fit()
        self.best_order = order

        return {
            'order': order,
            'aic': float(self.fitted_model.aic),
            'bic': float(self.fitted_model.bic),
            'model_type': 'ARIMA'
        }

    def fit_sarima(self, data, order=None, seasonal_order=None, auto_select=True):
        """
        拟合SARIMA模型（考虑季节性）

        Args:
            data: 时间序列数据
            order: (p, d, q)
            seasonal_order: (P, D, Q, s) s为季节周期
            auto_select: 是否自动选择参数

        Returns:
            fit_info: 拟合信息
        """
        if order is None:
            if auto_select:
                _, d = self.auto_difference(data)
                order = (1, d, 1)
            else:
                order = (1, 1, 1)

        if seasonal_order is None:
            # 假设7天为一个周期（工程施工周期）
            seasonal_order = (1, 1, 1, 7)

        try:
            self.model = SARIMAX(data, order=order, seasonal_order=seasonal_order)
            self.fitted_model = self.model.fit(disp=False)
            self.best_order = order

            return {
                'order': order,
                'seasonal_order': seasonal_order,
                'aic': float(self.fitted_model.aic),
                'bic': float(self.fitted_model.bic),
                'model_type': 'SARIMA'
            }
        except Exception as e:
            # 如果SARIMA失败，回退到ARIMA
            print(f"[警告] SARIMA拟合失败，回退到ARIMA: {str(e)}")
            return self.fit_arima(data, order=order, auto_select=False)

    def predict(self, steps=30):
        """
        预测未来值

        Args:
            steps: 预测步数（天数）

        Returns:
            forecast: 预测结果字典
        """
        if self.fitted_model is None:
            raise ValueError("模型未拟合，请先调用fit方法")

        forecast_result = self.fitted_model.get_forecast(steps=steps)
        forecast = forecast_result.predicted_mean
        conf_int = forecast_result.conf_int()

        # 处理conf_int可能是DataFrame或ndarray的情况
        if hasattr(conf_int, 'iloc'):
            lower_bound = conf_int.iloc[:, 0].tolist()
            upper_bound = conf_int.iloc[:, 1].tolist()
        else:
            lower_bound = conf_int[:, 0].tolist()
            upper_bound = conf_int[:, 1].tolist()

        return {
            'forecast': forecast.tolist(),
            'lower_bound': lower_bound,
            'upper_bound': upper_bound,
            'steps': steps
        }

    def evaluate(self, test_data):
        """
        评估模型性能

        Args:
            test_data: 测试集数据

        Returns:
            metrics: MAE, RMSE, MAPE
        """
        predictions = self.fitted_model.forecast(steps=len(test_data))

        mae = np.mean(np.abs(predictions - test_data))
        rmse = np.sqrt(np.mean((predictions - test_data) ** 2))

        # 避免除零错误
        non_zero_mask = test_data != 0
        if np.any(non_zero_mask):
            mape = np.mean(np.abs((test_data[non_zero_mask] - predictions[non_zero_mask]) /
                                 test_data[non_zero_mask])) * 100
        else:
            mape = 0.0

        return {
            'mae': float(mae),
            'rmse': float(rmse),
            'mape': float(mape)
        }

    def get_residuals(self):
        """
        获取残差用于诊断

        Returns:
            residuals: 残差数组
        """
        if self.fitted_model is None:
            return None
        return self.fitted_model.resid


def predict_settlement(point_id, conn, model_type='arima', steps=30):
    """
    为单个监测点预测沉降

    Args:
        point_id: 监测点ID
        conn: 数据库连接
        model_type: 'arima' 或 'sarima'
        steps: 预测步数

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

    # 创建预测器
    predictor = TimeSeriesPredictor(model_type=model_type)

    # 拟合模型
    settlement_data = df['settlement'].values

    if model_type == 'arima':
        fit_info = predictor.fit_arima(settlement_data, auto_select=True)
    else:
        fit_info = predictor.fit_sarima(settlement_data, auto_select=True)

    # 预测
    forecast = predictor.predict(steps=steps)

    # 生成预测日期
    last_date = pd.to_datetime(df['date'].values[-1])
    future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1),
                                periods=steps, freq='D')

    return {
        'success': True,
        'point_id': point_id,
        'model_info': fit_info,
        'forecast': {
            'dates': future_dates.strftime('%Y-%m-%d').tolist(),
            'values': forecast['forecast'],
            'lower_bound': forecast['lower_bound'],
            'upper_bound': forecast['upper_bound']
        },
        'last_actual_value': float(settlement_data[-1]),
        'last_actual_date': last_date.strftime('%Y-%m-%d')
    }


# 使用示例和测试
if __name__ == '__main__':
    print("[测试] 时间序列预测模块")

    # 模拟沉降数据
    np.random.seed(42)
    dates = pd.date_range('2024-01-01', periods=100, freq='D')
    trend = np.linspace(0, 5, 100)
    noise = np.random.randn(100) * 0.1
    settlement = trend + noise

    print(f"[数据] 生成了 {len(settlement)} 天的沉降数据")

    # 测试ARIMA
    print("\n[测试1] ARIMA模型")
    predictor_arima = TimeSeriesPredictor(model_type='arima')
    fit_info = predictor_arima.fit_arima(settlement, auto_select=True)
    print(f"[拟合] 最优参数: {fit_info['order']}, AIC: {fit_info['aic']:.2f}")

    forecast = predictor_arima.predict(steps=30)
    print(f"[预测] 未来30天预测值范围: {min(forecast['forecast']):.2f} ~ {max(forecast['forecast']):.2f} mm")

    # 测试SARIMA
    print("\n[测试2] SARIMA模型")
    predictor_sarima = TimeSeriesPredictor(model_type='sarima')
    fit_info = predictor_sarima.fit_sarima(settlement, auto_select=True)
    print(f"[拟合] 参数: {fit_info['order']}, AIC: {fit_info['aic']:.2f}")

    forecast = predictor_sarima.predict(steps=30)
    print(f"[预测] 未来30天预测值范围: {min(forecast['forecast']):.2f} ~ {max(forecast['forecast']):.2f} mm")

    # 评估模型
    print("\n[测试3] 模型评估")
    train_data = settlement[:-10]
    test_data = settlement[-10:]

    predictor_arima.fit_arima(train_data, auto_select=True)
    metrics = predictor_arima.evaluate(test_data)
    print(f"[ARIMA] MAE: {metrics['mae']:.3f}, RMSE: {metrics['rmse']:.3f}, MAPE: {metrics['mape']:.2f}%")

    print("\n[测试完成]")
