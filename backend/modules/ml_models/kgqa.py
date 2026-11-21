# -*- coding: utf-8 -*-
"""
KGQA: Knowledge Graph Question Answering - 知识图谱问答系统
基于知识图谱的自然语言问答

核心功能:
1. 意图识别 - 识别用户问题类型
2. 实体识别 - 提取问题中的实体
3. Cypher生成 - 将自然语言转换为Cypher查询
4. 答案生成 - 将查询结果转换为自然语言

支持的问题类型:
- 实体查询: "S1监测点的状态是什么？"
- 关系查询: "S1附近有哪些监测点？"
- 因果查询: "哪些施工事件导致了异常？"
- 统计查询: "有多少个高风险监测点？"
- 路径查询: "S1到S5的异常传播路径是什么？"
"""

import re
from typing import Dict, List, Tuple, Optional
import warnings
warnings.filterwarnings('ignore')


class KGQA:
    """
    知识图谱问答系统
    """

    def __init__(self, kg_builder):
        """
        初始化KGQA系统

        Args:
            kg_builder: KnowledgeGraphBuilder实例
        """
        self.kg = kg_builder

        # 问题模板
        self.question_patterns = {
            'entity_query': [
                r'(.+)的(.+)是什么',
                r'(.+)的(.+)',
                r'查询(.+)的(.+)',
            ],
            'neighbor_query': [
                r'(.+)附近有哪些(.+)',
                r'(.+)周围的(.+)',
                r'(.+)邻近的(.+)',
            ],
            'causal_query': [
                r'哪些(.+)导致了(.+)',
                r'(.+)的原因是什么',
                r'(.+)是由什么引起的',
            ],
            'count_query': [
                r'有多少个(.+)',
                r'(.+)的数量',
                r'统计(.+)',
            ],
            'path_query': [
                r'(.+)到(.+)的(.+)路径',
                r'(.+)和(.+)之间的(.+)',
            ],
            'risk_query': [
                r'高风险(.+)',
                r'危险的(.+)',
                r'异常的(.+)',
            ],
        }

        # 实体类型映射
        self.entity_types = {
            '监测点': 'MonitoringPoint',
            '传感器': 'Sensor',
            '施工事件': 'ConstructionEvent',
            '异常': 'Anomaly',
            '地质结构': 'GeologicalStructure',
        }

        # 属性映射
        self.property_mapping = {
            '状态': 'status',
            '类型': 'type',
            '名称': 'name',
            '位置': 'location',
            '坐标': 'x_coordinate, y_coordinate',
            '日期': 'date',
            '严重程度': 'severity',
            '阈值': 'threshold_warning, threshold_alarm',
        }

    def answer(self, question: str) -> Dict:
        """
        回答问题

        Args:
            question: 自然语言问题

        Returns:
            答案
        """
        # 1. 意图识别
        intent = self._identify_intent(question)

        # 2. 实体识别
        entities = self._extract_entities(question)

        # 3. 生成Cypher查询
        cypher = self._generate_cypher(intent, entities, question)

        if not cypher:
            return {
                'success': False,
                'message': '无法理解问题，请换一种方式提问'
            }

        # 4. 执行查询
        try:
            with self.kg.driver.session() as session:
                result = session.run(cypher)
                records = [dict(record) for record in result]

            # 5. 生成答案
            answer = self._generate_answer(intent, records, question)

            return {
                'success': True,
                'question': question,
                'intent': intent,
                'entities': entities,
                'cypher': cypher,
                'records': records,
                'answer': answer
            }

        except Exception as e:
            return {
                'success': False,
                'message': f'查询失败: {str(e)}',
                'cypher': cypher
            }

    def _identify_intent(self, question: str) -> str:
        """
        识别问题意图

        Args:
            question: 问题

        Returns:
            意图类型
        """
        for intent, patterns in self.question_patterns.items():
            for pattern in patterns:
                if re.search(pattern, question):
                    return intent

        return 'unknown'

    def _extract_entities(self, question: str) -> List[str]:
        """
        提取实体

        Args:
            question: 问题

        Returns:
            实体列表
        """
        entities = []

        # 提取监测点ID (如S1, S2, T1等)
        point_ids = re.findall(r'[A-Z]\d+', question)
        entities.extend(point_ids)

        # 提取事件ID
        event_ids = re.findall(r'EVENT_\d+', question)
        entities.extend(event_ids)

        # 提取异常ID
        anomaly_ids = re.findall(r'ANOMALY_\d+', question)
        entities.extend(anomaly_ids)

        return entities

    def _generate_cypher(self, intent: str, entities: List[str], question: str) -> Optional[str]:
        """
        生成Cypher查询

        Args:
            intent: 意图
            entities: 实体
            question: 问题

        Returns:
            Cypher查询
        """
        if intent == 'entity_query':
            return self._generate_entity_query(entities, question)

        elif intent == 'neighbor_query':
            return self._generate_neighbor_query(entities, question)

        elif intent == 'causal_query':
            return self._generate_causal_query(entities, question)

        elif intent == 'count_query':
            return self._generate_count_query(question)

        elif intent == 'path_query':
            return self._generate_path_query(entities, question)

        elif intent == 'risk_query':
            return self._generate_risk_query(question)

        else:
            return None

    def _generate_entity_query(self, entities: List[str], question: str) -> str:
        """生成实体查询"""
        if not entities:
            return None

        entity_id = entities[0]

        # 提取属性
        property_name = None
        for prop_cn, prop_en in self.property_mapping.items():
            if prop_cn in question:
                property_name = prop_en
                break

        if property_name:
            cypher = f"""
            MATCH (p:MonitoringPoint {{point_id: '{entity_id}'}})
            RETURN p.point_id as point_id, p.{property_name} as value
            """
        else:
            cypher = f"""
            MATCH (p:MonitoringPoint {{point_id: '{entity_id}'}})
            RETURN p
            """

        return cypher

    def _generate_neighbor_query(self, entities: List[str], question: str) -> str:
        """生成邻近查询"""
        if not entities:
            return None

        entity_id = entities[0]

        # 提取距离阈值
        distance_match = re.search(r'(\d+)米', question)
        distance = int(distance_match.group(1)) if distance_match else 50

        cypher = f"""
        MATCH (p:MonitoringPoint {{point_id: '{entity_id}'}})-[r:SPATIAL_NEAR]-(neighbor)
        WHERE r.distance < {distance}
        RETURN neighbor.point_id as point_id,
               neighbor.name as name,
               r.distance as distance,
               r.direction as direction
        ORDER BY r.distance
        """

        return cypher

    def _generate_causal_query(self, entities: List[str], question: str) -> str:
        """生成因果查询"""
        cypher = """
        MATCH (e:ConstructionEvent)-[c:CAUSES]->(a:Anomaly)-[:DETECTED_AT]->(p:MonitoringPoint)
        WHERE a.severity IN ['critical', 'high']
        RETURN e.event_id as event_id,
               e.name as event_name,
               e.type as event_type,
               a.anomaly_id as anomaly_id,
               a.date as anomaly_date,
               p.point_id as point_id,
               c.confidence as confidence,
               c.effect_size as effect_size
        ORDER BY c.confidence DESC
        LIMIT 10
        """

        return cypher

    def _generate_count_query(self, question: str) -> str:
        """生成统计查询"""
        # 识别实体类型
        entity_type = None
        for type_cn, type_en in self.entity_types.items():
            if type_cn in question:
                entity_type = type_en
                break

        if not entity_type:
            entity_type = 'MonitoringPoint'

        # 识别过滤条件
        if '高风险' in question or '异常' in question:
            cypher = f"""
            MATCH (a:Anomaly {{severity: 'high'}})-[:DETECTED_AT]->(p:{entity_type})
            RETURN COUNT(DISTINCT p) as count
            """
        else:
            cypher = f"""
            MATCH (n:{entity_type})
            RETURN COUNT(n) as count
            """

        return cypher

    def _generate_path_query(self, entities: List[str], question: str) -> str:
        """生成路径查询"""
        if len(entities) < 2:
            return None

        source_id = entities[0]
        target_id = entities[1]

        # 提取最大跳数
        hop_match = re.search(r'(\d+)跳', question)
        max_hops = int(hop_match.group(1)) if hop_match else 3

        cypher = f"""
        MATCH path = shortestPath(
            (p1:MonitoringPoint {{point_id: '{source_id}'}})-[:SPATIAL_NEAR*1..{max_hops}]-(p2:MonitoringPoint {{point_id: '{target_id}'}})
        )
        RETURN [node in nodes(path) | node.point_id] as path_nodes,
               length(path) as path_length
        """

        return cypher

    def _generate_risk_query(self, question: str) -> str:
        """生成风险查询"""
        cypher = """
        MATCH (a:Anomaly)-[:DETECTED_AT]->(p:MonitoringPoint)
        WHERE a.severity IN ['critical', 'high']
        WITH p, COUNT(a) as anomaly_count
        RETURN p.point_id as point_id,
               p.name as name,
               p.type as type,
               anomaly_count
        ORDER BY anomaly_count DESC
        LIMIT 10
        """

        return cypher

    def _generate_answer(self, intent: str, records: List[Dict], question: str) -> str:
        """
        生成自然语言答案

        Args:
            intent: 意图
            records: 查询结果
            question: 问题

        Returns:
            答案
        """
        if not records:
            return "抱歉，没有找到相关信息。"

        if intent == 'entity_query':
            return self._format_entity_answer(records)

        elif intent == 'neighbor_query':
            return self._format_neighbor_answer(records)

        elif intent == 'causal_query':
            return self._format_causal_answer(records)

        elif intent == 'count_query':
            return self._format_count_answer(records)

        elif intent == 'path_query':
            return self._format_path_answer(records)

        elif intent == 'risk_query':
            return self._format_risk_answer(records)

        else:
            return f"找到 {len(records)} 条结果。"

    def _format_entity_answer(self, records: List[Dict]) -> str:
        """格式化实体查询答案"""
        if len(records) == 0:
            return "未找到该实体。"

        record = records[0]

        if 'value' in record:
            return f"查询结果: {record['value']}"
        else:
            # 格式化所有属性
            props = [f"{k}: {v}" for k, v in record.items() if not k.startswith('_')]
            return "查询结果:\n" + "\n".join(props)

    def _format_neighbor_answer(self, records: List[Dict]) -> str:
        """格式化邻近查询答案"""
        if len(records) == 0:
            return "附近没有其他监测点。"

        answer = f"找到 {len(records)} 个邻近监测点:\n"
        for i, record in enumerate(records[:5], 1):
            answer += f"{i}. {record['point_id']} ({record.get('name', '未命名')}) - "
            answer += f"距离 {record['distance']:.1f}米，方向 {record['direction']}\n"

        if len(records) > 5:
            answer += f"... 还有 {len(records) - 5} 个监测点"

        return answer

    def _format_causal_answer(self, records: List[Dict]) -> str:
        """格式化因果查询答案"""
        if len(records) == 0:
            return "未发现明确的因果关系。"

        answer = f"发现 {len(records)} 个因果关系:\n"
        for i, record in enumerate(records[:5], 1):
            answer += f"{i}. {record['event_name']} ({record['event_type']}) "
            answer += f"导致 {record['point_id']} 在 {record['anomaly_date']} 发生异常，"
            answer += f"置信度 {record['confidence']:.2f}，效应大小 {record['effect_size']:.2f}\n"

        if len(records) > 5:
            answer += f"... 还有 {len(records) - 5} 个因果关系"

        return answer

    def _format_count_answer(self, records: List[Dict]) -> str:
        """格式化统计查询答案"""
        if len(records) == 0:
            return "统计结果为0。"

        count = records[0]['count']
        return f"统计结果: {count} 个"

    def _format_path_answer(self, records: List[Dict]) -> str:
        """格式化路径查询答案"""
        if len(records) == 0:
            return "未找到路径。"

        record = records[0]
        path_nodes = record['path_nodes']
        path_length = record['path_length']

        answer = f"找到路径（长度 {path_length}）:\n"
        answer += " -> ".join(path_nodes)

        return answer

    def _format_risk_answer(self, records: List[Dict]) -> str:
        """格式化风险查询答案"""
        if len(records) == 0:
            return "未发现高风险监测点。"

        answer = f"发现 {len(records)} 个高风险监测点:\n"
        for i, record in enumerate(records[:5], 1):
            answer += f"{i}. {record['point_id']} ({record.get('name', '未命名')}) - "
            answer += f"{record['type']}，异常次数 {record['anomaly_count']}\n"

        if len(records) > 5:
            answer += f"... 还有 {len(records) - 5} 个高风险点"

        return answer


# 使用示例
if __name__ == '__main__':
    print("[成功] KGQA问答系统模块加载成功!")
    print("[成功] 支持的问题类型: 实体查询、邻近查询、因果查询、统计查询、路径查询、风险查询")
