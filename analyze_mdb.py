import pyodbc
import pandas as pd
import os
import sys

def analyze_mdb_structure(mdb_path):
    """分析MDB文件的结构，显示所有表和字段"""
    if not os.path.exists(mdb_path):
        print(f"错误: 文件 {mdb_path} 不存在")
        return
    
    try:
        # 创建连接字符串
        conn_str = f"Driver={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={mdb_path}"
        
        # 连接到数据库
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        
        # 获取所有表名
        tables = [table.table_name for table in cursor.tables(tableType='TABLE')]
        
        print(f"\n找到 {len(tables)} 个表:")
        for i, table in enumerate(tables, 1):
            print(f"{i}. {table}")
        
        # 分析每个表的结构
        print("\n详细表结构:")
        for table in tables:
            print(f"\n表名: {table}")
            
            # 获取表的列信息
            columns = cursor.columns(table=table)
            cols_info = []
            
            for column in columns:
                col_name = column.column_name
                col_type = column.type_name
                col_size = column.column_size
                cols_info.append(f"{col_name} ({col_type}, {col_size})")
            
            for i, col_info in enumerate(cols_info, 1):
                print(f"  {i}. {col_info}")
            
            # 尝试获取表中的记录数
            try:
                cursor.execute(f"SELECT COUNT(*) FROM [{table}]")
                row_count = cursor.fetchone()[0]
                print(f"  记录数: {row_count}")
                
                # 如果表有数据，显示前5行作为示例
                if row_count > 0:
                    cursor.execute(f"SELECT TOP 5 * FROM [{table}]")
                    rows = cursor.fetchall()
                    
                    # 获取列名
                    column_names = [column[0] for column in cursor.description]
                    
                    print("  数据示例 (前5行):")
                    df = pd.DataFrame.from_records(rows, columns=column_names)
                    # 指定显示宽度以避免截断
                    with pd.option_context('display.max_columns', None, 'display.width', 1000):
                        print("  " + str(df).replace("\n", "\n  "))
            except Exception as e:
                print(f"  无法获取记录数或示例数据: {str(e)}")
        
        # 关闭连接
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"分析数据库时出错: {str(e)}")

if __name__ == "__main__":
    # 指定MDB文件路径
    mdb_path = r"D:\帆软\隧道数据汇总.mdb"
    
    print(f"开始分析MDB文件: {mdb_path}")
    analyze_mdb_structure(mdb_path)
    print("\n分析完成") 