# -*- coding: utf-8 -*-
"""
Prophet 时间序列预测模块
适用于有明显趋势和季节性的沉降数据
"""
import pandas as pd
import numpy as np
try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False
    print("[警告] Prophet未安装，请运行: pip install prophet")
import warnings
warnings.filterwarnings('ignore')


class ProphetPredictor:
    """Facebook Prophet 预测器"""

    def __init__(self,
                 changepoint_prior_scale=0.05,
                 seasonality_prior_scale=10.0,
                 holidays_prior_scale=10.0):
        """
        初始化Prophet模型

        Args:
            changepoint_prior_scale: 趋势变化点灵敏度（越大越灵敏）
            seasonality_prior_scale: 季节性强度
            holidays_prior_scale: 节假日效应强度
        """
        if not PROPHET_AVAILABLE:
            raise ImportError("Prophet未安装")

        self.model = Prophet(
            changepoint_prior_scale=changepoint_prior_scale,
            seasonality_prior_scale=seasonality_prior_scale,
            holidays_prior_scale=holidays_prior_scale,
            daily_seasonality=False,
            weekly_seasonality=True,
            yearly_seasonality=False
        )
        self.fitted = False

    def add_construction_events(self, events_df):
        """
        添加施工事件作为特殊日期

        Args:
            events_df: DataFrame with columns ['ds', 'holiday', 'lower_window', 'upper_window']
                      ds: 日期
                      holiday: 事件名称（如"爆破施工"）
                      lower_window: 事件影响开始前几天
                      upper_window: 事件影响持续几天
        """
        self.model = Prophet(holidays=events_df)

    def fit(self, df):
        """
        拟合模型

        Args:
            df: DataFrame with columns ['ds', 'y']
                ds: 日期（datetime格式）
                y: 沉降值（float）
        """
        # 数据验证
        if not isinstance(df, pd.DataFrame):
            raise ValueError("输入必须是pandas DataFrame")

        if 'ds' not in df.columns or 'y' not in df.columns:
            raise ValueError("DataFrame必须包含'ds'和'y'列")

        # 确保日期格式正确
        df = df.copy()
        df['ds'] = pd.to_datetime(df['ds'])

        # 拟合模型
        self.model.fit(df)
        self.fitted = True

        return self

    def predict(self, periods=30, freq='D'):
        """
        预测未来值

        Args:
            periods: 预测周期数
            freq: 频率（'D'=天, 'H'=小时）

        Returns:
            forecast_dict: 包含预测值和置信区间的字典
        """
        if not self.fitted:
            raise ValueError("模型未拟合，请先调用fit方法")

        # 创建未来日期
        future = self.model.make_future_dataframe(periods=periods, freq=freq)

        # 预测
        forecast = self.model.predict(future)

        # 提取关键列
        result = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(periods)

        return {
            'dates': result['ds'].dt.strftime('%Y-%m-%d').tolist(),
            'forecast': result['yhat'].tolist(),
            'lower_bound': result['yhat_lower'].tolist(),
            'upper_bound': result['yhat_upper'].tolist(),
            'steps': periods
        }

    def detect_changepoints(self):
        """
        检测趋势变化点（沉降速率突变点）

        Returns:
            changepoints: 变化点日期列表
        """
        if not self.fitted:
            raise ValueError("模型未拟合")

        changepoints = self.model.changepoints
        return changepoints.dt.strftime('%Y-%m-%d').tolist()

    def get_components(self):
        """
        分解时间序列成分（趋势、周季节性）

        Returns:
            components: 各成分的贡献
        """
        if not self.fitted:
            raise ValueError("模型未拟合")

        # 获取完整预测
        future = self.model.make_future_dataframe(periods=0)
        forecast = self.model.predict(future)

        components = {
            'trend': forecast['trend'].tolist(),
        }

        if 'weekly' in forecast.columns:
            components['weekly'] = forecast['weekly'].tolist()

        return components

    def evaluate(self, test_df):
        """
        评估模型性能

        Args:
            test_df: 测试集 DataFrame ['ds', 'y']

        Returns:
            metrics: MAE, RMSE, MAPE
        """
        # 预测测试集
        forecast = self.model.predict(test_df[['ds']])
        predictions = forecast['yhat'].values
        actuals = test_df['y'].values

        mae = np.mean(np.abs(predictions - actuals))
        rmse = np.sqrt(np.mean((predictions - actuals) ** 2))

        # 避免除零
        non_zero_mask = actuals != 0
        if np.any(non_zero_mask):
            mape = np.mean(np.abs((actuals[non_zero_mask] - predictions[non_zero_mask]) /
                                 actuals[non_zero_mask])) * 100
        else:
            mape = 0.0

        return {
            'mae': float(mae),
            'rmse': float(rmse),
            'mape': float(mape)
        }


def predict_with_prophet(point_id, conn, steps=30):
    """
    使用Prophet为单个监测点预测沉降

    Args:
        point_id: 监测点ID
        conn: 数据库连接
        steps: 预测步数

    Returns:
        result: 预测结果
    """
    if not PROPHET_AVAILABLE:
        return {
            'success': False,
            'message': 'Prophet未安装',
            'point_id': point_id
        }

    # 查询数据
    query = """
        SELECT measurement_date as ds, cumulative_change as y
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
    predictor = ProphetPredictor(changepoint_prior_scale=0.1)

    # 拟合模型
    predictor.fit(df)

    # 预测
    forecast = predictor.predict(periods=steps)

    # 检测变化点
    changepoints = predictor.detect_changepoints()

    return {
        'success': True,
        'point_id': point_id,
        'model_type': 'Prophet',
        'forecast': forecast,
        'changepoints': changepoints,
        'last_actual_value': float(df['y'].iloc[-1]),
        'last_actual_date': pd.to_datetime(df['ds'].iloc[-1]).strftime('%Y-%m-%d')
    }


# 使用示例和测试
if __name__ == '__main__':
    if not PROPHET_AVAILABLE:
        print("[错误] Prophet未安装，无法运行测试")
        print("[提示] 请运行: pip install prophet")
    else:
        print("[测试] Prophet预测模块")

        # 模拟沉降数据
        dates = pd.date_range('2024-01-01', periods=100, freq='D')
        trend = np.linspace(0, 5, 100)
        weekly_pattern = np.sin(np.arange(100) * 2 * np.pi / 7) * 0.3
        noise = np.random.randn(100) * 0.1
        settlement = trend + weekly_pattern + noise

        df = pd.DataFrame({
            'ds': dates,
            'y': settlement
        })

        print(f"[数据] 生成了 {len(df)} 天的沉降数据")

        # 创建预测器
        predictor = ProphetPredictor(changepoint_prior_scale=0.1)

        # 拟合模型
        print("\n[步骤1] 拟合Prophet模型...")
        predictor.fit(df)
        print("[成功] 模型拟合完成")

        # 预测未来30天
        print("\n[步骤2] 预测未来30天...")
        forecast = predictor.predict(periods=30)
        print(f"[预测] 预测值范围: {min(forecast['forecast']):.2f} ~ {max(forecast['forecast']):.2f} mm")

        # 检测变化点
        print("\n[步骤3] 检测趋势变化点...")
        changepoints = predictor.detect_changepoints()
        print(f"[变化点] 发现 {len(changepoints)} 个趋势变化点")
        if len(changepoints) > 0:
            print(f"[示例] 前3个变化点: {changepoints[:3]}")

        # 评估模型
        print("\n[步骤4] 模型评估...")
        train_df = df.iloc[:-10]
        test_df = df.iloc[-10:]
        predictor.fit(train_df)
        metrics = predictor.evaluate(test_df)
        print(f"[评估] MAE: {metrics['mae']:.3f}, RMSE: {metrics['rmse']:.3f}, MAPE: {metrics['mape']:.2f}%")

        print("\n[测试完成]")
