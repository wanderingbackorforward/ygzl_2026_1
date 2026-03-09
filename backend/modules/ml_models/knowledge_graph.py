# -*- coding: utf-8 -*-
"""
Knowledge Graph Builder - 知识图谱构建器
基于Neo4j构建地质灾害监测领域知识图谱

核心功能:
1. 实体抽取 - 从数据库提取监测点、传感器、施工事件等实体
2. 关系抽取 - 构建空间邻近、时间先后、因果关系等关系
3. 图谱构建 - 批量创建节点和关系
4. 查询接口 - 提供Cypher查询封装

依赖: neo4j Python驱动
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
from datetime import datetime, date
from scipy.spatial.distance import cdist
import warnings
warnings.filterwarnings('ignore')

try:
    from neo4j import GraphDatabase
    NEO4J_AVAILABLE = True
except ImportError:
    NEO4J_AVAILABLE = False
    print("[警告] Neo4j未安装,请运行: pip install neo4j")


class KnowledgeGraphBuilder:
    """
    知识图谱构建器 - 构建和管理地质灾害监测知识图谱
    """

    def __init__(self, uri: str = "bolt://localhost:7687", user: str = "neo4j", password: str = "password"):
        """
        初始化知识图谱构建器

        Args:
            uri: Neo4j数据库URI
            user: 用户名
            password: 密码
        """
        if not NEO4J_AVAILABLE:
            raise ImportError("[错误] Neo4j未安装")

        self.driver = GraphDatabase.driver(uri, auth=(user, password))
        print(f"[成功] 连接到Neo4j数据库: {uri}")

    def close(self):
        """关闭数据库连接"""
        if self.driver:
            self.driver.close()
            print("[成功] 数据库连接已关闭")

    def clear_graph(self):
        """清空图谱（谨慎使用）"""
        with self.driver.session() as session:
            session.run("MATCH (n) DETACH DELETE n")
            print("[成功] 图谱已清空")

    def create_indexes(self):
        """创建索引以提升查询性能"""
        with self.driver.session() as session:
            indexes = [
                "CREATE INDEX idx_monitoring_point_id IF NOT EXISTS FOR (p:MonitoringPoint) ON (p.point_id)",
                "CREATE INDEX idx_monitoring_point_type IF NOT EXISTS FOR (p:MonitoringPoint) ON (p.type)",
                "CREATE INDEX idx_sensor_id IF NOT EXISTS FOR (s:Sensor) ON (s.sensor_id)",
                "CREATE INDEX idx_event_id IF NOT EXISTS FOR (e:ConstructionEvent) ON (e.event_id)",
                "CREATE INDEX idx_event_date IF NOT EXISTS FOR (e:ConstructionEvent) ON (e.start_date)",
                "CREATE INDEX idx_geo_id IF NOT EXISTS FOR (g:GeologicalStructure) ON (g.structure_id)",
                "CREATE INDEX idx_weather_date IF NOT EXISTS FOR (w:WeatherCondition) ON (w.date)",
                "CREATE INDEX idx_anomaly_id IF NOT EXISTS FOR (a:Anomaly) ON (a.anomaly_id)",
                "CREATE INDEX idx_anomaly_date IF NOT EXISTS FOR (a:Anomaly) ON (a.date)",
            ]

            for index_query in indexes:
                try:
                    session.run(index_query)
                    print(f"[成功] 创建索引: {index_query.split('FOR')[1].split('ON')[0].strip()}")
                except Exception as e:
                    print(f"[警告] 索引创建失败: {e}")

    # =========================================================
    # 实体抽取与创建
    # =========================================================

    def extract_monitoring_points(self, conn) -> List[Dict]:
        """
        从数据库提取监测点实体

        Args:
            conn: 数据库连接

        Returns:
            监测点列表
        """
        query = """
        SELECT
            point_id,
            point_name as name,
            point_type as type,
            x_coordinate,
            y_coordinate,
            z_coordinate,
            installation_date,
            status,
            threshold_warning,
            threshold_alarm
        FROM monitoring_points
        WHERE x_coordinate IS NOT NULL AND y_coordinate IS NOT NULL
        """

        df = pd.read_sql(query, conn)
        points = df.to_dict('records')

        print(f"[成功] 提取了 {len(points)} 个监测点")
        return points

    def create_monitoring_points(self, points: List[Dict]):
        """
        批量创建监测点节点

        Args:
            points: 监测点列表
        """
        with self.driver.session() as session:
            for point in points:
                cypher = """
                MERGE (p:MonitoringPoint {point_id: $point_id})
                SET p.name = $name,
                    p.type = $type,
                    p.x_coordinate = $x_coordinate,
                    p.y_coordinate = $y_coordinate,
                    p.z_coordinate = $z_coordinate,
                    p.installation_date = date($installation_date),
                    p.status = $status,
                    p.threshold_warning = $threshold_warning,
                    p.threshold_alarm = $threshold_alarm
                """

                # 处理日期
                if isinstance(point.get('installation_date'), (datetime, date)):
                    point['installation_date'] = point['installation_date'].strftime('%Y-%m-%d')

                session.run(cypher, point)

        print(f"[成功] 创建了 {len(points)} 个监测点节点")

    def extract_construction_events(self, conn) -> List[Dict]:
        """
        从数据库提取施工事件实体

        Args:
            conn: 数据库连接

        Returns:
            施工事件列表
        """
        query = """
        SELECT
            event_id,
            event_name as name,
            event_type as type,
            start_date,
            end_date,
            location,
            x_coordinate,
            y_coordinate,
            intensity,
            description
        FROM construction_events
        """

        try:
            df = pd.read_sql(query, conn)
            events = df.to_dict('records')
            print(f"[成功] 提取了 {len(events)} 个施工事件")
            return events
        except Exception as e:
            print(f"[警告] 施工事件表不存在或查询失败: {e}")
            return []

    def create_construction_events(self, events: List[Dict]):
        """
        批量创建施工事件节点

        Args:
            events: 施工事件列表
        """
        if not events:
            return

        with self.driver.session() as session:
            for event in events:
                cypher = """
                MERGE (e:ConstructionEvent {event_id: $event_id})
                SET e.name = $name,
                    e.type = $type,
                    e.start_date = date($start_date),
                    e.end_date = date($end_date),
                    e.location = $location,
                    e.x_coordinate = $x_coordinate,
                    e.y_coordinate = $y_coordinate,
                    e.intensity = $intensity,
                    e.description = $description
                """

                # 处理日期
                for date_field in ['start_date', 'end_date']:
                    if isinstance(event.get(date_field), (datetime, date)):
                        event[date_field] = event[date_field].strftime('%Y-%m-%d')

                session.run(cypher, event)

        print(f"[成功] 创建了 {len(events)} 个施工事件节点")

    def extract_anomalies(self, conn) -> List[Dict]:
        """
        从数据库提取异常事件实体

        Args:
            conn: 数据库连接

        Returns:
            异常事件列表
        """
        query = """
        SELECT
            CONCAT(point_id, '_', DATE_FORMAT(date, '%Y%m%d')) as anomaly_id,
            point_id,
            date,
            severity,
            anomaly_type as type,
            value,
            anomaly_score,
            description
        FROM anomaly_records
        WHERE severity IN ('critical', 'high', 'medium')
        """

        try:
            df = pd.read_sql(query, conn)
            anomalies = df.to_dict('records')
            print(f"[成功] 提取了 {len(anomalies)} 个异常事件")
            return anomalies
        except Exception as e:
            print(f"[警告] 异常记录表不存在或查询失败: {e}")
            return []

    def create_anomalies(self, anomalies: List[Dict]):
        """
        批量创建异常事件节点并关联到监测点

        Args:
            anomalies: 异常事件列表
        """
        if not anomalies:
            return

        with self.driver.session() as session:
            for anomaly in anomalies:
                cypher = """
                MERGE (a:Anomaly {anomaly_id: $anomaly_id})
                SET a.date = date($date),
                    a.severity = $severity,
                    a.type = $type,
                    a.value = $value,
                    a.anomaly_score = $anomaly_score,
                    a.description = $description
                WITH a
                MATCH (p:MonitoringPoint {point_id: $point_id})
                MERGE (a)-[:DETECTED_AT]->(p)
                """

                # 处理日期
                if isinstance(anomaly.get('date'), (datetime, date)):
                    anomaly['date'] = anomaly['date'].strftime('%Y-%m-%d')

                session.run(cypher, anomaly)

        print(f"[成功] 创建了 {len(anomalies)} 个异常事件节点")

    # =========================================================
    # 关系抽取与创建
    # =========================================================

    def build_spatial_relationships(self, points: List[Dict], distance_threshold: float = 50.0):
        """
        构建空间邻近关系

        Args:
            points: 监测点列表
            distance_threshold: 距离阈值（米）
        """
        # 提取坐标
        coords = np.array([[p['x_coordinate'], p['y_coordinate']] for p in points])
        point_ids = [p['point_id'] for p in points]

        # 计算距离矩阵
        distances = cdist(coords, coords, metric='euclidean')

        # 创建关系
        with self.driver.session() as session:
            count = 0
            for i in range(len(points)):
                for j in range(i+1, len(points)):
                    if distances[i, j] < distance_threshold:
                        # 计算方向
                        dx = coords[j][0] - coords[i][0]
                        dy = coords[j][1] - coords[i][1]
                        direction = self._calculate_direction(dx, dy)

                        cypher = """
                        MATCH (p1:MonitoringPoint {point_id: $id1})
                        MATCH (p2:MonitoringPoint {point_id: $id2})
                        MERGE (p1)-[:SPATIAL_NEAR {distance: $distance, direction: $direction}]-(p2)
                        """

                        session.run(cypher, {
                            'id1': point_ids[i],
                            'id2': point_ids[j],
                            'distance': float(distances[i, j]),
                            'direction': direction
                        })
                        count += 1

        print(f"[成功] 创建了 {count} 个空间邻近关系")

    def _calculate_direction(self, dx: float, dy: float) -> str:
        """计算方向"""
        angle = np.arctan2(dy, dx) * 180 / np.pi

        if -22.5 <= angle < 22.5:
            return 'E'
        elif 22.5 <= angle < 67.5:
            return 'NE'
        elif 67.5 <= angle < 112.5:
            return 'N'
        elif 112.5 <= angle < 157.5:
            return 'NW'
        elif angle >= 157.5 or angle < -157.5:
            return 'W'
        elif -157.5 <= angle < -112.5:
            return 'SW'
        elif -112.5 <= angle < -67.5:
            return 'S'
        else:
            return 'SE'

    def build_correlation_relationships(self, conn, correlation_threshold: float = 0.7):
        """
        构建相关性关系

        Args:
            conn: 数据库连接
            correlation_threshold: 相关系数阈值
        """
        # 查询沉降数据
        query = """
        SELECT point_id, date, settlement
        FROM settlement_data
        ORDER BY point_id, date
        """

        df = pd.read_sql(query, conn)

        # 透视表
        pivot_df = df.pivot(index='date', columns='point_id', values='settlement')
        pivot_df = pivot_df.fillna(method='ffill').fillna(method='bfill')

        # 计算相关系数矩阵
        corr_matrix = pivot_df.corr(method='pearson')

        # 创建关系
        with self.driver.session() as session:
            count = 0
            point_ids = corr_matrix.columns.tolist()

            for i in range(len(point_ids)):
                for j in range(i+1, len(point_ids)):
                    corr = corr_matrix.iloc[i, j]

                    if abs(corr) > correlation_threshold:
                        cypher = """
                        MATCH (p1:MonitoringPoint {point_id: $id1})
                        MATCH (p2:MonitoringPoint {point_id: $id2})
                        MERGE (p1)-[:CORRELATES_WITH {
                            correlation: $correlation,
                            method: 'Pearson'
                        }]-(p2)
                        """

                        session.run(cypher, {
                            'id1': point_ids[i],
                            'id2': point_ids[j],
                            'correlation': float(corr)
                        })
                        count += 1

        print(f"[成功] 创建了 {count} 个相关性关系")

    def build_causal_relationships(self, causal_pairs: List[Dict]):
        """
        构建因果关系

        Args:
            causal_pairs: 因果关系列表
                [{
                    'event_id': 'EVENT_001',
                    'anomaly_id': 'ANOMALY_001',
                    'confidence': 0.85,
                    'effect_size': -5.2,
                    'lag_days': 1,
                    'method': 'DID'
                }]
        """
        if not causal_pairs:
            return

        with self.driver.session() as session:
            for pair in causal_pairs:
                cypher = """
                MATCH (e:ConstructionEvent {event_id: $event_id})
                MATCH (a:Anomaly {anomaly_id: $anomaly_id})
                MERGE (e)-[:CAUSES {
                    confidence: $confidence,
                    effect_size: $effect_size,
                    lag_days: $lag_days,
                    method: $method
                }]->(a)
                """

                session.run(cypher, pair)

        print(f"[成功] 创建了 {len(causal_pairs)} 个因果关系")

    # =========================================================
    # 查询接口
    # =========================================================

    def query_neighbors(self, point_id: str, max_distance: float = 50.0) -> List[Dict]:
        """
        查询某个监测点的邻近点

        Args:
            point_id: 监测点ID
            max_distance: 最大距离

        Returns:
            邻近点列表
        """
        with self.driver.session() as session:
            cypher = """
            MATCH (p:MonitoringPoint {point_id: $point_id})-[r:SPATIAL_NEAR]-(neighbor)
            WHERE r.distance < $max_distance
            RETURN neighbor.point_id as point_id,
                   neighbor.name as name,
                   r.distance as distance,
                   r.direction as direction
            ORDER BY r.distance
            """

            result = session.run(cypher, {'point_id': point_id, 'max_distance': max_distance})
            neighbors = [dict(record) for record in result]

            return neighbors

    def query_causal_chain(self, event_id: str) -> List[Dict]:
        """
        查询施工事件的因果链

        Args:
            event_id: 施工事件ID

        Returns:
            因果链
        """
        with self.driver.session() as session:
            cypher = """
            MATCH (e:ConstructionEvent {event_id: $event_id})-[c:CAUSES]->(a:Anomaly)-[:DETECTED_AT]->(p:MonitoringPoint)
            RETURN e.name as event_name,
                   a.anomaly_id as anomaly_id,
                   a.date as anomaly_date,
                   a.severity as severity,
                   p.point_id as point_id,
                   p.name as point_name,
                   c.confidence as confidence,
                   c.effect_size as effect_size,
                   c.lag_days as lag_days
            ORDER BY c.confidence DESC
            """

            result = session.run(cypher, {'event_id': event_id})
            chain = [dict(record) for record in result]

            return chain

    def query_anomaly_propagation(self, source_point_id: str, max_hops: int = 3) -> List[Dict]:
        """
        查询异常传播路径

        Args:
            source_point_id: 源监测点ID
            max_hops: 最大跳数

        Returns:
            传播路径
        """
        with self.driver.session() as session:
            cypher = f"""
            MATCH path = (p1:MonitoringPoint {{point_id: $source_point_id}})-[:SPATIAL_NEAR*1..{max_hops}]-(p2:MonitoringPoint)
            WHERE EXISTS((p1)<-[:DETECTED_AT]-(:Anomaly))
              AND EXISTS((p2)<-[:DETECTED_AT]-(:Anomaly))
            RETURN [node in nodes(path) | node.point_id] as path_nodes,
                   length(path) as path_length
            ORDER BY path_length
            LIMIT 10
            """

            result = session.run(cypher, {'source_point_id': source_point_id})
            paths = [dict(record) for record in result]

            return paths

    def query_high_risk_points(self, severity: str = 'high') -> List[Dict]:
        """
        查询高风险监测点

        Args:
            severity: 严重程度

        Returns:
            高风险点列表
        """
        with self.driver.session() as session:
            cypher = """
            MATCH (a:Anomaly {severity: $severity})-[:DETECTED_AT]->(p:MonitoringPoint)
            WITH p, COUNT(a) as anomaly_count
            RETURN p.point_id as point_id,
                   p.name as name,
                   p.type as type,
                   anomaly_count
            ORDER BY anomaly_count DESC
            """

            result = session.run(cypher, {'severity': severity})
            points = [dict(record) for record in result]

            return points

    def query_graph_statistics(self) -> Dict:
        """
        查询图谱统计信息

        Returns:
            统计信息
        """
        with self.driver.session() as session:
            stats = {}

            # 节点统计
            node_types = ['MonitoringPoint', 'ConstructionEvent', 'Anomaly', 'Sensor', 'GeologicalStructure']
            for node_type in node_types:
                result = session.run(f"MATCH (n:{node_type}) RETURN COUNT(n) as count")
                stats[f'{node_type}_count'] = result.single()['count']

            # 关系统计
            rel_types = ['SPATIAL_NEAR', 'CORRELATES_WITH', 'CAUSES', 'DETECTED_AT', 'AFFECTED_BY']
            for rel_type in rel_types:
                result = session.run(f"MATCH ()-[r:{rel_type}]->() RETURN COUNT(r) as count")
                stats[f'{rel_type}_count'] = result.single()['count']

            return stats


# 使用示例
if __name__ == '__main__':
    if NEO4J_AVAILABLE:
        print("[成功] 知识图谱构建器模块加载成功!")
    else:
        print("[警告] Neo4j未安装,请运行: pip install neo4j")
