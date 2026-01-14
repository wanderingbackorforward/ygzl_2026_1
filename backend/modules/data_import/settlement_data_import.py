import pandas as pd
import mysql.connector
from sqlalchemy import create_engine
import os
import sys

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# 导入数据库配置
from modules.database.db_config import db_config

def import_excel_to_mysql(excel_path):
    print(f"开始导入Excel文件: {excel_path}")

    try:
        # 读取Excel文件
        df = pd.read_excel(excel_path)

        # 确认列名格式
        print("Excel列名:", df.columns.tolist())

        # 重命名第一列为measurement_date并确保格式正确
        df.rename(columns={df.columns[0]: 'measurement_date'}, inplace=True)

        # 确保日期列格式正确
        df['measurement_date'] = pd.to_datetime(df['measurement_date'])

        # 创建数据库连接
        engine = create_engine(
            f"mysql+pymysql://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")

        # 将数据导入MySQL
        df.to_sql('raw_settlement_data', engine, if_exists='append', index=False)

        print(f"成功导入 {len(df)} 行数据到 raw_settlement_data 表")
        return True

    except Exception as e:
        print(f"导入失败: {str(e)}")
        return False

if __name__ == "__main__":
    # 指定Excel文件路径
    excel_file = input("请输入Excel文件路径: ")

    if os.path.exists(excel_file):
        import_excel_to_mysql(excel_file)
    else:
        print("文件不存在，请检查路径是否正确")