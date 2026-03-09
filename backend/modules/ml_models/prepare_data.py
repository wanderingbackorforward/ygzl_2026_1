# -*- coding: utf-8 -*-
"""
数据准备脚本 - 阶段1: 智能预测引擎升级
用途: 从数据库导出所有监测数据,准备训练数据集

功能:
1. 从Supabase导出沉降、温度、裂缝、振动数据
2. 数据预处理(归一化、缺失值处理)
3. 数据集划分(训练70%、验证15%、测试15%)
4. 保存为CSV和NPY格式

作者: Claude Opus 4.6
日期: 2026-03-09
"""

import os
import sys
import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import json

# 添加项目根目录到路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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

def fetch_settlement_data() -> pd.DataFrame:
    """
    从Supabase获取沉降数据
    """
    print("[成功] 正在获取沉降数据...")
    try:
        # 获取所有沉降数据,按时间排序
        r = requests.get(
            _url('/rest/v1/settlement_data?select=*&order=date.asc'),
            headers=_headers(),
            timeout=30
        )
        r.raise_for_status()
        data = r.json()

        if not data:
            print("[警告] 没有找到沉降数据")
            return pd.DataFrame()

        df = pd.DataFrame(data)
        print(f"[成功] 获取到 {len(df)} 条沉降数据")
        return df
    except Exception as e:
        print(f"[错误] 获取沉降数据失败: {e}")
        return pd.DataFrame()

def fetch_temperature_data() -> pd.DataFrame:
    """
    从Supabase获取温度数据
    """
    print("[成功] 正在获取温度数据...")
    try:
        r = requests.get(
            _url('/rest/v1/temperature_data?select=*&order=date.asc'),
            headers=_headers(),
            timeout=30
        )
        r.raise_for_status()
        data = r.json()

        if not data:
            print("[警告] 没有找到温度数据")
            return pd.DataFrame()

        df = pd.DataFrame(data)
        print(f"[成功] 获取到 {len(df)} 条温度数据")
        return df
    except Exception as e:
        print(f"[错误] 获取温度数据失败: {e}")
        return pd.DataFrame()

def fetch_crack_data() -> pd.DataFrame:
    """
    从Supabase获取裂缝数据
    """
    print("[成功] 正在获取裂缝数据...")
    try:
        r = requests.get(
            _url('/rest/v1/crack_data?select=*&order=date.asc'),
            headers=_headers(),
            timeout=30
        )
        r.raise_for_status()
        data = r.json()

        if not data:
            print("[警告] 没有找到裂缝数据")
            return pd.DataFrame()

        df = pd.DataFrame(data)
        print(f"[成功] 获取到 {len(df)} 条裂缝数据")
        return df
    except Exception as e:
        print(f"[错误] 获取裂缝数据失败: {e}")
        return pd.DataFrame()

def preprocess_data(df: pd.DataFrame, data_type: str) -> pd.DataFrame:
    """
    数据预处理

    Args:
        df: 原始数据
        data_type: 数据类型 (settlement/temperature/crack)

    Returns:
        预处理后的数据
    """
    if df.empty:
        return df

    print(f"[成功] 正在预处理{data_type}数据...")

    # 1. 转换日期格式
    if 'date' in df.columns:
        df['date'] = pd.to_datetime(df['date'])

    # 2. 按日期排序
    df = df.sort_values('date')

    # 3. 处理缺失值
    # 数值列使用前向填充
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    df[numeric_cols] = df[numeric_cols].fillna(method='ffill')
    df[numeric_cols] = df[numeric_cols].fillna(method='bfill')
    df[numeric_cols] = df[numeric_cols].fillna(0)

    # 4. 移除异常值 (3-sigma原则)
    for col in numeric_cols:
        if col not in ['id', 'point_id']:
            mean = df[col].mean()
            std = df[col].std()
            df = df[(df[col] >= mean - 3*std) & (df[col] <= mean + 3*std)]

    print(f"[成功] 预处理完成,剩余 {len(df)} 条数据")
    return df

def merge_multi_source_data(
    settlement_df: pd.DataFrame,
    temperature_df: pd.DataFrame,
    crack_df: pd.DataFrame
) -> pd.DataFrame:
    """
    合并多源数据

    Args:
        settlement_df: 沉降数据
        temperature_df: 温度数据
        crack_df: 裂缝数据

    Returns:
        合并后的数据
    """
    print("[成功] 正在合并多源数据...")

    if settlement_df.empty:
        print("[错误] 沉降数据为空,无法合并")
        return pd.DataFrame()

    # 以沉降数据为基准
    merged_df = settlement_df.copy()

    # 合并温度数据
    if not temperature_df.empty:
        temp_cols = [col for col in temperature_df.columns if col not in ['id', 'date']]
        temp_df_renamed = temperature_df[['date'] + temp_cols].copy()
        temp_df_renamed.columns = ['date'] + [f'temp_{col}' for col in temp_cols]
        merged_df = pd.merge(merged_df, temp_df_renamed, on='date', how='left')

    # 合并裂缝数据
    if not crack_df.empty:
        crack_cols = [col for col in crack_df.columns if col not in ['id', 'date']]
        crack_df_renamed = crack_df[['date'] + crack_cols].copy()
        crack_df_renamed.columns = ['date'] + [f'crack_{col}' for col in crack_cols]
        merged_df = pd.merge(merged_df, crack_df_renamed, on='date', how='left')

    # 填充合并后的缺失值
    merged_df = merged_df.fillna(method='ffill').fillna(method='bfill').fillna(0)

    print(f"[成功] 合并完成,共 {len(merged_df)} 条数据, {len(merged_df.columns)} 个特征")
    return merged_df

def normalize_data(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict]:
    """
    归一化数据

    Args:
        df: 原始数据

    Returns:
        归一化后的数据和归一化参数
    """
    print("[成功] 正在归一化数据...")

    # 保存归一化参数
    norm_params = {}

    # 数值列归一化
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    numeric_cols = [col for col in numeric_cols if col not in ['id', 'point_id']]

    df_normalized = df.copy()

    for col in numeric_cols:
        mean = df[col].mean()
        std = df[col].std()

        if std > 0:
            df_normalized[col] = (df[col] - mean) / std
            norm_params[col] = {'mean': mean, 'std': std}
        else:
            norm_params[col] = {'mean': mean, 'std': 1.0}

    print(f"[成功] 归一化完成,共 {len(numeric_cols)} 个特征")
    return df_normalized, norm_params

def split_dataset(
    df: pd.DataFrame,
    train_ratio: float = 0.7,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    划分数据集

    Args:
        df: 完整数据
        train_ratio: 训练集比例
        val_ratio: 验证集比例
        test_ratio: 测试集比例

    Returns:
        训练集、验证集、测试集
    """
    print("[成功] 正在划分数据集...")

    n = len(df)
    train_size = int(n * train_ratio)
    val_size = int(n * val_ratio)

    train_df = df.iloc[:train_size]
    val_df = df.iloc[train_size:train_size+val_size]
    test_df = df.iloc[train_size+val_size:]

    print(f"[成功] 训练集: {len(train_df)} 条")
    print(f"[成功] 验证集: {len(val_df)} 条")
    print(f"[成功] 测试集: {len(test_df)} 条")

    return train_df, val_df, test_df

def save_datasets(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    test_df: pd.DataFrame,
    norm_params: Dict,
    output_dir: str = 'data/processed'
):
    """
    保存数据集

    Args:
        train_df: 训练集
        val_df: 验证集
        test_df: 测试集
        norm_params: 归一化参数
        output_dir: 输出目录
    """
    print(f"[成功] 正在保存数据集到 {output_dir}...")

    # 创建输出目录
    os.makedirs(output_dir, exist_ok=True)

    # 保存CSV格式
    train_df.to_csv(os.path.join(output_dir, 'train.csv'), index=False)
    val_df.to_csv(os.path.join(output_dir, 'val.csv'), index=False)
    test_df.to_csv(os.path.join(output_dir, 'test.csv'), index=False)

    # 保存NPY格式 (用于快速加载)
    np.save(os.path.join(output_dir, 'train.npy'), train_df.values)
    np.save(os.path.join(output_dir, 'val.npy'), val_df.values)
    np.save(os.path.join(output_dir, 'test.npy'), test_df.values)

    # 保存归一化参数
    with open(os.path.join(output_dir, 'norm_params.json'), 'w') as f:
        json.dump(norm_params, f, indent=2)

    # 保存列名
    with open(os.path.join(output_dir, 'columns.json'), 'w') as f:
        json.dump(list(train_df.columns), f, indent=2)

    print("[成功] 数据集保存完成!")
    print(f"  - train.csv: {len(train_df)} 条")
    print(f"  - val.csv: {len(val_df)} 条")
    print(f"  - test.csv: {len(test_df)} 条")
    print(f"  - norm_params.json: {len(norm_params)} 个参数")

def main():
    """
    主函数
    """
    print("="*60)
    print("数据准备脚本 - 阶段1: 智能预测引擎升级")
    print("="*60)

    # 1. 获取数据
    settlement_df = fetch_settlement_data()
    temperature_df = fetch_temperature_data()
    crack_df = fetch_crack_data()

    if settlement_df.empty:
        print("[错误] 没有沉降数据,无法继续")
        return

    # 2. 预处理
    settlement_df = preprocess_data(settlement_df, 'settlement')
    temperature_df = preprocess_data(temperature_df, 'temperature')
    crack_df = preprocess_data(crack_df, 'crack')

    # 3. 合并多源数据
    merged_df = merge_multi_source_data(settlement_df, temperature_df, crack_df)

    if merged_df.empty:
        print("[错误] 合并后数据为空,无法继续")
        return

    # 4. 归一化
    normalized_df, norm_params = normalize_data(merged_df)

    # 5. 划分数据集
    train_df, val_df, test_df = split_dataset(normalized_df)

    # 6. 保存数据集
    save_datasets(train_df, val_df, test_df, norm_params)

    print("="*60)
    print("[成功] 数据准备完成!")
    print("="*60)

if __name__ == '__main__':
    main()
