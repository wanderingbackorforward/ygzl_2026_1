# -*- coding: utf-8 -*-
"""
温度V2 科研级算法引擎
7大算法: STL分解、CUSUM变点检测、温度梯度、热扩散系数、冻融周期、养护成熟度、温度-沉降相关性
"""

import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict


class TemperatureAlgorithms:
    """温度科研算法集合 - 纯计算，不依赖外部服务"""

    # ========== 算法1: STL季节性分解 ==========
    @staticmethod
    def stl_decomposition(dates: List[str], values: List[float],
                          period: int = 7) -> Dict[str, Any]:
        """
        简化STL分解: 趋势 + 季节 + 残差
        残差即异常信号，|残差| > 2*sigma 为异常点
        period: 周期天数(7=周周期, 30=月周期, 365=年周期)
        """
        n = len(values)
        if n < period * 2:
            return {'success': False, 'message': '数据量不足，至少需要2个完整周期'}

        y = np.array(values, dtype=float)

        # 1) 趋势: 移动平均
        kernel = np.ones(period) / period
        trend = np.convolve(y, kernel, mode='same')
        # 边缘修正
        half = period // 2
        for i in range(half):
            trend[i] = np.mean(y[:period])
            trend[-(i+1)] = np.mean(y[-period:])

        # 2) 去趋势
        detrended = y - trend

        # 3) 季节分量: 按周期位置取中位数
        seasonal = np.zeros(n)
        for i in range(period):
            indices = list(range(i, n, period))
            seasonal_val = np.median(detrended[indices])
            for idx in indices:
                seasonal[idx] = seasonal_val
        # 中心化
        seasonal -= np.mean(seasonal[:period])

        # 4) 残差
        residual = y - trend - seasonal

        # 5) 异常检测
        sigma = np.std(residual)
        mean_r = np.mean(residual)
        anomaly_threshold = 2.0 * sigma
        anomalies = []
        for i in range(n):
            if abs(residual[i] - mean_r) > anomaly_threshold:
                anomalies.append({
                    'index': i,
                    'date': dates[i] if i < len(dates) else None,
                    'value': float(values[i]),
                    'residual': float(residual[i]),
                    'severity': 'critical' if abs(residual[i] - mean_r) > 3 * sigma else 'warning'
                })

        return {
            'success': True,
            'trend': trend.tolist(),
            'seasonal': seasonal.tolist(),
            'residual': residual.tolist(),
            'dates': dates,
            'original': values,
            'anomalies': anomalies,
            'stats': {
                'residual_std': float(sigma),
                'anomaly_count': len(anomalies),
                'trend_direction': 'rising' if trend[-1] > trend[0] else 'falling' if trend[-1] < trend[0] else 'stable',
                'trend_change': float(trend[-1] - trend[0]),
            }
        }
    # ========== 算法2: CUSUM变点检测 ==========
    @staticmethod
    def cusum_detection(dates: List[str], values: List[float],
                        k: float = 0.5, h: float = 3.0,
                        baseline_days: int = 30) -> Dict[str, Any]:
        """
        CUSUM累积和变点检测
        k: 容许值(检测灵敏度), h: 决策阈值
        在残差上运行效果最佳(先做STL分解)
        """
        n = len(values)
        if n < baseline_days + 5:
            return {'success': False, 'message': '数据量不足'}

        y = np.array(values, dtype=float)
        mu0 = np.mean(y[:baseline_days])  # 基线均值
        sigma = np.std(y[:baseline_days]) or 1.0

        # 标准化
        z = (y - mu0) / sigma

        s_pos = np.zeros(n)  # 上侧CUSUM
        s_neg = np.zeros(n)  # 下侧CUSUM
        change_points = []

        for i in range(1, n):
            s_pos[i] = max(0, s_pos[i-1] + z[i] - k)
            s_neg[i] = max(0, s_neg[i-1] - z[i] - k)

            if s_pos[i] > h and (not change_points or change_points[-1]['type'] != 'increase'):
                change_points.append({
                    'index': i, 'date': dates[i] if i < len(dates) else None,
                    'type': 'increase', 'cusum_value': float(s_pos[i]),
                    'description': f'温度均值上升偏移，偏移量约{(s_pos[i]*sigma):.1f}C'
                })
                s_pos[i] = 0  # 重置

            if s_neg[i] > h and (not change_points or change_points[-1]['type'] != 'decrease'):
                change_points.append({
                    'index': i, 'date': dates[i] if i < len(dates) else None,
                    'type': 'decrease', 'cusum_value': float(s_neg[i]),
                    'description': f'温度均值下降偏移，偏移量约{(s_neg[i]*sigma):.1f}C'
                })
                s_neg[i] = 0

        current_status = 'normal'
        if s_pos[-1] > h * 0.7:
            current_status = 'warning_high'
        elif s_neg[-1] > h * 0.7:
            current_status = 'warning_low'

        return {
            'success': True,
            'cusum_positive': s_pos.tolist(),
            'cusum_negative': s_neg.tolist(),
            'dates': dates,
            'change_points': change_points,
            'baseline_mean': float(mu0),
            'baseline_std': float(sigma),
            'threshold_h': h,
            'current_status': current_status,
        }

    # ========== 算法3: 温度梯度分析 ==========
    @staticmethod
    def temperature_gradient(sensor_data: Dict[str, Dict]) -> Dict[str, Any]:
        """
        空间温度梯度计算
        sensor_data: {sensor_id: {lat, lon, depth, current_temp}}
        """
        sensors = list(sensor_data.items())
        n = len(sensors)
        if n < 2:
            return {'success': False, 'message': '至少需要2个传感器'}

        gradients = []
        max_gradient = 0
        max_pair = None

        for i in range(n):
            for j in range(i+1, n):
                sid1, d1 = sensors[i]
                sid2, d2 = sensors[j]
                t1 = d1.get('current_temp')
                t2 = d2.get('current_temp')
                if t1 is None or t2 is None:
                    continue

                # 计算距离(简化: 用深度差或平面距离)
                depth1 = d1.get('depth', 0) or 0
                depth2 = d2.get('depth', 0) or 0
                dist = abs(depth2 - depth1) if abs(depth2 - depth1) > 0.1 else 1.0

                grad = abs(float(t2) - float(t1)) / dist
                pair_info = {
                    'sensor_a': sid1, 'sensor_b': sid2,
                    'temp_a': float(t1), 'temp_b': float(t2),
                    'distance_m': float(dist),
                    'gradient': round(float(grad), 3),
                    'risk': 'high' if grad > 2.5 else 'medium' if grad > 1.5 else 'low'
                }
                gradients.append(pair_info)
                if grad > max_gradient:
                    max_gradient = grad
                    max_pair = pair_info

        gradients.sort(key=lambda x: x['gradient'], reverse=True)

        return {
            'success': True,
            'gradients': gradients[:20],  # Top 20
            'max_gradient': round(float(max_gradient), 3),
            'max_pair': max_pair,
            'risk_summary': {
                'high': sum(1 for g in gradients if g['risk'] == 'high'),
                'medium': sum(1 for g in gradients if g['risk'] == 'medium'),
                'low': sum(1 for g in gradients if g['risk'] == 'low'),
            }
        }
    # ========== 算法4: 冻融周期计数 ==========
    @staticmethod
    def freeze_thaw_cycles(dates: List[str], values: List[float],
                           threshold: float = 0.0) -> Dict[str, Any]:
        """
        冻融周期自动计数 + 严重度分级
        threshold: 冻结温度阈值(默认0C)
        """
        n = len(values)
        if n < 3:
            return {'success': False, 'message': '数据量不足'}

        cycles = []
        frozen = False
        freeze_start = None

        for i in range(n):
            t = float(values[i])
            if not frozen and t < threshold:
                frozen = True
                freeze_start = i
            elif frozen and t > threshold:
                frozen = False
                cycles.append({
                    'freeze_start': dates[freeze_start] if freeze_start < len(dates) else None,
                    'thaw_date': dates[i] if i < len(dates) else None,
                    'duration_days': i - freeze_start,
                    'min_temp': float(min(values[freeze_start:i+1])),
                })

        total = len(cycles)
        # 严重度分级 (基于年化)
        if dates and len(dates) >= 2:
            try:
                d0 = datetime.strptime(dates[0][:10], '%Y-%m-%d')
                d1 = datetime.strptime(dates[-1][:10], '%Y-%m-%d')
                span_days = max((d1 - d0).days, 1)
                annual_rate = total * 365.0 / span_days
            except Exception:
                annual_rate = total
        else:
            annual_rate = total

        if annual_rate > 60:
            severity = 'severe'
            guidance = '必须采取热防护措施，禁止裸露施工'
        elif annual_rate > 30:
            severity = 'high'
            guidance = '建议使用引气混凝土，加强排水和保温'
        elif annual_rate > 10:
            severity = 'moderate'
            guidance = '注意混凝土养护，适当保温覆盖'
        else:
            severity = 'low'
            guidance = '冻融风险较低，常规施工即可'

        return {
            'success': True,
            'total_cycles': total,
            'annual_rate': round(annual_rate, 1),
            'severity': severity,
            'guidance': guidance,
            'cycles': cycles[-20:],  # 最近20次
            'currently_frozen': frozen,
        }

    # ========== 算法5: 养护成熟度追踪 ==========
    @staticmethod
    def curing_maturity(dates: List[str], values: List[float],
                        datum_temp: float = -10.0,
                        interval_hours: float = 24.0,
                        target_maturity: float = 4800.0) -> Dict[str, Any]:
        """
        Nurse-Saul 成熟度法 (ASTM C1074)
        M(t) = SUM[(T_avg - T_datum) * delta_t]  [C-hours]
        """
        n = len(values)
        if n < 2:
            return {'success': False, 'message': '数据量不足'}

        maturity_curve = []
        cumulative = 0.0

        for i in range(n):
            t_avg = float(values[i])
            increment = max(0, (t_avg - datum_temp) * interval_hours)
            cumulative += increment
            maturity_curve.append({
                'date': dates[i] if i < len(dates) else None,
                'temperature': t_avg,
                'increment': round(increment, 1),
                'cumulative': round(cumulative, 1),
                'progress_pct': round(min(100, cumulative / target_maturity * 100), 1),
            })

        # 预估达标时间
        if cumulative > 0 and cumulative < target_maturity and n >= 2:
            daily_rate = cumulative / n
            remaining = target_maturity - cumulative
            est_days = remaining / daily_rate if daily_rate > 0 else None
        else:
            est_days = None

        return {
            'success': True,
            'current_maturity': round(cumulative, 1),
            'target_maturity': target_maturity,
            'progress_pct': round(min(100, cumulative / target_maturity * 100), 1),
            'reached_target': cumulative >= target_maturity,
            'estimated_days_remaining': round(est_days, 1) if est_days else None,
            'maturity_curve': maturity_curve,
            'datum_temperature': datum_temp,
        }
    # ========== 算法6: 热扩散系数估算 ==========
    @staticmethod
    def thermal_diffusivity(sensor_pairs: List[Dict]) -> Dict[str, Any]:
        """
        振幅法估算热扩散系数
        alpha = omega * (z2-z1)^2 / (2 * (ln(A1/A2))^2)
        sensor_pairs: [{sensor_a, sensor_b, depth_a, depth_b, amplitude_a, amplitude_b}]
        """
        results = []
        omega = 2 * np.pi / 86400.0  # 日周期角频率

        for pair in sensor_pairs:
            dz = abs(pair.get('depth_b', 0) - pair.get('depth_a', 0))
            a1 = pair.get('amplitude_a', 0)
            a2 = pair.get('amplitude_b', 0)

            if dz < 0.01 or a1 <= 0 or a2 <= 0 or a2 >= a1:
                continue

            ln_ratio = np.log(a1 / a2)
            if ln_ratio <= 0:
                continue

            alpha = omega * dz**2 / (2 * ln_ratio**2)

            # 土质推断
            alpha_e6 = alpha * 1e6
            if alpha_e6 < 0.3:
                soil_type = '干燥砂土'
            elif alpha_e6 < 0.6:
                soil_type = '干燥粘土'
            elif alpha_e6 < 0.9:
                soil_type = '饱和粘土'
            elif alpha_e6 < 1.2:
                soil_type = '饱和砂土'
            else:
                soil_type = '岩石/混凝土'

            results.append({
                'sensor_a': pair.get('sensor_a'),
                'sensor_b': pair.get('sensor_b'),
                'depth_diff_m': round(dz, 2),
                'diffusivity_m2s': float(f'{alpha:.2e}'),
                'diffusivity_e6': round(alpha_e6, 3),
                'inferred_soil': soil_type,
            })

        return {
            'success': len(results) > 0,
            'results': results,
            'message': f'成功估算{len(results)}对传感器的热扩散系数' if results else '无有效传感器对',
        }

    # ========== 算法7: 温度-沉降相关性 ==========
    @staticmethod
    def temp_settlement_correlation(
        temp_dates: List[str], temp_values: List[float],
        settle_dates: List[str], settle_values: List[float]
    ) -> Dict[str, Any]:
        """
        多变量回归: S(t) = a*ln(t) + b*T(t) + c
        分析温度对沉降的影响系数
        """
        # 对齐日期
        temp_map = {}
        for i, d in enumerate(temp_dates):
            key = d[:10] if d else None
            if key:
                temp_map[key] = float(temp_values[i])

        aligned_t = []
        aligned_s = []
        aligned_dates = []
        for i, d in enumerate(settle_dates):
            key = d[:10] if d else None
            if key and key in temp_map:
                aligned_t.append(temp_map[key])
                aligned_s.append(float(settle_values[i]))
                aligned_dates.append(key)

        n = len(aligned_t)
        if n < 10:
            return {'success': False, 'message': f'对齐数据仅{n}条，至少需要10条'}

        t_arr = np.array(aligned_t)
        s_arr = np.array(aligned_s)

        # 皮尔逊相关系数
        corr = float(np.corrcoef(t_arr, s_arr)[0, 1])

        # 线性回归: S = a*T + b
        A = np.vstack([t_arr, np.ones(n)]).T
        result = np.linalg.lstsq(A, s_arr, rcond=None)
        slope, intercept = result[0]

        # R^2
        s_pred = slope * t_arr + intercept
        ss_res = np.sum((s_arr - s_pred)**2)
        ss_tot = np.sum((s_arr - np.mean(s_arr))**2)
        r_squared = 1 - ss_res / ss_tot if ss_tot > 0 else 0

        # 温度敏感度解读
        sensitivity = abs(slope)
        if sensitivity > 0.3:
            interpretation = '温度对沉降影响显著，每1C变化引起约{:.2f}mm沉降变化'.format(sensitivity)
            level = 'high'
        elif sensitivity > 0.1:
            interpretation = '温度对沉降有一定影响，建议进行温度补偿修正'
            level = 'medium'
        else:
            interpretation = '温度对沉降影响较小，可忽略温度修正'
            level = 'low'

        return {
            'success': True,
            'correlation': round(corr, 4),
            'r_squared': round(r_squared, 4),
            'slope': round(float(slope), 4),
            'intercept': round(float(intercept), 4),
            'sensitivity_level': level,
            'interpretation': interpretation,
            'data_points': n,
            'aligned_data': [
                {'date': aligned_dates[i], 'temperature': aligned_t[i], 'settlement': aligned_s[i]}
                for i in range(min(n, 100))  # 最多返回100条
            ],
        }
