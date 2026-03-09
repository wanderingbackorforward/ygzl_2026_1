# -*- coding: utf-8 -*-
"""
统一训练管理脚本 - 阶段1: 智能预测引擎升级

功能:
1. 一键训练所有模型(Informer/STGCN/PINN)
2. 自动对比实验
3. 生成评估报告
4. 保存最佳模型

作者: Claude Opus 4.6
日期: 2026-03-09
"""

import os
import sys
import subprocess
import json
import pandas as pd
from datetime import datetime

def run_data_preparation():
    """
    运行数据准备脚本
    """
    print("="*60)
    print("步骤1: 数据准备")
    print("="*60)

    result = subprocess.run(
        [sys.executable, 'prepare_data.py'],
        cwd=os.path.dirname(os.path.abspath(__file__)),
        capture_output=True,
        text=True
    )

    print(result.stdout)
    if result.returncode != 0:
        print(f"[错误] 数据准备失败: {result.stderr}")
        return False

    return True

def train_model(model_name: str):
    """
    训练指定模型

    Args:
        model_name: 模型名称 (informer/stgcn/pinn)
    """
    print("="*60)
    print(f"步骤2: 训练{model_name.upper()}模型")
    print("="*60)

    script_name = f'train_{model_name}.py'

    if not os.path.exists(os.path.join(os.path.dirname(__file__), script_name)):
        print(f"[警告] {script_name} 不存在,跳过")
        return None

    result = subprocess.run(
        [sys.executable, script_name],
        cwd=os.path.dirname(os.path.abspath(__file__)),
        capture_output=True,
        text=True
    )

    print(result.stdout)
    if result.returncode != 0:
        print(f"[错误] {model_name}训练失败: {result.stderr}")
        return None

    # 读取评估指标
    metrics_path = os.path.join('models', model_name, 'metrics.json')
    if os.path.exists(metrics_path):
        with open(metrics_path, 'r') as f:
            metrics = json.load(f)
        return metrics

    return None

def compare_models(results: dict):
    """
    对比模型性能

    Args:
        results: 模型评估结果字典
    """
    print("="*60)
    print("步骤3: 模型对比")
    print("="*60)

    # 创建对比表
    df = pd.DataFrame(results).T
    df = df.round(4)

    print("\n模型性能对比:")
    print(df.to_string())

    # 找出最佳模型
    best_model = df['MAE'].idxmin()
    print(f"\n[成功] 最佳模型: {best_model.upper()}")
    print(f"  MAE: {df.loc[best_model, 'MAE']:.4f}")
    print(f"  RMSE: {df.loc[best_model, 'RMSE']:.4f}")
    print(f"  MAPE: {df.loc[best_model, 'MAPE']:.2f}%")

    # 保存对比结果
    report_dir = 'reports'
    os.makedirs(report_dir, exist_ok=True)

    df.to_csv(os.path.join(report_dir, 'model_comparison.csv'))
    print(f"\n[成功] 对比结果已保存到 {report_dir}/model_comparison.csv")

    return best_model

def generate_report(results: dict, best_model: str):
    """
    生成评估报告

    Args:
        results: 模型评估结果
        best_model: 最佳模型名称
    """
    print("="*60)
    print("步骤4: 生成评估报告")
    print("="*60)

    report_dir = 'reports'
    os.makedirs(report_dir, exist_ok=True)

    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    report = f"""# 阶段1模型训练评估报告

**生成时间**: {timestamp}
**最佳模型**: {best_model.upper()}

## 模型性能对比

| 模型 | MAE | RMSE | MAPE (%) |
|------|-----|------|----------|
"""

    for model_name, metrics in results.items():
        report += f"| {model_name.upper()} | {metrics['MAE']:.4f} | {metrics['RMSE']:.4f} | {metrics['MAPE']:.2f} |\n"

    report += f"""

## 最佳模型详情

- **模型名称**: {best_model.upper()}
- **MAE**: {results[best_model]['MAE']:.4f}
- **RMSE**: {results[best_model]['RMSE']:.4f}
- **MAPE**: {results[best_model]['MAPE']:.2f}%

## 结论

1. 所有模型训练完成
2. {best_model.upper()}模型性能最佳
3. 模型权重已保存到 `models/{best_model}/best_model.pth`

## 下一步

1. 前端集成
2. API优化
3. 撰写技术文档
4. 生成论文草稿
"""

    report_path = os.path.join(report_dir, 'training_report.md')
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"[成功] 评估报告已保存到 {report_path}")

def main():
    """
    主函数
    """
    print("="*80)
    print("统一训练管理 - 阶段1: 智能预测引擎升级")
    print("="*80)

    # 1. 数据准备
    if not run_data_preparation():
        print("[错误] 数据准备失败,终止训练")
        return

    # 2. 训练所有模型
    models = ['informer', 'stgcn', 'pinn']
    results = {}

    for model_name in models:
        metrics = train_model(model_name)
        if metrics:
            results[model_name] = metrics

    if not results:
        print("[错误] 没有模型训练成功")
        return

    # 3. 对比模型
    best_model = compare_models(results)

    # 4. 生成报告
    generate_report(results, best_model)

    print("="*80)
    print("[成功] 所有训练任务完成!")
    print("="*80)

if __name__ == '__main__':
    main()
