# -*- coding: utf-8 -*-
"""
清理工单数据库中的乱码数据
"""
import os
import sys

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from modules.db.vendor import get_repo

def clean_corrupted_tickets():
    """删除包含乱码的工单"""
    repo = get_repo()

    print("开始清理乱码工单...")

    # 获取所有工单
    tickets = repo.tickets_get(filters={}, limit=1000, offset=0)

    print(f"找到 {len(tickets)} 个工单")

    deleted_count = 0
    for ticket in tickets:
        ticket_id = ticket.get('id')
        title = ticket.get('title', '')
        description = ticket.get('description', '')

        # 检查是否包含乱码（问号）
        if '?' in title or '?' in description:
            print(f"\n删除乱码工单:")
            print(f"  ID: {ticket_id}")
            print(f"  标题: {title}")
            print(f"  描述: {description[:50]}...")

            try:
                repo.ticket_delete(ticket_id)
                print(f"  ✓ 已删除")
                deleted_count += 1
            except Exception as e:
                print(f"  ✗ 删除失败: {e}")

    print(f"\n清理完成！共删除 {deleted_count} 个乱码工单")
    print("\n提示: 系统会根据监测数据自动生成新的工单")

if __name__ == '__main__':
    # 确认操作
    print("=" * 60)
    print("警告: 此操作将删除所有包含乱码的工单！")
    print("=" * 60)
    confirm = input("确认继续？(输入 yes 继续): ")

    if confirm.lower() == 'yes':
        clean_corrupted_tickets()
    else:
        print("操作已取消")
