import mysql.connector
import pandas as pd
import numpy as np
from modules.database.db_config import db_config

class MySQLRepo:
    def get_all_points(self):
        conn = mysql.connector.connect(**db_config)
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT mp.*, sa.alert_level, sa.trend_type
            FROM monitoring_points mp
            LEFT JOIN settlement_analysis sa ON mp.point_id = sa.point_id
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows

    def get_point_detail(self, point_id):
        conn = mysql.connector.connect(**db_config)
        ts = pd.read_sql(
            """
            SELECT measurement_date, value, daily_change, cumulative_change
            FROM processed_settlement_data
            WHERE point_id = %s
            ORDER BY measurement_date
            """,
            conn, params=(point_id,)
        )
        ts['measurement_date'] = ts['measurement_date'].astype(str)
        ts = ts.replace({np.nan: None}).to_dict('records')
        ana = pd.read_sql(
            "SELECT * FROM settlement_analysis WHERE point_id = %s",
            conn, params=(point_id,)
        )
        ana_dict = {}
        if not ana.empty:
            ana_dict = ana.replace({np.nan: None}).to_dict('records')[0]
        conn.close()
        return {'timeSeriesData': ts, 'analysisData': ana_dict}

    def get_summary(self):
        conn = mysql.connector.connect(**db_config)
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT * FROM settlement_analysis
            ORDER BY CAST(REGEXP_REPLACE(point_id, '[^0-9]+', '') AS UNSIGNED), point_id
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows

    def get_trends(self):
        conn = mysql.connector.connect(**db_config)
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT trend_type, COUNT(*) as count
            FROM settlement_analysis
            GROUP BY trend_type
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
