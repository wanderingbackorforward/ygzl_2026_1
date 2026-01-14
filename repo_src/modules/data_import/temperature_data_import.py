import pandas as pd
import pyodbc
import mysql.connector
from sqlalchemy import create_engine, text
import os
import sys

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# 导入数据库配置
from modules.database.db_config import db_config

def import_mdb_to_mysql(mdb_path):
    """从MDB文件导入温度数据到MySQL数据库"""
    print(f"开始从MDB文件导入温度数据: {mdb_path}")

    try:
        # 检查文件是否存在
        if not os.path.exists(mdb_path):
            print(f"错误: 文件 {mdb_path} 不存在")
            return False
        
        # 创建Access数据库连接
        conn_str = f"Driver={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={mdb_path}"
        access_conn = pyodbc.connect(conn_str)
        access_cursor = access_conn.cursor()
        
        # 创建MySQL数据库连接
        engine = create_engine(
            f"mysql+pymysql://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['database']}")
        
        # 1. 导入传感器信息
        print("正在导入传感器信息...")
        # 查询温度传感器信息 - 根据MDB文件分析, ST2字段为'温度'表示传感器可测温度
        sensor_query = """
        SELECT SID, SName, MID, CHID, SensorType, ST1, Unit1, ST2, Unit2, Factory, SN
        FROM Sensor
        WHERE ST2 = '温度' OR SensorType LIKE '%温度%'
        """
        
        try:
            # 执行查询
            access_cursor.execute(sensor_query)
            sensors = access_cursor.fetchall()
            
            if not sensors:
                print("警告: 未找到温度传感器信息")
                # 扩大查询范围，尝试获取所有传感器
                access_cursor.execute("SELECT SID, SName, MID, CHID, SensorType, ST1, Unit1, ST2, Unit2, Factory, SN FROM Sensor")
                sensors = access_cursor.fetchall()
                print(f"获取了 {len(sensors)} 个传感器信息，将筛选出温度相关数据")
            
            # 获取列名
            columns = [column[0] for column in access_cursor.description]
            
            # 创建DataFrame
            sensors_df = pd.DataFrame.from_records(sensors, columns=columns)
            
            # 保存到MySQL
            sensors_df.to_sql('temperature_sensors', engine, if_exists='replace', index=False)
            print(f"成功导入 {len(sensors_df)} 个传感器信息到 temperature_sensors 表")
            
        except Exception as e:
            print(f"导入传感器信息失败: {str(e)}")
            return False
        
        # 2. 导入MCU控制单元信息
        print("正在导入MCU控制单元信息...")
        mcu_query = """
        SELECT MID, MName, MType, MCHCount, MAddress, MConnect
        FROM MCU
        """
        
        try:
            access_cursor.execute(mcu_query)
            mcus = access_cursor.fetchall()
            
            # 获取列名
            columns = [column[0] for column in access_cursor.description]
            
            # 创建DataFrame
            mcus_df = pd.DataFrame.from_records(mcus, columns=columns)
            
            # 保存到MySQL
            mcus_df.to_sql('temperature_mcus', engine, if_exists='replace', index=False)
            print(f"成功导入 {len(mcus_df)} 个MCU信息到 temperature_mcus 表")
            
        except Exception as e:
            print(f"导入MCU信息失败: {str(e)}")
            # 继续执行，MCU信息不是必需的
        
        # 3. 导入温度数据
        print("正在导入温度测量数据...")
        # R2字段根据分析可能是温度数据
        # 为了避免导入过多数据，我们只导入与特定传感器相关的数据
        
        # 先获取已导入的温度传感器ID列表
        with engine.connect() as conn:
            result = conn.execute(text("SELECT SID FROM temperature_sensors"))
            sensor_ids = [row[0] for row in result]
        
        if not sensor_ids:
            print("警告: 未找到温度传感器ID，将尝试导入所有数据")
            # 如果没有找到温度传感器ID，先导入一批样本数据
            data_query = """
            SELECT TOP 10000 DID, SID, DataTime, S1, S2, R1, R2, IsWarning
            FROM Data
            ORDER BY DataTime DESC
            """
        else:
            # 构建IN条件字符串
            sensor_ids_str = ','.join(str(sid) for sid in sensor_ids)
            data_query = f"""
            SELECT DID, SID, DataTime, S1, S2, R1, R2, IsWarning
            FROM Data
            WHERE SID IN ({sensor_ids_str})
            ORDER BY DataTime DESC
            """
        
        try:
            print(f"正在执行查询: {data_query}")
            # 为了避免内存问题，分批读取数据
            batch_size = 50000
            offset = 0
            total_imported = 0
            
            while True:
                batch_query = f"{data_query} OFFSET {offset} ROWS FETCH NEXT {batch_size} ROWS ONLY"
                try:
                    access_cursor.execute(batch_query)
                except Exception as e:
                    # 如果不支持OFFSET-FETCH语法，尝试使用TOP
                    if offset == 0:
                        batch_query = f"SELECT TOP {batch_size} DID, SID, DataTime, S1, S2, R1, R2, IsWarning FROM Data ORDER BY DataTime DESC"
                        access_cursor.execute(batch_query)
                    else:
                        print(f"警告: 分批查询不支持，已导入前 {total_imported} 条记录")
                        break
                
                batch_data = access_cursor.fetchall()
                if not batch_data:
                    break
                
                # 获取列名
                columns = [column[0] for column in access_cursor.description]
                
                # 创建DataFrame
                data_df = pd.DataFrame.from_records(batch_data, columns=columns)
                
                # 转换日期格式
                data_df['DataTime'] = pd.to_datetime(data_df['DataTime'])
                
                # 重命名列以符合我们的标准
                data_df.rename(columns={
                    'DataTime': 'measurement_date',
                    'R2': 'temperature',  # 假设R2是温度值
                    'R1': 'raw_value',    # 原始测量值
                    'S1': 'value1',       # 其他测量值
                    'S2': 'value2'        # 其他测量值
                }, inplace=True)
                
                # 保存到MySQL
                data_df.to_sql('raw_temperature_data', engine, if_exists='append' if total_imported > 0 else 'replace', index=False)
                
                total_imported += len(data_df)
                print(f"已导入 {total_imported} 条温度数据记录")
                
                offset += batch_size
                if len(batch_data) < batch_size:
                    break
            
            print(f"成功导入总计 {total_imported} 条温度数据到 raw_temperature_data 表")
            
        except Exception as e:
            print(f"导入温度数据失败: {str(e)}")
            return False
        
        # 关闭连接
        access_cursor.close()
        access_conn.close()
        
        print("温度数据导入完成")
        return True
        
    except Exception as e:
        print(f"导入过程中出错: {str(e)}")
        return False

if __name__ == "__main__":
    # 指定MDB文件路径
    mdb_path = input("请输入MDB文件路径: ")

    if os.path.exists(mdb_path):
        import_mdb_to_mysql(mdb_path)
    else:
        print("文件不存在，请检查路径是否正确")
