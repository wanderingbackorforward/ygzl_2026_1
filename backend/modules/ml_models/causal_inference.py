# -*- coding: utf-8 -*-
"""
因果推断模块 - 量化施工事件影响
使用双重差分法（DID）和合成控制法（SCM）
"""
import numpy as np
import pandas as pd
from scipy import stats
from scipy.optimize import minimize
import warnings
warnings.filterwarnings('ignore')


class CausalInference:
    """因果推断分析器"""

    def __init__(self):
        self.treatment_effect = None
        self.method = None

    def difference_in_differences(self, treated_before, treated_after,
                                  control_before, control_after, paired=False):
        """
        双重差分法（DID）

        Args:
            treated_before: 处理组事件前的值（数组）
            treated_after: 处理组事件后的值（数组）
            control_before: 对照组事件前的值（数组）
            control_after: 对照组事件后的值（数组）
            paired: 对照组与处理组是否按日期一一对应。为 True 时先算逐日差值再求标准误，
                    可以消掉两边共有的时间波动，也是这里实际采用的口径。

        Returns:
            result: 处理效应分析结果
        """
        treated_before = np.asarray(treated_before, dtype=float)
        treated_after = np.asarray(treated_after, dtype=float)
        control_before = np.asarray(control_before, dtype=float)
        control_after = np.asarray(control_after, dtype=float)

        # 处理组的变化
        treated_change = np.mean(treated_after) - np.mean(treated_before)

        # 对照组的变化（自然趋势）
        control_change = np.mean(control_after) - np.mean(control_before)

        # 双重差分估计量
        treatment_effect = treated_change - control_change

        self.treatment_effect = treatment_effect
        self.method = 'DID'

        # 标准误：DID 是四个均值相减，不能把前后样本合并后再除以总样本量
        if (paired and len(treated_before) == len(control_before)
                and len(treated_after) == len(control_after)):
            # 逐日差值：同一时点的共同波动被消掉，只留处理组与对照组的差异
            diff_before = treated_before - control_before
            diff_after = treated_after - control_after
            se = np.sqrt(
                np.var(diff_before, ddof=1) / len(diff_before)
                + np.var(diff_after, ddof=1) / len(diff_after)
            )
            dof = len(diff_before) + len(diff_after) - 2
        else:
            se = np.sqrt(
                np.var(treated_before, ddof=1) / len(treated_before)
                + np.var(treated_after, ddof=1) / len(treated_after)
                + np.var(control_before, ddof=1) / len(control_before)
                + np.var(control_after, ddof=1) / len(control_after)
            )
            dof = (len(treated_before) + len(treated_after)
                   + len(control_before) + len(control_after) - 4)

        # 小样本用 t 分布，样本量足够时与 1.96 基本一致
        t_crit = float(stats.t.ppf(0.975, max(dof, 1))) if dof > 0 else 1.96

        # 95%置信区间
        ci_lower = treatment_effect - t_crit * se
        ci_upper = treatment_effect + t_crit * se

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

        # cumulative_change 向下为负：效应为负说明比对照点多下沉
        trend = "多下沉" if effect < 0 else "少下沉"

        return f"施工后比对照点位{trend} {abs(effect):.3f} mm（{magnitude}）"


def _pick_similar_controls(treated_pre, candidate_ids, fetch_point_fn,
                           window_start, event_date, k=3):
    """
    自动挑对照组：只看施工前窗口，挑走势与处理组最接近的 k 个点位。

    不用坐标距离选点，因为 monitoring_points 里的坐标是示意布局，
    不是现场实测坐标；用距离会制造一个看起来合理、实际没有依据的对照。
    """
    if treated_pre is None or len(treated_pre) == 0 or not candidate_ids:
        return []

    scored = []
    for cid in candidate_ids:
        try:
            cdf = fetch_point_fn(cid)
        except Exception:
            continue
        if cdf is None or len(cdf) == 0:
            continue

        cdf = cdf.copy()
        cdf['measurement_date'] = pd.to_datetime(cdf['measurement_date'])
        col = 'cumulative_change' if 'cumulative_change' in cdf.columns else 'cumulative_settlement'
        cpre = cdf[
            (cdf['measurement_date'] >= window_start) &
            (cdf['measurement_date'] < event_date)
        ]
        if len(cpre) < 2:
            continue

        joined = pd.concat(
            [treated_pre.rename('t'),
             cpre.set_index('measurement_date')[col].rename('c')],
            axis=1, join='inner'
        ).dropna()
        if len(joined) < 2:
            continue

        scored.append((float(np.mean(np.abs(joined['t'] - joined['c']))), cid))

    scored.sort(key=lambda item: item[0])
    return [cid for _, cid in scored[:k]]


def _aligned_series(dates, treated_values, control_series):
    """按日期把对照序列对齐到处理组序列；缺测的日期直接丢掉，不补数。"""
    if control_series is None or len(control_series) == 0:
        return dates, treated_values, [0.0] * len(dates)

    ctrl = control_series.reindex(pd.to_datetime(dates))
    keep = ~ctrl.isna().values
    if keep.all():
        return dates, treated_values, [float(v) for v in ctrl.values]

    return (
        [d for d, k in zip(dates, keep) if k],
        [float(v) for v, k in zip(treated_values, keep) if k],
        [float(v) for v, k in zip(ctrl.values, keep) if k],
    )


def _build_verdict(point_id, effect, ci, method='DID'):
    """把统计结果翻译成一句人话结论、依据和建议。"""
    lo, hi = float(ci[0]), float(ci[1])
    significant = (lo > 0) or (hi < 0)
    abs_effect = abs(float(effect))
    trend = '多下沉' if effect < 0 else '少下沉'
    base = ('和“如果没施工”的推算线相比' if method == 'SCM'
            else '扣掉对比点位的同期变化后')

    if not significant:
        return {
            'significant': False,
            'level': 'unknown',
            'headline': f'看不出施工对 {point_id} 有明显影响',
            'detail': (
                f'{base}，差距是 {abs_effect:.2f} mm，'
                f'但可能范围在 {lo:.2f} ~ {hi:.2f} mm 之间，跨过了 0，'
                f'所以不能断定是施工造成的。'
            ),
            'advice': '先继续观察 2~3 周；如果这个点位和对比点位持续拉开差距，再复核。',
        }

    return {
        'significant': True,
        'level': 'clear',
        'headline': f'施工后 {point_id} 比同等条件的点位{trend}了 {abs_effect:.2f} mm',
        'detail': (
            f'{base}，差距是 {abs_effect:.2f} mm；'
            f'可能范围在 {lo:.2f} ~ {hi:.2f} mm 之间，没有跨过 0，'
            f'说明这个差距不太可能只是正常波动。'
        ),
        'advice': (
            '建议复核这个点位的预警阈值，并加密观测频次。'
            if effect < 0 else
            '影响方向偏安全，建议保持现有观测频率，确认是否持续。'
        ),
    }


def analyze_event_impact(point_id, event_date, conn=None, control_point_ids=None,
                        method='DID', window_days=30,
                        treated_df=None, fetch_point_fn=None, points_df=None,
                        exclude_point_ids=None):
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
        exclude_point_ids: 不能作为对照的点位（例如同一次施工影响范围内的点）

    Returns:
        result: 因果推断结果
    """
    try:
        window_days = int(window_days)
    except (TypeError, ValueError):
        return {'success': False, 'message': '观察窗口必须是整数天数'}
    if window_days < 1 or window_days > 365:
        return {'success': False, 'message': '观察窗口需在 1~365 天之间'}

    method = str(method or 'DID').upper()
    if method not in ('DID', 'SCM'):
        return {'success': False, 'message': "method 必须是 'DID' 或 'SCM'"}

    try:
        event_date = pd.to_datetime(event_date)
    except Exception:
        return {'success': False, 'message': '事件日期格式无效，请用 YYYY-MM-DD'}

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

    if treated_df is None or len(treated_df) == 0:
        return {
            'success': False,
            'message': f'点位 {point_id} 没有沉降数据，请检查点位编号',
            'point_id': point_id
        }

    treated_df = treated_df.sort_values('measurement_date').reset_index(drop=True)
    treated_df['measurement_date'] = pd.to_datetime(treated_df['measurement_date'])

    # 找到事件时间索引
    matches = treated_df[treated_df['measurement_date'] >= event_date]
    if matches.empty:
        last_date = treated_df['measurement_date'].max().strftime('%Y-%m-%d')
        return {
            'success': False,
            'message': f'事件日期晚于全部实测数据（最后一条是 {last_date}），无法分析'
        }

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
        # 自动配对对照组：用施工前走势最接近的点位，而不是按字母序取前三个
        from modules.ml_models.supabase_data import fetch_settlement_point_ids
        all_point_ids = fetch_settlement_point_ids()
        excluded = set(exclude_point_ids or []) | {point_id}
        other_ids = [pid for pid in all_point_ids if pid not in excluded]
        treated_pre_series = treated_df.loc[
            (treated_df['measurement_date'] >= window_start_date) &
            (treated_df['measurement_date'] < event_date_ts),
            ['measurement_date', value_col]
        ].set_index('measurement_date')[value_col]
        control_point_ids = _pick_similar_controls(
            treated_pre_series, other_ids, fetch_point_fn,
            window_start_date, event_date_ts, k=3
        )
        control_selection = 'auto_similar_trend'
        if not control_point_ids:
            control_point_ids = other_ids[:3]
            control_selection = 'auto_first_ids'
    else:
        control_selection = 'manual'

    if not control_point_ids:
        return {
            'success': False,
            'message': 'No control points available. Please specify control_point_ids manually.',
            'point_id': point_id
        }

    # 创建因果推断分析器
    causal = CausalInference()

    if method == 'DID':
        # 多个对照点按日期取平均，得到一条合成对照序列
        ctrl_frames = []

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
            if ctrl_df is None or len(ctrl_df) == 0 or value_col not in ctrl_df.columns:
                continue
            ctrl_df['measurement_date'] = pd.to_datetime(ctrl_df['measurement_date'])
            ctrl_frames.append(
                ctrl_df[['measurement_date', value_col]].rename(
                    columns={value_col: 'cumulative_change'})
            )

        if not ctrl_frames:
            return {
                'success': False,
                'message': f'No control group data in window [{window_start_date.strftime("%Y-%m-%d")}, '
                           f'{window_end_date.strftime("%Y-%m-%d")}]. Control points tried: {control_point_ids}',
                'point_id': point_id
            }

        ctrl_avg = pd.concat(ctrl_frames, ignore_index=True) \
            .groupby('measurement_date')['cumulative_change'].mean()

        # 添加前端图表需要的时间序列数据 (before_period / after_period)
        before_dates = treated_df[
            (treated_df['measurement_date'] >= window_start_date) &
            (treated_df['measurement_date'] < event_date_ts)
        ]['measurement_date'].dt.strftime('%Y-%m-%d').tolist()
        after_dates = treated_df[
            (treated_df['measurement_date'] >= event_date_ts) &
            (treated_df['measurement_date'] <= window_end_date)
        ]['measurement_date'].dt.strftime('%Y-%m-%d').tolist()

        # 图表和统计用同一条对照序列：按日期对齐，缺测日期直接丢弃，不补数
        before_dates, b_treated, c_before = _aligned_series(
            before_dates, treated_before.tolist(), ctrl_avg)
        after_dates, a_treated, c_after = _aligned_series(
            after_dates, treated_after.tolist(), ctrl_avg)

        if len(b_treated) < 2 or len(a_treated) < 2:
            return {
                'success': False,
                'message': '施工前后可对齐的实测日期不足（各需至少 2 次），请放大观察窗口',
                'point_id': point_id
            }

        # 执行DID分析：按日期配对，标准误用逐日差值计算
        result = causal.difference_in_differences(
            b_treated, a_treated, c_before, c_after, paired=True
        )

        result['before_period'] = {
            'dates': before_dates,
            'treated_values': b_treated,
            'control_values': c_before,
        }
        result['after_period'] = {
            'dates': after_dates,
            'treated_values': a_treated,
            'control_values': c_after,
        }

    elif method == 'SCM':
        # 每个对照点按日期对齐到处理组，缺测的点位/日期不参与拟合
        ctrl_series = {}

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
            if ctrl_df is None or len(ctrl_df) == 0 or value_col not in ctrl_df.columns:
                continue
            ctrl_df['measurement_date'] = pd.to_datetime(ctrl_df['measurement_date'])
            ctrl_series[ctrl_id] = ctrl_df.set_index('measurement_date')[value_col]

        if not ctrl_series:
            return {
                'success': False,
                'message': 'No control group data available for SCM',
                'point_id': point_id
            }

        treated_indexed = treated_df.set_index('measurement_date')[value_col]
        ctrl_aligned = pd.DataFrame(ctrl_series).reindex(treated_indexed.index).dropna(how='any')
        # 与对比法使用同一观察窗，保证图表和“样本量”口径一致
        ctrl_aligned = ctrl_aligned.loc[
            (ctrl_aligned.index >= window_start_date) &
            (ctrl_aligned.index <= window_end_date)
        ]

        if len(ctrl_aligned) < 3:
            return {
                'success': False,
                'message': '对照组与处理组能对齐的日期太少，无法做趋势模拟，请改用对比法',
                'point_id': point_id
            }

        treated_full = treated_indexed.loc[ctrl_aligned.index].values
        control_matrix = ctrl_aligned.values
        scm_event_idx = int((ctrl_aligned.index < event_date_ts).sum())

        if scm_event_idx < 1 or scm_event_idx >= len(treated_full):
            return {
                'success': False,
                'message': '事件日期把可用数据切成了空的一段，请调整观察窗口',
                'point_id': point_id
            }

        # 执行SCM分析
        result = causal.synthetic_control(treated_full, control_matrix, scm_event_idx)

        # ---- Normalize SCM output to match DID format for frontend ----
        mask_b = ctrl_aligned.index < event_date_ts
        mask_a = (ctrl_aligned.index >= event_date_ts) & (ctrl_aligned.index <= window_end_date)
        t_before = treated_full[mask_b]
        t_after = treated_full[mask_a]

        result['treatment_effect'] = result['post_event_effect']
        result['treated_change'] = (
            float(np.mean(t_after) - np.mean(t_before))
            if len(t_before) > 0 and len(t_after) > 0 else 0.0
        )
        result['control_change'] = 0.0

        # 区间用事件前拟合误差，并按小样本 t 分布放大；拟合误差越大区间越宽
        pre_rmse = float(result.get('pre_event_rmse', 1.0))
        t_crit = float(stats.t.ppf(0.975, max(scm_event_idx - 1, 1)))
        result['confidence_interval'] = [
            result['post_event_effect'] - t_crit * pre_rmse,
            result['post_event_effect'] + t_crit * pre_rmse,
        ]

        # Build before/after period data for chart rendering
        cf = result.get('counterfactual', [])
        b_dates = [d.strftime('%Y-%m-%d') for d in ctrl_aligned.index[mask_b]]
        a_dates = [d.strftime('%Y-%m-%d') for d in ctrl_aligned.index[mask_a]]

        b_pos = np.flatnonzero(mask_b).tolist()
        a_pos = np.flatnonzero(mask_a).tolist()

        cf_b = [float(cf[p]) for p in b_pos if p < len(cf)] if cf else [0.0] * len(b_dates)
        cf_a = [float(cf[p]) for p in a_pos if p < len(cf)] if cf else [0.0] * len(a_dates)

        result['before_period'] = {
            'dates': b_dates,
            'treated_values': t_before.tolist(),
            'control_values': cf_b,
        }
        result['after_period'] = {
            'dates': a_dates,
            'treated_values': t_after.tolist(),
            'control_values': cf_a,
            'counterfactual': cf_a,
        }

        # 对照组自身的变化，用合成对照序列算，避免前端显示 0.00 mm
        if len(cf_b) > 0 and len(cf_a) > 0:
            result['control_change'] = float(np.mean(cf_a) - np.mean(cf_b))

    else:
        raise ValueError("method必须是'DID'或'SCM'")

    result['point_id'] = point_id
    result['event_date'] = event_date.strftime('%Y-%m-%d')
    result['control_points'] = control_point_ids

    # 统一给出人话结论：先看区间是否跨过 0，再谈影响大小
    ci = result.get('confidence_interval') or [0.0, 0.0]
    rmse = float(result.get('pre_event_rmse') or 0.0)
    # 趋势模拟法事件前拟合误差小于 0.05 mm 时，说明合成对照几乎复制了处理组，
    # 后续区间会过度乐观，这种情况不能当作定论
    result['interval_reliable'] = not (result.get('method') == 'SCM' and rmse < 0.05)

    verdict = _build_verdict(
        point_id, float(result.get('treatment_effect', 0.0)), ci,
        result.get('method', 'DID')
    )
    result.update(verdict)

    if not result['significant'] and result['interval_reliable']:
        # interpretation 是方法层的粗解释，这里按统计结论改写，避免“中等影响”和
        # “看不出明显影响”同时出现在一个响应里
        effect = float(result.get('treatment_effect', 0.0))
        direction = '多下沉' if effect < 0 else '少下沉'
        result['interpretation'] = (
            f'施工后比对照点位{direction} {abs(effect):.2f} mm，'
            '但波动范围跨过 0，统计上还不能确认是施工造成的'
        )

    if not result['interval_reliable']:
        result['level'] = 'caution'
        result['headline'] = f'{point_id} 的影响估算不够稳，建议改用对比法'
        result['detail'] = '趋势模拟法对施工前的数据拟合得过于完美，把握区间会偏乐观，不能当作定论。'
        result['advice'] = '在高级设置里切回「对比法（推荐）」再算一次。'

    result['method_label'] = '对比法' if result.get('method') == 'DID' else '趋势模拟法'
    result['control_selection'] = control_selection

    n_before = len((result.get('before_period') or {}).get('dates') or [])
    n_after = len((result.get('after_period') or {}).get('dates') or [])
    result['sample_size'] = {
        'treated_before': int(n_before),
        'treated_after': int(n_after),
        'control_points': int(len(control_point_ids)),
    }
    # 周测数据下，前后各少于 5 次很难压住正常波动，页面要提示样本偏少
    result['low_sample'] = min(n_before, n_after) < 5
    result['data_note'] = (
        f'施工前 {n_before} 次、施工后 {n_after} 次；'
        f'对比点位 {len(control_point_ids)} 个'
    )
    result['algorithm'] = {
        'name': result.get('method'),
        'label': result['method_label'],
        'uses_llm': False,
        'data_source': '现场沉降监测实测数据（周测）',
    }

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
