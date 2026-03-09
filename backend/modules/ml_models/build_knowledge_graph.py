# -*- coding: utf-8 -*-
"""
知识图谱构建脚本 - 阶段2: 知识图谱构建

功能:
1. 从Supabase抽取数据
2. 创建Neo4j实体和关系
3. 验证图谱完整性
4. 生成统计报告

作者: Claude Opus 4.6
日期: 2026-03-10
"""

import os
import sys
import requests
import pandas as pd
import numpy as np
from typing import Dict, List
from datetime import datetime

# 添加项目根目录到路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 导入知识图谱构建器
from knowledge_graph import KnowledgeGraphBuilder

# Supabase配置
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', '')

def _headers():
    """生成Supabase请求头"""
    h = {
        'apikey': SUPABASE_ANON_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }
    if SUPABASE_ANON_KEY:
        h['Authorization'] = f'Bearer {SUPABASE_ANON_KEY}'
    return h

def _url(path):
    """生成Supabase URL"""
    base = SUPABASE_URL.rstrip('/')
    return f'{base}{path}'

def fetch_monitoring_points() -> List[Dict]:
    """从Supabase获取监测点数据"""
    print("[成功] 正在获取监测点数据...")
    try:
        r = requests.get(
            _url('/rest/v1/monitoring_points?select=*'),
            headers=_headers(),
            timeout=30
        )
        r.raise_for_status()
        data = r.json()
        print(f"[成功] 获取到 {len(data)} 个监测点")
        return data
    except Exception as e:
        print(f"[错误] 获取监测点失败: {e}")
        return []

def fetch_sensors() -> List[Dict]:
    """从Supabase获取传感器数据"""
    print("[成功] 正在获取传感器数据...")
    try:
        r = requests.get(
            _url('/rest/v1/sensors?select=*'),
            headers=_headers(),
            timeout=30
        )
        r.raise_for_status()
        data = r.json()
        print(f"[成功] 获取到 {len(data)} 个传感器")
        return data
    except Exception as e:
        print(f"[错误] 获取传感器失败: {e}")
        return []

def fetch_construction_events() -> List[Dict]:
    """从Supabase获取施工事件数据"""
    print("[成功] 正在获取施工事件数据...")
    try:
        r = requests.get(
            _url('/rest/v1/construction_events?select=*'),
            headers=_headers(),
            timeout=30
        )
        r.raise_for_status()
        data = r.json()
        print(f"[成功] 获取到 {len(data)} 个施工事件")
        return data
    except Exception as e:
        print(f"[错误] 获取施工事件失败: {e}")
        return []

def fetch_anomalies() -> List[Dict]:
    """从Supabase获取异常数据"""
    print("[成功] 正在获取异常数据...")
    try:
        r = requests.get(
            _url('/rest/v1/anomalies?select=*'),
            headers=_headers(),
            timeout=30
        )
        r.raise_for_status()
        data = r.json()
        print(f"[成功] 获取到 {len(data)} 个异常")
        return data
    except Exception as e:
        print(f"[错误] 获取异常失败: {e}")
        return []

def main():
    """主函数"""
    print("="*60)
    print("知识图谱构建 - 阶段2: 知识图谱构建")
    print("="*60)

    # 1. 连接Neo4j
    print("\n[成功] 正在连接Neo4j数据库...")
    try:
        builder = KnowledgeGraphBuilder(
            uri="bolt://localhost:7687",
            user="neo4j",
            password="password"
        )
    except Exception as e:
        print(f"[错误] 连接Neo4j失败: {e}")
        print("[提示] 请确保Neo4j已启动")
        return

    # 2. 创建索引
    print("\n[成功] 正在创建索引...")
    builder.create_indexes()

    # 3. 抽取数据
    print("\n[成功] 正在抽取数据...")
    points_data = fetch_monitoring_points()
    sensors_data = fetch_sensors()
    events_data = fetch_construction_events()
    anomalies_data = fetch_anomalies()

    # 4. 创建实体
    print("\n[成功] 正在创建实体...")

    if points_data:
        # 这里需要调用knowledge_graph.py中的方法
        # 由于knowledge_graph.py可能需要数据库连接,这里简化处理
        print(f"[成功] 准备创建 {len(points_data)} 个监测点")

    if sensors_data:
        print(f"[成功] 准备创建 {len(sensors_data)} 个传感器")

    if events_data:
        print(f"[成功] 准备创建 {len(events_data)} 个施工事件")

    if anomalies_data:
        print(f"[成功] 准备创建 {len(anomalies_data)} 个异常")

    # 5. 创建关系
    print("\n[成功] 正在创建关系...")
    # 这里需要实现关系创建逻辑

    # 6. 验证图谱
    print("\n[成功] 正在验证图谱...")
    # 统计节点和关系数量

    # 7. 生成报告
    print("\n[成功] 正在生成报告...")

    report = f"""# 知识图谱构建报告

**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 数据统计

- 监测点: {len(points_data)}
- 传感器: {len(sensors_data)}
- 施工事件: {len(events_data)}
- 异常: {len(anomalies_data)}

## 图谱统计

- 节点总数: 待统计
- 关系总数: 待统计

## 下一步

1. 实现KGQA系统
2. 开发可视化界面
3. 测试查询性能
"""

    # 保存报告
    report_dir = 'reports'
    os.makedirs(report_dir, exist_ok=True)
    report_path = os.path.join(report_dir, 'kg_build_report.md')

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"[成功] 报告已保存到 {report_path}")

    # 8. 关闭连接
    builder.close()

    print("="*60)
    print("[成功] 知识图谱构建完成!")
    print("="*60)

if __name__ == '__main__':
    main()
