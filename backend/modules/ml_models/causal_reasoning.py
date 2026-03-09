# -*- coding: utf-8 -*-
"""
Causal Reasoning Engine - 因果推理引擎（增强版）
基于结构因果模型(SCM)和反事实推理

核心功能:
1. 因果发现 - 从数据中自动发现因果关系
2. 因果推断 - 量化因果效应大小
3. 反事实推理 - "如果不发生X，Y会怎样？"
4. 干预效应估计 - "采取措施X，Y会改变多少？"

方法:
- PC算法 (因果发现)
- Granger因果检验
- 双重差分法(DID)
- 合成控制法(SCM)
- 倾向得分匹配(PSM)
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
from scipy import stats
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
import warnings
warnings.filterwarnings('ignore')

try:
    from statsmodels.tsa.stattools import grangercausalitytests
    STATSMODELS_AVAILABLE = True
except ImportError:
    STATSMODELS_AVAILABLE = False
    print("[警告] statsmodels未安装")


class CausalReasoningEngine:
    """
    因果推理引擎 - 发现和量化因果关系
    """

    def __init__(self):
        self.causal_graph = {}  # 因果图
        self.causal_effects = {}  # 因果效应

    # =========================================================
    # 1. 因果发现 (Causal Discovery)
    # =========================================================

    def discover_causal_relationships(
        self,
        data: pd.DataFrame,
        method: str = 'granger',
        max_lag: int = 5,
        significance_level: float = 0.05
    ) -> List[Dict]:
        """
        从数据中自动发现因果关系

        Args:
            data: 时间序列数据 (columns: variables, rows: time points)
            method: 方法 (granger/correlation/pc)
            max_lag: 最大滞后阶数
            significance_level: 显著性水平

        Returns:
            因果关系列表
        """
        if method == 'granger':
            return self._granger_causality_discovery(data, max_lag, significance_level)
        elif method == 'correlation':
            return self._correlation_based_discovery(data, significance_level)
        elif method == 'pc':
            return self._pc_algorithm_discovery(data, significance_level)
        else:
            raise ValueError(f"[错误] 不支持的方法: {method}")

    def _granger_causality_discovery(
        self,
        data: pd.DataFrame,
        max_lag: int,
        significance_level: float
    ) -> List[Dict]:
        """
        Granger因果检验

        原理: 如果X的历史信息能显著改善Y的预测，则X Granger因果Y
        """
        if not STATSMODELS_AVAILABLE:
            print("[警告] statsmodels未安装，无法使用Granger因果检验")
            return []

        causal_pairs = []
        variables = data.columns.tolist()

        for i, var_x in enumerate(variables):
            for j, var_y in enumerate(variables):
                if i == j:
                    continue

                try:
                    # 准备数据
                    test_data = data[[var_y, var_x]].dropna()

                    if len(test_data) < max_lag * 2:
                        continue

                    # Granger因果检验
                    result = grangercausalitytests(test_data, max_lag, verbose=False)

                    # 提取p值
                    p_values = [result[lag][0]['ssr_ftest'][1] for lag in range(1, max_lag + 1)]
                    min_p_value = min(p_values)
                    best_lag = p_values.index(min_p_value) + 1

                    # 如果显著，则认为存在因果关系
                    if min_p_value < significance_level:
                        causal_pairs.append({
                            'cause': var_x,
                            'effect': var_y,
                            'method': 'Granger',
                            'p_value': float(min_p_value),
                            'lag': int(best_lag),
                            'confidence': float(1 - min_p_value)
                        })

                except Exception as e:
                    print(f"[警告] Granger检验失败 ({var_x} -> {var_y}): {e}")
                    continue

        print(f"[成功] 发现了 {len(causal_pairs)} 个Granger因果关系")
        return causal_pairs

    def _correlation_based_discovery(
        self,
        data: pd.DataFrame,
        significance_level: float
    ) -> List[Dict]:
        """
        基于相关性的因果发现（简化版）

        注意: 相关性不等于因果性，这只是初步筛选
        """
        causal_pairs = []
        variables = data.columns.tolist()

        # 计算相关系数矩阵
        corr_matrix = data.corr(method='pearson')

        for i, var_x in enumerate(variables):
            for j, var_y in enumerate(variables):
                if i >= j:
                    continue

                corr = corr_matrix.iloc[i, j]

                # 计算p值
                n = len(data)
                t_stat = corr * np.sqrt(n - 2) / np.sqrt(1 - corr**2)
                p_value = 2 * (1 - stats.t.cdf(abs(t_stat), n - 2))

                if p_value < significance_level and abs(corr) > 0.5:
                    causal_pairs.append({
                        'cause': var_x,
                        'effect': var_y,
                        'method': 'Correlation',
                        'correlation': float(corr),
                        'p_value': float(p_value),
                        'confidence': float(abs(corr))
                    })

        print(f"[成功] 发现了 {len(causal_pairs)} 个高相关关系")
        return causal_pairs

    def _pc_algorithm_discovery(
        self,
        data: pd.DataFrame,
        significance_level: float
    ) -> List[Dict]:
        """
        PC算法（简化版）

        原理: 通过条件独立性测试构建因果图
        """
        # 简化实现：基于偏相关
        causal_pairs = []
        variables = data.columns.tolist()

        # 计算偏相关矩阵
        from sklearn.covariance import GraphicalLassoCV

        try:
            model = GraphicalLassoCV()
            model.fit(data.values)
            precision_matrix = model.precision_

            # 精度矩阵的非零元素表示条件依赖
            for i, var_x in enumerate(variables):
                for j, var_y in enumerate(variables):
                    if i >= j:
                        continue

                    if abs(precision_matrix[i, j]) > 0.01:
                        causal_pairs.append({
                            'cause': var_x,
                            'effect': var_y,
                            'method': 'PC',
                            'strength': float(abs(precision_matrix[i, j])),
                            'confidence': float(min(abs(precision_matrix[i, j]), 1.0))
                        })

            print(f"[成功] PC算法发现了 {len(causal_pairs)} 个因果关系")
            return causal_pairs

        except Exception as e:
            print(f"[警告] PC算法失败: {e}")
            return []

    # =========================================================
    # 2. 因果效应估计 (Causal Effect Estimation)
    # =========================================================

    def estimate_causal_effect(
        self,
        data: pd.DataFrame,
        treatment_var: str,
        outcome_var: str,
        method: str = 'DID',
        control_vars: List[str] = None
    ) -> Dict:
        """
        估计因果效应

        Args:
            data: 数据
            treatment_var: 处理变量（原因）
            outcome_var: 结果变量（效应）
            method: 方法 (DID/SCM/PSM/IV)
            control_vars: 控制变量

        Returns:
            因果效应估计结果
        """
        if method == 'DID':
            return self._difference_in_differences(data, treatment_var, outcome_var)
        elif method == 'SCM':
            return self._synthetic_control_method(data, treatment_var, outcome_var, control_vars)
        elif method == 'PSM':
            return self._propensity_score_matching(data, treatment_var, outcome_var, control_vars)
        elif method == 'IV':
            return self._instrumental_variable(data, treatment_var, outcome_var, control_vars)
        else:
            raise ValueError(f"[错误] 不支持的方法: {method}")

    def _difference_in_differences(
        self,
        data: pd.DataFrame,
        treatment_var: str,
        outcome_var: str
    ) -> Dict:
        """
        双重差分法 (Difference-in-Differences)

        原理: 对比处理组和对照组在处理前后的变化差异
        """
        # 假设数据包含: treatment (0/1), post (0/1), outcome
        # treatment=1表示处理组, post=1表示处理后

        if 'treatment' not in data.columns or 'post' not in data.columns:
            print("[警告] DID需要treatment和post列")
            return {'success': False, 'message': '缺少必要列'}

        # 计算四个均值
        y_treat_post = data[(data['treatment'] == 1) & (data['post'] == 1)][outcome_var].mean()
        y_treat_pre = data[(data['treatment'] == 1) & (data['post'] == 0)][outcome_var].mean()
        y_control_post = data[(data['treatment'] == 0) & (data['post'] == 1)][outcome_var].mean()
        y_control_pre = data[(data['treatment'] == 0) & (data['post'] == 0)][outcome_var].mean()

        # DID估计量
        did_estimate = (y_treat_post - y_treat_pre) - (y_control_post - y_control_pre)

        # 回归估计（更精确）
        data['treatment_post'] = data['treatment'] * data['post']

        X = data[['treatment', 'post', 'treatment_post']].values
        y = data[outcome_var].values

        model = LinearRegression()
        model.fit(X, y)

        did_coef = model.coef_[2]  # treatment_post的系数

        return {
            'success': True,
            'method': 'DID',
            'treatment': treatment_var,
            'outcome': outcome_var,
            'effect_size': float(did_estimate),
            'regression_coef': float(did_coef),
            'treat_pre': float(y_treat_pre),
            'treat_post': float(y_treat_post),
            'control_pre': float(y_control_pre),
            'control_post': float(y_control_post)
        }

    def _synthetic_control_method(
        self,
        data: pd.DataFrame,
        treatment_var: str,
        outcome_var: str,
        control_vars: List[str]
    ) -> Dict:
        """
        合成控制法 (Synthetic Control Method)

        原理: 用多个对照单位的加权组合来构造反事实
        """
        # 简化实现：使用线性回归拟合权重
        if not control_vars:
            return {'success': False, 'message': '需要提供对照变量'}

        # 处理前数据
        pre_data = data[data['post'] == 0]

        # 拟合权重
        X_pre = pre_data[control_vars].values
        y_pre = pre_data[outcome_var].values

        model = LinearRegression(positive=True)  # 权重非负
        model.fit(X_pre, y_pre)

        # 预测反事实
        post_data = data[data['post'] == 1]
        X_post = post_data[control_vars].values
        y_counterfactual = model.predict(X_post)

        # 实际结果
        y_actual = post_data[outcome_var].values

        # 因果效应
        effect = np.mean(y_actual - y_counterfactual)

        return {
            'success': True,
            'method': 'SCM',
            'treatment': treatment_var,
            'outcome': outcome_var,
            'effect_size': float(effect),
            'weights': model.coef_.tolist(),
            'control_vars': control_vars
        }

    def _propensity_score_matching(
        self,
        data: pd.DataFrame,
        treatment_var: str,
        outcome_var: str,
        control_vars: List[str]
    ) -> Dict:
        """
        倾向得分匹配 (Propensity Score Matching)

        原理: 通过匹配倾向得分来平衡处理组和对照组
        """
        from sklearn.linear_model import LogisticRegression
        from sklearn.neighbors import NearestNeighbors

        if not control_vars:
            return {'success': False, 'message': '需要提供控制变量'}

        # 估计倾向得分
        X = data[control_vars].values
        treatment = data[treatment_var].values

        ps_model = LogisticRegression()
        ps_model.fit(X, treatment)
        propensity_scores = ps_model.predict_proba(X)[:, 1]

        # 匹配
        treated_idx = np.where(treatment == 1)[0]
        control_idx = np.where(treatment == 0)[0]

        ps_treated = propensity_scores[treated_idx].reshape(-1, 1)
        ps_control = propensity_scores[control_idx].reshape(-1, 1)

        nn = NearestNeighbors(n_neighbors=1)
        nn.fit(ps_control)
        distances, indices = nn.kneighbors(ps_treated)

        # 计算ATT (Average Treatment Effect on the Treated)
        y_treated = data.iloc[treated_idx][outcome_var].values
        y_matched_control = data.iloc[control_idx[indices.flatten()]][outcome_var].values

        att = np.mean(y_treated - y_matched_control)

        return {
            'success': True,
            'method': 'PSM',
            'treatment': treatment_var,
            'outcome': outcome_var,
            'effect_size': float(att),
            'n_treated': len(treated_idx),
            'n_control': len(control_idx),
            'avg_distance': float(np.mean(distances))
        }

    def _instrumental_variable(
        self,
        data: pd.DataFrame,
        treatment_var: str,
        outcome_var: str,
        control_vars: List[str]
    ) -> Dict:
        """
        工具变量法 (Instrumental Variable)

        原理: 使用工具变量来解决内生性问题
        """
        # 简化实现：两阶段最小二乘法(2SLS)
        if not control_vars or len(control_vars) < 1:
            return {'success': False, 'message': '需要提供工具变量'}

        instrument = control_vars[0]  # 第一个控制变量作为工具变量

        # 第一阶段：用工具变量预测处理变量
        X1 = data[[instrument]].values
        treatment = data[treatment_var].values

        stage1_model = LinearRegression()
        stage1_model.fit(X1, treatment)
        treatment_hat = stage1_model.predict(X1)

        # 第二阶段：用预测的处理变量预测结果变量
        X2 = treatment_hat.reshape(-1, 1)
        y = data[outcome_var].values

        stage2_model = LinearRegression()
        stage2_model.fit(X2, y)

        iv_estimate = stage2_model.coef_[0]

        return {
            'success': True,
            'method': 'IV',
            'treatment': treatment_var,
            'outcome': outcome_var,
            'instrument': instrument,
            'effect_size': float(iv_estimate),
            'first_stage_r2': float(stage1_model.score(X1, treatment))
        }

    # =========================================================
    # 3. 反事实推理 (Counterfactual Reasoning)
    # =========================================================

    def counterfactual_inference(
        self,
        data: pd.DataFrame,
        treatment_var: str,
        outcome_var: str,
        intervention: Dict
    ) -> Dict:
        """
        反事实推理："如果不发生X，Y会怎样？"

        Args:
            data: 数据
            treatment_var: 处理变量
            outcome_var: 结果变量
            intervention: 干预 {'var': 'X', 'value': 0}

        Returns:
            反事实结果
        """
        # 训练预测模型
        features = [col for col in data.columns if col != outcome_var]
        X = data[features].values
        y = data[outcome_var].values

        model = LinearRegression()
        model.fit(X, y)

        # 构造反事实数据
        counterfactual_data = data.copy()
        counterfactual_data[intervention['var']] = intervention['value']

        X_cf = counterfactual_data[features].values
        y_cf = model.predict(X_cf)

        # 对比实际结果和反事实结果
        y_actual = data[outcome_var].values
        effect = np.mean(y_actual - y_cf)

        return {
            'success': True,
            'intervention': intervention,
            'actual_mean': float(np.mean(y_actual)),
            'counterfactual_mean': float(np.mean(y_cf)),
            'effect': float(effect),
            'effect_percentage': float(effect / np.mean(y_actual) * 100)
        }

    # =========================================================
    # 4. 干预效应估计 (Intervention Effect)
    # =========================================================

    def estimate_intervention_effect(
        self,
        data: pd.DataFrame,
        intervention: Dict,
        outcome_var: str
    ) -> Dict:
        """
        估计干预效应："采取措施X，Y会改变多少？"

        Args:
            data: 数据
            intervention: 干预 {'var': 'X', 'change': +10}
            outcome_var: 结果变量

        Returns:
            干预效应
        """
        # 训练预测模型
        features = [col for col in data.columns if col != outcome_var]
        X = data[features].values
        y = data[outcome_var].values

        model = LinearRegression()
        model.fit(X, y)

        # 基线预测
        y_baseline = model.predict(X)

        # 干预后预测
        intervention_data = data.copy()
        intervention_data[intervention['var']] += intervention['change']

        X_intervention = intervention_data[features].values
        y_intervention = model.predict(X_intervention)

        # 干预效应
        effect = np.mean(y_intervention - y_baseline)

        return {
            'success': True,
            'intervention': intervention,
            'baseline_mean': float(np.mean(y_baseline)),
            'intervention_mean': float(np.mean(y_intervention)),
            'effect': float(effect),
            'effect_percentage': float(effect / np.mean(y_baseline) * 100)
        }


# 使用示例
if __name__ == '__main__':
    print("[成功] 因果推理引擎模块加载成功!")
    print("[成功] 支持的方法: Granger因果检验、DID、SCM、PSM、IV")
