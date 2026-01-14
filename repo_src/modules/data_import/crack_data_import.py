import pandas as pd
import mysql.connector
from sqlalchemy import create_engine
import os
import sys

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# 导入数据库配置
from modules.database.db_config import db_config


def check_tables_exist():
    """
    检查所需的数据库表是否都存在

    返回:
    dict: 包含每个表是否存在的信息
    """
    try:
        # 连接到MySQL
        conn = mysql.connector.connect(
            host=db_config['host'],
            user=db_config['user'],
            password=db_config['password'],
            database=db_config['database']
        )

        cursor = conn.cursor()

        # 需要检查的表列表
        required_tables = [
            'raw_crack_data',
            'crack_monitoring_points',
            'crack_analysis_results'
        ]

        tables_status = {}

        # 检查每个表是否存在
        for table in required_tables:
            cursor.execute(f"SHOW TABLES LIKE '{table}'")
            tables_status[table] = cursor.fetchone() is not None

        cursor.close()
        conn.close()

        return tables_status

    except Exception as e:
        print(f"检查表是否存在时出错: {str(e)}")
        # 如果发生错误，假设所有表都不存在
        return {table: False for table in ['raw_crack_data', 'crack_monitoring_points', 'crack_analysis_results']}


def ensure_database_exists():
    """检查并确保数据库存在"""
    try:
        # 检查数据库是否存在，如果不存在则创建
        conn = mysql.connector.connect(
            host=db_config['host'],
            user=db_config['user'],
            password=db_config['password']
        )

        cursor = conn.cursor()

        # 创建数据库（如果不存在）
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_config['database']}")

        conn.commit()
        cursor.close()
        conn.close()

        return True

    except Exception as e:
        print(f"确保数据库存在时出错: {str(e)}")
        return False


def import_crack_excel(excel_path):
    """
    导入裂缝Excel数据到MySQL数据库，自动检测并创建缺失的表

    参数:
    excel_path: Excel文件路径

    返回:
    成功返回True，失败返回False
    """
    print(f"开始导入裂缝Excel文件: {excel_path}")

    # 确保数据库存在
    if not ensure_database_exists():
        print("创建数据库失败，导入过程终止")
        return False

    # 检查必要的表是否存在
    tables_status = check_tables_exist()
    missing_tables = [table for table, exists in tables_status.items() if not exists]

    if missing_tables:
        print(f"检测到缺少必要的表: {', '.join(missing_tables)}")
        print("正在创建缺失的表...")
        if not create_database_tables(missing_tables):
            print("创建必要的表失败，导入过程终止")
            return False
        print("所有必要的表已创建，继续导入过程")

    try:
        # 读取Excel文件
        df = pd.read_excel(excel_path, engine='openpyxl')

        # 确认列名格式
        print("Excel列名:", df.columns.tolist())

        # 方法2：提供更灵活的选项，优先使用特定名称，如果不存在则回退到第一列
        date_col_name = '监测日期与时间'
        date_col = date_col_name if date_col_name in df.columns else df.columns[0]

        # 过滤掉不需要的行
        df = df[~df[date_col].isin(['max', 'min'])]

        # 转换日期格式，注意指定format='%y/%m/%d %H:%M'
        df['measurement_date'] = pd.to_datetime(df[date_col], format='%y/%m/%d %H:%M', errors='coerce')

        # 检查日期转换是否有问题
        invalid_dates = df[df['measurement_date'].isna()]
        if not invalid_dates.empty:
            print(f"警告: {len(invalid_dates)}行日期无法解析")
            print(f"无法解析的日期示例: {invalid_dates[date_col].iloc[:5].tolist()}")
            print("确保日期格式为 '年/月/日 时:分' 例如 '19/01/01 00:00'")
            return False

        # 创建数据库连接
        engine = create_engine(
            f"mysql+pymysql://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")

        # 连接到数据库
        conn = engine.connect()

        # 检查表是否存在
        result = conn.execute("SHOW TABLES LIKE 'raw_crack_data'")
        table_exists = result.fetchone() is not None

        if table_exists:
            # 检查表结构是否需要更新
            result = conn.execute("DESCRIBE raw_crack_data")
            existing_columns = [row[0].lower() for row in result.fetchall()]

            # 获取Excel文件中的列（排除日期列）
            data_columns = [col for col in df.columns if col != date_col]

            # 检查是否有新列需要添加
            for col in data_columns:
                if col.lower() not in existing_columns and col != 'measurement_date':
                    # 添加新列
                    conn.execute(f"ALTER TABLE raw_crack_data ADD COLUMN `{col}` FLOAT")
                    print(f"添加了新列: {col}")

        # 准备导入的数据
        import_df = df.copy()
        if date_col in import_df.columns:
            import_df.drop(columns=[date_col], inplace=True)

        # 将数据导入MySQL - 特别注意表名为 raw_crack_data，而不是 raw_settlement_data
        import_df.to_sql('raw_crack_data', engine, if_exists='append', index=False)

        print(f"成功导入 {len(import_df)} 行裂缝数据到 raw_crack_data 表")
        return True

    except Exception as e:
        print(f"导入失败: {str(e)}")
        return False


def create_database_tables(missing_tables=None):
    """
    创建裂缝数据所需的数据库表

    参数:
    missing_tables: 需要创建的表列表，如果为None则创建所有表
    """
    try:
        # 连接到MySQL
        conn = mysql.connector.connect(
            host=db_config['host'],
            user=db_config['user'],
            password=db_config['password'],
            database=db_config['database']
        )

        cursor = conn.cursor()

        tables_created = []

        # 创建原始裂缝数据表
        if missing_tables is None or 'raw_crack_data' in missing_tables:
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS `raw_crack_data` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `measurement_date` DATETIME NOT NULL,
                INDEX (`measurement_date`)
            )
            """)
            tables_created.append('raw_crack_data')

        # 创建裂缝监测点表
        if missing_tables is None or 'crack_monitoring_points' in missing_tables:
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS `crack_monitoring_points` (
                `point_id` VARCHAR(50) PRIMARY KEY,
                `description` VARCHAR(100),
                `location` VARCHAR(100),
                `initial_value` FLOAT,
                `last_value` FLOAT,
                `total_change` FLOAT,
                `average_change_rate` FLOAT,
                `change_type` VARCHAR(20),
                `monitoring_start_date` DATETIME,
                `monitoring_end_date` DATETIME,
                `trend_slope` FLOAT,
                `trend_type` VARCHAR(20),
                `r_value` FLOAT,
                `p_value` FLOAT,
                `status` VARCHAR(20) DEFAULT 'active'
            )
            """)
            tables_created.append('crack_monitoring_points')

        # 创建裂缝分析结果表
        if missing_tables is None or 'crack_analysis_results' in missing_tables:
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS `crack_analysis_results` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `analysis_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
                `point_id` VARCHAR(50),
                `min_value` FLOAT,
                `max_value` FLOAT,
                `mean_value` FLOAT,
                `median_value` FLOAT,
                `std_value` FLOAT,
                `coefficient_of_variation` FLOAT,
                `q25_value` FLOAT,
                `q75_value` FLOAT,
                `iqr_value` FLOAT,
                `anomaly_count` INT,
                FOREIGN KEY (`point_id`) REFERENCES `crack_monitoring_points`(`point_id`)
            )
            """)
            tables_created.append('crack_analysis_results')

        conn.commit()
        cursor.close()
        conn.close()

        if tables_created:
            print(f"成功创建以下数据库表: {', '.join(tables_created)}")
        return True

    except Exception as e:
        print(f"创建数据库表失败: {str(e)}")
        return False


def initialize_database():
    """检查并初始化数据库结构"""
    try:
        # 检查数据库是否存在，如果不存在则创建
        conn = mysql.connector.connect(
            host=db_config['host'],
            user=db_config['user'],
            password=db_config['password']
        )

        cursor = conn.cursor()

        # 创建数据库（如果不存在）
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_config['database']}")

        conn.commit()
        cursor.close()
        conn.close()

        # 创建所需表
        create_database_tables()

        return True

    except Exception as e:
        print(f"初始化数据库失败: {str(e)}")
        return False


def first_time_import(excel_path):
    """首次导入时的处理，包括创建数据库和表结构"""
    # 初始化数据库结构
    if not initialize_database():
        return False

    # 导入Excel数据 - 特别注意这里调用的是import_crack_excel而不是import_excel_to_mysql
    return import_crack_excel(excel_path)


if __name__ == "__main__":
    # 获取命令行参数
    import argparse

    parser = argparse.ArgumentParser(description='导入裂缝监测数据到数据库')
    parser.add_argument('--excel', type=str, help='Excel文件路径')
    # 保留--first-time参数以保持向后兼容，但它不再是必需的
    parser.add_argument('--first-time', action='store_true', help='不再需要指定，程序将自动检测并创建必要的表')

    args = parser.parse_args()

    excel_file = args.excel

    if not excel_file:
        excel_file = input("请输入Excel文件路径: ")

    if not os.path.exists(excel_file):
        print("文件不存在，请检查路径是否正确")
        sys.exit(1)

    # 不再需要区分首次导入和普通导入，统一使用改进的import_crack_excel函数
    if import_crack_excel(excel_file):
        print("导入成功")
    else:
        print("导入失败")