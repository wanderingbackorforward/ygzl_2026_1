# 知识图谱Schema设计

**设计时间**: 2026-03-09
**设计者**: Claude Opus 4.6
**目标**: 构建地质灾害监测领域知识图谱

---

## 一、实体类型 (Node Types)

### 1. MonitoringPoint (监测点)
**标签**: `MonitoringPoint`

**属性**:
- `point_id`: String (唯一标识)
- `name`: String (名称)
- `type`: String (类型: settlement/temperature/crack/vibration)
- `x_coordinate`: Float (X坐标)
- `y_coordinate`: Float (Y坐标)
- `z_coordinate`: Float (Z坐标/高程)
- `installation_date`: Date (安装日期)
- `status`: String (状态: active/inactive/maintenance)
- `threshold_warning`: Float (预警阈值)
- `threshold_alarm`: Float (报警阈值)

**示例**:
```cypher
CREATE (p:MonitoringPoint {
  point_id: 'S1',
  name: '沉降监测点S1',
  type: 'settlement',
  x_coordinate: 100.5,
  y_coordinate: 200.3,
  z_coordinate: 10.2,
  installation_date: date('2024-01-01'),
  status: 'active',
  threshold_warning: -20.0,
  threshold_alarm: -30.0
})
```

---

### 2. Sensor (传感器)
**标签**: `Sensor`

**属性**:
- `sensor_id`: String (唯一标识)
- `model`: String (型号)
- `manufacturer`: String (厂商)
- `accuracy`: Float (精度)
- `measurement_range`: String (测量范围)
- `installation_date`: Date (安装日期)
- `calibration_date`: Date (校准日期)
- `status`: String (状态)

**示例**:
```cypher
CREATE (s:Sensor {
  sensor_id: 'SENSOR_001',
  model: 'LS-100',
  manufacturer: 'Leica',
  accuracy: 0.1,
  measurement_range: '-100mm to +100mm',
  installation_date: date('2024-01-01'),
  calibration_date: date('2024-06-01'),
  status: 'active'
})
```

---

### 3. ConstructionEvent (施工事件)
**标签**: `ConstructionEvent`

**属性**:
- `event_id`: String (唯一标识)
- `name`: String (事件名称)
- `type`: String (类型: excavation/blasting/grouting/support)
- `start_date`: Date (开始日期)
- `end_date`: Date (结束日期)
- `location`: String (位置描述)
- `x_coordinate`: Float (X坐标)
- `y_coordinate`: Float (Y坐标)
- `intensity`: Float (强度/规模)
- `description`: String (描述)

**示例**:
```cypher
CREATE (e:ConstructionEvent {
  event_id: 'EVENT_001',
  name: '隧道开挖',
  type: 'excavation',
  start_date: date('2024-06-15'),
  end_date: date('2024-06-20'),
  location: '里程K1+200',
  x_coordinate: 150.0,
  y_coordinate: 250.0,
  intensity: 8.5,
  description: '隧道开挖作业，开挖深度10米'
})
```

---

### 4. GeologicalStructure (地质结构)
**标签**: `GeologicalStructure`

**属性**:
- `structure_id`: String (唯一标识)
- `name`: String (名称)
- `type`: String (类型: fault/layer/aquifer/karst)
- `depth`: Float (深度)
- `thickness`: Float (厚度)
- `material`: String (材料/岩性)
- `permeability`: Float (渗透系数)
- `strength`: Float (强度)
- `description`: String (描述)

**示例**:
```cypher
CREATE (g:GeologicalStructure {
  structure_id: 'GEO_001',
  name: '粉质粘土层',
  type: 'layer',
  depth: 5.0,
  thickness: 3.5,
  material: '粉质粘土',
  permeability: 0.001,
  strength: 150.0,
  description: '第四系全新统粉质粘土层'
})
```

---

### 5. WeatherCondition (气象条件)
**标签**: `WeatherCondition`

**属性**:
- `condition_id`: String (唯一标识)
- `date`: Date (日期)
- `temperature`: Float (温度)
- `humidity`: Float (湿度)
- `rainfall`: Float (降雨量)
- `wind_speed`: Float (风速)
- `pressure`: Float (气压)

**示例**:
```cypher
CREATE (w:WeatherCondition {
  condition_id: 'WEATHER_20240615',
  date: date('2024-06-15'),
  temperature: 25.5,
  humidity: 65.0,
  rainfall: 15.2,
  wind_speed: 3.5,
  pressure: 1013.2
})
```

---

### 6. Anomaly (异常事件)
**标签**: `Anomaly`

**属性**:
- `anomaly_id`: String (唯一标识)
- `date`: Date (日期)
- `severity`: String (严重程度: critical/high/medium/low)
- `type`: String (类型: spike/acceleration/fluctuation/trend)
- `value`: Float (异常值)
- `anomaly_score`: Float (异常分数)
- `description`: String (描述)

**示例**:
```cypher
CREATE (a:Anomaly {
  anomaly_id: 'ANOMALY_001',
  date: date('2024-06-16'),
  severity: 'high',
  type: 'acceleration',
  value: -25.5,
  anomaly_score: 0.85,
  description: '沉降速率突然加快'
})
```

---

## 二、关系类型 (Relationship Types)

### 1. SPATIAL_NEAR (空间邻近)
**方向**: 双向
**属性**:
- `distance`: Float (距离，单位：米)
- `direction`: String (方向: N/S/E/W/NE/NW/SE/SW)

**示例**:
```cypher
MATCH (p1:MonitoringPoint {point_id: 'S1'}), (p2:MonitoringPoint {point_id: 'S2'})
CREATE (p1)-[:SPATIAL_NEAR {distance: 25.5, direction: 'NE'}]->(p2)
```

---

### 2. TEMPORAL_BEFORE (时间先后)
**方向**: 单向
**属性**:
- `time_diff`: Integer (时间差，单位：天)

**示例**:
```cypher
MATCH (e1:ConstructionEvent {event_id: 'EVENT_001'}), (e2:ConstructionEvent {event_id: 'EVENT_002'})
CREATE (e1)-[:TEMPORAL_BEFORE {time_diff: 5}]->(e2)
```

---

### 3. CAUSES (因果关系)
**方向**: 单向
**属性**:
- `confidence`: Float (置信度: 0-1)
- `effect_size`: Float (效应大小)
- `lag_days`: Integer (滞后天数)
- `method`: String (推断方法: DID/SCM/Granger)

**示例**:
```cypher
MATCH (e:ConstructionEvent {event_id: 'EVENT_001'}), (a:Anomaly {anomaly_id: 'ANOMALY_001'})
CREATE (e)-[:CAUSES {confidence: 0.85, effect_size: -5.2, lag_days: 1, method: 'DID'}]->(a)
```

---

### 4. CORRELATES_WITH (相关性)
**方向**: 双向
**属性**:
- `correlation`: Float (相关系数: -1 to 1)
- `p_value`: Float (显著性)
- `method`: String (方法: Pearson/Spearman)

**示例**:
```cypher
MATCH (p1:MonitoringPoint {point_id: 'S1'}), (p2:MonitoringPoint {point_id: 'S2'})
CREATE (p1)-[:CORRELATES_WITH {correlation: 0.75, p_value: 0.001, method: 'Pearson'}]->(p2)
```

---

### 5. HAS_SENSOR (拥有传感器)
**方向**: 单向
**属性**: 无

**示例**:
```cypher
MATCH (p:MonitoringPoint {point_id: 'S1'}), (s:Sensor {sensor_id: 'SENSOR_001'})
CREATE (p)-[:HAS_SENSOR]->(s)
```

---

### 6. LOCATED_IN (位于)
**方向**: 单向
**属性**: 无

**示例**:
```cypher
MATCH (p:MonitoringPoint {point_id: 'S1'}), (g:GeologicalStructure {structure_id: 'GEO_001'})
CREATE (p)-[:LOCATED_IN]->(g)
```

---

### 7. AFFECTED_BY (受影响)
**方向**: 单向
**属性**:
- `impact_degree`: Float (影响程度: 0-1)
- `start_date`: Date (影响开始日期)
- `end_date`: Date (影响结束日期)

**示例**:
```cypher
MATCH (p:MonitoringPoint {point_id: 'S1'}), (e:ConstructionEvent {event_id: 'EVENT_001'})
CREATE (p)-[:AFFECTED_BY {impact_degree: 0.7, start_date: date('2024-06-15'), end_date: date('2024-06-20')}]->(e)
```

---

### 8. DETECTED_AT (检测到)
**方向**: 单向
**属性**: 无

**示例**:
```cypher
MATCH (a:Anomaly {anomaly_id: 'ANOMALY_001'}), (p:MonitoringPoint {point_id: 'S1'})
CREATE (a)-[:DETECTED_AT]->(p)
```

---

## 三、索引设计

### 节点索引
```cypher
-- 监测点索引
CREATE INDEX idx_monitoring_point_id FOR (p:MonitoringPoint) ON (p.point_id);
CREATE INDEX idx_monitoring_point_type FOR (p:MonitoringPoint) ON (p.type);
CREATE INDEX idx_monitoring_point_status FOR (p:MonitoringPoint) ON (p.status);

-- 传感器索引
CREATE INDEX idx_sensor_id FOR (s:Sensor) ON (s.sensor_id);

-- 施工事件索引
CREATE INDEX idx_event_id FOR (e:ConstructionEvent) ON (e.event_id);
CREATE INDEX idx_event_date FOR (e:ConstructionEvent) ON (e.start_date);

-- 地质结构索引
CREATE INDEX idx_geo_id FOR (g:GeologicalStructure) ON (g.structure_id);

-- 气象条件索引
CREATE INDEX idx_weather_date FOR (w:WeatherCondition) ON (w.date);

-- 异常事件索引
CREATE INDEX idx_anomaly_id FOR (a:Anomaly) ON (a.anomaly_id);
CREATE INDEX idx_anomaly_date FOR (a:Anomaly) ON (a.date);
CREATE INDEX idx_anomaly_severity FOR (a:Anomaly) ON (a.severity);
```

---

## 四、典型查询示例

### 1. 查找某个监测点的所有邻近点
```cypher
MATCH (p:MonitoringPoint {point_id: 'S1'})-[r:SPATIAL_NEAR]-(neighbor)
WHERE r.distance < 50
RETURN neighbor.point_id, neighbor.name, r.distance, r.direction
ORDER BY r.distance
```

### 2. 查找导致异常的施工事件
```cypher
MATCH (e:ConstructionEvent)-[c:CAUSES]->(a:Anomaly)-[:DETECTED_AT]->(p:MonitoringPoint)
WHERE a.severity IN ['critical', 'high']
RETURN e.name, e.type, a.date, p.point_id, c.confidence, c.effect_size
ORDER BY c.confidence DESC
```

### 3. 查找空间关联的异常传播路径
```cypher
MATCH path = (p1:MonitoringPoint)-[:SPATIAL_NEAR*1..3]-(p2:MonitoringPoint)
WHERE p1.point_id = 'S1'
  AND EXISTS((p1)<-[:DETECTED_AT]-(:Anomaly))
  AND EXISTS((p2)<-[:DETECTED_AT]-(:Anomaly))
RETURN path
```

### 4. 查找受某个施工事件影响的所有监测点
```cypher
MATCH (p:MonitoringPoint)-[r:AFFECTED_BY]->(e:ConstructionEvent {event_id: 'EVENT_001'})
RETURN p.point_id, p.name, r.impact_degree, r.start_date, r.end_date
ORDER BY r.impact_degree DESC
```

### 5. 查找高相关性的监测点对
```cypher
MATCH (p1:MonitoringPoint)-[r:CORRELATES_WITH]-(p2:MonitoringPoint)
WHERE r.correlation > 0.7 AND r.p_value < 0.05
RETURN p1.point_id, p2.point_id, r.correlation, r.p_value
ORDER BY r.correlation DESC
```

---

## 五、数据导入策略

### 1. 监测点数据导入
```python
# 从数据库读取监测点数据
query = "SELECT * FROM monitoring_points"
df = pd.read_sql(query, conn)

# 批量创建节点
for _, row in df.iterrows():
    cypher = """
    CREATE (p:MonitoringPoint {
        point_id: $point_id,
        name: $name,
        type: $type,
        x_coordinate: $x,
        y_coordinate: $y,
        z_coordinate: $z,
        installation_date: date($installation_date),
        status: $status
    })
    """
    session.run(cypher, row.to_dict())
```

### 2. 空间关系构建
```python
# 计算所有监测点之间的距离
from scipy.spatial.distance import cdist

coords = df[['x_coordinate', 'y_coordinate']].values
distances = cdist(coords, coords)

# 创建空间邻近关系
for i in range(len(df)):
    for j in range(i+1, len(df)):
        if distances[i, j] < 50:  # 距离阈值
            cypher = """
            MATCH (p1:MonitoringPoint {point_id: $id1})
            MATCH (p2:MonitoringPoint {point_id: $id2})
            CREATE (p1)-[:SPATIAL_NEAR {distance: $distance}]->(p2)
            """
            session.run(cypher, {
                'id1': df.iloc[i]['point_id'],
                'id2': df.iloc[j]['point_id'],
                'distance': distances[i, j]
            })
```

### 3. 因果关系推断
```python
# 使用因果推断算法识别因果关系
from modules.ml_models.causal_inference import CausalInference

ci = CausalInference()
causal_pairs = ci.discover_causal_relationships(data)

# 创建因果关系
for pair in causal_pairs:
    cypher = """
    MATCH (e:ConstructionEvent {event_id: $event_id})
    MATCH (a:Anomaly {anomaly_id: $anomaly_id})
    CREATE (e)-[:CAUSES {
        confidence: $confidence,
        effect_size: $effect_size,
        lag_days: $lag_days,
        method: $method
    }]->(a)
    """
    session.run(cypher, pair)
```

---

## 六、扩展性设计

### 未来可扩展的实体类型
- `MaintenanceRecord` (维护记录)
- `AlertRule` (预警规则)
- `User` (用户)
- `Report` (报告)
- `Prediction` (预测结果)

### 未来可扩展的关系类型
- `TRIGGERS` (触发)
- `RESOLVES` (解决)
- `PREDICTS` (预测)
- `VALIDATES` (验证)

---

**设计者**: Claude Opus 4.6 (1M context)
**完成时间**: 2026-03-09
