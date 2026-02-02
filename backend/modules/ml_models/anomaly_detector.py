# -*- coding: utf-8 -*-
"""
异常检测模块 - 孤立森林 + 多维特征工程
适用于沉降数据的智能异常检测
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import LocalOutlierFactor
import warnings
warnings.filterwarnings('ignore')


class AnomalyDetector:
    """多算法异常检测器"""

    def __init__(self, method='isolation_forest', contamination=0.05):
        """
        初始化异常检测器

        Args:
            method: 'isolation_forest' 或 'lof' (Local Outlier Factor)
            contamination: 异常比例（0.05表示5%的数据是异常）
        """
        self.method = method
        self.contamination = contamination
        self.scaler = StandardScaler()
        self.model = None
        self.feature_names = []

        if method == 'isolation_forest':
            self.model = IsolationForest(
                contamination=contamination,
                random_state=42,
                n_estimators=100,
                max_samples='auto'
            )
        elif method == 'lof':
            self.model = LocalOutlierFactor(
                contamination=contamination,
                novelty=True,
                n_neighbors=20
            )

    def prepare_features(self, df):
        """
        准备特征工程

        Args:
            df: DataFrame with columns ['date', 'settlement']

        Returns:
            features: 特征矩阵
            feature_names: 特征名称列表
        """
        df = df.copy()
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date').reset_index(drop=True)

        features = pd.DataFrame()

        # 特征1: 沉降值本身
        features['settlement'] = df['settlement']

        # 特征2: 日沉降速率
        features['daily_rate'] = df['settlement'].diff().fillna(0)

        # 特征3: 7天移动平均
        features['ma_7'] = df['settlement'].rolling(window=7, min_periods=1).mean()

        # 特征4: 7天标准差（波动性）
        features['std_7'] = df['settlement'].rolling(window=7, min_periods=1).std().fillna(0)

        # 特征5: 加速度（二阶差分）
        features['acceleration'] = features['daily_rate'].diff().fillna(0)

        # 特征6: 与移动平均的偏离度
        features['deviation'] = df['settlement'] - features['ma_7']

        # 特征7: 14天移动平均（长期趋势）
        features['ma_14'] = df['settlement'].rolling(window=14, min_periods=1).mean()

        # 特征8: 短期与长期趋势差异
        features['trend_diff'] = features['ma_7'] - features['ma_14']

        # 填充剩余缺失值
        features = features.fillna(method='bfill').fillna(0)

        self.feature_names = features.columns.tolist()

        return features

    def fit(self, df):
        """
        拟合异常检测模型

        Args:
            df: DataFrame with columns ['date', 'settlement']
        """
        features = self.prepare_features(df)

        # 标准化
        features_scaled = self.scaler.fit_transform(features)

        # 拟合模型
        if self.method == 'isolation_forest':
            self.model.fit(features_scaled)
        elif self.method == 'lof':
            self.model.fit(features_scaled)

        return self

    def predict(self, df):
        """
        预测异常点

        Args:
            df: DataFrame with columns ['date', 'settlement']

        Returns:
            anomalies: 异常点信息字典
        """
        features = self.prepare_features(df)
        features_scaled = self.scaler.transform(features)

        # 预测（-1表示异常，1表示正常）
        predictions = self.model.predict(features_scaled)

        # 异常分数（越负越异常）
        if self.method == 'isolation_forest':
            scores = self.model.score_samples(features_scaled)
        else:
            scores = self.model.decision_function(features_scaled)

        # 构建结果
        df = df.copy()
        df['is_anomaly'] = predictions == -1
        df['anomaly_score'] = scores

        # 提取异常点
        anomalies = df[df['is_anomaly']].copy()

        if len(anomalies) > 0:
            anomalies['severity'] = self._calculate_severity(anomalies['anomaly_score'])
            anomalies['anomaly_type'] = self._classify_anomaly_type(anomalies, features)
        else:
            anomalies['severity'] = []
            anomalies['anomaly_type'] = []

        return {
            'total_points': len(df),
            'anomaly_count': len(anomalies),
            'anomaly_rate': len(anomalies) / len(df) * 100 if len(df) > 0 else 0,
            'anomalies': anomalies[['date', 'settlement', 'anomaly_score',
                                   'severity', 'anomaly_type']].to_dict('records')
        }

    def _calculate_severity(self, scores):
        """
        根据异常分数计算严重程度

        Returns:
            severity: 'critical', 'high', 'medium', 'low'
        """
        if len(scores) == 0:
            return []

        # 分数越负越严重
        percentiles = np.percentile(scores, [25, 50, 75])

        severity = []
        for score in scores:
            if score < percentiles[0]:
                severity.append('critical')
            elif score < percentiles[1]:
                severity.append('high')
            elif score < percentiles[2]:
                severity.append('medium')
            else:
                severity.append('low')

        return severity

    def _classify_anomaly_type(self, anomalies_df, features_df):
        """
        分类异常类型

        Returns:
            anomaly_types: 'spike', 'trend', 'acceleration', 'volatility'
        """
        types = []

        for idx in anomalies_df.index:
            # 获取该点的特征
            daily_rate = abs(features_df.loc[idx, 'daily_rate'])
            acceleration = abs(features_df.loc[idx, 'acceleration'])
            std_7 = features_df.loc[idx, 'std_7']
            deviation = abs(features_df.loc[idx, 'deviation'])

            # 根据特征判断异常类型
            if daily_rate > 0.5:  # 日沉降速率过大
                types.append('spike')
            elif acceleration > 0.2:  # 加速度异常
                types.append('acceleration')
            elif std_7 > 0.3:  # 波动性异常
                types.append('volatility')
            elif deviation > 1.0:  # 偏离趋势
                types.append('trend')
            else:
                types.append('unknown')

        return types

    def get_feature_importance(self):
        """
        获取特征重要性（仅适用于孤立森林）

        Returns:
            importance: 特征重要性字典
        """
        if self.method != 'isolation_forest':
            return None

        # 孤立森林没有直接的特征重要性，但可以通过扰动法估计
        return {name: 1.0 / len(self.feature_names)
                for name in self.feature_names}


def detect_anomalies_for_point(point_id, conn, method='isolation_forest',
                               contamination=0.05):
    """
    为单个监测点检测异常

    Args:
        point_id: 监测点ID
        conn: 数据库连接
        method: 检测方法
        contamination: 异常比例

    Returns:
        result: 异常检测结果
    """
    # 查询数据
    query = """
        SELECT measurement_date as date, cumulative_change as settlement
        FROM processed_settlement_data
        WHERE point_id = %s
        ORDER BY measurement_date
    """

    df = pd.read_sql(query, conn, params=(point_id,))

    if len(df) < 10:
        return {
            'success': False,
            'message': '数据量不足，至少需要10条记录',
            'point_id': point_id
        }

    # 创建检测器
    detector = AnomalyDetector(method=method, contamination=contamination)

    # 拟合并预测
    detector.fit(df)
    result = detector.predict(df)

    result['success'] = True
    result['point_id'] = point_id
    result['method'] = method

    return result


# 使用示例和测试
if __name__ == '__main__':
    print("[测试] 异常检测模块")

    # 模拟沉降数据（包含异常点）
    dates = pd.date_range('2024-01-01', periods=100, freq='D')
    settlement = np.cumsum(np.random.randn(100) * 0.1) + np.linspace(0, 5, 100)

    # 人工注入异常点
    settlement[30] += 2.0  # 突然沉降
    settlement[60] -= 1.5  # 突然回弹
    settlement[80:85] += np.random.randn(5) * 0.5  # 波动异常

    df = pd.DataFrame({
        'date': dates,
        'settlement': settlement
    })

    # 创建检测器
    detector = AnomalyDetector(method='isolation_forest', contamination=0.05)

    # 拟合模型
    print("[步骤1] 训练异常检测模型...")
    detector.fit(df)
    print("[成功] 模型训练完成")

    # 预测异常
    print("\n[步骤2] 检测异常点...")
    result = detector.predict(df)

    print(f"[结果] 发现 {result['anomaly_count']} 个异常点 ({result['anomaly_rate']:.1f}%)")

    if result['anomaly_count'] > 0:
        print("\n[异常详情]")
        for i, anomaly in enumerate(result['anomalies'][:5], 1):
            print(f"{i}. 日期: {anomaly['date']}, "
                  f"沉降: {anomaly['settlement']:.2f}mm, "
                  f"严重程度: {anomaly['severity']}, "
                  f"类型: {anomaly['anomaly_type']}")

    print("\n[测试完成]")
