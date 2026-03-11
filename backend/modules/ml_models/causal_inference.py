# -*- coding: utf-8 -*-
"""
因果推断模块 - 量化施工事件影响
使用双重差分法（DID）和合成控制法（SCM）
"""
import numpy as np
import pandas as pd
from scipy.optimize import minimize
import warnings
warnings.filterwarnings('ignore')


class CausalInference:
    """因果推断分析器"""

    def __init__(self):
        self.treatment_effect = None
        self.method = None

    def difference_in_differences(self, treated_before, treated_after,
                                  control_before, control_after):
        """
        双重差分法（DID）

        Args:
            treated_before: 处理组事件前的值（数组）
            treated_after: 处理组事件后的值（数组）
            control_before: 对照组事件前的值（数组）
            control_after: 对照组事件后的值（数组）

        Returns:
            result: 处理效应分析结果
        """
        # 处理组的变化
        treated_change = np.mean(treated_after) - np.mean(treated_before)

        # 对照组的变化（自然趋势）
        control_change = np.mean(control_after) - np.mean(control_before)

        # 双重差分估计量
        treatment_effect = treated_change - control_change

        self.treatment_effect = treatment_effect
        self.method = 'DID'

        # 计算标准误（简化版）
        n_treated = len(treated_before) + len(treated_after)
        n_control = len(control_before) + len(control_after)

        var_treated = np.var(np.concatenate([treated_before, treated_after]))
        var_control = np.var(np.concatenate([control_before, control_after]))

        se = np.sqrt(var_treated / n_treated + var_control / n_control)

        # 95%置信区间
        ci_lower = treatment_effect - 1.96 * se
        ci_upper = treatment_effect + 1.96 * se

        return {
            'method': 'DID',
            'treatment_effect': float(treatment_effect),
            'treated_change': float(treated_change),
            'control_change': float(control_change),
            'standard_error': float(se),
            'confidence_interval': [float(ci_lower), float(ci_upper)],
            'interpretation': self._interpret_effect(treatment_effect, 'DID')
        }

    def synthetic_control(self, treated_data, control_data_matrix,
                         event_time_index):
        """
        合成控制法（SCM）

        Args:
            treated_data: 处理组时间序列 (T,)
            control_data_matrix: 对照组矩阵 (T, N) N个对照点
            event_time_index: 事件发生时间索引

        Returns:
            result: 合成控制分析结果
        """
        T, N = control_data_matrix.shape

        if event_time_index >= T or event_time_index < 1:
            raise ValueError("事件时间索引无效")

        # 事件前数据
        treated_pre = treated_data[:event_time_index]
        control_pre = control_data_matrix[:event_time_index, :]

        # 优化权重，使合成控制组在事件前与处理组最接近
        def objective(weights):
            synthetic = control_pre @ weights
            return np.sum((treated_pre - synthetic) ** 2)

        # 约束：权重和为1，且非负
        constraints = {'type': 'eq', 'fun': lambda w: np.sum(w) - 1}
        bounds = [(0, 1) for _ in range(N)]

        result = minimize(
            objective,
            x0=np.ones(N) / N,
            bounds=bounds,
            constraints=constraints,
            method='SLSQP'
        )

        optimal_weights = result.x

        # 构建完整的合成控制组
        synthetic_control = control_data_matrix @ optimal_weights

        # 计算处理效应
        treatment_effect = treated_data - synthetic_control

        # 事件后的平均效应
        post_event_effect = np.mean(treatment_effect[event_time_index:])

        # 拟合优度（事件前）
        pre_event_rmse = np.sqrt(np.mean((treated_pre - synthetic_control[:event_time_index]) ** 2))

        self.treatment_effect = post_event_effect
        self.method = 'SCM'

        return {
            'method': 'SCM',
            'counterfactual': synthetic_control.tolist(),
            'treatment_effect_series': treatment_effect.tolist(),
            'post_event_effect': float(post_event_effect),
            'weights': optimal_weights.tolist(),
            'pre_event_rmse': float(pre_event_rmse),
            'interpretation': self._interpret_effect(post_event_effect, 'SCM')
        }

    def _interpret_effect(self, effect, method):
        """
        解释处理效应

        Args:
            effect: 处理效应值
            method: 方法名称

        Returns:
            interpretation: 解释文本
        """
        if abs(effect) < 0.1:
            magnitude = "几乎没有影响"
        elif abs(effect) < 0.5:
            magnitude = "轻微影响"
        elif abs(effect) < 1.0:
            magnitude = "中等影响"
        elif abs(effect) < 2.0:
            magnitude = "显著影响"
        else:
            magnitude = "严重影响"

        direction = "增加" if effect > 0 else "减少"

        return f"施工事件导致沉降{direction} {abs(effect):.3f} mm（{magnitude}）"


def analyze_event_impact(point_id, event_date, conn=None, control_point_ids=None,
                        method='DID', window_days=30,
                        treated_df=None, fetch_point_fn=None, points_df=None):
    """
    分析施工事件对特定监测点的影响

    Args:
        point_id: 受影响的监测点ID
        event_date: 事件发生日期
        conn: 数据库连接 (legacy, optional)
        control_point_ids: 对照组监测点ID列表（未受影响的点）
        method: 'DID' 或 'SCM'
        window_days: 事件前后的观察窗口（天）
        treated_df: 预取的处理组DataFrame (columns: measurement_date, cumulative_change)
        fetch_point_fn: 函数，接受point_id返回DataFrame
        points_df: 监测点坐标DataFrame (columns: point_id, x_coord, y_coord)

    Returns:
        result: 因果推断结果
    """
    event_date = pd.to_datetime(event_date)

    # 获取处理组数据
    if treated_df is None and fetch_point_fn is not None:
        treated_df = fetch_point_fn(point_id)
    elif treated_df is None and conn is not None:
        query_treated = """
            SELECT measurement_date, cumulative_change
            FROM processed_settlement_data
            WHERE point_id = %s
            ORDER BY measurement_date
        """
        treated_df = pd.read_sql(query_treated, conn, params=(point_id,))
    elif treated_df is None:
        return {'success': False, 'message': 'No data source provided'}

    treated_df['measurement_date'] = pd.to_datetime(treated_df['measurement_date'])

    # 找到事件时间索引
    matches = treated_df[treated_df['measurement_date'] >= event_date]
    if matches.empty:
        return {
            'success': False,
            'message': f'Event date {event_date.strftime("%Y-%m-%d")} is after all available data'
        }
    event_idx = matches.index[0]

    # 用日期定义事件前后窗口（而非位置索引，避免跨DataFrame索引错位）
    event_date_ts = pd.to_datetime(event_date)
    window_start_date = event_date_ts - pd.Timedelta(days=window_days)
    window_end_date = event_date_ts + pd.Timedelta(days=window_days)

    # cumulative_change is the column from fetch_point_raw()
    value_col = 'cumulative_change' if 'cumulative_change' in treated_df.columns else 'cumulative_settlement'
    treated_before = treated_df[
        (treated_df['measurement_date'] >= window_start_date) &
        (treated_df['measurement_date'] < event_date_ts)
    ][value_col].values
    treated_after = treated_df[
        (treated_df['measurement_date'] >= event_date_ts) &
        (treated_df['measurement_date'] <= window_end_date)
    ][value_col].values

    if len(treated_before) == 0 or len(treated_after) == 0:
        return {
            'success': False,
            'message': f'Insufficient data around event date {event_date_ts.strftime("%Y-%m-%d")}. '
                       f'Before: {len(treated_before)} points, After: {len(treated_after)} points',
            'point_id': point_id
        }

    if control_point_ids is None:
        # 自动选择对照组
        if points_df is not None and not points_df.empty:
            from modules.ml_models.supabase_data import find_distant_points
            control_point_ids = find_distant_points(point_id, points_df, n=3)
            # 如果坐标全为0导致距离选择失败,随机选3个其他点
            if not control_point_ids:
                other_ids = points_df[points_df['point_id'] != point_id]['point_id'].tolist()
                control_point_ids = other_ids[:3]
        elif conn is not None:
            query_control_points = """
                SELECT p1.point_id,
                       SQRT(POW(p1.x_coord - p2.x_coord, 2) +
                            POW(p1.y_coord - p2.y_coord, 2)) as distance
                FROM monitoring_points p1
                CROSS JOIN monitoring_points p2
                WHERE p2.point_id = %s AND p1.point_id != %s
                ORDER BY distance DESC
                LIMIT 3
            """
            control_df = pd.read_sql(query_control_points, conn, params=(point_id, point_id))
            control_point_ids = control_df['point_id'].tolist()
        else:
            control_point_ids = []

    if not control_point_ids:
        return {
            'success': False,
            'message': 'No control points available. Please specify control_point_ids manually.',
            'point_id': point_id
        }

    # 创建因果推断分析器
    causal = CausalInference()

    if method == 'DID':
        # 查询对照组数据 - 使用日期筛选（非位置索引）
        control_before_list = []
        control_after_list = []

        for ctrl_id in control_point_ids:
            if fetch_point_fn is not None:
                ctrl_df = fetch_point_fn(ctrl_id)
            elif conn is not None:
                query_ctrl = """
                    SELECT measurement_date, cumulative_change
                    FROM processed_settlement_data
                    WHERE point_id = %s
                    ORDER BY measurement_date
                """
                ctrl_df = pd.read_sql(query_ctrl, conn, params=(ctrl_id,))
            else:
                continue
            ctrl_df['measurement_date'] = pd.to_datetime(ctrl_df['measurement_date'])

            ctrl_before = ctrl_df[
                (ctrl_df['measurement_date'] >= window_start_date) &
                (ctrl_df['measurement_date'] < event_date_ts)
            ]['cumulative_change'].values
            ctrl_after = ctrl_df[
                (ctrl_df['measurement_date'] >= event_date_ts) &
                (ctrl_df['measurement_date'] <= window_end_date)
            ]['cumulative_change'].values

            if len(ctrl_before) > 0:
                control_before_list.extend(ctrl_before)
            if len(ctrl_after) > 0:
                control_after_list.extend(ctrl_after)

        if not control_before_list or not control_after_list:
            return {
                'success': False,
                'message': f'No control group data in window [{window_start_date.strftime("%Y-%m-%d")}, '
                           f'{window_end_date.strftime("%Y-%m-%d")}]. Control points tried: {control_point_ids}',
                'point_id': point_id
            }

        # 执行DID分析
        result = causal.difference_in_differences(
            treated_before, treated_after,
            np.array(control_before_list), np.array(control_after_list)
        )

    elif method == 'SCM':
        # 构建对照组矩阵
        control_matrix_list = []

        for ctrl_id in control_point_ids:
            if fetch_point_fn is not None:
                ctrl_df = fetch_point_fn(ctrl_id)
            elif conn is not None:
                query_ctrl = """
                    SELECT measurement_date, cumulative_change
                    FROM processed_settlement_data
                    WHERE point_id = %s
                    ORDER BY measurement_date
                """
                ctrl_df = pd.read_sql(query_ctrl, conn, params=(ctrl_id,))
            else:
                continue
            ctrl_df['measurement_date'] = pd.to_datetime(ctrl_df['measurement_date'])
            control_matrix_list.append(ctrl_df[value_col].values)

        if not control_matrix_list:
            return {
                'success': False,
                'message': 'No control group data available for SCM',
                'point_id': point_id
            }

        control_matrix = np.column_stack(control_matrix_list)
        treated_full = treated_df[value_col].values

        # 计算位置索引用于SCM
        scm_event_idx = treated_df.index.get_loc(event_idx) if event_idx in treated_df.index else 0
        if isinstance(scm_event_idx, slice):
            scm_event_idx = scm_event_idx.start or 0

        # 执行SCM分析
        result = causal.synthetic_control(treated_full, control_matrix, scm_event_idx)

    else:
        raise ValueError("method必须是'DID'或'SCM'")

    result['point_id'] = point_id
    result['event_date'] = event_date.strftime('%Y-%m-%d')
    result['control_points'] = control_point_ids

    return result


# 测试代码
if __name__ == '__main__':
    print("[测试] 因果推断模块")

    # 示例1：双重差分法
    print("\n[测试1] 双重差分法（DID）")

    # 模拟数据：爆破施工前后的沉降
    treated_before = np.array([1.0, 1.2, 1.1, 1.3, 1.15])  # 施工点事件前
    treated_after = np.array([2.5, 2.8, 2.6, 2.9, 2.7])   # 施工点事件后
    control_before = np.array([0.9, 1.0, 0.95, 1.05, 1.02])  # 远离施工点事件前
    control_after = np.array([1.2, 1.3, 1.25, 1.35, 1.28])   # 远离施工点事件后

    causal = CausalInference()
    result = causal.difference_in_differences(
        treated_before, treated_after,
        control_before, control_after
    )

    print(f"[结果] {result['interpretation']}")
    print(f"[详情] 处理组变化: {result['treated_change']:.3f} mm")
    print(f"[详情] 对照组变化: {result['control_change']:.3f} mm")
    print(f"[详情] 净影响: {result['treatment_effect']:.3f} mm")
    print(f"[详情] 95%置信区间: [{result['confidence_interval'][0]:.3f}, {result['confidence_interval'][1]:.3f}]")

    # 示例2：合成控制法
    print("\n[测试2] 合成控制法（SCM）")

    # 模拟数据
    T = 60  # 60天
    event_time = 30  # 第30天发生施工事件

    # 处理组（受施工影响的点）
    treated_data = np.concatenate([
        np.linspace(0, 3, event_time),  # 事件前正常沉降
        np.linspace(3, 8, T - event_time)  # 事件后加速沉降
    ])

    # 对照组（3个未受影响的点）
    np.random.seed(42)
    control_data_matrix = np.column_stack([
        np.linspace(0, 3.5, T) + np.random.randn(T) * 0.1,
        np.linspace(0, 3.2, T) + np.random.randn(T) * 0.1,
        np.linspace(0, 3.8, T) + np.random.randn(T) * 0.1
    ])

    result = causal.synthetic_control(treated_data, control_data_matrix, event_time)

    print(f"[结果] {result['interpretation']}")
    print(f"[详情] 事件后平均影响: {result['post_event_effect']:.3f} mm")
    print(f"[详情] 合成控制组权重: {[f'{w:.3f}' for w in result['weights']]}")
    print(f"[详情] 事件前拟合误差(RMSE): {result['pre_event_rmse']:.3f} mm")

    print("\n[测试完成]")
