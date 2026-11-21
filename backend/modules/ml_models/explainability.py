# -*- coding: utf-8 -*-
"""
Explainability module - Feature importance analysis

Supports two backends:
1. SHAP (if installed) - SHapley Additive exPlanations
2. Lightweight (sklearn) - permutation_importance fallback
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
import warnings
warnings.filterwarnings('ignore')

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False
    print("[Info] SHAP not installed, using permutation_importance fallback")


class LightweightExplainer:
    """
    Lightweight feature importance using sklearn permutation_importance.
    No external dependencies beyond sklearn (already available on Vercel).
    """

    def __init__(self):
        self.model = None
        self.feature_names = None
        self.importance_result = None

    def explain(self, X: np.ndarray, y: np.ndarray,
                feature_names: List[str] = None,
                n_repeats: int = 10) -> Dict:
        """
        Train a GradientBoostingRegressor and compute permutation importance.

        Args:
            X: feature matrix (n_samples, n_features)
            y: target values (n_samples,)
            feature_names: list of feature names
            n_repeats: number of permutation repeats

        Returns:
            dict with feature_importance and summary
        """
        from sklearn.ensemble import GradientBoostingRegressor
        from sklearn.inspection import permutation_importance
        from sklearn.model_selection import train_test_split

        self.feature_names = feature_names or [f"feature_{i}" for i in range(X.shape[1])]

        # Split data
        if len(X) > 30:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.3, random_state=42
            )
        else:
            X_train, X_test, y_train, y_test = X, X, y, y

        # Train model
        self.model = GradientBoostingRegressor(
            n_estimators=100, max_depth=4, learning_rate=0.1, random_state=42
        )
        self.model.fit(X_train, y_train)

        train_score = self.model.score(X_train, y_train)
        test_score = self.model.score(X_test, y_test)

        # Permutation importance on test set
        perm_result = permutation_importance(
            self.model, X_test, y_test,
            n_repeats=n_repeats, random_state=42
        )

        # Build feature_importance list (sorted by importance descending)
        importances = perm_result.importances_mean
        sorted_idx = np.argsort(importances)[::-1]

        feature_importance = []
        for rank, idx in enumerate(sorted_idx):
            feature_importance.append({
                'feature': self.feature_names[idx],
                'importance': float(importances[idx]),
                'std': float(perm_result.importances_std[idx]),
                'rank': rank + 1,
            })

        # Build summary statistics
        summary = []
        for idx in sorted_idx:
            vals = perm_result.importances[idx]
            summary.append({
                'feature': self.feature_names[idx],
                'mean_shap': float(np.mean(vals)),
                'mean_abs_shap': float(np.mean(np.abs(vals))),
                'std_shap': float(np.std(vals)),
                'min_shap': float(np.min(vals)),
                'max_shap': float(np.max(vals)),
                'median_shap': float(np.median(vals)),
            })

        return {
            'success': True,
            'method': 'permutation_importance',
            'feature_importance': feature_importance,
            'summary': summary,
            'model_performance': {
                'train_r2': round(train_score, 4),
                'test_r2': round(test_score, 4),
            },
        }


def build_settlement_features(settlement_values: np.ndarray) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    """
    Build time-series features from raw settlement data.

    Returns: (X, y, feature_names)
    """
    n = len(settlement_values)
    if n < 10:
        raise ValueError("Need at least 10 data points")

    # Feature engineering
    lag_1 = np.roll(settlement_values, 1); lag_1[0] = settlement_values[0]
    lag_2 = np.roll(settlement_values, 2); lag_2[:2] = settlement_values[0]
    lag_3 = np.roll(settlement_values, 3); lag_3[:3] = settlement_values[0]
    lag_7 = np.roll(settlement_values, 7); lag_7[:7] = settlement_values[0]

    # Rolling statistics
    s = pd.Series(settlement_values)
    roll_mean_3 = s.rolling(3, min_periods=1).mean().values
    roll_std_3 = s.rolling(3, min_periods=1).std().fillna(0).values
    roll_mean_7 = s.rolling(7, min_periods=1).mean().values
    roll_std_7 = s.rolling(7, min_periods=1).std().fillna(0).values

    # Rate of change
    diff_1 = np.diff(settlement_values, prepend=settlement_values[0])

    # Time index (normalized)
    time_idx = np.arange(n) / max(n - 1, 1)

    feature_names = [
        'lag_1 (1-day lag)',
        'lag_2 (2-day lag)',
        'lag_3 (3-day lag)',
        'lag_7 (7-day lag)',
        'roll_mean_3 (3-day avg)',
        'roll_std_3 (3-day volatility)',
        'roll_mean_7 (7-day avg)',
        'roll_std_7 (7-day volatility)',
        'rate_of_change (daily delta)',
        'time_progression',
    ]

    X = np.column_stack([
        lag_1, lag_2, lag_3, lag_7,
        roll_mean_3, roll_std_3,
        roll_mean_7, roll_std_7,
        diff_1, time_idx,
    ])

    return X, settlement_values, feature_names


class ExplainabilityAnalyzer:
    """
    可解释性分析器 - 使用SHAP解释模型预测
    """

    def __init__(self, model, model_type: str = 'tree'):
        """
        Args:
            model: 训练好的模型
            model_type: 模型类型 (tree, linear, deep, kernel)
        """
        if not SHAP_AVAILABLE:
            raise ImportError("[错误] SHAP未安装")

        self.model = model
        self.model_type = model_type
        self.explainer = None
        self.shap_values = None
        self.feature_names = None

    def fit(self, X: np.ndarray, feature_names: List[str] = None):
        """
        初始化SHAP解释器

        Args:
            X: 训练数据 (n_samples, n_features)
            feature_names: 特征名称列表
        """
        self.feature_names = feature_names or [f"Feature_{i}" for i in range(X.shape[1])]

        print(f"[成功] 初始化SHAP解释器 (模型类型: {self.model_type})...")

        # 根据模型类型选择解释器
        if self.model_type == 'tree':
            # 树模型 (RandomForest, XGBoost, LightGBM)
            self.explainer = shap.TreeExplainer(self.model)

        elif self.model_type == 'linear':
            # 线性模型 (LinearRegression, Ridge, Lasso)
            self.explainer = shap.LinearExplainer(self.model, X)

        elif self.model_type == 'deep':
            # 深度学习模型 (PyTorch, TensorFlow)
            self.explainer = shap.DeepExplainer(self.model, X)

        elif self.model_type == 'kernel':
            # 通用模型 (任意黑盒模型)
            self.explainer = shap.KernelExplainer(self.model.predict, X)

        else:
            raise ValueError(f"[错误] 不支持的模型类型: {self.model_type}")

        print("[成功] SHAP解释器初始化完成!")

    def explain(self, X: np.ndarray) -> Dict:
        """
        计算SHAP值

        Args:
            X: 待解释的数据 (n_samples, n_features)

        Returns:
            解释结果
        """
        if self.explainer is None:
            raise ValueError("[错误] 请先调用fit()初始化解释器")

        print("[成功] 计算SHAP值...")

        # 计算SHAP值
        self.shap_values = self.explainer.shap_values(X)

        # 如果是多输出模型,取第一个输出
        if isinstance(self.shap_values, list):
            self.shap_values = self.shap_values[0]

        print("[成功] SHAP值计算完成!")

        return {
            'success': True,
            'shap_values': self.shap_values,
            'feature_names': self.feature_names,
            'base_value': self.explainer.expected_value
        }

    def get_feature_importance(self, method: str = 'mean_abs') -> Dict:
        """
        计算特征重要性

        Args:
            method: 计算方法 (mean_abs, mean, max)

        Returns:
            特征重要性排序
        """
        if self.shap_values is None:
            raise ValueError("[错误] 请先调用explain()计算SHAP值")

        if method == 'mean_abs':
            # 平均绝对SHAP值
            importance = np.mean(np.abs(self.shap_values), axis=0)

        elif method == 'mean':
            # 平均SHAP值
            importance = np.mean(self.shap_values, axis=0)

        elif method == 'max':
            # 最大绝对SHAP值
            importance = np.max(np.abs(self.shap_values), axis=0)

        else:
            raise ValueError(f"[错误] 不支持的方法: {method}")

        # 排序
        sorted_indices = np.argsort(importance)[::-1]

        feature_importance = []
        for idx in sorted_indices:
            feature_importance.append({
                'feature': self.feature_names[idx],
                'importance': float(importance[idx]),
                'rank': int(np.where(sorted_indices == idx)[0][0] + 1)
            })

        return {
            'success': True,
            'method': method,
            'feature_importance': feature_importance
        }

    def explain_single_prediction(self, x: np.ndarray, sample_idx: int = 0) -> Dict:
        """
        解释单个预测

        Args:
            x: 单个样本 (1, n_features) 或 (n_features,)
            sample_idx: 样本索引

        Returns:
            单个预测的解释
        """
        if self.shap_values is None:
            raise ValueError("[错误] 请先调用explain()计算SHAP值")

        if x.ndim == 1:
            x = x.reshape(1, -1)

        # 获取该样本的SHAP值
        shap_values_sample = self.shap_values[sample_idx]

        # 构建解释
        contributions = []
        for i, feature_name in enumerate(self.feature_names):
            contributions.append({
                'feature': feature_name,
                'value': float(x[0, i]),
                'shap_value': float(shap_values_sample[i]),
                'contribution': 'positive' if shap_values_sample[i] > 0 else 'negative'
            })

        # 按SHAP值绝对值排序
        contributions.sort(key=lambda x: abs(x['shap_value']), reverse=True)

        # 计算预测值
        base_value = self.explainer.expected_value
        if isinstance(base_value, np.ndarray):
            base_value = base_value[0]

        prediction = base_value + np.sum(shap_values_sample)

        return {
            'success': True,
            'sample_idx': sample_idx,
            'base_value': float(base_value),
            'prediction': float(prediction),
            'contributions': contributions,
            'top_3_features': [c['feature'] for c in contributions[:3]]
        }

    def get_dependence_plot_data(self, feature_idx: int, interaction_idx: int = None) -> Dict:
        """
        获取依赖图数据

        Args:
            feature_idx: 主特征索引
            interaction_idx: 交互特征索引(可选)

        Returns:
            依赖图数据
        """
        if self.shap_values is None:
            raise ValueError("[错误] 请先调用explain()计算SHAP值")

        feature_name = self.feature_names[feature_idx]
        shap_values_feature = self.shap_values[:, feature_idx]

        result = {
            'success': True,
            'feature': feature_name,
            'shap_values': shap_values_feature.tolist()
        }

        if interaction_idx is not None:
            interaction_name = self.feature_names[interaction_idx]
            result['interaction_feature'] = interaction_name

        return result

    def get_summary_statistics(self) -> Dict:
        """
        获取SHAP值的统计摘要
        """
        if self.shap_values is None:
            raise ValueError("[错误] 请先调用explain()计算SHAP值")

        summary = []

        for i, feature_name in enumerate(self.feature_names):
            shap_values_feature = self.shap_values[:, i]

            summary.append({
                'feature': feature_name,
                'mean_shap': float(np.mean(shap_values_feature)),
                'mean_abs_shap': float(np.mean(np.abs(shap_values_feature))),
                'std_shap': float(np.std(shap_values_feature)),
                'min_shap': float(np.min(shap_values_feature)),
                'max_shap': float(np.max(shap_values_feature)),
                'median_shap': float(np.median(shap_values_feature))
            })

        # 按mean_abs_shap排序
        summary.sort(key=lambda x: x['mean_abs_shap'], reverse=True)

        return {
            'success': True,
            'summary': summary
        }


class ModelExplainer:
    """
    模型解释器 - 高级接口,支持多种模型类型
    """

    def __init__(self):
        self.analyzers = {}

    def add_model(self, model_name: str, model, model_type: str = 'tree'):
        """
        添加模型

        Args:
            model_name: 模型名称
            model: 模型对象
            model_type: 模型类型
        """
        analyzer = ExplainabilityAnalyzer(model, model_type)
        self.analyzers[model_name] = analyzer

        print(f"[成功] 添加模型: {model_name} (类型: {model_type})")

    def explain_all(self, X: np.ndarray, feature_names: List[str]) -> Dict:
        """
        解释所有模型

        Args:
            X: 数据
            feature_names: 特征名称

        Returns:
            所有模型的解释结果
        """
        results = {}

        for model_name, analyzer in self.analyzers.items():
            print(f"[成功] 解释模型: {model_name}...")

            try:
                # 初始化解释器
                analyzer.fit(X, feature_names)

                # 计算SHAP值
                analyzer.explain(X)

                # 获取特征重要性
                importance = analyzer.get_feature_importance()

                # 获取统计摘要
                summary = analyzer.get_summary_statistics()

                results[model_name] = {
                    'success': True,
                    'feature_importance': importance['feature_importance'],
                    'summary': summary['summary']
                }

            except Exception as e:
                print(f"[警告] {model_name} 解释失败: {e}")
                results[model_name] = {
                    'success': False,
                    'error': str(e)
                }

        return {
            'success': True,
            'models': results
        }

    def compare_feature_importance(self) -> Dict:
        """
        对比不同模型的特征重要性
        """
        comparison = {}

        for model_name, analyzer in self.analyzers.items():
            if analyzer.shap_values is not None:
                importance = analyzer.get_feature_importance()
                comparison[model_name] = importance['feature_importance']

        return {
            'success': True,
            'comparison': comparison
        }


# 使用示例
if __name__ == '__main__':
    if SHAP_AVAILABLE:
        print("[成功] SHAP可解释性分析模块加载成功!")
        print("[成功] 支持的模型类型: tree, linear, deep, kernel")
    else:
        print("[警告] SHAP未安装,请运行: pip install shap")
