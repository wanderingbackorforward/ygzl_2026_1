# -*- coding: utf-8 -*-
"""
STGCN: 时空图卷积网络 (Spatio-Temporal Graph Convolutional Networks)
论文: "Spatio-Temporal Graph Convolutional Networks: A Deep Learning Framework for Traffic Forecasting" (IJCAI 2018)

核心创新:
1. 图卷积 (Graph Convolution) - 捕捉空间依赖
2. 时间卷积 (Temporal Convolution) - 捕捉时间依赖
3. ST-Conv Block - 时空卷积块,同时建模时空关系

应用场景: 多个监测点联合预测,利用空间关联提升精度
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
from scipy.spatial.distance import cdist


class SpatialGraphBuilder:
    """
    空间图构建器 - 根据监测点坐标构建邻接矩阵
    """
    def __init__(self, distance_threshold: float = 100.0):
        """
        Args:
            distance_threshold: 距离阈值(米),小于此距离的点视为邻居
        """
        self.distance_threshold = distance_threshold

    def build_adjacency_matrix(self, points: List[Dict]) -> np.ndarray:
        """
        构建邻接矩阵

        Args:
            points: 监测点列表,每个点包含 {'id': str, 'x': float, 'y': float}

        Returns:
            adj_matrix: (N, N) 邻接矩阵
        """
        n_points = len(points)

        # 提取坐标
        coords = np.array([[p['x'], p['y']] for p in points])

        # 计算欧氏距离
        distances = cdist(coords, coords, metric='euclidean')

        # 距离小于阈值的点视为邻居
        adj_matrix = (distances < self.distance_threshold).astype(float)

        # 添加自环
        np.fill_diagonal(adj_matrix, 1.0)

        return adj_matrix

    def normalize_adjacency_matrix(self, adj_matrix: np.ndarray) -> np.ndarray:
        """
        归一化邻接矩阵: D^(-1/2) * A * D^(-1/2)

        Args:
            adj_matrix: 原始邻接矩阵

        Returns:
            normalized_adj: 归一化后的邻接矩阵
        """
        # 计算度矩阵
        degree = np.sum(adj_matrix, axis=1)

        # D^(-1/2)
        d_inv_sqrt = np.power(degree, -0.5)
        d_inv_sqrt[np.isinf(d_inv_sqrt)] = 0.0
        d_mat_inv_sqrt = np.diag(d_inv_sqrt)

        # D^(-1/2) * A * D^(-1/2)
        normalized_adj = d_mat_inv_sqrt @ adj_matrix @ d_mat_inv_sqrt

        return normalized_adj

    def build_from_database(self, conn) -> Tuple[np.ndarray, List[str]]:
        """
        从数据库读取监测点坐标并构建邻接矩阵

        Args:
            conn: 数据库连接

        Returns:
            adj_matrix: 邻接矩阵
            point_ids: 监测点ID列表
        """
        query = """
        SELECT DISTINCT point_id, x_coordinate as x, y_coordinate as y
        FROM monitoring_points
        WHERE x_coordinate IS NOT NULL AND y_coordinate IS NOT NULL
        ORDER BY point_id
        """

        cursor = conn.cursor(dictionary=True)
        cursor.execute(query)
        points = cursor.fetchall()
        cursor.close()

        if len(points) == 0:
            raise ValueError("数据库中没有监测点坐标数据")

        point_ids = [p['point_id'] for p in points]
        adj_matrix = self.build_adjacency_matrix(points)
        adj_matrix = self.normalize_adjacency_matrix(adj_matrix)

        return adj_matrix, point_ids


class GraphConvolution(nn.Module):
    """
    图卷积层: Y = σ(AXW)
    """
    def __init__(self, in_features: int, out_features: int):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.weight = nn.Parameter(torch.FloatTensor(in_features, out_features))
        self.bias = nn.Parameter(torch.FloatTensor(out_features))
        self.reset_parameters()

    def reset_parameters(self):
        nn.init.xavier_uniform_(self.weight)
        nn.init.zeros_(self.bias)

    def forward(self, x, adj):
        """
        Args:
            x: (batch, num_nodes, in_features)
            adj: (num_nodes, num_nodes)
        Returns:
            output: (batch, num_nodes, out_features)
        """
        # X * W
        support = torch.matmul(x, self.weight)

        # A * X * W
        output = torch.matmul(adj, support)

        # 加偏置
        output = output + self.bias

        return output


class TemporalConvolution(nn.Module):
    """
    时间卷积层: 使用1D卷积捕捉时间依赖
    """
    def __init__(self, in_channels: int, out_channels: int, kernel_size: int = 3):
        super().__init__()
        self.conv = nn.Conv2d(
            in_channels=in_channels,
            out_channels=out_channels,
            kernel_size=(1, kernel_size),
            padding=(0, kernel_size // 2)
        )

    def forward(self, x):
        """
        Args:
            x: (batch, in_channels, num_nodes, time_steps)
        Returns:
            output: (batch, out_channels, num_nodes, time_steps)
        """
        return self.conv(x)


class STConvBlock(nn.Module):
    """
    时空卷积块: 图卷积 + 时间卷积 + 残差连接
    """
    def __init__(
        self,
        in_channels: int,
        spatial_channels: int,
        out_channels: int,
        num_nodes: int,
        kernel_size: int = 3
    ):
        super().__init__()

        # 时间卷积1
        self.temporal1 = TemporalConvolution(in_channels, spatial_channels, kernel_size)

        # 图卷积
        self.graph_conv = GraphConvolution(spatial_channels, spatial_channels)

        # 时间卷积2
        self.temporal2 = TemporalConvolution(spatial_channels, out_channels, kernel_size)

        # 批归一化
        self.batch_norm = nn.BatchNorm2d(out_channels)

        # 残差连接
        if in_channels != out_channels:
            self.residual = nn.Conv2d(in_channels, out_channels, kernel_size=1)
        else:
            self.residual = None

    def forward(self, x, adj):
        """
        Args:
            x: (batch, in_channels, num_nodes, time_steps)
            adj: (num_nodes, num_nodes)
        Returns:
            output: (batch, out_channels, num_nodes, time_steps)
        """
        # 残差
        residual = x if self.residual is None else self.residual(x)

        # 时间卷积1
        x = self.temporal1(x)
        x = F.relu(x)

        # 图卷积
        # (batch, channels, num_nodes, time_steps) -> (batch, time_steps, num_nodes, channels)
        x = x.permute(0, 3, 2, 1)
        batch_size, time_steps, num_nodes, channels = x.shape
        x = x.reshape(batch_size * time_steps, num_nodes, channels)

        x = self.graph_conv(x, adj)
        x = F.relu(x)

        # 恢复形状
        x = x.reshape(batch_size, time_steps, num_nodes, channels)
        x = x.permute(0, 3, 2, 1)

        # 时间卷积2
        x = self.temporal2(x)

        # 批归一化
        x = self.batch_norm(x)

        # 残差连接
        x = x + residual
        x = F.relu(x)

        return x


class STGCN(nn.Module):
    """
    时空图卷积网络完整模型
    """
    def __init__(
        self,
        num_nodes: int,
        in_channels: int,
        spatial_channels: int,
        out_channels: int,
        num_layers: int = 2,
        seq_len: int = 60,
        pred_len: int = 30
    ):
        super().__init__()
        self.num_nodes = num_nodes
        self.seq_len = seq_len
        self.pred_len = pred_len

        # ST-Conv块
        self.st_blocks = nn.ModuleList()

        # 第一层
        self.st_blocks.append(
            STConvBlock(in_channels, spatial_channels, out_channels, num_nodes)
        )

        # 中间层
        for _ in range(num_layers - 1):
            self.st_blocks.append(
                STConvBlock(out_channels, spatial_channels, out_channels, num_nodes)
            )

        # 输出层
        self.output_layer = nn.Conv2d(
            out_channels,
            pred_len,
            kernel_size=(1, seq_len)
        )

    def forward(self, x, adj):
        """
        Args:
            x: (batch, in_channels, num_nodes, seq_len)
            adj: (num_nodes, num_nodes)
        Returns:
            output: (batch, num_nodes, pred_len)
        """
        # ST-Conv块
        for block in self.st_blocks:
            x = block(x, adj)

        # 输出层
        x = self.output_layer(x)  # (batch, pred_len, num_nodes, 1)
        x = x.squeeze(-1)  # (batch, pred_len, num_nodes)
        x = x.permute(0, 2, 1)  # (batch, num_nodes, pred_len)

        return x


class STGCNPredictor:
    """
    STGCN预测器 - 用于多点联合沉降预测的高级接口
    """
    def __init__(
        self,
        num_nodes: int = 25,
        seq_len: int = 60,
        pred_len: int = 30,
        in_channels: int = 1,
        spatial_channels: int = 16,
        out_channels: int = 32,
        num_layers: int = 2,
        device: str = 'cpu'
    ):
        self.num_nodes = num_nodes
        self.seq_len = seq_len
        self.pred_len = pred_len
        self.device = device

        # 创建模型
        self.model = STGCN(
            num_nodes=num_nodes,
            in_channels=in_channels,
            spatial_channels=spatial_channels,
            out_channels=out_channels,
            num_layers=num_layers,
            seq_len=seq_len,
            pred_len=pred_len
        ).to(device)

        self.optimizer = None
        self.criterion = nn.MSELoss()

        # 空间图构建器
        self.graph_builder = SpatialGraphBuilder(distance_threshold=100.0)
        self.adj_matrix = None
        self.point_ids = None

    def prepare_data(self, conn) -> Dict:
        """
        准备训练/预测数据

        Returns:
            data: {
                'features': (num_samples, num_nodes, seq_len),
                'targets': (num_samples, num_nodes, pred_len),
                'adj_matrix': (num_nodes, num_nodes),
                'point_ids': List[str],
                'scaler': StandardScaler
            }
        """
        # 构建空间图
        adj_matrix, point_ids = self.graph_builder.build_from_database(conn)
        self.adj_matrix = adj_matrix
        self.point_ids = point_ids

        # 查询所有监测点的时间序列数据
        query = """
        SELECT point_id, date, settlement
        FROM settlement_data
        WHERE point_id IN ({})
        ORDER BY point_id, date
        """.format(','.join(['%s'] * len(point_ids)))

        cursor = conn.cursor(dictionary=True)
        cursor.execute(query, point_ids)
        data = cursor.fetchall()
        cursor.close()

        # 转换为DataFrame
        df = pd.DataFrame(data)
        df['date'] = pd.to_datetime(df['date'])

        # 透视表: 行=日期, 列=监测点
        pivot_df = df.pivot(index='date', columns='point_id', values='settlement')
        pivot_df = pivot_df.sort_index()

        # 填充缺失值
        pivot_df = pivot_df.ffill().bfill()

        # 归一化
        from sklearn.preprocessing import StandardScaler
        scaler = StandardScaler()
        normalized_data = scaler.fit_transform(pivot_df.values)

        # 构建样本
        n_samples = len(normalized_data) - self.seq_len - self.pred_len + 1
        features = []
        targets = []

        for i in range(n_samples):
            # 输入: (num_nodes, seq_len)
            x = normalized_data[i:i+self.seq_len].T
            features.append(x)

            # 目标: (num_nodes, pred_len)
            y = normalized_data[i+self.seq_len:i+self.seq_len+self.pred_len].T
            targets.append(y)

        features = np.array(features)  # (num_samples, num_nodes, seq_len)
        targets = np.array(targets)  # (num_samples, num_nodes, pred_len)

        return {
            'features': features,
            'targets': targets,
            'adj_matrix': adj_matrix,
            'point_ids': point_ids,
            'scaler': scaler,
            'dates': pivot_df.index
        }

    def train(self, train_data: Dict, val_data: Dict = None, epochs: int = 100, lr: float = 0.001):
        """
        训练模型
        """
        self.model.train()
        self.optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)

        features = train_data['features']
        targets = train_data['targets']
        adj_matrix = train_data['adj_matrix']

        # 转换为Tensor
        adj_tensor = torch.FloatTensor(adj_matrix).to(self.device)

        n_samples = len(features)
        batch_size = 32

        best_loss = float('inf')
        patience = 10
        patience_counter = 0

        for epoch in range(epochs):
            epoch_loss = 0
            n_batches = 0

            # 随机打乱
            indices = np.random.permutation(n_samples)

            for i in range(0, n_samples, batch_size):
                batch_indices = indices[i:i+batch_size]

                # 准备批次数据
                batch_x = features[batch_indices]  # (batch, num_nodes, seq_len)
                batch_y = targets[batch_indices]  # (batch, num_nodes, pred_len)

                # 转换为Tensor并调整形状
                batch_x = torch.FloatTensor(batch_x).unsqueeze(1).to(self.device)  # (batch, 1, num_nodes, seq_len)
                batch_y = torch.FloatTensor(batch_y).to(self.device)

                # 前向传播
                self.optimizer.zero_grad()
                pred = self.model(batch_x, adj_tensor)
                loss = self.criterion(pred, batch_y)

                # 反向传播
                loss.backward()
                self.optimizer.step()

                epoch_loss += loss.item()
                n_batches += 1

            avg_loss = epoch_loss / n_batches
            print(f"Epoch {epoch+1}/{epochs}, Loss: {avg_loss:.6f}")

            # 早停
            if avg_loss < best_loss:
                best_loss = avg_loss
                patience_counter = 0
            else:
                patience_counter += 1
                if patience_counter >= patience:
                    print(f"Early stopping at epoch {epoch+1}")
                    break

    def predict(self, input_data: Dict) -> Dict:
        """
        预测所有监测点的未来沉降
        """
        self.model.eval()

        features = input_data['features']
        adj_matrix = input_data['adj_matrix']
        scaler = input_data['scaler']
        point_ids = input_data['point_ids']
        dates = input_data['dates']

        # 使用最后一个样本作为输入
        x = features[-1:]  # (1, num_nodes, seq_len)

        # 转换为Tensor
        x = torch.FloatTensor(x).unsqueeze(1).to(self.device)  # (1, 1, num_nodes, seq_len)
        adj_tensor = torch.FloatTensor(adj_matrix).to(self.device)

        # 预测
        with torch.no_grad():
            pred = self.model(x, adj_tensor)
            pred = pred.squeeze(0).cpu().numpy()  # (num_nodes, pred_len)

        # 反归一化
        pred_denorm = scaler.inverse_transform(pred.T).T

        # 生成日期
        last_date = dates[-1]
        pred_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=self.pred_len)

        # 构建结果
        predictions = {}
        for i, point_id in enumerate(point_ids):
            predictions[point_id] = {
                'predictions': pred_denorm[i].tolist(),
                'dates': pred_dates.strftime('%Y-%m-%d').tolist()
            }

        return {
            'success': True,
            'model': 'stgcn',
            'num_nodes': self.num_nodes,
            'predictions': predictions,
            'spatial_correlation': self._analyze_spatial_correlation(adj_matrix, point_ids)
        }

    def _analyze_spatial_correlation(self, adj_matrix: np.ndarray, point_ids: List[str]) -> Dict:
        """
        分析空间关联
        """
        # 找到每个点的邻居
        neighbors = {}
        for i, point_id in enumerate(point_ids):
            neighbor_indices = np.where(adj_matrix[i] > 0)[0]
            neighbor_ids = [point_ids[j] for j in neighbor_indices if j != i]
            neighbors[point_id] = neighbor_ids

        return {
            'neighbors': neighbors,
            'avg_neighbors': np.mean([len(v) for v in neighbors.values()])
        }

    def evaluate(self, test_data: Dict) -> Dict:
        """
        评估模型性能
        """
        self.model.eval()

        features = test_data['features']
        targets = test_data['targets']
        adj_matrix = test_data['adj_matrix']

        # 转换为Tensor
        x = torch.FloatTensor(features).unsqueeze(1).to(self.device)
        y = torch.FloatTensor(targets).to(self.device)
        adj_tensor = torch.FloatTensor(adj_matrix).to(self.device)

        # 预测
        with torch.no_grad():
            pred = self.model(x, adj_tensor)

        # 计算指标
        mae = torch.mean(torch.abs(pred - y)).item()
        rmse = torch.sqrt(torch.mean((pred - y) ** 2)).item()
        mape = torch.mean(torch.abs((pred - y) / (y + 1e-8))).item() * 100

        return {
            'MAE': float(mae),
            'RMSE': float(rmse),
            'MAPE': float(mape)
        }


# 使用示例
if __name__ == '__main__':
    # 创建预测器
    predictor = STGCNPredictor(
        num_nodes=25,
        seq_len=60,
        pred_len=30,
        spatial_channels=16,
        out_channels=32,
        num_layers=2
    )

    print("STGCN模型创建成功!")
    print(f"模型参数数量: {sum(p.numel() for p in predictor.model.parameters())}")
