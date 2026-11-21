# -*- coding: utf-8 -*-
"""
Informer模型训练脚本 - 阶段1: 智能预测引擎升级

功能:
1. 加载预处理后的数据
2. 创建数据加载器
3. 训练Informer模型
4. 评估模型性能
5. 保存最佳模型

作者: Claude Opus 4.6
日期: 2026-03-09
"""

import os
import sys
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import numpy as np
import pandas as pd
import json
from typing import Dict, List, Tuple
from tqdm import tqdm
import matplotlib.pyplot as plt

# 添加项目根目录到路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 导入Informer模型
from informer_predictor import InformerModel

class SettlementDataset(Dataset):
    """
    沉降数据集类
    """
    def __init__(
        self,
        data: np.ndarray,
        seq_len: int = 30,
        pred_len: int = 7,
        feature_cols: List[int] = None
    ):
        """
        Args:
            data: 数据数组 (n_samples, n_features)
            seq_len: 输入序列长度
            pred_len: 预测序列长度
            feature_cols: 特征列索引
        """
        self.data = data
        self.seq_len = seq_len
        self.pred_len = pred_len
        self.feature_cols = feature_cols if feature_cols is not None else list(range(data.shape[1]))

    def __len__(self):
        return len(self.data) - self.seq_len - self.pred_len + 1

    def __getitem__(self, idx):
        # 输入序列
        x = self.data[idx:idx+self.seq_len, self.feature_cols]

        # 目标序列 (只预测沉降值,假设第0列是沉降)
        y = self.data[idx+self.seq_len:idx+self.seq_len+self.pred_len, 0]

        return torch.FloatTensor(x), torch.FloatTensor(y)

def load_data(data_dir: str = 'data/processed') -> Tuple[np.ndarray, np.ndarray, np.ndarray, Dict]:
    """
    加载预处理后的数据

    Args:
        data_dir: 数据目录

    Returns:
        训练集、验证集、测试集、归一化参数
    """
    print(f"[成功] 正在从 {data_dir} 加载数据...")

    train_data = np.load(os.path.join(data_dir, 'train.npy'))
    val_data = np.load(os.path.join(data_dir, 'val.npy'))
    test_data = np.load(os.path.join(data_dir, 'test.npy'))

    with open(os.path.join(data_dir, 'norm_params.json'), 'r') as f:
        norm_params = json.load(f)

    print(f"[成功] 训练集: {train_data.shape}")
    print(f"[成功] 验证集: {val_data.shape}")
    print(f"[成功] 测试集: {test_data.shape}")

    return train_data, val_data, test_data, norm_params

def create_dataloaders(
    train_data: np.ndarray,
    val_data: np.ndarray,
    test_data: np.ndarray,
    seq_len: int = 30,
    pred_len: int = 7,
    batch_size: int = 32
) -> Tuple[DataLoader, DataLoader, DataLoader]:
    """
    创建数据加载器

    Args:
        train_data: 训练数据
        val_data: 验证数据
        test_data: 测试数据
        seq_len: 输入序列长度
        pred_len: 预测序列长度
        batch_size: 批次大小

    Returns:
        训练、验证、测试数据加载器
    """
    print("[成功] 正在创建数据加载器...")

    train_dataset = SettlementDataset(train_data, seq_len, pred_len)
    val_dataset = SettlementDataset(val_data, seq_len, pred_len)
    test_dataset = SettlementDataset(test_data, seq_len, pred_len)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)

    print(f"[成功] 训练批次: {len(train_loader)}")
    print(f"[成功] 验证批次: {len(val_loader)}")
    print(f"[成功] 测试批次: {len(test_loader)}")

    return train_loader, val_loader, test_loader

def train_epoch(
    model: nn.Module,
    train_loader: DataLoader,
    criterion: nn.Module,
    optimizer: optim.Optimizer,
    device: torch.device
) -> float:
    """
    训练一个epoch

    Args:
        model: 模型
        train_loader: 训练数据加载器
        criterion: 损失函数
        optimizer: 优化器
        device: 设备

    Returns:
        平均损失
    """
    model.train()
    total_loss = 0.0

    for x, y in tqdm(train_loader, desc="Training"):
        x, y = x.to(device), y.to(device)

        # 前向传播
        optimizer.zero_grad()
        y_pred = model(x)

        # 计算损失
        loss = criterion(y_pred, y)

        # 反向传播
        loss.backward()
        optimizer.step()

        total_loss += loss.item()

    return total_loss / len(train_loader)

def validate(
    model: nn.Module,
    val_loader: DataLoader,
    criterion: nn.Module,
    device: torch.device
) -> float:
    """
    验证模型

    Args:
        model: 模型
        val_loader: 验证数据加载器
        criterion: 损失函数
        device: 设备

    Returns:
        平均损失
    """
    model.eval()
    total_loss = 0.0

    with torch.no_grad():
        for x, y in val_loader:
            x, y = x.to(device), y.to(device)

            # 前向传播
            y_pred = model(x)

            # 计算损失
            loss = criterion(y_pred, y)
            total_loss += loss.item()

    return total_loss / len(val_loader)

def evaluate(
    model: nn.Module,
    test_loader: DataLoader,
    device: torch.device,
    norm_params: Dict
) -> Dict:
    """
    评估模型性能

    Args:
        model: 模型
        test_loader: 测试数据加载器
        device: 设备
        norm_params: 归一化参数

    Returns:
        评估指标
    """
    model.eval()
    all_preds = []
    all_targets = []

    with torch.no_grad():
        for x, y in test_loader:
            x, y = x.to(device), y.to(device)

            # 前向传播
            y_pred = model(x)

            all_preds.append(y_pred.cpu().numpy())
            all_targets.append(y.cpu().numpy())

    # 合并所有预测和目标
    all_preds = np.concatenate(all_preds, axis=0)
    all_targets = np.concatenate(all_targets, axis=0)

    # 反归一化 (假设第0列是沉降)
    if 'settlement' in norm_params:
        mean = norm_params['settlement']['mean']
        std = norm_params['settlement']['std']
        all_preds = all_preds * std + mean
        all_targets = all_targets * std + mean

    # 计算评估指标
    mae = np.mean(np.abs(all_preds - all_targets))
    rmse = np.sqrt(np.mean((all_preds - all_targets) ** 2))
    mape = np.mean(np.abs((all_preds - all_targets) / (all_targets + 1e-8))) * 100

    metrics = {
        'MAE': mae,
        'RMSE': rmse,
        'MAPE': mape
    }

    return metrics

def plot_training_history(train_losses: List[float], val_losses: List[float], save_path: str):
    """
    绘制训练历史

    Args:
        train_losses: 训练损失列表
        val_losses: 验证损失列表
        save_path: 保存路径
    """
    plt.figure(figsize=(10, 6))
    plt.plot(train_losses, label='Train Loss')
    plt.plot(val_losses, label='Val Loss')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.title('Training History')
    plt.legend()
    plt.grid(True)
    plt.savefig(save_path)
    plt.close()

def main():
    """
    主函数
    """
    print("="*60)
    print("Informer模型训练 - 阶段1: 智能预测引擎升级")
    print("="*60)

    # 配置
    config = {
        'data_dir': 'data/processed',
        'model_dir': 'models/informer',
        'seq_len': 30,
        'pred_len': 7,
        'batch_size': 32,
        'epochs': 50,
        'learning_rate': 0.001,
        'd_model': 512,
        'n_heads': 8,
        'n_layers': 3,
        'dropout': 0.1
    }

    # 创建模型目录
    os.makedirs(config['model_dir'], exist_ok=True)

    # 设备
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"[成功] 使用设备: {device}")

    # 1. 加载数据
    train_data, val_data, test_data, norm_params = load_data(config['data_dir'])

    # 2. 创建数据加载器
    train_loader, val_loader, test_loader = create_dataloaders(
        train_data, val_data, test_data,
        config['seq_len'], config['pred_len'], config['batch_size']
    )

    # 3. 创建模型
    print("[成功] 正在创建Informer模型...")
    n_features = train_data.shape[1]
    model = InformerModel(
        input_dim=n_features,
        d_model=config['d_model'],
        n_heads=config['n_heads'],
        n_layers=config['n_layers'],
        pred_len=config['pred_len'],
        dropout=config['dropout']
    ).to(device)

    # 4. 损失函数和优化器
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=config['learning_rate'])

    # 5. 训练
    print("[成功] 开始训练...")
    train_losses = []
    val_losses = []
    best_val_loss = float('inf')

    for epoch in range(config['epochs']):
        print(f"\nEpoch {epoch+1}/{config['epochs']}")

        # 训练
        train_loss = train_epoch(model, train_loader, criterion, optimizer, device)
        train_losses.append(train_loss)

        # 验证
        val_loss = validate(model, val_loader, criterion, device)
        val_losses.append(val_loss)

        print(f"Train Loss: {train_loss:.6f}, Val Loss: {val_loss:.6f}")

        # 保存最佳模型
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), os.path.join(config['model_dir'], 'best_model.pth'))
            print("[成功] 保存最佳模型")

    # 6. 绘制训练历史
    plot_training_history(train_losses, val_losses, os.path.join(config['model_dir'], 'training_history.png'))

    # 7. 加载最佳模型并评估
    print("\n[成功] 正在评估最佳模型...")
    model.load_state_dict(torch.load(os.path.join(config['model_dir'], 'best_model.pth')))
    metrics = evaluate(model, test_loader, device, norm_params)

    print("\n" + "="*60)
    print("评估结果:")
    print(f"  MAE: {metrics['MAE']:.4f}")
    print(f"  RMSE: {metrics['RMSE']:.4f}")
    print(f"  MAPE: {metrics['MAPE']:.2f}%")
    print("="*60)

    # 8. 保存配置和指标
    with open(os.path.join(config['model_dir'], 'config.json'), 'w') as f:
        json.dump(config, f, indent=2)

    with open(os.path.join(config['model_dir'], 'metrics.json'), 'w') as f:
        json.dump(metrics, f, indent=2)

    print("\n[成功] 训练完成!")

if __name__ == '__main__':
    main()
