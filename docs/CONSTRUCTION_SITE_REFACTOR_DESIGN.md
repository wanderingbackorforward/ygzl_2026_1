# -*- coding: utf-8 -*-
# 地形沉降监测数字孪生系统重构方案

> **项目名称**: 地形沉降监测数字孪生系统
> **方案版本**: v2.0 - 实施完成版
> **创建日期**: 2026-01-17
> **更新日期**: 2026-01-18
> **实施状态**: [已完成] 核心功能实施完毕
> **核心理念**: 切中工程特点，架构驱动设计

---

## 实施进度总览

| 模块 | 状态 | 描述 |
|------|------|------|
| 数据库架构 | [已完成] | 6张核心表 + 3个视图 |
| 指标计算引擎 | [已完成] | 完整实现 5 种计算方法 |
| 预警规则系统 | [已完成] | 支持自动触发工单 |
| 快照管理 | [已完成] | 支持多种快照类型 |
| API 接口 | [已完成] | 40+ REST 端点 |
| 测试覆盖 | [已完成] | 24 个测试用例全部通过 |

---

## 1. 工程背景与问题定义

### 1.1 工程场景

```
+---------------------------------------------------------------+
|                工程施工现场数字孪生系统                      |
+---------------------------------------------------------------+
|                                                               |
|  +-------------------+      +---------------------+           |
|  |   监测感知层       |      |   数据处理层        |           |
|  |                   |      |                     |           |
|  | . 沉降监测点 S1-S50 | ---> | . 原始数据采集       |           |
|  | . 裂缝监测点 C1-C20 |      | . 工程指标计算       |           |
|  | . 温度传感器 T1-T10 |      | . 趋势分析           |           |
|  | . 振动监测点 V1-V5  |      | . 预警判定           |           |
|  +-------------------+      +---------------------+           |
|           |                       |                           |
|           v                       v                           |
|  +---------------------------------------------------------------+
|  |                 业务应用层                            |
|  |                                                       |
|  |  . 现场工程师  <--查看指标--  . 生成工单               |
|  |  . 技术负责人  <--分析趋势--  . 审批方案               |
|  |  . 项目经理    <--决策支持--  . 报告导出               |
|  +---------------------------------------------------------------+
+---------------------------------------------------------------+
```

### 1.2 核心问题（工程视角）

| 问题类别 | 当前痛点 | 工程影响 |
|---------|---------|---------|
| **数据可读性** | 原始数据混杂计算指标，现场人员难理解 | 延误决策时机 |
| **操作效率** | 查数据->记编号->切页面->填工单（4步操作） | 应急响应慢 |
| **责任追溯** | 数据来源不清，计算过程不透明 | 事故定责困难 |
| **历史回溯** | 无法查看"某一时刻"的数据状态 | 无法复现问题场景 |
| **网络依赖** | 完全依赖在线访问，现场信号差时无法使用 | 工作中断 |

---

## 2. 系统架构设计

### 2.1 三层数据分层架构 [已实施]

```
+-----------------------------------------------------------------------+
|                           数据分层架构                                  |
+-----------------------------------------------------------------------+
|                                                                       |
|  Layer 3: 业务决策层                                                   |
|  +------------------------------------------------------------------+ |
|  | tickets (工单表) | metric_snapshots (快照表) | alert_rules (规则) | |
|  +------------------------------------------------------------------+ |
|           ^                                                           |
|           | 触发                                                      |
|  Layer 2: 工程指标层 [已实施]                                           |
|  +------------------------------------------------------------------+ |
|  | engineering_metrics | metric_configs | v_points_alert_status      | |
|  | . 累计沉降量        | . 计算公式      | . 预警状态汇总              | |
|  | . 日变化率          | . 阈值配置      |                            | |
|  | . 趋势斜率          | . 更新频率      |                            | |
|  +------------------------------------------------------------------+ |
|           ^                                                           |
|           | 计算                                                      |
|  Layer 1: 原始数据层 [已实施]                                           |
|  +------------------------------------------------------------------+ |
|  | monitoring_points | raw_data | v_raw_data_stats                   | |
|  | . S01-S50         | . 传感器读数 | . 统计信息                      | |
|  | . C01-C20         | . 采集时间   |                                | |
|  | . T01-T10         | . 质量标识   |                                | |
|  +------------------------------------------------------------------+ |
|                                                                       |
+-----------------------------------------------------------------------+
```

### 2.2 指标计算引擎架构 [已实施]

```
+-----------------------------------------------------------------------+
|                       指标计算引擎架构                                  |
+-----------------------------------------------------------------------+
|                                                                       |
|   输入层                 计算层                  输出层               |
|      |                     |                        |                 |
|      v                     v                        v                 |
|  +--------+    +------------+    +------------+    +--------+         |
|  | raw_   | -> | Calculator | -> | Threshold  | -> | Result |         |
|  | data   |    |            |    | Evaluator  |    | Object |         |
|  +--------+    +------------+    +------------+    +--------+         |
|                     |                                  |               |
|                     v                                  v               |
|               +------------+                    +------------+         |
|               | metric_    |                    | Alert Rule |         |
|               | configs    |                    | Processor  |         |
|               +------------+                    +------------+         |
|                                                                       |
|   已实现计算方法:                                                      |
|   . difference  - 差值计算                                            |
|   . cumulative  - 累计计算                                            |
|   . average     - 移动平均                                            |
|   . regression  - 线性回归趋势                                         |
|   . rate        - 变化率计算                                          |
|   . custom      - 自定义公式                                          |
+-----------------------------------------------------------------------+
```

---

## 3. 已实施的数据库表结构

### 3.1 核心表清单

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `monitoring_points` | 监测点基础信息 | point_id, point_type, status, threshold_config |
| `raw_data` | 原始传感器读数 | point_id, measured_at, raw_value, quality_flag |
| `metric_configs` | 指标计算配置 | metric_type, calculation_method, thresholds |
| `engineering_metrics` | 计算后的工程指标 | point_id, metric_type, computed_value, threshold_status |
| `alert_rules` | 预警规则配置 | trigger_metric_type, condition_params, action_type |
| `metric_snapshots` | 数据状态快照 | snapshot_type, snapshot_data, ticket_id |

### 3.2 视图清单

| 视图名 | 用途 |
|--------|------|
| `v_points_with_latest_metrics` | 监测点与最新指标联合查询 |
| `v_points_alert_status` | 监测点预警状态汇总 |
| `v_raw_data_stats` | 原始数据统计信息 |

### 3.3 预置指标配置

| 指标类型 | 名称 | 计算方法 | 预警阈值 | 严重阈值 |
|---------|------|---------|---------|---------|
| cumulative_settlement | 累计沉降量 | cumulative | 20mm | 30mm |
| daily_settlement_rate | 日沉降速率 | difference | 2mm/day | 5mm/day |
| settlement_trend | 沉降趋势斜率 | regression | 1mm/day | 2mm/day |
| crack_width | 裂缝宽度 | difference | 0.3mm | 0.5mm |
| crack_growth_rate | 裂缝增长率 | difference | 0.1mm/day | 0.2mm/day |
| temperature_deviation | 温度偏差 | difference | 5C | 10C |
| peak_vibration | 峰值振动 | difference | 10mm/s | 25mm/s |

---

## 4. API 接口文档

### 4.1 监测点管理

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/metrics/points` | 获取监测点列表 |
| GET | `/api/metrics/points/<point_id>` | 获取监测点详情及最新指标 |
| POST | `/api/metrics/points` | 创建监测点 |
| PUT | `/api/metrics/points/<point_id>` | 更新监测点 |
| DELETE | `/api/metrics/points/<point_id>` | 删除监测点 |

### 4.2 原始数据管理

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/metrics/raw-data/<point_id>` | 获取原始数据 |
| POST | `/api/metrics/raw-data` | 创建原始数据 |
| POST | `/api/metrics/raw-data/batch` | 批量创建原始数据 |
| GET | `/api/metrics/raw-data/<point_id>/statistics` | 获取统计信息 |

### 4.3 工程指标

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/metrics/engineering/<point_id>` | 获取工程指标 |
| GET | `/api/metrics/engineering/<point_id>/latest` | 获取最新指标 |
| POST | `/api/metrics/engineering/<point_id>/calculate` | 计算指标 |
| POST | `/api/metrics/engineering/process-all` | 处理所有活跃点 |
| GET | `/api/metrics/engineering/alerts` | 获取预警列表 |

### 4.4 配置管理

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/metrics/configs` | 获取指标配置 |
| POST | `/api/metrics/configs` | 创建配置 |
| PUT | `/api/metrics/configs/<metric_type>` | 更新配置 |
| GET | `/api/metrics/alert-rules` | 获取预警规则 |
| POST | `/api/metrics/alert-rules` | 创建预警规则 |

### 4.5 快照管理

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/metrics/snapshots` | 获取快照列表 |
| POST | `/api/metrics/snapshots` | 创建快照 |
| GET | `/api/metrics/snapshots/ticket/<ticket_id>` | 获取工单关联快照 |

### 4.6 引擎控制

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/metrics/engine/status` | 获取引擎状态 |
| POST | `/api/metrics/engine/start` | 启动后台处理 |
| POST | `/api/metrics/engine/stop` | 停止后台处理 |

---

## 5. 代码结构

```
backend/modules/metrics_engine/
+-- __init__.py           # 模块入口
+-- calculator.py         # 核心计算逻辑 (MetricsCalculator)
+-- engine.py             # 引擎编排 (MetricsEngine)
+-- models.py             # 数据模型 (6个Model类)
+-- api.py                # REST API (metrics_bp Blueprint)

supabase/sql/
+-- 01_tickets.sql        # 工单表
+-- 02_users.sql          # 用户表
+-- 03_monitoring_points.sql  # [新增] 监测点与指标表

tests/
+-- test_metrics_engine.py    # [新增] 24个测试用例
```

---

## 6. 测试覆盖

### 6.1 测试类别

| 测试类 | 用例数 | 覆盖内容 |
|--------|--------|---------|
| TestMetricsCalculator | 13 | 各种计算方法、阈值评估 |
| TestCalculationResult | 1 | 结果对象属性 |
| TestMetricsEngineIntegration | 1 | 引擎初始化 |
| TestAPIEndpoints | 2 | API端点响应 |
| TestDataModels | 1 | 模型头部生成 |
| TestSQLSchema | 3 | SQL文件完整性 |
| TestEdgeCases | 3 | 边缘情况处理 |

### 6.2 运行测试

```bash
cd python_scripts
python -m pytest tests/test_metrics_engine.py -v
```

**结果**: 24 passed in 0.32s

---

## 7. 部署说明

### 7.1 数据库初始化

1. 登录 Supabase 控制台
2. 进入 SQL Editor
3. 依次执行:
   - `supabase/sql/01_tickets.sql`
   - `supabase/sql/02_users.sql`
   - `supabase/sql/03_monitoring_points.sql`

### 7.2 环境变量

```bash
# .env 文件
DB_VENDOR=supabase_http
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE=your-service-role-key
```

### 7.3 启动服务

```bash
cd python_scripts
python backend/modules/api/api_server.py
```

---

## 8. 后续迭代计划

### 8.1 近期优化 (Phase 1)

- [ ] 前端仪表板集成新指标API
- [ ] 实现实时数据推送 (WebSocket)
- [ ] 添加指标趋势图表组件

### 8.2 中期增强 (Phase 2)

- [ ] 移动端适配
- [ ] 离线数据缓存
- [ ] 报告自动生成模块

### 8.3 长期规划 (Phase 3)

- [ ] 机器学习预测模型集成
- [ ] 多项目管理支持
- [ ] 第三方系统API对接

---

## 9. 变更日志

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-01-17 | v1.0 | 初始设计文档 |
| 2026-01-18 | v2.0 | 完成核心功能实施，更新实施状态 |

---

**文档维护者**: Claude Code
**最后更新**: 2026-01-18
