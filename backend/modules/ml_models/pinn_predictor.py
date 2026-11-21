# -*- coding: utf-8 -*-
"""
PINN: Physics-Informed Neural Networks (物理信息神经网络)
论文: "Physics-informed neural networks: A deep learning framework for solving forward and inverse problems
       involving nonlinear partial differential equations" (Journal of Computational Physics 2019)

核心创新:
1. 将物理定律(PDE)作为损失函数的一部分
2. 数据驱动 + 物理约束 = 更准确、更可解释的预测
3. 适用于数据稀缺场景

应用场景: 地铁沉降预测,融合土体力学方程
物理约束: Terzaghi固结理论、Mohr-Coulomb准则
"""

import torch
import torch.nn as nn
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional


class PhysicsLaws:
    """
    物理定律模块 - 土体力学方程
    """

    @staticmethod
    def terzaghi_consolidation(settlement, time, cv=1.0, H=10.0):
        """
        Terzaghi一维固结理论

        ∂u/∂t = cv * ∂²u/∂z²

        Args:
            settlement: 沉降量 (m)
            time: 时间 (days)
            cv: 固结系数 (m²/day)
            H: 土层厚度 (m)

        Returns:
            residual: 物理方程残差
        """
        # 计算时间导数 ∂u/∂t
        du_dt = torch.autograd.grad(
            settlement, time,
            grad_outputs=torch.ones_like(settlement),
            create_graph=True,
            retain_graph=True
        )[0]

        # 计算空间二阶导数 ∂²u/∂z² (简化为时间的二阶导数)
        d2u_dt2 = torch.autograd.grad(
            du_dt, time,
            grad_outputs=torch.ones_like(du_dt),
            create_graph=True,
            retain_graph=True
        )[0]

        # Terzaghi方程残差
        residual = du_dt - cv * d2u_dt2

        return residual

    @staticmethod
    def settlement_rate_constraint(settlement, time, max_rate=0.01):
        """
        沉降速率约束: |∂u/∂t| < max_rate

        Args:
            settlement: 沉降量
            time: 时间
            max_rate: 最大沉降速率 (m/day)

        Returns:
            penalty: 违反约束的惩罚项
        """
        du_dt = torch.autograd.grad(
            settlement, time,
            grad_outputs=torch.ones_like(settlement),
            create_graph=True,
            retain_graph=True
        )[0]

        # 超过最大速率的惩罚
        penalty = torch.relu(torch.abs(du_dt) - max_rate)

        return penalty

    @staticmethod
    def monotonicity_constraint(settlement):
        """
        单调性约束: 沉降应该单调递增(或保持稳定)

        Args:
            settlement: 沉降序列

        Returns:
            penalty: 违反单调性的惩罚
        """
        # 计算差分
        diff = settlement[1:] - settlement[:-1]

        # 惩罚负增长(回弹)
        penalty = torch.relu(-diff)

        return penalty


class PINN(nn.Module):
    """
    Physics-Informed Neural Network 完整模型
    """

    def __init__(
        self,
        input_dim: int = 4,  # 输入特征数(时间、温度、裂缝、振动)
        hidden_dims: List[int] = [64, 128, 128, 64],
        output_dim: int = 1,  # 输出(沉降)
        activation: str = 'tanh'
    ):
        super().__init__()

        self.input_dim = input_dim
        self.output_dim = output_dim

        # 构建网络层
        layers = []
        prev_dim = input_dim

        for hidden_dim in hidden_dims:
            layers.append(nn.Linear(prev_dim, hidden_dim))

            if activation == 'tanh':
                layers.append(nn.Tanh())
            elif activation == 'relu':
                layers.append(nn.ReLU())
            elif activation == 'gelu':
                layers.append(nn.GELU())

            prev_dim = hidden_dim

        # 输出层
        layers.append(nn.Linear(prev_dim, output_dim))

        self.network = nn.Sequential(*layers)

        # 初始化权重
        self._initialize_weights()

    def _initialize_weights(self):
        """Xavier初始化"""
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_normal_(m.weight)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)

    def forward(self, x):
        """
        前向传播

        Args:
            x: (batch, input_dim) 输入特征

        Returns:
            settlement: (batch, 1) 预测沉降
        """
        return self.network(x)


class PINNPredictor:
    """
    PINN预测器 - 用于沉降预测的高级接口
    """

    def __init__(
        self,
        seq_len: int = 60,
        pred_len: int = 30,
        features: List[str] = None,
        hidden_dims: List[int] = [64, 128, 128, 64],
        physics_weight: float = 0.1,  # 物理损失权重
        device: str = 'cpu'
    ):
        self.seq_len = seq_len
        self.pred_len = pred_len
        self.device = device
        self.physics_weight = physics_weight

        # 默认特征
        self.features = features or ['time', 'temperature', 'crack_width', 'vibration']
        self.input_dim = len(self.features)

        # 创建模型
        self.model = PINN(
            input_dim=self.input_dim,
            hidden_dims=hidden_dims,
            output_dim=1,
            activation='tanh'
        ).to(device)

        self.optimizer = None
        self.data_criterion = nn.MSELoss()
        self.physics_laws = PhysicsLaws()

    def prepare_data(self, point_id: str, conn) -> Dict:
        """
        准备训练/预测数据
        """
        # 查询多源数据
        query = """
        SELECT
            s.date,
            s.settlement,
            COALESCE(t.temperature, 0) as temperature,
            COALESCE(c.crack_width, 0) as crack_width,
            COALESCE(v.vibration_intensity, 0) as vibration
        FROM settlement_data s
        LEFT JOIN temperature_data t ON s.date = t.date AND s.point_id = t.point_id
        LEFT JOIN crack_data c ON s.date = c.date
        LEFT JOIN vibration_data v ON s.date = v.date
        WHERE s.point_id = %s
        ORDER BY s.date ASC
        """

        cursor = conn.cursor(dictionary=True)
        cursor.execute(query, (point_id,))
        data = cursor.fetchall()
        cursor.close()

        if len(data) < self.seq_len:
            raise ValueError(f"[错误] 数据不足: 需要至少{self.seq_len}天数据")

        # 转换为DataFrame
        df = pd.DataFrame(data)
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date')

        # 添加时间特征(归一化天数)
        df['time'] = (df['date'] - df['date'].min()).dt.days / 365.0

        # 归一化
        from sklearn.preprocessing import StandardScaler
        scaler_features = StandardScaler()
        scaler_target = StandardScaler()

        df[self.features] = scaler_features.fit_transform(df[self.features])
        df[['settlement']] = scaler_target.fit_transform(df[['settlement']])

        return {
            'data': df,
            'scaler_features': scaler_features,
            'scaler_target': scaler_target,
            'point_id': point_id
        }

    def compute_physics_loss(self, x, y_pred):
        """
        计算物理损失

        Args:
            x: 输入特征 (batch, input_dim)
            y_pred: 预测沉降 (batch, 1)

        Returns:
            physics_loss: 物理约束损失
        """
        # 提取时间特征
        time = x[:, 0:1]  # 假设第一列是时间
        time.requires_grad = True

        # 重新计算预测(用于自动微分)
        y_pred_grad = self.model(x)

        # 1. Terzaghi固结方程残差
        terzaghi_residual = self.physics_laws.terzaghi_consolidation(
            y_pred_grad, time, cv=1.0, H=10.0
        )
        terzaghi_loss = torch.mean(terzaghi_residual ** 2)

        # 2. 沉降速率约束
        rate_penalty = self.physics_laws.settlement_rate_constraint(
            y_pred_grad, time, max_rate=0.01
        )
        rate_loss = torch.mean(rate_penalty ** 2)

        # 3. 单调性约束
        monotonicity_penalty = self.physics_laws.monotonicity_constraint(y_pred_grad)
        monotonicity_loss = torch.mean(monotonicity_penalty ** 2)

        # 总物理损失
        physics_loss = terzaghi_loss + 0.5 * rate_loss + 0.3 * monotonicity_loss

        return physics_loss

    def train(self, train_data: Dict, val_data: Dict = None, epochs: int = 100, lr: float = 0.001):
        """
        训练模型
        """
        self.model.train()
        self.optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)

        df = train_data['data']

        # 准备训练数据
        X = df[self.features].values
        y = df['settlement'].values.reshape(-1, 1)

        X_tensor = torch.FloatTensor(X).to(self.device)
        y_tensor = torch.FloatTensor(y).to(self.device)

        best_loss = float('inf')
        patience = 15
        patience_counter = 0

        for epoch in range(epochs):
            self.optimizer.zero_grad()

            # 前向传播
            y_pred = self.model(X_tensor)

            # 数据损失
            data_loss = self.data_criterion(y_pred, y_tensor)

            # 物理损失
            physics_loss = self.compute_physics_loss(X_tensor, y_pred)

            # 总损失
            total_loss = data_loss + self.physics_weight * physics_loss

            # 反向传播
            total_loss.backward()
            self.optimizer.step()

            if (epoch + 1) % 10 == 0:
                print(f"Epoch {epoch+1}/{epochs}, "
                      f"Data Loss: {data_loss.item():.6f}, "
                      f"Physics Loss: {physics_loss.item():.6f}, "
                      f"Total Loss: {total_loss.item():.6f}")

            # 早停
            if total_loss.item() < best_loss:
                best_loss = total_loss.item()
                patience_counter = 0
            else:
                patience_counter += 1
                if patience_counter >= patience:
                    print(f"[成功] Early stopping at epoch {epoch+1}")
                    break

    def predict(self, input_data: Dict) -> Dict:
        """
        预测未来沉降
        """
        self.model.eval()

        df = input_data['data']
        scaler_features = input_data['scaler_features']
        scaler_target = input_data['scaler_target']

        # 使用最后一个时间点作为起点
        last_time = df['time'].iloc[-1]
        last_features = df[self.features].iloc[-1].values

        predictions = []
        pred_dates = []

        # 逐步预测
        current_features = last_features.copy()

        for i in range(self.pred_len):
            # 更新时间
            current_features[0] = last_time + (i + 1) / 365.0

            # 预测
            x = torch.FloatTensor(current_features).unsqueeze(0).to(self.device)

            with torch.no_grad():
                pred = self.model(x)
                pred_value = pred.item()

            predictions.append(pred_value)

            # 生成日期
            pred_date = df['date'].iloc[-1] + pd.Timedelta(days=i+1)
            pred_dates.append(pred_date)

        # 反归一化
        predictions_array = np.array(predictions).reshape(-1, 1)
        predictions_denorm = scaler_target.inverse_transform(predictions_array).flatten()

        return {
            'success': True,
            'model': 'pinn',
            'point_id': input_data['point_id'],
            'predictions': predictions_denorm.tolist(),
            'dates': [d.strftime('%Y-%m-%d') for d in pred_dates],
            'confidence_interval': self._calculate_confidence_interval(predictions_denorm),
            'metrics': {
                'model_type': 'PINN',
                'seq_len': self.seq_len,
                'pred_len': self.pred_len,
                'physics_weight': self.physics_weight,
                'features': self.features
            }
        }

    def _calculate_confidence_interval(self, predictions: np.ndarray, confidence: float = 0.95) -> Dict:
        """
        计算置信区间
        """
        std = np.std(predictions)
        z_score = 1.96  # 95% confidence

        lower = predictions - z_score * std
        upper = predictions + z_score * std

        return {
            'lower': lower.tolist(),
            'upper': upper.tolist(),
            'confidence': confidence
        }

    def evaluate(self, test_data: Dict) -> Dict:
        """
        评估模型性能
        """
        self.model.eval()

        df = test_data['data']
        scaler_target = test_data['scaler_target']

        X = df[self.features].values
        y = df['settlement'].values

        X_tensor = torch.FloatTensor(X).to(self.device)

        with torch.no_grad():
            y_pred = self.model(X_tensor).cpu().numpy().flatten()

        # 反归一化
        y_pred_denorm = scaler_target.inverse_transform(y_pred.reshape(-1, 1)).flatten()
        y_denorm = scaler_target.inverse_transform(y.reshape(-1, 1)).flatten()

        # 计算指标
        mae = np.mean(np.abs(y_pred_denorm - y_denorm))
        rmse = np.sqrt(np.mean((y_pred_denorm - y_denorm) ** 2))
        mape = np.mean(np.abs((y_pred_denorm - y_denorm) / (y_denorm + 1e-8))) * 100

        return {
            'MAE': float(mae),
            'RMSE': float(rmse),
            'MAPE': float(mape)
        }


# 使用示例
if __name__ == '__main__':
    # 创建预测器
    predictor = PINNPredictor(
        seq_len=60,
        pred_len=30,
        features=['time', 'temperature', 'crack_width', 'vibration'],
        hidden_dims=[64, 128, 128, 64],
        physics_weight=0.1
    )

    print("[成功] PINN模型创建成功!")
    print(f"[成功] 模型参数数量: {sum(p.numel() for p in predictor.model.parameters())}")
