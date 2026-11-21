# -*- coding: utf-8 -*-
"""
Ensemble Learning: 集成学习预测器
整合多个模型(ARIMA, Informer, STGCN, PINN)的预测结果,提升鲁棒性和精度

核心方法:
1. Stacking - 元学习器整合基学习器
2. Weighted Average - 加权平均
3. Voting - 投票机制

优势:
- 降低单一模型的过拟合风险
- 提升预测稳定性
- 综合多种模型的优势
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor
import warnings
warnings.filterwarnings('ignore')

# 导入基础预测器
try:
    from .time_series_predictor import TimeSeriesPredictor
    ARIMA_AVAILABLE = True
except:
    ARIMA_AVAILABLE = False

try:
    from .informer_predictor import InformerPredictor
    INFORMER_AVAILABLE = True
except:
    INFORMER_AVAILABLE = False

try:
    from .stgcn_predictor import STGCNPredictor
    STGCN_AVAILABLE = True
except:
    STGCN_AVAILABLE = False

try:
    from .pinn_predictor import PINNPredictor
    PINN_AVAILABLE = True
except:
    PINN_AVAILABLE = False


class EnsemblePredictor:
    """
    集成学习预测器 - 整合多个模型的预测结果
    """

    def __init__(
        self,
        method: str = 'stacking',  # stacking, weighted_average, voting
        base_models: List[str] = None,  # 基础模型列表
        meta_learner: str = 'ridge',  # 元学习器类型
        device: str = 'cpu'
    ):
        self.method = method
        self.device = device
        self.meta_learner_type = meta_learner

        # 默认使用所有可用模型
        if base_models is None:
            base_models = []
            if ARIMA_AVAILABLE:
                base_models.append('arima')
            if INFORMER_AVAILABLE:
                base_models.append('informer')
            if STGCN_AVAILABLE:
                base_models.append('stgcn')
            if PINN_AVAILABLE:
                base_models.append('pinn')

        self.base_models = base_models
        self.predictors = {}
        self.meta_learner = None
        self.model_weights = None

        # 初始化基础预测器
        self._initialize_predictors()

    def _initialize_predictors(self):
        """初始化基础预测器"""
        for model_name in self.base_models:
            if model_name == 'arima' and ARIMA_AVAILABLE:
                self.predictors['arima'] = TimeSeriesPredictor()
            elif model_name == 'informer' and INFORMER_AVAILABLE:
                self.predictors['informer'] = InformerPredictor(device=self.device)
            elif model_name == 'stgcn' and STGCN_AVAILABLE:
                self.predictors['stgcn'] = STGCNPredictor(device=self.device)
            elif model_name == 'pinn' and PINN_AVAILABLE:
                self.predictors['pinn'] = PINNPredictor(device=self.device)

        print(f"[成功] 初始化了 {len(self.predictors)} 个基础预测器: {list(self.predictors.keys())}")

    def train(self, train_data: Dict, val_data: Dict = None):
        """
        训练集成模型

        Args:
            train_data: 训练数据
            val_data: 验证数据(用于训练元学习器)
        """
        print("[成功] 开始训练基础模型...")

        # 1. 训练所有基础模型
        base_predictions = {}

        for model_name, predictor in self.predictors.items():
            print(f"[成功] 训练 {model_name} 模型...")

            try:
                if model_name in ['informer', 'stgcn', 'pinn']:
                    # 深度学习模型
                    predictor.train(train_data, val_data, epochs=50)
                else:
                    # 传统模型(ARIMA不需要显式训练)
                    pass

                # 获取训练集预测(用于训练元学习器)
                if val_data is not None:
                    pred_result = predictor.predict(val_data)
                    base_predictions[model_name] = pred_result.get('predictions', [])

            except Exception as e:
                print(f"[警告] {model_name} 训练失败: {e}")
                continue

        # 2. 训练元学习器(仅Stacking方法)
        if self.method == 'stacking' and val_data is not None:
            self._train_meta_learner(base_predictions, val_data)

        # 3. 计算模型权重(加权平均方法)
        elif self.method == 'weighted_average' and val_data is not None:
            self._calculate_weights(base_predictions, val_data)

        print("[成功] 集成模型训练完成!")

    def _train_meta_learner(self, base_predictions: Dict, val_data: Dict):
        """
        训练元学习器(Stacking)

        Args:
            base_predictions: 基础模型在验证集上的预测
            val_data: 验证集真实值
        """
        print("[成功] 训练元学习器...")

        # 准备元学习器的输入
        X_meta = []
        for model_name in sorted(base_predictions.keys()):
            preds = base_predictions[model_name]
            X_meta.append(preds)

        X_meta = np.array(X_meta).T  # (n_samples, n_models)

        # 真实值
        y_meta = val_data['data']['settlement'].values

        # 创建元学习器
        if self.meta_learner_type == 'ridge':
            self.meta_learner = Ridge(alpha=1.0)
        elif self.meta_learner_type == 'rf':
            self.meta_learner = RandomForestRegressor(n_estimators=100, random_state=42)
        else:
            self.meta_learner = Ridge(alpha=1.0)

        # 训练
        self.meta_learner.fit(X_meta, y_meta)

        print(f"[成功] 元学习器训练完成 (类型: {self.meta_learner_type})")

    def _calculate_weights(self, base_predictions: Dict, val_data: Dict):
        """
        计算模型权重(加权平均)

        基于验证集性能计算权重: weight_i = 1 / MAE_i
        """
        print("[成功] 计算模型权重...")

        y_true = val_data['data']['settlement'].values
        weights = {}
        total_inverse_mae = 0

        for model_name, preds in base_predictions.items():
            mae = np.mean(np.abs(np.array(preds) - y_true))
            inverse_mae = 1.0 / (mae + 1e-8)
            weights[model_name] = inverse_mae
            total_inverse_mae += inverse_mae

        # 归一化权重
        self.model_weights = {k: v / total_inverse_mae for k, v in weights.items()}

        print(f"[成功] 模型权重: {self.model_weights}")

    def predict(self, input_data: Dict) -> Dict:
        """
        集成预测

        Args:
            input_data: 输入数据

        Returns:
            预测结果
        """
        # 1. 获取所有基础模型的预测
        base_predictions = {}
        pred_dates = None

        for model_name, predictor in self.predictors.items():
            try:
                result = predictor.predict(input_data)

                if result.get('success'):
                    base_predictions[model_name] = np.array(result['predictions'])

                    if pred_dates is None:
                        pred_dates = result.get('dates', [])

            except Exception as e:
                print(f"[警告] {model_name} 预测失败: {e}")
                continue

        if len(base_predictions) == 0:
            return {
                'success': False,
                'message': '[错误] 所有基础模型预测失败'
            }

        # 2. 集成预测
        if self.method == 'stacking' and self.meta_learner is not None:
            final_predictions = self._stacking_predict(base_predictions)

        elif self.method == 'weighted_average' and self.model_weights is not None:
            final_predictions = self._weighted_average_predict(base_predictions)

        else:
            # 默认: 简单平均
            final_predictions = self._simple_average_predict(base_predictions)

        # 3. 计算置信区间
        confidence_interval = self._calculate_ensemble_confidence(base_predictions)

        return {
            'success': True,
            'model': 'ensemble',
            'method': self.method,
            'base_models': list(base_predictions.keys()),
            'predictions': final_predictions.tolist(),
            'dates': pred_dates,
            'confidence_interval': confidence_interval,
            'base_predictions': {k: v.tolist() for k, v in base_predictions.items()},
            'model_weights': self.model_weights,
            'metrics': {
                'model_type': 'Ensemble',
                'method': self.method,
                'n_base_models': len(base_predictions)
            }
        }

    def _stacking_predict(self, base_predictions: Dict) -> np.ndarray:
        """Stacking预测"""
        X_meta = []
        for model_name in sorted(base_predictions.keys()):
            X_meta.append(base_predictions[model_name])

        X_meta = np.array(X_meta).T  # (n_samples, n_models)

        final_predictions = self.meta_learner.predict(X_meta)

        return final_predictions

    def _weighted_average_predict(self, base_predictions: Dict) -> np.ndarray:
        """加权平均预测"""
        final_predictions = np.zeros(len(next(iter(base_predictions.values()))))

        for model_name, preds in base_predictions.items():
            weight = self.model_weights.get(model_name, 1.0 / len(base_predictions))
            final_predictions += weight * preds

        return final_predictions

    def _simple_average_predict(self, base_predictions: Dict) -> np.ndarray:
        """简单平均预测"""
        all_preds = np.array(list(base_predictions.values()))
        final_predictions = np.mean(all_preds, axis=0)

        return final_predictions

    def _calculate_ensemble_confidence(self, base_predictions: Dict) -> Dict:
        """
        计算集成模型的置信区间

        使用基础模型预测的标准差作为不确定性度量
        """
        all_preds = np.array(list(base_predictions.values()))

        # 计算均值和标准差
        mean_preds = np.mean(all_preds, axis=0)
        std_preds = np.std(all_preds, axis=0)

        # 95%置信区间
        z_score = 1.96
        lower = mean_preds - z_score * std_preds
        upper = mean_preds + z_score * std_preds

        return {
            'lower': lower.tolist(),
            'upper': upper.tolist(),
            'confidence': 0.95,
            'std': std_preds.tolist()
        }

    def evaluate(self, test_data: Dict) -> Dict:
        """
        评估集成模型性能
        """
        # 获取预测
        result = self.predict(test_data)

        if not result['success']:
            return {'success': False, 'message': '[错误] 预测失败'}

        predictions = np.array(result['predictions'])
        y_true = test_data['data']['settlement'].values

        # 计算指标
        mae = np.mean(np.abs(predictions - y_true))
        rmse = np.sqrt(np.mean((predictions - y_true) ** 2))
        mape = np.mean(np.abs((predictions - y_true) / (y_true + 1e-8))) * 100

        # 对比基础模型
        base_metrics = {}
        for model_name, base_preds in result.get('base_predictions', {}).items():
            base_preds = np.array(base_preds)
            base_mae = np.mean(np.abs(base_preds - y_true))
            base_metrics[model_name] = {'MAE': float(base_mae)}

        return {
            'success': True,
            'ensemble_metrics': {
                'MAE': float(mae),
                'RMSE': float(rmse),
                'MAPE': float(mape)
            },
            'base_model_metrics': base_metrics,
            'improvement': self._calculate_improvement(mae, base_metrics)
        }

    def _calculate_improvement(self, ensemble_mae: float, base_metrics: Dict) -> Dict:
        """计算集成模型相对于基础模型的提升"""
        improvements = {}

        for model_name, metrics in base_metrics.items():
            base_mae = metrics['MAE']
            improvement = (base_mae - ensemble_mae) / base_mae * 100
            improvements[model_name] = f"{improvement:.2f}%"

        return improvements


# 使用示例
if __name__ == '__main__':
    # 创建集成预测器
    predictor = EnsemblePredictor(
        method='stacking',
        base_models=['arima', 'informer', 'pinn'],
        meta_learner='ridge'
    )

    print("[成功] Ensemble模型创建成功!")
    print(f"[成功] 基础模型: {predictor.base_models}")
    print(f"[成功] 集成方法: {predictor.method}")
