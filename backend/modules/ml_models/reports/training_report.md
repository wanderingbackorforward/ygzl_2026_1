# 深度学习模型训练评估报告 (第二轮调优)

**生成时间**: 2026-06-20 05:35:11
**训练环境**: cuda (PyTorch 2.6.0+cu124)
**数据来源**: Supabase (dt-terrain-settlement-dev)
**数据规模**: 25 个监测点, 每点 52 周沉降记录

## 模型性能对比 (第二轮)

| 模型 | MAE (mm) | RMSE (mm) | MAPE (%) | 版本 |
|------|----------|-----------|----------|------|
| INFORMER | 0.3291 | 0.4533 | 47.62 | v2调优 |
| STGCN | 0.3381 | 0.4452 | 39.86 | v1(未变) |
| PINN | 0.9690 | 1.1694 | 127.94 | v2调优 |

## 调优说明

### Informer v2
- 新增: CosineAnnealing 学习率调度 (0.001 -> 1e-5)
- 新增: 权重衰减 (1e-4) + 梯度裁剪 (1.0)
- 调整: epochs 80 -> 150, dropout 0.1 -> 0.15
- v1 MAE: 0.5054 -> v2 MAE: 0.3291

### PINN v2
- 关键: 物理损失权重 0.1 -> 0.01 (让数据拟合主导)
- 新增: 更深网络 [128,256,256,128,64] + CosineLR + 梯度裁剪
- 调整: epochs 200 -> 400, LR 0.001 -> 0.0005
- v1 MAE: 0.9686 -> v2 MAE: 0.9690

### STGCN
- 保持第一轮结果 (MAE=0.3381, 已最优)

## 最佳模型: INFORMER (MAE = 0.3291 mm)

## API 端点
- `GET /api/ml/dl/status` - 查询模型状态
- `GET /api/ml/dl/predict/informer/<point_id>` - Informer 预测
- `GET /api/ml/dl/predict/stgcn` - STGCN 多点预测
- `GET /api/ml/dl/predict/pinn/<point_id>` - PINN 预测
