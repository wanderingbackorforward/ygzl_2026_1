# -*- coding: utf-8 -*-
"""
Informer: 基于Transformer的长序列时间序列预测模型
论文: "Informer: Beyond Efficient Transformer for Long Sequence Time-Series Forecasting" (AAAI 2021)

核心创新:
1. ProbSparse Self-Attention - 降低计算复杂度从O(L²)到O(L log L)
2. Self-Attention Distilling - 减少网络层数
3. Generative Style Decoder - 一次性生成长序列预测

应用场景: 地铁沉降长期预测(30-90天)
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
import math


class PositionalEncoding(nn.Module):
    """
    位置编码 - 为序列添加位置信息
    """
    def __init__(self, d_model: int, max_len: int = 5000):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))

        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        pe = pe.unsqueeze(0)
        self.register_buffer('pe', pe)

    def forward(self, x):
        return x + self.pe[:, :x.size(1)]


class ProbAttention(nn.Module):
    """
    ProbSparse Self-Attention
    核心思想: 只计算最重要的Q-K对,降低计算复杂度
    """
    def __init__(self, d_model: int, n_heads: int, factor: int = 5):
        super().__init__()
        self.d_model = d_model
        self.n_heads = n_heads
        self.d_k = d_model // n_heads
        self.factor = factor

        self.query_projection = nn.Linear(d_model, d_model)
        self.key_projection = nn.Linear(d_model, d_model)
        self.value_projection = nn.Linear(d_model, d_model)
        self.out_projection = nn.Linear(d_model, d_model)

    def forward(self, queries, keys, values, attn_mask=None):
        B, L, _ = queries.shape
        _, S, _ = keys.shape
        H = self.n_heads

        # 投影
        queries = self.query_projection(queries).view(B, L, H, self.d_k)
        keys = self.key_projection(keys).view(B, S, H, self.d_k)
        values = self.value_projection(values).view(B, S, H, self.d_k)

        # ProbSparse采样
        U_part = self.factor * np.ceil(np.log(S)).astype('int').item()
        u = min(U_part, L)

        # 计算采样的Q-K分数
        queries_sample = queries[:, torch.randperm(L)[:u], :, :]
        scores_sample = torch.einsum("blhd,bshd->bhls", queries_sample, keys)

        # 找到Top-k个最重要的查询
        M = scores_sample.max(-1)[0] - torch.div(scores_sample.sum(-1), S)
        M_top = M.topk(u, sorted=False)[1]

        # 计算注意力
        queries_reduce = queries[torch.arange(B)[:, None, None], M_top, :, :]
        scores = torch.einsum("blhd,bshd->bhls", queries_reduce, keys)

        if attn_mask is not None:
            scores = scores.masked_fill(attn_mask, -1e9)

        attn = F.softmax(scores, dim=-1)
        context = torch.einsum("bhls,bshd->blhd", attn, values)

        # 输出投影
        context = context.contiguous().view(B, u, self.d_model)
        output = self.out_projection(context)

        return output, attn


class InformerEncoderLayer(nn.Module):
    """
    Informer编码器层
    """
    def __init__(self, d_model: int, n_heads: int, d_ff: int, dropout: float = 0.1):
        super().__init__()
        self.attention = ProbAttention(d_model, n_heads)
        self.conv1 = nn.Conv1d(d_model, d_ff, kernel_size=1)
        self.conv2 = nn.Conv1d(d_ff, d_model, kernel_size=1)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x, attn_mask=None):
        # Self-Attention
        new_x, attn = self.attention(x, x, x, attn_mask=attn_mask)
        x = x + self.dropout(new_x)
        x = self.norm1(x)

        # Feed-Forward
        y = x.transpose(1, 2)
        y = self.dropout(F.relu(self.conv1(y)))
        y = self.dropout(self.conv2(y))
        y = y.transpose(1, 2)

        return self.norm2(x + y), attn


class InformerDecoderLayer(nn.Module):
    """
    Informer解码器层
    """
    def __init__(self, d_model: int, n_heads: int, d_ff: int, dropout: float = 0.1):
        super().__init__()
        self.self_attention = ProbAttention(d_model, n_heads)
        self.cross_attention = ProbAttention(d_model, n_heads)
        self.conv1 = nn.Conv1d(d_model, d_ff, kernel_size=1)
        self.conv2 = nn.Conv1d(d_ff, d_model, kernel_size=1)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.norm3 = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x, cross, x_mask=None, cross_mask=None):
        # Self-Attention
        x = x + self.dropout(self.self_attention(x, x, x, attn_mask=x_mask)[0])
        x = self.norm1(x)

        # Cross-Attention
        x = x + self.dropout(self.cross_attention(x, cross, cross, attn_mask=cross_mask)[0])
        x = self.norm2(x)

        # Feed-Forward
        y = x.transpose(1, 2)
        y = self.dropout(F.relu(self.conv1(y)))
        y = self.dropout(self.conv2(y))
        y = y.transpose(1, 2)

        return self.norm3(x + y)


class Informer(nn.Module):
    """
    Informer完整模型
    """
    def __init__(
        self,
        enc_in: int,  # 编码器输入特征数
        dec_in: int,  # 解码器输入特征数
        c_out: int,  # 输出特征数
        seq_len: int,  # 输入序列长度
        label_len: int,  # 标签序列长度
        out_len: int,  # 输出序列长度
        d_model: int = 512,
        n_heads: int = 8,
        e_layers: int = 3,
        d_layers: int = 2,
        d_ff: int = 2048,
        dropout: float = 0.1,
    ):
        super().__init__()
        self.seq_len = seq_len
        self.label_len = label_len
        self.out_len = out_len

        # 编码器输入嵌入
        self.enc_embedding = nn.Linear(enc_in, d_model)
        self.enc_pos_encoding = PositionalEncoding(d_model)

        # 解码器输入嵌入
        self.dec_embedding = nn.Linear(dec_in, d_model)
        self.dec_pos_encoding = PositionalEncoding(d_model)

        # 编码器
        self.encoder = nn.ModuleList([
            InformerEncoderLayer(d_model, n_heads, d_ff, dropout)
            for _ in range(e_layers)
        ])

        # 解码器
        self.decoder = nn.ModuleList([
            InformerDecoderLayer(d_model, n_heads, d_ff, dropout)
            for _ in range(d_layers)
        ])

        # 输出投影
        self.projection = nn.Linear(d_model, c_out)

    def forward(self, x_enc, x_dec):
        """
        前向传播
        Args:
            x_enc: 编码器输入 (batch, seq_len, enc_in)
            x_dec: 解码器输入 (batch, label_len + out_len, dec_in)
        Returns:
            预测输出 (batch, out_len, c_out)
        """
        # 编码器
        enc_out = self.enc_embedding(x_enc)
        enc_out = self.enc_pos_encoding(enc_out)

        for layer in self.encoder:
            enc_out, _ = layer(enc_out)

        # 解码器
        dec_out = self.dec_embedding(x_dec)
        dec_out = self.dec_pos_encoding(dec_out)

        for layer in self.decoder:
            dec_out = layer(dec_out, enc_out)

        # 输出投影
        dec_out = self.projection(dec_out)

        return dec_out[:, -self.out_len:, :]  # 只返回预测部分


class InformerPredictor:
    """
    Informer预测器 - 用于沉降预测的高级接口
    """
    def __init__(
        self,
        seq_len: int = 60,  # 输入60天历史数据
        label_len: int = 30,  # 标签30天
        pred_len: int = 30,  # 预测30天
        features: List[str] = None,  # 特征列表
        device: str = 'cpu'
    ):
        self.seq_len = seq_len
        self.label_len = label_len
        self.pred_len = pred_len
        self.device = device

        # 默认特征: 沉降、温度、裂缝、振动
        self.features = features or ['settlement', 'temperature', 'crack_width', 'vibration']
        self.enc_in = len(self.features)
        self.dec_in = len(self.features)
        self.c_out = 1  # 只预测沉降

        # 创建模型
        self.model = Informer(
            enc_in=self.enc_in,
            dec_in=self.dec_in,
            c_out=self.c_out,
            seq_len=seq_len,
            label_len=label_len,
            out_len=pred_len,
            d_model=512,
            n_heads=8,
            e_layers=3,
            d_layers=2,
            d_ff=2048,
            dropout=0.1
        ).to(device)

        self.optimizer = None
        self.criterion = nn.MSELoss()

    def prepare_data(self, point_id: str, conn) -> Dict:
        """
        准备训练/预测数据
        """
        # 查询多源数据
        query = f"""
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

        if len(data) < self.seq_len + self.pred_len:
            raise ValueError(f"数据不足: 需要至少{self.seq_len + self.pred_len}天数据")

        # 转换为DataFrame
        df = pd.DataFrame(data)
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date')

        # 归一化
        from sklearn.preprocessing import StandardScaler
        scaler = StandardScaler()
        df[self.features] = scaler.fit_transform(df[self.features])

        return {
            'data': df,
            'scaler': scaler,
            'point_id': point_id
        }

    def train(self, train_data: Dict, val_data: Dict = None, epochs: int = 100, lr: float = 0.0001):
        """
        训练模型
        """
        self.model.train()
        self.optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)

        df = train_data['data']
        n_samples = len(df) - self.seq_len - self.pred_len + 1

        best_loss = float('inf')
        patience = 10
        patience_counter = 0

        for epoch in range(epochs):
            epoch_loss = 0
            for i in range(n_samples):
                # 准备输入
                x_enc = df[self.features].iloc[i:i+self.seq_len].values
                x_dec_start = df[self.features].iloc[i+self.seq_len-self.label_len:i+self.seq_len].values
                x_dec_end = np.zeros((self.pred_len, self.enc_in))
                x_dec = np.vstack([x_dec_start, x_dec_end])

                # 目标
                y = df['settlement'].iloc[i+self.seq_len:i+self.seq_len+self.pred_len].values

                # 转换为Tensor
                x_enc = torch.FloatTensor(x_enc).unsqueeze(0).to(self.device)
                x_dec = torch.FloatTensor(x_dec).unsqueeze(0).to(self.device)
                y = torch.FloatTensor(y).unsqueeze(0).unsqueeze(-1).to(self.device)

                # 前向传播
                self.optimizer.zero_grad()
                pred = self.model(x_enc, x_dec)
                loss = self.criterion(pred, y)

                # 反向传播
                loss.backward()
                self.optimizer.step()

                epoch_loss += loss.item()

            avg_loss = epoch_loss / n_samples
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
        预测未来沉降
        """
        self.model.eval()

        df = input_data['data']
        scaler = input_data['scaler']

        # 使用最后seq_len天数据作为输入
        x_enc = df[self.features].iloc[-self.seq_len:].values
        x_dec_start = df[self.features].iloc[-self.label_len:].values
        x_dec_end = np.zeros((self.pred_len, self.enc_in))
        x_dec = np.vstack([x_dec_start, x_dec_end])

        # 转换为Tensor
        x_enc = torch.FloatTensor(x_enc).unsqueeze(0).to(self.device)
        x_dec = torch.FloatTensor(x_dec).unsqueeze(0).to(self.device)

        # 预测
        with torch.no_grad():
            pred = self.model(x_enc, x_dec)
            pred = pred.squeeze().cpu().numpy()

        # 反归一化
        pred_full = np.zeros((self.pred_len, len(self.features)))
        pred_full[:, 0] = pred  # 沉降在第一列
        pred_denorm = scaler.inverse_transform(pred_full)[:, 0]

        # 生成日期
        last_date = df['date'].iloc[-1]
        pred_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=self.pred_len)

        return {
            'success': True,
            'model': 'informer',
            'point_id': input_data['point_id'],
            'predictions': pred_denorm.tolist(),
            'dates': pred_dates.strftime('%Y-%m-%d').tolist(),
            'confidence_interval': self._calculate_confidence_interval(pred_denorm),
            'metrics': {
                'model_type': 'Informer',
                'seq_len': self.seq_len,
                'pred_len': self.pred_len,
                'features': self.features
            }
        }

    def _calculate_confidence_interval(self, predictions: np.ndarray, confidence: float = 0.95) -> Dict:
        """
        计算置信区间(简化版)
        """
        std = np.std(predictions)
        z_score = 1.96  # 95%置信区间

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
        scaler = test_data['scaler']

        n_samples = len(df) - self.seq_len - self.pred_len + 1
        all_preds = []
        all_targets = []

        for i in range(n_samples):
            # 准备输入
            x_enc = df[self.features].iloc[i:i+self.seq_len].values
            x_dec_start = df[self.features].iloc[i+self.seq_len-self.label_len:i+self.seq_len].values
            x_dec_end = np.zeros((self.pred_len, self.enc_in))
            x_dec = np.vstack([x_dec_start, x_dec_end])

            # 目标
            y = df['settlement'].iloc[i+self.seq_len:i+self.seq_len+self.pred_len].values

            # 转换为Tensor
            x_enc = torch.FloatTensor(x_enc).unsqueeze(0).to(self.device)
            x_dec = torch.FloatTensor(x_dec).unsqueeze(0).to(self.device)

            # 预测
            with torch.no_grad():
                pred = self.model(x_enc, x_dec)
                pred = pred.squeeze().cpu().numpy()

            all_preds.append(pred)
            all_targets.append(y)

        # 反归一化
        all_preds = np.array(all_preds)
        all_targets = np.array(all_targets)

        # 计算指标
        mae = np.mean(np.abs(all_preds - all_targets))
        rmse = np.sqrt(np.mean((all_preds - all_targets) ** 2))
        mape = np.mean(np.abs((all_preds - all_targets) / (all_targets + 1e-8))) * 100

        return {
            'MAE': float(mae),
            'RMSE': float(rmse),
            'MAPE': float(mape)
        }


# 使用示例
if __name__ == '__main__':
    # 创建预测器
    predictor = InformerPredictor(
        seq_len=60,
        pred_len=30,
        features=['settlement', 'temperature', 'crack_width', 'vibration']
    )

    print("Informer模型创建成功!")
    print(f"模型参数数量: {sum(p.numel() for p in predictor.model.parameters())}")
