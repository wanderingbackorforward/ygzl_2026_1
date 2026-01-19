# -*- coding: utf-8 -*-
"""
二级分析服务基类
定义通用的分析接口和数据结构
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import List, Dict, Any, Optional
import json


class SeverityLevel(Enum):
    """严重程度等级"""
    CRITICAL = "critical"    # 严重
    HIGH = "high"            # 高
    MEDIUM = "medium"        # 中等
    LOW = "low"              # 低
    NORMAL = "normal"        # 正常


class AnomalyType(Enum):
    """异常类型"""
    THRESHOLD_EXCEEDED = "threshold_exceeded"          # 超过阈值
    RATE_ABNORMAL = "rate_abnormal"                    # 变化率异常
    TREND_ABNORMAL = "trend_abnormal"                  # 趋势异常
    PREDICTION_WARNING = "prediction_warning"          # 预测预警
    CORRELATION_ANOMALY = "correlation_anomaly"        # 关联异常
    PATTERN_DETECTED = "pattern_detected"              # 检测到特殊模式


class RecommendationPriority(Enum):
    """建议优先级"""
    URGENT = "urgent"        # 紧急
    HIGH = "high"            # 高
    MEDIUM = "medium"        # 中
    LOW = "low"              # 低


@dataclass
class AnomalyItem:
    """异常项"""
    id: str                                  # 唯一标识
    point_id: str                            # 监测点ID
    anomaly_type: str                        # 异常类型
    severity: str                            # 严重程度
    title: str                               # 标题
    description: str                         # 详细描述
    detected_at: str                         # 检测时间
    data_time: Optional[str] = None          # 数据时间
    current_value: Optional[float] = None    # 当前值
    threshold: Optional[float] = None        # 阈值
    deviation: Optional[float] = None        # 偏差值
    trend: Optional[str] = None              # 趋势方向
    related_points: List[str] = field(default_factory=list)  # 关联监测点
    metadata: Dict[str, Any] = field(default_factory=dict)   # 额外元数据

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Recommendation:
    """处置建议"""
    id: str                                  # 唯一标识
    priority: str                            # 优先级
    title: str                               # 标题
    description: str                         # 详细描述
    action_type: str                         # 行动类型 (inspect/repair/monitor/report)
    target_points: List[str] = field(default_factory=list)  # 目标监测点
    estimated_urgency: Optional[str] = None  # 预估紧急程度
    reference_anomalies: List[str] = field(default_factory=list)  # 关联的异常ID
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class AnalysisStats:
    """分析统计"""
    total_points: int = 0                    # 总监测点数
    analyzed_points: int = 0                 # 已分析点数
    anomaly_count: int = 0                   # 异常数量
    critical_count: int = 0                  # 严重异常数
    high_count: int = 0                      # 高风险数
    medium_count: int = 0                    # 中等风险数
    low_count: int = 0                       # 低风险数
    normal_count: int = 0                    # 正常数

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class AnalysisResult:
    """分析结果"""
    data_type: str                           # 数据类型 (settlement/temperature/crack/vibration)
    analysis_time: str                       # 分析时间
    stats: AnalysisStats                     # 统计信息
    anomalies: List[AnomalyItem]             # 异常列表
    recommendations: List[Recommendation]     # 建议列表
    summary: Dict[str, Any] = field(default_factory=dict)  # 汇总信息
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'data_type': self.data_type,
            'analysis_time': self.analysis_time,
            'stats': self.stats.to_dict(),
            'anomalies': [a.to_dict() for a in self.anomalies],
            'recommendations': [r.to_dict() for r in self.recommendations],
            'summary': self.summary,
            'metadata': self.metadata,
        }


class BaseAnalysisService(ABC):
    """分析服务基类"""

    def __init__(self, data_type: str):
        self.data_type = data_type

    @abstractmethod
    def analyze(self) -> AnalysisResult:
        """执行分析，返回分析结果"""
        pass

    @abstractmethod
    def detect_anomalies(self) -> List[AnomalyItem]:
        """检测异常"""
        pass

    @abstractmethod
    def generate_recommendations(self, anomalies: List[AnomalyItem]) -> List[Recommendation]:
        """基于异常生成建议"""
        pass

    def _generate_id(self, prefix: str) -> str:
        """生成唯一ID"""
        import uuid
        return f"{prefix}_{uuid.uuid4().hex[:8]}"

    def _get_current_time(self) -> str:
        """获取当前时间字符串"""
        return datetime.now().isoformat()

    def _calculate_stats(self, anomalies: List[AnomalyItem], total_points: int) -> AnalysisStats:
        """计算统计信息"""
        stats = AnalysisStats(
            total_points=total_points,
            analyzed_points=total_points,
            anomaly_count=len(anomalies),
        )

        for anomaly in anomalies:
            if anomaly.severity == SeverityLevel.CRITICAL.value:
                stats.critical_count += 1
            elif anomaly.severity == SeverityLevel.HIGH.value:
                stats.high_count += 1
            elif anomaly.severity == SeverityLevel.MEDIUM.value:
                stats.medium_count += 1
            elif anomaly.severity == SeverityLevel.LOW.value:
                stats.low_count += 1

        stats.normal_count = total_points - len(set(a.point_id for a in anomalies))
        return stats
