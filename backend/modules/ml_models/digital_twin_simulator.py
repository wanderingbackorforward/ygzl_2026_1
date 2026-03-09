# -*- coding: utf-8 -*-
"""
数字孪生仿真器 - 阶段3: 数字孪生仿真平台

功能:
1. 简化的土体力学模型
2. Kalman Filter数据同化
3. 情景模拟引擎
4. 3D可视化数据准备

作者: Claude Opus 4.6
日期: 2026-03-10
"""

import numpy as np
from typing import Dict, List, Tuple
from scipy.integrate import odeint

class SimplifiedSettlementModel:
    """
    简化的沉降预测模型
    """
    def __init__(self, H: float = 10.0, E: float = 20.0, A: float = 1.0, T: float = 100.0):
        """
        Args:
            H: 土层厚度 (m)
            E: 弹性模量 (MPa)
            A: 面积 (m²)
            T: 固结时间常数 (天)
        """
        self.H = H
        self.E = E
        self.A = A
        self.T = T

    def predict(self, load: float, t: float) -> float:
        """
        预测沉降

        Args:
            load: 荷载 (kN)
            t: 时间 (天)

        Returns:
            沉降 (mm)
        """
        settlement = (load * self.H) / (self.E * self.A) * (1 - np.exp(-t / self.T))
        return settlement * 1000  # 转换为mm

class KalmanFilter:
    """
    Kalman滤波器 - 数据同化
    """
    def __init__(self, F, B, H, Q, R, x0, P0):
        self.F = F  # 状态转移矩阵
        self.B = B  # 控制输入矩阵
        self.H = H  # 观测矩阵
        self.Q = Q  # 过程噪声
        self.R = R  # 测量噪声
        self.x = x0  # 初始状态
        self.P = P0  # 初始协方差

    def predict(self, u):
        """预测步骤"""
        self.x = self.F @ self.x + self.B @ u
        self.P = self.F @ self.P @ self.F.T + self.Q
        return self.x

    def update(self, z):
        """更新步骤"""
        y = z - self.H @ self.x
        S = self.H @ self.P @ self.H.T + self.R
        K = self.P @ self.H.T @ np.linalg.inv(S)
        self.x = self.x + K @ y
        self.P = (np.eye(len(self.x)) - K @ self.H) @ self.P
        return self.x

class ScenarioSimulator:
    """
    情景模拟引擎
    """
    def __init__(self, physics_model):
        self.physics_model = physics_model

    def simulate_construction_sequence(self, sequence: List[Dict]) -> List[float]:
        """
        模拟施工顺序

        Args:
            sequence: 施工步骤列表

        Returns:
            沉降列表
        """
        results = []
        for step in sequence:
            load = step.get('load', 0)
            time = step.get('time', 0)
            settlement = self.physics_model.predict(load, time)
            results.append(settlement)
        return results

    def simulate_extreme_weather(self, rainfall: float) -> float:
        """
        模拟极端天气

        Args:
            rainfall: 降雨量 (mm)

        Returns:
            沉降增量 (mm)
        """
        # 简化模型: 降雨增加荷载
        load_increase = rainfall * 0.01  # 1mm降雨 = 0.01kN荷载
        settlement = self.physics_model.predict(load_increase, 1)
        return settlement

    def simulate_long_term(self, years: int) -> List[float]:
        """
        模拟长期演化

        Args:
            years: 年数

        Returns:
            沉降时间序列
        """
        time_steps = years * 365
        settlements = []
        base_load = 100  # 基础荷载 (kN)

        for t in range(time_steps):
            settlement = self.physics_model.predict(base_load, t)
            settlements.append(settlement)

        return settlements

class DigitalTwinSimulator:
    """
    数字孪生仿真器 - 主类
    """
    def __init__(self):
        self.physics_model = SimplifiedSettlementModel()

        # 初始化Kalman Filter
        F = np.array([[1.0]])  # 状态转移
        B = np.array([[0.01]])  # 控制输入
        H = np.array([[1.0]])  # 观测
        Q = np.array([[0.1]])  # 过程噪声
        R = np.array([[1.0]])  # 测量噪声
        x0 = np.array([0.0])  # 初始状态
        P0 = np.array([[1.0]])  # 初始协方差

        self.kf = KalmanFilter(F, B, H, Q, R, x0, P0)
        self.scenario_sim = ScenarioSimulator(self.physics_model)

    def run_simulation(self, scenario_type: str, params: Dict) -> Dict:
        """
        运行仿真

        Args:
            scenario_type: 情景类型 (construction/weather/long_term)
            params: 参数

        Returns:
            仿真结果
        """
        if scenario_type == 'construction':
            sequence = params.get('sequence', [])
            results = self.scenario_sim.simulate_construction_sequence(sequence)
            return {'type': 'construction', 'results': results}

        elif scenario_type == 'weather':
            rainfall = params.get('rainfall', 0)
            result = self.scenario_sim.simulate_extreme_weather(rainfall)
            return {'type': 'weather', 'settlement_increase': result}

        elif scenario_type == 'long_term':
            years = params.get('years', 5)
            results = self.scenario_sim.simulate_long_term(years)
            return {'type': 'long_term', 'results': results}

        else:
            raise ValueError(f"未知的情景类型: {scenario_type}")

    def data_assimilation(self, measurements: List[float], controls: List[float]) -> List[float]:
        """
        数据同化

        Args:
            measurements: 测量值列表
            controls: 控制输入列表

        Returns:
            同化后的状态估计
        """
        estimates = []

        for z, u in zip(measurements, controls):
            # 预测
            self.kf.predict(np.array([u]))

            # 更新
            x_est = self.kf.update(np.array([z]))
            estimates.append(x_est[0])

        return estimates

def main():
    """主函数 - 测试"""
    print("="*60)
    print("数字孪生仿真器测试")
    print("="*60)

    simulator = DigitalTwinSimulator()

    # 测试1: 施工顺序模拟
    print("\n[测试1] 施工顺序模拟")
    sequence = [
        {'load': 50, 'time': 10},
        {'load': 100, 'time': 20},
        {'load': 150, 'time': 30}
    ]
    result = simulator.run_simulation('construction', {'sequence': sequence})
    print(f"结果: {result}")

    # 测试2: 极端天气模拟
    print("\n[测试2] 极端天气模拟")
    result = simulator.run_simulation('weather', {'rainfall': 100})
    print(f"结果: {result}")

    # 测试3: 长期演化模拟
    print("\n[测试3] 长期演化模拟")
    result = simulator.run_simulation('long_term', {'years': 1})
    print(f"结果长度: {len(result['results'])}")

    # 测试4: 数据同化
    print("\n[测试4] 数据同化")
    measurements = [1.0, 2.5, 4.0, 5.5, 7.0]
    controls = [10, 20, 30, 40, 50]
    estimates = simulator.data_assimilation(measurements, controls)
    print(f"估计值: {estimates}")

    print("\n" + "="*60)
    print("[成功] 所有测试完成!")
    print("="*60)

if __name__ == '__main__':
    main()
