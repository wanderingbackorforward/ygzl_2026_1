# 温度预测模型训练报告

**生成时间**: 2026-06-20 15:54:23
**训练环境**: cuda (PyTorch 2.6.0+cu124)
**数据来源**: Supabase (dt-terrain-settlement-dev)
**数据规模**: 244 个传感器, 时间跨度 2024-08-10 ~ 2024-08-29 (20 天, 日频)
**训练样本数**: 1423
**训练耗时**: 93.4 秒

## 模型架构

**多任务 Informer (Multi-Task Informer)**:
- 共享 Transformer 主干 (d_model=64, 2层编码器, 1层解码器, 4头注意力)
- 传感器 ID 嵌入 (n_sensors × 16维) 做个性化适配
- 输入: 6 天历史 [avg/min/max/std/range 5个特征 + 传感器嵌入]
- 输出: 2 天预测 (avg_temperature)
- 参数总量: ~50K (小而精)

## 训练策略

- 优化器: Adam (lr=0.001, weight_decay=1e-4) + CosineAnnealing
- 损失: MSE
- 梯度裁剪: 1.0
- Epochs: 100, Batch Size: 32

## 评估指标

| 指标 | 值 | 单位 |
|------|------|------|
| **MAE** | **0.1029** | °C |
| **RMSE** | **0.3159** | °C |
| **MAPE** | 0.45 | % |

## 与沉降模型对比

| 模块 | 数据点 | 最佳 MAE | 相对误差 |
|------|--------|----------|----------|
| 沉降预测 (STGCN) | 1300 | 0.338 mm | ~1% (相对 30mm 量程) |
| **温度预测 (本模型)** | 3175 | **0.1029 °C** | ~0.42% (相对 24.6°C 均值) |

## 部署

- 权重: `trained_models/temperature_best.pth`
- 推理模块: `dl_inference.py` 的 `predict_temperature(sid, steps)` 函数
- API 端点: `GET /api/ml/dl/predict/temperature/<sid>?steps=N`
- 前端: 温度监测页 → AI 预测

## 文件清单

```
backend/modules/ml_models/trained_models/
├── temperature_best.pth        # 权重
├── temperature_config.json     # 配置
└── temperature_metrics.json    # 指标
```
