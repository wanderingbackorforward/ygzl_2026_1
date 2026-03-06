# -*- coding: utf-8 -*-
"""
修复工单数据库中的中文乱码问题
"""
import os
import sys

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from modules.db.vendor import get_repo

def fix_encoding():
    """修复工单表中的编码问题"""
    repo = get_repo()

    print("开始修复工单编码问题...")

    # 获取所有工单
    tickets = repo.tickets_get(filters={}, limit=1000, offset=0)

    print(f"找到 {len(tickets)} 个工单")

    fixed_count = 0
    for ticket in tickets:
        ticket_id = ticket.get('id')
        title = ticket.get('title', '')
        description = ticket.get('description', '')

        # 检查是否包含乱码（问号）
        if '?' in title or '?' in description:
            print(f"\n工单 ID {ticket_id}:")
            print(f"  原标题: {title}")
            print(f"  原描述: {description[:50]}...")

            # 尝试修复编码
            try:
                # 方法1: 假设数据是以 latin1 错误编码的 UTF-8
                fixed_title = title
                fixed_description = description

                if '?' in title:
                    try:
                        # 尝试将错误编码的字符串转回字节，再用正确的编码解码
                        fixed_title = title.encode('latin1').decode('utf-8', errors='ignore')
                    except:
                        pass

                if '?' in description:
                    try:
                        fixed_description = description.encode('latin1').decode('utf-8', errors='ignore')
                    except:
                        pass

                # 如果修复后还是有问号，说明数据已经损坏，无法恢复
                if '?' in fixed_title or '?' in fixed_description:
                    print(f"  ⚠️  数据已损坏，无法自动修复")
                    print(f"  建议: 手动重新创建此工单")
                else:
                    # 更新数据库
                    update_data = {}
                    if fixed_title != title:
                        update_data['title'] = fixed_title
                    if fixed_description != description:
                        update_data['description'] = fixed_description

                    if update_data:
                        repo.ticket_update(ticket_id, update_data)
                        print(f"  ✓ 已修复")
                        print(f"  新标题: {fixed_title}")
                        fixed_count += 1

            except Exception as e:
                print(f"  ✗ 修复失败: {e}")

    print(f"\n修复完成！成功修复 {fixed_count} 个工单")
    print("\n注意: 如果有工单无法自动修复，建议手动删除并重新创建")

if __name__ == '__main__':
    fix_encoding()
