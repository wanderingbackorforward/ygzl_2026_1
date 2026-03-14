# -*- coding: utf-8 -*-
"""
重新处理知识图谱文献 - 使用增强的实体提取算法
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# 加载环境变量
try:
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(__file__), '../.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
except ImportError:
    pass

from backend.modules.ml_models.supabase_kg import SupabaseKnowledgeGraph

def main():
    print("开始重新处理知识图谱文献...")
    kg = SupabaseKnowledgeGraph()

    # 获取所有文献
    docs_result = kg.list_documents(limit=100)
    if not docs_result.get('success'):
        print(f"[错误] 获取文献列表失败: {docs_result.get('message')}")
        return

    docs = docs_result['documents']
    print(f"找到 {len(docs)} 篇文献\n")

    success_count = 0
    for i, doc in enumerate(docs, 1):
        doc_id = doc['id']
        title = doc['title']
        print(f"[{i}/{len(docs)}] 处理: {title}")

        # 先删除旧的提取结果
        try:
            import requests
            from backend.modules.ml_models.supabase_kg import _base_url, _headers

            # 删除该文献的节点和边
            requests.delete(
                f"{_base_url()}/rest/v1/kg_edges?document_id=eq.{doc_id}",
                headers=_headers(), timeout=10,
            )
            requests.delete(
                f"{_base_url()}/rest/v1/kg_nodes?document_id=eq.{doc_id}",
                headers=_headers(), timeout=10,
            )
            requests.delete(
                f"{_base_url()}/rest/v1/kg_document_entities?document_id=eq.{doc_id}",
                headers=_headers(), timeout=10,
            )
            print("  [清理] 已删除旧数据")
        except Exception as e:
            print(f"  [警告] 清理失败: {e}")

        # 重新处理
        result = kg.process_document(doc_id)
        if result.get('success'):
            entities = result.get('entities_extracted', 0)
            relations = result.get('relations_extracted', 0)
            print(f"  [成功] 提取 {entities} 个实体, {relations} 条关系\n")
            success_count += 1
        else:
            print(f"  [失败] {result.get('message')}\n")

    print(f"\n完成！成功处理 {success_count}/{len(docs)} 篇文献")
    print("请刷新前端查看优化后的知识图谱")

if __name__ == '__main__':
    main()
