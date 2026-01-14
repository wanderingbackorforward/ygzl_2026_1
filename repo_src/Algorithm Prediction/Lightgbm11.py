import pandas as pd
import numpy as np
from imblearn.over_sampling import SMOTE
from lightgbm import LGBMClassifier
from sklearn.metrics import roc_auc_score, roc_curve, accuracy_score, recall_score
from sklearn.model_selection import train_test_split, KFold
from hyperopt import hp, fmin, tpe, Trials, STATUS_OK
from hyperopt.pyll.base import scope
import matplotlib.pyplot as plt
import seaborn as sns
import random
from sklearn.metrics import confusion_matrix# 计算混淆矩阵
# 设置全局随机种子
random.seed(0)
np.random.seed(0)


# 导入数据
dataset = pd.read_excel("./DATA1/all0730.xlsx")
X = dataset.iloc[:, 0:17].values
y = dataset.iloc[:, 17].values

# 先拆分数据集，再对训练集应用 SMOTE
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=0)
smote = SMOTE(random_state=0)
X_train_resampled, y_train_resampled = smote.fit_resample(X_train, y_train)

# 获取特征名
feature_names = dataset.columns[:17].tolist()


# 定义模型评估函数（用于 Hyperopt）
def objective(params):
    params['max_depth'] = int(params['max_depth'])
    params['num_leaves'] = int(params['num_leaves'])
    n_estimators = int(params['num_boost_round'])

    model = LGBMClassifier(
        objective='binary',
        learning_rate=params['learning_rate'],
        max_depth=params['max_depth'],
        num_leaves=params['num_leaves'],
        n_estimators=n_estimators,
        subsample=params['subsample'],
        colsample_bytree=params['colsample_bytree'],
        min_child_weight=params['min_child_weight'],
        reg_alpha=params['reg_alpha'],
        reg_lambda=params['reg_lambda'],
        seed=0
    )
    model.fit(X_train_resampled, y_train_resampled)
    preds = model.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, preds)
    return {'loss': -auc, 'status': STATUS_OK}


# 定义搜索空间
space = {
    'learning_rate': hp.uniform('learning_rate', 0.01, 0.2),
    'max_depth': scope.int(hp.quniform('max_depth', 2, 20, 1)),
    'num_leaves': scope.int(hp.quniform('num_leaves', 20, 150, 1)),
    'num_boost_round': scope.int(hp.quniform('num_boost_round', 100, 1000, 1)),
    'subsample': hp.uniform('subsample', 0.3, 1.0),
    'colsample_bytree': hp.uniform('colsample_bytree', 0.3, 1.0),
    'min_child_weight': hp.uniform('min_child_weight', 0.1, 10),
    'reg_alpha': hp.uniform('reg_alpha', 0.0, 1.0),
    'reg_lambda': hp.uniform('reg_lambda', 0.0, 1.0),
}

# 运行优化
trials = Trials()
best = fmin(fn=objective, space=space, algo=tpe.suggest, max_evals=10, trials=trials, rstate=np.random.default_rng(0))

# 使用最优参数
best_params = {k: v for k, v in best.items() if k != 'num_boost_round'}
best_params['max_depth'] = int(best_params['max_depth'])
best_params['num_leaves'] = int(best_params['num_leaves'])

# --- 新增 K-Fold Cross-Validation ---
print("开始 K 折交叉验证...")
kf = KFold(n_splits=5, shuffle=True, random_state=0)

# 存储每个折的评估结果
auc_scores = []
accuracy_scores = []

for fold, (train_index, val_index) in enumerate(kf.split(X_train_resampled), 1):
    X_train_fold, X_val_fold = X_train_resampled[train_index], X_train_resampled[val_index]
    y_train_fold, y_val_fold = y_train_resampled[train_index], y_train_resampled[val_index]

    # 使用最优参数训练模型
    model = LGBMClassifier(
        objective='binary',
        n_estimators=int(best['num_boost_round']),
        **best_params,
        seed=0
    )
    model.fit(X_train_fold, y_train_fold)

    # 预测验证集
    val_preds_proba = model.predict_proba(X_val_fold)[:, 1]
    val_preds = (val_preds_proba >= 0.5).astype(int)

    # 计算评估指标
    auc = roc_auc_score(y_val_fold, val_preds_proba)
    accuracy = accuracy_score(y_val_fold, val_preds)

    auc_scores.append(auc)
    accuracy_scores.append(accuracy)

    print(f"Fold {fold} - AUC: {auc:.4f}, Accuracy: {accuracy:.4f}")

# 输出交叉验证的平均结果
print("\n交叉验证结果：")
print(f"平均 AUC: {np.mean(auc_scores):.4f} (±{np.std(auc_scores):.4f})")
print(f"平均准确率: {np.mean(accuracy_scores):.4f} (±{np.std(accuracy_scores):.4f})")

# --- 训练最终模型 ---
final_model = LGBMClassifier(
    objective='binary',
    n_estimators=int(best['num_boost_round']),
    **best_params,
    seed=0
)

# 训练模型并记录评估结果
final_model.fit(
    X_train_resampled,
    y_train_resampled,
    eval_set=[(X_train_resampled, y_train_resampled), (X_test, y_test)],
    eval_metric='binary_logloss',
    verbose=0
)
evals_result = final_model.evals_result_

print("\n使用的参数：", {**best_params, 'n_estimators': int(best['num_boost_round'])})

# 输出特征重要性
feature_importance = pd.DataFrame({
    'Feature': feature_names,
    'Importance': final_model.feature_importances_
}).sort_values('Importance', ascending=False)

# 计算归一化特征重要性
feature_importance['Normalized Importance'] = feature_importance['Importance'] / feature_importance['Importance'].sum()

# 保存到 Excel
feature_importance.to_excel('./DATA1/0730.xlsx', index=False)

# 可视化特征重要性
plt.figure(figsize=(10, 6))
sns.barplot(x='Importance', y='Feature', data=feature_importance)
plt.title('Feature Importance')
plt.show()

# 预测和评估
test_preds_proba = final_model.predict_proba(X_test)[:, 1]
test_preds = (test_preds_proba >= 0.5).astype(int)

auc_score = roc_auc_score(y_test, test_preds_proba)
accuracy = accuracy_score(y_test, test_preds)
recall = recall_score(y_test, test_preds)
print("测试集 AUC：", auc_score)
print("测试集准确率：", accuracy)
print("测试集召回率：", recall)  # 输出召回率


# 输出训练集上的准确率
train_preds_proba = final_model.predict_proba(X_train_resampled)[:, 1]
train_preds_binary = (train_preds_proba >= 0.5).astype(int)
train_accuracy = accuracy_score(y_train_resampled, train_preds_binary)
print("训练集上的准确率：", train_accuracy)

# 生成并保存 ROC 曲线数据
fpr, tpr, thresholds = roc_curve(y_test, test_preds_proba)
# 绘制ROC曲线
plt.figure(figsize=(8, 6))
plt.plot(fpr, tpr, color='blue', label=f'ROC curve (AUC = {auc_score:.4f})')
plt.plot([0, 1], [0, 1], color='red', linestyle='--')  # 随机猜测的对角线
plt.xlabel('False Positive Rate')
plt.ylabel('True Positive Rate')
plt.title('Receiver Operating Characteristic (ROC) Curve')
plt.legend(loc='lower right')
plt.grid(True)
plt.savefig('./DATA1/ROC_Curve.png')  # 导出ROC曲线图
plt.show()

roc_data = pd.DataFrame({'False Positive Rate': fpr, 'True Positive Rate': tpr, 'Thresholds': thresholds})
roc_data.to_excel('./DATA1/ROC_Curve_Data1.xlsx', index=False)

# 绘制学习曲线
plt.figure(figsize=(10, 6))
plt.plot(evals_result['training']['binary_logloss'], label='Train Logloss')
plt.plot(evals_result['valid_1']['binary_logloss'], label='Validation Logloss')
plt.xlabel('Boosting Rounds')
plt.ylabel('Logloss')
plt.title('Learning Curve')
plt.legend()
plt.show()

# 导入混淆矩阵函数

cm = confusion_matrix(y_test, test_preds)# 绘制混淆矩阵
plt.figure(figsize=(8, 6))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=['Class 0', 'Class 1'], yticklabels=['Class 0', 'Class 1'])
plt.xlabel('Predicted')
plt.ylabel('Actual')
plt.title('Confusion Matrix')
plt.show()

# 从混淆矩阵中提取 TP, TN, FP, FN
TN, FP, FN, TP = cm.ravel()

# 计算特异度
specificity = TN / (TN + FP) if (TN + FP) > 0 else 0

# 计算 MCC
denominator = np.sqrt((TP + FP) * (TP + FN) * (TN + FP) * (TN + FN))
mcc = (TP * TN - FP * FN) / denominator if denominator > 0 else 0

# 输出结果
print("测试集特异度：", specificity)
print("测试集MCC：", mcc)