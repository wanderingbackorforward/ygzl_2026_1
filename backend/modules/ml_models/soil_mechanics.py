# -*- coding: utf-8 -*-
"""
Soil Mechanics Models - 土体力学模型
实现经典土体力学理论和本构模型

核心模型:
1. Mohr-Coulomb准则 - 土体强度理论
2. Drucker-Prager模型 - 三维强度准则
3. Terzaghi固结理论 - 一维固结
4. Biot固结理论 - 三维固结
5. Duncan-Chang模型 - 非线性弹性

应用场景: 数字孪生仿真、沉降预测、稳定性分析
"""

import numpy as np
from typing import Dict, List, Tuple, Optional
from scipy.integrate import odeint
from scipy.optimize import fsolve
import warnings
warnings.filterwarnings('ignore')


class MohrCoulombModel:
    """
    Mohr-Coulomb准则 - 土体强度理论

    破坏准则: τ = c + σ * tan(φ)
    其中:
        τ: 剪应力
        σ: 法向应力
        c: 粘聚力
        φ: 内摩擦角
    """

    def __init__(self, cohesion: float, friction_angle: float):
        """
        初始化Mohr-Coulomb模型

        Args:
            cohesion: 粘聚力 (kPa)
            friction_angle: 内摩擦角 (度)
        """
        self.c = cohesion
        self.phi = np.radians(friction_angle)  # 转换为弧度

    def shear_strength(self, normal_stress: float) -> float:
        """
        计算剪切强度

        Args:
            normal_stress: 法向应力 (kPa)

        Returns:
            剪切强度 (kPa)
        """
        return self.c + normal_stress * np.tan(self.phi)

    def safety_factor(self, shear_stress: float, normal_stress: float) -> float:
        """
        计算安全系数

        Args:
            shear_stress: 实际剪应力 (kPa)
            normal_stress: 法向应力 (kPa)

        Returns:
            安全系数
        """
        strength = self.shear_strength(normal_stress)
        return strength / (shear_stress + 1e-8)

    def principal_stress_at_failure(self, sigma3: float) -> float:
        """
        计算破坏时的大主应力

        Args:
            sigma3: 小主应力 (kPa)

        Returns:
            大主应力 (kPa)
        """
        Nφ = (1 + np.sin(self.phi)) / (1 - np.sin(self.phi))
        sigma1 = sigma3 * Nφ + 2 * self.c * np.sqrt(Nφ)
        return sigma1


class DruckerPragerModel:
    """
    Drucker-Prager模型 - 三维强度准则

    破坏准则: √J2 = α * I1 + k
    其中:
        J2: 偏应力张量第二不变量
        I1: 应力张量第一不变量
        α, k: 材料参数
    """

    def __init__(self, cohesion: float, friction_angle: float):
        """
        初始化Drucker-Prager模型

        Args:
            cohesion: 粘聚力 (kPa)
            friction_angle: 内摩擦角 (度)
        """
        self.c = cohesion
        self.phi = np.radians(friction_angle)

        # 计算Drucker-Prager参数
        sin_phi = np.sin(self.phi)
        self.alpha = (2 * sin_phi) / (np.sqrt(3) * (3 - sin_phi))
        self.k = (6 * self.c * np.cos(self.phi)) / (np.sqrt(3) * (3 - sin_phi))

    def yield_function(self, sigma: np.ndarray) -> float:
        """
        计算屈服函数值

        Args:
            sigma: 应力张量 [σ1, σ2, σ3]

        Returns:
            屈服函数值 (< 0: 弹性, = 0: 屈服, > 0: 破坏)
        """
        # 第一不变量
        I1 = np.sum(sigma)

        # 偏应力
        p = I1 / 3
        s = sigma - p

        # 第二偏应力不变量
        J2 = 0.5 * np.sum(s**2)

        # 屈服函数
        f = np.sqrt(J2) - self.alpha * I1 - self.k

        return f


class TerzaghiConsolidation:
    """
    Terzaghi一维固结理论

    控制方程: ∂u/∂t = cv * ∂²u/∂z²
    其中:
        u: 超孔隙水压力
        t: 时间
        z: 深度
        cv: 固结系数
    """

    def __init__(self, cv: float, H: float, q: float):
        """
        初始化Terzaghi固结模型

        Args:
            cv: 固结系数 (m²/day)
            H: 土层厚度 (m)
            q: 荷载 (kPa)
        """
        self.cv = cv
        self.H = H
        self.q = q

    def settlement(self, t: float, z: float = None, n_terms: int = 50) -> float:
        """
        计算固结沉降

        Args:
            t: 时间 (days)
            z: 深度 (m)，None表示平均沉降
            n_terms: 级数项数

        Returns:
            沉降量 (m)
        """
        if z is None:
            z = self.H / 2  # 中点

        # 时间因子
        Tv = self.cv * t / (self.H ** 2)

        # 级数求和
        u = 0
        for m in range(n_terms):
            M = (2 * m + 1) * np.pi / 2
            u += (2 / M) * np.sin(M * z / self.H) * np.exp(-M**2 * Tv)

        # 沉降量
        s = self.q * (1 - u) / 100  # 简化计算

        return s

    def consolidation_degree(self, t: float) -> float:
        """
        计算固结度

        Args:
            t: 时间 (days)

        Returns:
            固结度 (0-1)
        """
        Tv = self.cv * t / (self.H ** 2)

        if Tv < 0.217:
            U = np.sqrt(4 * Tv / np.pi)
        else:
            U = 1 - 10 ** (-Tv / 0.933)

        return U

    def time_for_consolidation(self, U: float) -> float:
        """
        计算达到指定固结度所需时间

        Args:
            U: 目标固结度 (0-1)

        Returns:
            时间 (days)
        """
        if U < 0.53:
            Tv = (np.pi / 4) * U ** 2
        else:
            Tv = -0.933 * np.log10(1 - U)

        t = Tv * (self.H ** 2) / self.cv

        return t


class BiotConsolidation:
    """
    Biot三维固结理论

    控制方程:
        ∇²u = (1/cv) * ∂u/∂t
        ∇²p = (1/cv) * ∂p/∂t
    其中:
        u: 位移
        p: 孔隙水压力
        cv: 固结系数
    """

    def __init__(self, E: float, nu: float, k: float, gamma_w: float):
        """
        初始化Biot固结模型

        Args:
            E: 弹性模量 (kPa)
            nu: 泊松比
            k: 渗透系数 (m/day)
            gamma_w: 水的重度 (kN/m³)
        """
        self.E = E
        self.nu = nu
        self.k = k
        self.gamma_w = gamma_w

        # 计算固结系数
        mv = (1 + nu) * (1 - 2 * nu) / (E * (1 - nu))
        self.cv = k / (gamma_w * mv)

    def settlement_3d(self, q: float, B: float, L: float, H: float, t: float) -> float:
        """
        计算三维固结沉降（简化）

        Args:
            q: 荷载 (kPa)
            B: 基础宽度 (m)
            L: 基础长度 (m)
            H: 土层厚度 (m)
            t: 时间 (days)

        Returns:
            沉降量 (m)
        """
        # 影响深度
        z = min(H, 2 * B)

        # 平均附加应力
        sigma_z = q * (1 - z / (z + B))

        # 压缩量
        mv = (1 + self.nu) * (1 - 2 * self.nu) / (self.E * (1 - self.nu))
        s_final = mv * sigma_z * z

        # 固结度
        Tv = self.cv * t / (H ** 2)
        if Tv < 0.217:
            U = np.sqrt(4 * Tv / np.pi)
        else:
            U = 1 - 10 ** (-Tv / 0.933)

        # 当前沉降
        s = s_final * U

        return s


class DuncanChangModel:
    """
    Duncan-Chang非线性弹性模型

    切线模量: Et = K * pa * (σ3/pa)^n * [1 - Rf * (σ1-σ3)/(σ1-σ3)f]^2
    其中:
        K, n, Rf: 模型参数
        pa: 大气压力
        σ1, σ3: 大小主应力
    """

    def __init__(self, K: float, n: float, Rf: float, c: float, phi: float):
        """
        初始化Duncan-Chang模型

        Args:
            K: 模量数
            n: 模量指数
            Rf: 破坏比
            c: 粘聚力 (kPa)
            phi: 内摩擦角 (度)
        """
        self.K = K
        self.n = n
        self.Rf = Rf
        self.c = c
        self.phi = np.radians(phi)
        self.pa = 101.325  # 大气压力 (kPa)

    def tangent_modulus(self, sigma1: float, sigma3: float) -> float:
        """
        计算切线模量

        Args:
            sigma1: 大主应力 (kPa)
            sigma3: 小主应力 (kPa)

        Returns:
            切线模量 (kPa)
        """
        # 破坏时的偏应力
        sin_phi = np.sin(self.phi)
        sigma1f = 2 * self.c * np.cos(self.phi) + 2 * sigma3 * sin_phi
        sigma1f /= (1 - sin_phi)

        # 应力水平
        SL = (sigma1 - sigma3) / (sigma1f - sigma3)

        # 切线模量
        Et = self.K * self.pa * (sigma3 / self.pa) ** self.n
        Et *= (1 - self.Rf * SL) ** 2

        return Et


class SoilMechanicsSimulator:
    """
    土体力学仿真器 - 综合多种模型
    """

    def __init__(self):
        self.models = {}

    def add_model(self, name: str, model):
        """添加模型"""
        self.models[name] = model

    def simulate_settlement(
        self,
        load: float,
        soil_params: Dict,
        time_days: int = 365
    ) -> Dict:
        """
        模拟沉降过程

        Args:
            load: 荷载 (kPa)
            soil_params: 土体参数
            time_days: 模拟时长 (天)

        Returns:
            模拟结果
        """
        # 创建Terzaghi固结模型
        terzaghi = TerzaghiConsolidation(
            cv=soil_params.get('cv', 1.0),
            H=soil_params.get('H', 10.0),
            q=load
        )

        # 时间序列
        times = np.linspace(0, time_days, 100)
        settlements = []
        consolidation_degrees = []

        for t in times:
            s = terzaghi.settlement(t)
            U = terzaghi.consolidation_degree(t)
            settlements.append(s)
            consolidation_degrees.append(U)

        return {
            'success': True,
            'times': times.tolist(),
            'settlements': settlements,
            'consolidation_degrees': consolidation_degrees,
            'final_settlement': settlements[-1],
            'model': 'Terzaghi'
        }

    def stability_analysis(
        self,
        soil_params: Dict,
        stress_state: Dict
    ) -> Dict:
        """
        稳定性分析

        Args:
            soil_params: 土体参数
            stress_state: 应力状态

        Returns:
            分析结果
        """
        # 创建Mohr-Coulomb模型
        mc = MohrCoulombModel(
            cohesion=soil_params.get('c', 20.0),
            friction_angle=soil_params.get('phi', 30.0)
        )

        # 计算安全系数
        shear_stress = stress_state.get('shear_stress', 0)
        normal_stress = stress_state.get('normal_stress', 0)

        safety_factor = mc.safety_factor(shear_stress, normal_stress)
        shear_strength = mc.shear_strength(normal_stress)

        # 判断稳定性
        if safety_factor > 1.5:
            stability = 'stable'
        elif safety_factor > 1.2:
            stability = 'marginally_stable'
        else:
            stability = 'unstable'

        return {
            'success': True,
            'safety_factor': float(safety_factor),
            'shear_strength': float(shear_strength),
            'shear_stress': float(shear_stress),
            'stability': stability,
            'model': 'Mohr-Coulomb'
        }


# 使用示例
if __name__ == '__main__':
    print("[成功] 土体力学模型模块加载成功!")
    print("[成功] 支持的模型: Mohr-Coulomb, Drucker-Prager, Terzaghi, Biot, Duncan-Chang")
