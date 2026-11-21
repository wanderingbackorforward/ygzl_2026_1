# -*- coding: utf-8 -*-
"""
温度V2 施工指导引擎
基于 ACI 207/305/306 标准的红黄绿灯施工指导矩阵
"""

from typing import Dict, Any, List, Optional


class ConstructionGuide:
    """施工指导引擎 - 纯规则，零网络依赖"""

    # 施工指导矩阵 (红黄绿灯)
    GUIDANCE_MATRIX = {
        'ambient_temp': {
            'green': {'min': 10, 'max': 30, 'label': '适宜施工'},
            'yellow': {'ranges': [(5, 10), (30, 35)], 'label': '需采取措施'},
            'red': {'ranges': [(-999, 5), (35, 999)], 'label': '禁止/暂停施工'},
        },
        'concrete_temp': {
            'green': {'min': 10, 'max': 32, 'label': '浇筑温度合格'},
            'yellow': {'ranges': [(5, 10), (32, 35)], 'label': '需调整配合比'},
            'red': {'ranges': [(-999, 5), (35, 999)], 'label': '禁止浇筑'},
        },
        'core_surface_diff': {
            'green': {'min': 0, 'max': 15, 'label': '温差正常'},
            'yellow': {'ranges': [(15, 20)], 'label': '加强保温'},
            'red': {'ranges': [(20, 999)], 'label': '立即采取措施'},
        },
        'cooling_rate': {
            'green': {'min': 0, 'max': 1.5, 'label': '冷却速率正常'},
            'yellow': {'ranges': [(1.5, 2.5)], 'label': '减缓冷却'},
            'red': {'ranges': [(2.5, 999)], 'label': '紧急保温'},
        },
        'ground_temp': {
            'green': {'min': 5, 'max': 999, 'label': '地温正常'},
            'yellow': {'ranges': [(0, 5)], 'label': '注意防冻'},
            'red': {'ranges': [(-999, 0)], 'label': '冻土，禁止开挖'},
        },
        'daily_range': {
            'green': {'min': 0, 'max': 15, 'label': '日温差正常'},
            'yellow': {'ranges': [(15, 20)], 'label': '加强养护覆盖'},
            'red': {'ranges': [(20, 999)], 'label': '极端温差，特殊养护'},
        },
    }
    @classmethod
    def evaluate_single(cls, metric: str, value: float) -> Dict[str, Any]:
        """评估单个指标的红黄绿灯状态"""
        rules = cls.GUIDANCE_MATRIX.get(metric)
        if not rules:
            return {'status': 'unknown', 'label': '未知指标'}

        g = rules['green']
        if g['min'] <= value <= g['max']:
            return {'status': 'green', 'label': g['label'], 'value': value}

        for r_min, r_max in rules.get('red', {}).get('ranges', []):
            if r_min <= value <= r_max:
                return {'status': 'red', 'label': rules['red']['label'], 'value': value}

        for y_min, y_max in rules.get('yellow', {}).get('ranges', []):
            if y_min <= value <= y_max:
                return {'status': 'yellow', 'label': rules['yellow']['label'], 'value': value}

        return {'status': 'yellow', 'label': '需关注', 'value': value}

    @classmethod
    def full_assessment(cls, conditions: Dict[str, float]) -> Dict[str, Any]:
        """
        全面施工条件评估
        conditions: {ambient_temp, concrete_temp, core_surface_diff, cooling_rate, ground_temp, daily_range}
        """
        results = {}
        overall_status = 'green'
        red_count = 0
        yellow_count = 0
        actions = []

        for metric, value in conditions.items():
            if value is None:
                continue
            result = cls.evaluate_single(metric, float(value))
            results[metric] = result

            if result['status'] == 'red':
                red_count += 1
                overall_status = 'red'
            elif result['status'] == 'yellow' and overall_status != 'red':
                yellow_count += 1
                overall_status = 'yellow'

        # 生成具体施工建议
        if conditions.get('ambient_temp') is not None:
            t = conditions['ambient_temp']
            if t < 5:
                actions.append({'priority': 'critical', 'action': '低温施工措施',
                    'detail': '混凝土拌合水加热至60-80C，骨料预热，运输保温覆盖，入模温度不低于5C'})
            elif t > 35:
                actions.append({'priority': 'critical', 'action': '高温施工措施',
                    'detail': '使用冰水拌合，遮阳棚覆盖，避开12-15时浇筑，加缓凝剂'})
            elif t > 30:
                actions.append({'priority': 'warning', 'action': '注意高温影响',
                    'detail': '控制混凝土入模温度，及时覆盖保湿养护'})

        if conditions.get('daily_range') is not None:
            dr = conditions['daily_range']
            if dr > 20:
                actions.append({'priority': 'critical', 'action': '极端温差防护',
                    'detail': '混凝土表面覆盖保温材料(岩棉/草帘)，厚度不小于50mm，养护期延长至14天'})
            elif dr > 15:
                actions.append({'priority': 'warning', 'action': '加强养护覆盖',
                    'detail': '浇筑后12小时内覆盖塑料薄膜+保温层，洒水养护不少于7天'})

        if conditions.get('ground_temp') is not None:
            gt = conditions['ground_temp']
            if gt < 0:
                actions.append({'priority': 'critical', 'action': '冻土处理',
                    'detail': '禁止在冻土上直接施工，需解冻处理或换填，基底温度需>2C'})
            elif gt < 5:
                actions.append({'priority': 'warning', 'action': '地温偏低',
                    'detail': '基底铺设保温层，混凝土浇筑后底部加热养护'})

        if conditions.get('core_surface_diff') is not None:
            diff = conditions['core_surface_diff']
            if diff > 20:
                actions.append({'priority': 'critical', 'action': '温差裂缝风险',
                    'detail': '立即加强表面保温，内部埋设冷却水管降温，温差控制在20C以内(ACI 301)'})

        return {
            'overall_status': overall_status,
            'red_count': red_count,
            'yellow_count': yellow_count,
            'metrics': results,
            'actions': sorted(actions, key=lambda x: 0 if x['priority'] == 'critical' else 1),
            'summary': cls._build_summary(overall_status, red_count, yellow_count),
        }

    @staticmethod
    def _build_summary(status: str, red: int, yellow: int) -> str:
        if status == 'red':
            return f'当前有{red}项指标超限(红灯)，必须采取紧急措施后方可施工'
        elif status == 'yellow':
            return f'当前有{yellow}项指标需关注(黄灯)，建议采取预防措施'
        return '所有指标正常(绿灯)，可正常施工'

    @classmethod
    def temperature_correction(cls, measured_settlement: float,
                                rod_length: float,
                                current_temp: float,
                                install_temp: float = 20.0,
                                material: str = 'steel') -> Dict[str, Any]:
        """
        沉降读数温度修正
        S_true = S_measured - (alpha_rod - alpha_ground) * L * (T - T_install)
        """
        alpha_map = {
            'steel': 12.0e-6,
            'invar': 1.2e-6,
            'concrete': 12.0e-6,
        }
        alpha_ground = 8.0e-6  # 土体平均热膨胀系数

        alpha_rod = alpha_map.get(material, 12.0e-6)
        delta_t = current_temp - install_temp
        correction = (alpha_rod - alpha_ground) * rod_length * delta_t * 1000  # mm

        return {
            'measured': round(measured_settlement, 3),
            'correction_mm': round(correction, 3),
            'corrected': round(measured_settlement - correction, 3),
            'delta_temp': round(delta_t, 1),
            'rod_material': material,
            'note': f'温度修正量{abs(correction):.3f}mm，{"偏大需扣除" if correction > 0 else "偏小需补回"}' if abs(correction) > 0.01 else '温度修正量可忽略',
        }
