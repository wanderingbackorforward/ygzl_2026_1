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

    def crack_get_monitoring_points(self):
        conn = mysql.connector.connect(**db_config)
        df = pd.read_sql("SELECT * FROM crack_monitoring_points WHERE status = 'active'", conn)
        if 'monitoring_start_date' in df.columns:
            df['monitoring_start_date'] = pd.to_datetime(df['monitoring_start_date']).dt.strftime('%Y-%m-%d %H:%M:%S')
        if 'monitoring_end_date' in df.columns:
            df['monitoring_end_date'] = pd.to_datetime(df['monitoring_end_date']).dt.strftime('%Y-%m-%d %H:%M:%S')
        res = df.replace({np.nan: None}).to_dict(orient='records')
        conn.close()
        return res

    def crack_get_data(self):
        conn = mysql.connector.connect(**db_config)
        df = pd.read_sql("SELECT * FROM raw_crack_data ORDER BY measurement_date", conn)
        if 'measurement_date' in df.columns:
            df['measurement_date'] = pd.to_datetime(df['measurement_date']).dt.strftime('%Y-%m-%d %H:%M:%S')
        res = df.replace({np.nan: None}).to_dict(orient='records')
        conn.close()
        return res

    def crack_get_analysis_results(self):
        conn = mysql.connector.connect(**db_config)
        df = pd.read_sql(
            "SELECT r.*, p.trend_type, p.change_type FROM crack_analysis_results r JOIN crack_monitoring_points p ON r.point_id = p.point_id ORDER BY r.analysis_date DESC",
            conn
        )
        if 'analysis_date' in df.columns:
            df['analysis_date'] = pd.to_datetime(df['analysis_date']).dt.strftime('%Y-%m-%d %H:%M:%S')
        res = df.replace({np.nan: None}).to_dict(orient='records')
        conn.close()
        return res

    def crack_get_trend_data(self):
        conn = mysql.connector.connect(**db_config)
        df = pd.read_sql("SELECT * FROM raw_crack_data ORDER BY measurement_date", conn)
        if 'id' in df.columns:
            df.drop(columns=['id'], inplace=True)
        point_columns = [c for c in df.columns if c != 'measurement_date']
        dates = pd.to_datetime(df['measurement_date']).dt.strftime('%Y-%m-%d %H:%M:%S').tolist()
        series = [{'name': p, 'data': [None if pd.isna(v) else v for v in df[p].tolist()]} for p in point_columns]
        conn.close()
        return {'dates': dates, 'series': series}

    def temperature_get_points(self):
        conn = mysql.connector.connect(**db_config)
        df = pd.read_sql("SELECT * FROM temperature_monitoring_points WHERE status = 'active'", conn)
        res = df.replace({np.nan: None}).to_dict(orient='records')
        conn.close()
        return res

    def temperature_get_summary(self):
        conn = mysql.connector.connect(**db_config)
        df = pd.read_sql("SELECT * FROM temperature_analysis ORDER BY CAST(REGEXP_REPLACE(sensor_id, '[^0-9]+', '') AS UNSIGNED), sensor_id", conn)
        if 'last_updated' in df.columns:
            df['last_updated'] = pd.to_datetime(df['last_updated']).dt.strftime('%Y-%m-%d %H:%M:%S')
        res = df.replace({np.nan: None}).to_dict(orient='records')
        conn.close()
        return res

    def temperature_get_data(self, sensor_id):
        conn = mysql.connector.connect(**db_config)
        df = pd.read_sql("SELECT * FROM processed_temperature_data WHERE SID = %s ORDER BY measurement_date", conn, params=(sensor_id,))
        if 'measurement_date' in df.columns:
            df['measurement_date'] = pd.to_datetime(df['measurement_date']).dt.strftime('%Y-%m-%d')
        rename = {}
        if 'avg_temp' in df.columns and 'avg_temperature' not in df.columns:
            rename['avg_temp'] = 'avg_temperature'
        if 'min_temp' in df.columns and 'min_temperature' not in df.columns:
            rename['min_temp'] = 'min_temperature'
        if 'max_temp' in df.columns and 'max_temperature' not in df.columns:
            rename['max_temp'] = 'max_temperature'
        if rename:
            df = df.rename(columns=rename)
        if {'max_temperature', 'min_temperature'}.issubset(df.columns) and 'temperature_range' not in df.columns:
            df['temperature_range'] = df['max_temperature'] - df['min_temperature']
        df = df.replace({np.nan: None})
        analysis_df = pd.read_sql("SELECT * FROM temperature_analysis WHERE sensor_id = %s", conn, params=(sensor_id,))
        analysis = {}
        if not analysis_df.empty:
            if 'last_updated' in analysis_df.columns:
                analysis_df['last_updated'] = pd.to_datetime(analysis_df['last_updated']).dt.strftime('%Y-%m-%d %H:%M:%S')
            analysis_df = analysis_df.replace({np.nan: None})
            if 'avg_temp' in analysis_df.columns and 'avg_temperature' not in analysis_df.columns:
                analysis_df = analysis_df.rename(columns={'avg_temp': 'avg_temperature'})
            if 'min_temp' in analysis_df.columns and 'min_temperature' not in analysis_df.columns:
                analysis_df = analysis_df.rename(columns={'min_temp': 'min_temperature'})
            if 'max_temp' in analysis_df.columns and 'max_temperature' not in analysis_df.columns:
                analysis_df = analysis_df.rename(columns={'max_temp': 'max_temperature'})
            analysis = analysis_df.to_dict(orient='records')[0]
        conn.close()
        return {'timeSeriesData': df.to_dict(orient='records'), 'analysisData': analysis}

    def temperature_get_data_multi(self, sensor_ids):
        conn = mysql.connector.connect(**db_config)
        result = {}
        for sensor_id in sensor_ids:
            df = pd.read_sql("SELECT * FROM processed_temperature_data WHERE SID = %s ORDER BY measurement_date", conn, params=(sensor_id,))
            if 'measurement_date' in df.columns:
                df['measurement_date'] = pd.to_datetime(df['measurement_date']).dt.strftime('%Y-%m-%d')
            rename = {}
            if 'avg_temp' in df.columns and 'avg_temperature' not in df.columns:
                rename['avg_temp'] = 'avg_temperature'
            if 'min_temp' in df.columns and 'min_temperature' not in df.columns:
                rename['min_temp'] = 'min_temperature'
            if 'max_temp' in df.columns and 'max_temperature' not in df.columns:
                rename['max_temp'] = 'max_temperature'
            if rename:
                df = df.rename(columns=rename)
            if {'max_temperature', 'min_temperature'}.issubset(df.columns) and 'temperature_range' not in df.columns:
                df['temperature_range'] = df['max_temperature'] - df['min_temperature']
            df = df.replace({np.nan: None})
            result[sensor_id] = df.to_dict(orient='records')
        conn.close()
        return result

    def temperature_get_trends(self):
        conn = mysql.connector.connect(**db_config)
        df = pd.read_sql("SELECT trend_type, COUNT(*) as count FROM temperature_analysis GROUP BY trend_type", conn)
        res = df.replace({np.nan: None}).to_dict(orient='records')
        conn.close()
        return res

    def temperature_get_stats(self):
        conn = mysql.connector.connect(**db_config)
        latest_df = pd.read_sql("SELECT AVG(avg_temperature) as current_avg_temp, MAX(avg_temperature) as current_max_temp, MIN(avg_temperature) as current_min_temp FROM processed_temperature_data WHERE measurement_date = (SELECT MAX(measurement_date) FROM processed_temperature_data)", conn)
        sensor_count_df = pd.read_sql("SELECT COUNT(DISTINCT sensor_id) as sensor_count FROM temperature_analysis", conn)
        date_range_df = pd.read_sql("SELECT MIN(measurement_date) as min_date, MAX(measurement_date) as max_date FROM processed_temperature_data", conn)
        min_date_str = date_range_df['min_date'].iloc[0].strftime('%Y-%m-%d') if not date_range_df.empty and pd.notna(date_range_df['min_date'].iloc[0]) else None
        max_date_str = date_range_df['max_date'].iloc[0].strftime('%Y-%m-%d') if not date_range_df.empty and pd.notna(date_range_df['max_date'].iloc[0]) else None
        date_range_display = f"{min_date_str} ~ {max_date_str}" if min_date_str and max_date_str and min_date_str != max_date_str else (min_date_str or max_date_str)
        trends_df = pd.read_sql("SELECT trend_type, COUNT(*) as count FROM temperature_analysis GROUP BY trend_type", conn)
        alerts_df = pd.read_sql("SELECT alert_level, COUNT(*) as count FROM temperature_analysis GROUP BY alert_level", conn)
        total_sensors = int(sensor_count_df['sensor_count'].iloc[0]) if not sensor_count_df.empty else 0
        stats = {
            'current_temperature': {
                'avg': float(latest_df['current_avg_temp'].iloc[0]) if not latest_df.empty and pd.notna(latest_df['current_avg_temp'].iloc[0]) else None,
                'max': float(latest_df['current_max_temp'].iloc[0]) if not latest_df.empty and pd.notna(latest_df['current_max_temp'].iloc[0]) else None,
                'min': float(latest_df['current_min_temp'].iloc[0]) if not latest_df.empty and pd.notna(latest_df['current_min_temp'].iloc[0]) else None,
                'sensor_count': total_sensors,
                'date_range': date_range_display
            },
            'trends': trends_df.set_index('trend_type')['count'].to_dict() if not trends_df.empty else {},
            'alerts': alerts_df.set_index('alert_level')['count'].to_dict() if not alerts_df.empty else {}
        }
        conn.close()
        return stats
