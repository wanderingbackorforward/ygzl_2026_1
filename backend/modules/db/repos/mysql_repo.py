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
            """
            SELECT
              r.*,
              p.trend_type,
              p.change_type,
              p.total_change,
              p.average_change_rate,
              p.trend_slope,
              r.mean_value AS avg_value,
              p.average_change_rate AS avg_daily_rate,
              p.trend_slope AS slope
            FROM crack_analysis_results r
            JOIN crack_monitoring_points p ON r.point_id = p.point_id
            ORDER BY r.analysis_date DESC
            """,
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

    def temperature_get_processed_window(self, days: int = 90):
        conn = mysql.connector.connect(**db_config)
        days = int(days) if days is not None else 90
        days = 1 if days <= 0 else days
        df = pd.read_sql(
            """
            SELECT *
            FROM processed_temperature_data
            WHERE measurement_date >= DATE_SUB((SELECT MAX(measurement_date) FROM processed_temperature_data), INTERVAL %s DAY)
            ORDER BY measurement_date
            """,
            conn,
            params=(days,)
        )
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
        conn.close()
        return df.to_dict(orient='records')

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

    def tunnel_ensure_schema(self):
        conn = mysql.connector.connect(**db_config)
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS `tunnel_projects` (
              `project_id` VARCHAR(36) PRIMARY KEY,
              `name` VARCHAR(200) NOT NULL,
              `description` TEXT,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS `tunnel_alignments` (
              `alignment_id` VARCHAR(36) PRIMARY KEY,
              `project_id` VARCHAR(36) NOT NULL,
              `name` VARCHAR(200) NOT NULL,
              `geojson` TEXT,
              `srid` INT DEFAULT 4326,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              INDEX (`project_id`)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS `tunnel_point_mappings` (
              `mapping_id` VARCHAR(36) PRIMARY KEY,
              `project_id` VARCHAR(36) NOT NULL,
              `point_id` VARCHAR(50) NOT NULL,
              `alignment_id` VARCHAR(36),
              `chainage_m` DOUBLE,
              `offset_m` DOUBLE,
              `side` VARCHAR(10),
              `section_name` VARCHAR(100),
              `structure_part` VARCHAR(50),
              `ring_no` INT,
              `remark` VARCHAR(255),
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY `uq_tunnel_point_mapping` (`project_id`, `point_id`),
              INDEX (`project_id`),
              INDEX (`alignment_id`)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS `tbm_telemetry` (
              `record_id` VARCHAR(36) PRIMARY KEY,
              `project_id` VARCHAR(36) NOT NULL,
              `machine_id` VARCHAR(50) NOT NULL,
              `ts` DATETIME NOT NULL,
              `chainage_m` DOUBLE,
              `ring_no` INT,
              `thrust_kN` DOUBLE,
              `torque_kNm` DOUBLE,
              `face_pressure_kPa` DOUBLE,
              `slurry_pressure_kPa` DOUBLE,
              `advance_rate_mm_min` DOUBLE,
              `cutterhead_rpm` DOUBLE,
              `pitch_deg` DOUBLE,
              `roll_deg` DOUBLE,
              `yaw_deg` DOUBLE,
              `grout_volume_L` DOUBLE,
              `grout_pressure_kPa` DOUBLE,
              `status` VARCHAR(20),
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY `uq_tbm_telemetry` (`project_id`, `machine_id`, `ts`),
              INDEX (`project_id`),
              INDEX (`machine_id`),
              INDEX (`ts`)
            )
            """
        )
        conn.commit()
        cur.close()
        conn.close()

    def tunnel_projects_list(self):
        self.tunnel_ensure_schema()
        conn = mysql.connector.connect(**db_config)
        df = pd.read_sql(
            "SELECT project_id, name, description, created_at FROM tunnel_projects ORDER BY created_at DESC",
            conn,
        )
        if "created_at" in df.columns:
            df["created_at"] = pd.to_datetime(df["created_at"]).dt.strftime("%Y-%m-%d %H:%M:%S")
        res = df.replace({np.nan: None}).to_dict(orient="records")
        conn.close()
        return res

    def tunnel_project_create(self, payload):
        self.tunnel_ensure_schema()
        conn = mysql.connector.connect(**db_config)
        cur = conn.cursor(dictionary=True)
        cur.execute(
            """
            INSERT INTO tunnel_projects (project_id, name, description)
            VALUES (%s, %s, %s)
            """,
            (payload.get("project_id"), payload.get("name"), payload.get("description")),
        )
        conn.commit()
        cur.execute(
            "SELECT project_id, name, description, created_at FROM tunnel_projects WHERE project_id = %s",
            (payload.get("project_id"),),
        )
        row = cur.fetchone() or {}
        cur.close()
        conn.close()
        if row.get("created_at") is not None:
            row["created_at"] = str(row["created_at"])
        return row

    def tunnel_alignments_list(self, project_id=None):
        self.tunnel_ensure_schema()
        conn = mysql.connector.connect(**db_config)
        if project_id:
            df = pd.read_sql(
                """
                SELECT alignment_id, project_id, name, geojson, srid, created_at
                FROM tunnel_alignments
                WHERE project_id = %s
                ORDER BY created_at DESC
                """,
                conn,
                params=(project_id,),
            )
        else:
            df = pd.read_sql(
                """
                SELECT alignment_id, project_id, name, geojson, srid, created_at
                FROM tunnel_alignments
                ORDER BY created_at DESC
                """,
                conn,
            )
        if "created_at" in df.columns:
            df["created_at"] = pd.to_datetime(df["created_at"]).dt.strftime("%Y-%m-%d %H:%M:%S")
        res = df.replace({np.nan: None}).to_dict(orient="records")
        conn.close()
        return res

    def tunnel_alignment_create(self, payload):
        self.tunnel_ensure_schema()
        conn = mysql.connector.connect(**db_config)
        cur = conn.cursor(dictionary=True)
        cur.execute(
            """
            INSERT INTO tunnel_alignments (alignment_id, project_id, name, geojson, srid)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                payload.get("alignment_id"),
                payload.get("project_id"),
                payload.get("name"),
                payload.get("geojson"),
                payload.get("srid"),
            ),
        )
        conn.commit()
        cur.execute(
            """
            SELECT alignment_id, project_id, name, geojson, srid, created_at
            FROM tunnel_alignments
            WHERE alignment_id = %s
            """,
            (payload.get("alignment_id"),),
        )
        row = cur.fetchone() or {}
        cur.close()
        conn.close()
        if row.get("created_at") is not None:
            row["created_at"] = str(row["created_at"])
        return row

    def tunnel_alignment_get(self, alignment_id):
        self.tunnel_ensure_schema()
        conn = mysql.connector.connect(**db_config)
        df = pd.read_sql(
            """
            SELECT alignment_id, project_id, name, geojson, srid, created_at
            FROM tunnel_alignments
            WHERE alignment_id = %s
            LIMIT 1
            """,
            conn,
            params=(alignment_id,),
        )
        conn.close()
        if df.empty:
            return None
        row = df.replace({np.nan: None}).to_dict(orient="records")[0]
        if row.get("created_at") is not None:
            row["created_at"] = str(row["created_at"])
        return row

    def tunnel_point_mappings_list(self, project_id, alignment_id=None):
        self.tunnel_ensure_schema()
        conn = mysql.connector.connect(**db_config)
        if alignment_id:
            df = pd.read_sql(
                """
                SELECT
                  mapping_id, project_id, point_id, alignment_id,
                  chainage_m, offset_m, side, section_name, structure_part, ring_no, remark,
                  created_at, updated_at
                FROM tunnel_point_mappings
                WHERE project_id = %s AND alignment_id = %s
                ORDER BY updated_at DESC
                """,
                conn,
                params=(project_id, alignment_id),
            )
        else:
            df = pd.read_sql(
                """
                SELECT
                  mapping_id, project_id, point_id, alignment_id,
                  chainage_m, offset_m, side, section_name, structure_part, ring_no, remark,
                  created_at, updated_at
                FROM tunnel_point_mappings
                WHERE project_id = %s
                ORDER BY updated_at DESC
                """,
                conn,
                params=(project_id,),
            )
        for k in ("created_at", "updated_at"):
            if k in df.columns:
                df[k] = pd.to_datetime(df[k]).dt.strftime("%Y-%m-%d %H:%M:%S")
        res = df.replace({np.nan: None}).to_dict(orient="records")
        conn.close()
        return res

    def tunnel_point_mapping_upsert(self, payload):
        self.tunnel_ensure_schema()
        conn = mysql.connector.connect(**db_config)
        cur = conn.cursor(dictionary=True)
        cur.execute(
            """
            INSERT INTO tunnel_point_mappings (
              mapping_id, project_id, point_id, alignment_id,
              chainage_m, offset_m, side, section_name, structure_part, ring_no, remark
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
              alignment_id = VALUES(alignment_id),
              chainage_m = VALUES(chainage_m),
              offset_m = VALUES(offset_m),
              side = VALUES(side),
              section_name = VALUES(section_name),
              structure_part = VALUES(structure_part),
              ring_no = VALUES(ring_no),
              remark = VALUES(remark)
            """,
            (
                payload.get("mapping_id"),
                payload.get("project_id"),
                payload.get("point_id"),
                payload.get("alignment_id"),
                payload.get("chainage_m"),
                payload.get("offset_m"),
                payload.get("side"),
                payload.get("section_name"),
                payload.get("structure_part"),
                payload.get("ring_no"),
                payload.get("remark"),
            ),
        )
        conn.commit()
        cur.execute(
            """
            SELECT
              mapping_id, project_id, point_id, alignment_id,
              chainage_m, offset_m, side, section_name, structure_part, ring_no, remark,
              created_at, updated_at
            FROM tunnel_point_mappings
            WHERE project_id = %s AND point_id = %s
            """,
            (payload.get("project_id"), payload.get("point_id")),
        )
        row = cur.fetchone() or {}
        cur.close()
        conn.close()
        for k in ("created_at", "updated_at"):
            if row.get(k) is not None:
                row[k] = str(row[k])
        return row

    def tbm_telemetry_upsert(self, payload):
        self.tunnel_ensure_schema()
        conn = mysql.connector.connect(**db_config)
        cur = conn.cursor(dictionary=True)
        cur.execute(
            """
            INSERT INTO tbm_telemetry (
              record_id, project_id, machine_id, ts, chainage_m, ring_no,
              thrust_kN, torque_kNm, face_pressure_kPa, slurry_pressure_kPa,
              advance_rate_mm_min, cutterhead_rpm, pitch_deg, roll_deg, yaw_deg,
              grout_volume_L, grout_pressure_kPa, status
            ) VALUES (
              %s, %s, %s, %s, %s, %s,
              %s, %s, %s, %s,
              %s, %s, %s, %s, %s,
              %s, %s, %s
            )
            ON DUPLICATE KEY UPDATE
              chainage_m = VALUES(chainage_m),
              ring_no = VALUES(ring_no),
              thrust_kN = VALUES(thrust_kN),
              torque_kNm = VALUES(torque_kNm),
              face_pressure_kPa = VALUES(face_pressure_kPa),
              slurry_pressure_kPa = VALUES(slurry_pressure_kPa),
              advance_rate_mm_min = VALUES(advance_rate_mm_min),
              cutterhead_rpm = VALUES(cutterhead_rpm),
              pitch_deg = VALUES(pitch_deg),
              roll_deg = VALUES(roll_deg),
              yaw_deg = VALUES(yaw_deg),
              grout_volume_L = VALUES(grout_volume_L),
              grout_pressure_kPa = VALUES(grout_pressure_kPa),
              status = VALUES(status)
            """,
            (
                payload.get("record_id"),
                payload.get("project_id"),
                payload.get("machine_id"),
                payload.get("ts"),
                payload.get("chainage_m"),
                payload.get("ring_no"),
                payload.get("thrust_kN"),
                payload.get("torque_kNm"),
                payload.get("face_pressure_kPa"),
                payload.get("slurry_pressure_kPa"),
                payload.get("advance_rate_mm_min"),
                payload.get("cutterhead_rpm"),
                payload.get("pitch_deg"),
                payload.get("roll_deg"),
                payload.get("yaw_deg"),
                payload.get("grout_volume_L"),
                payload.get("grout_pressure_kPa"),
                payload.get("status"),
            ),
        )
        conn.commit()
        cur.execute(
            """
            SELECT
              record_id, project_id, machine_id, ts, chainage_m, ring_no,
              thrust_kN, torque_kNm, face_pressure_kPa, slurry_pressure_kPa,
              advance_rate_mm_min, cutterhead_rpm, pitch_deg, roll_deg, yaw_deg,
              grout_volume_L, grout_pressure_kPa, status,
              created_at, updated_at
            FROM tbm_telemetry
            WHERE project_id = %s AND machine_id = %s AND ts = %s
            """,
            (payload.get("project_id"), payload.get("machine_id"), payload.get("ts")),
        )
        row = cur.fetchone() or {}
        cur.close()
        conn.close()
        for k in ("ts", "created_at", "updated_at"):
            if row.get(k) is not None:
                row[k] = str(row[k])
        return row

    def tbm_telemetry_list(self, project_id, machine_id=None, start=None, end=None, limit=5000):
        self.tunnel_ensure_schema()
        conn = mysql.connector.connect(**db_config)
        limit = int(limit) if limit is not None else 5000
        limit = 1 if limit <= 0 else min(limit, 20000)
        clauses = ["project_id = %s"]
        params = [project_id]
        if machine_id:
            clauses.append("machine_id = %s")
            params.append(machine_id)
        if start:
            clauses.append("ts >= %s")
            params.append(start)
        if end:
            clauses.append("ts <= %s")
            params.append(end)
        where = " AND ".join(clauses)
        df = pd.read_sql(
            f"""
            SELECT
              record_id, project_id, machine_id, ts, chainage_m, ring_no,
              thrust_kN, torque_kNm, face_pressure_kPa, slurry_pressure_kPa,
              advance_rate_mm_min, cutterhead_rpm, pitch_deg, roll_deg, yaw_deg,
              grout_volume_L, grout_pressure_kPa, status
            FROM tbm_telemetry
            WHERE {where}
            ORDER BY ts ASC
            LIMIT {limit}
            """,
            conn,
            params=tuple(params),
        )
        if "ts" in df.columns:
            df["ts"] = pd.to_datetime(df["ts"]).dt.strftime("%Y-%m-%d %H:%M:%S")
        res = df.replace({np.nan: None}).to_dict(orient="records")
        conn.close()
        return res

    def tbm_telemetry_list_by_chainage(self, project_id, machine_id=None, start_chainage=None, end_chainage=None, limit=5000):
        self.tunnel_ensure_schema()
        conn = mysql.connector.connect(**db_config)
        limit = int(limit) if limit is not None else 5000
        limit = 1 if limit <= 0 else min(limit, 20000)
        clauses = ["project_id = %s", "chainage_m IS NOT NULL"]
        params = [project_id]
        if machine_id:
            clauses.append("machine_id = %s")
            params.append(machine_id)
        if start_chainage is not None:
            clauses.append("chainage_m >= %s")
            params.append(start_chainage)
        if end_chainage is not None:
            clauses.append("chainage_m <= %s")
            params.append(end_chainage)
        where = " AND ".join(clauses)
        df = pd.read_sql(
            f"""
            SELECT
              record_id, project_id, machine_id, ts, chainage_m, ring_no,
              thrust_kN, torque_kNm, face_pressure_kPa, slurry_pressure_kPa,
              advance_rate_mm_min, cutterhead_rpm, pitch_deg, roll_deg, yaw_deg,
              grout_volume_L, grout_pressure_kPa, status
            FROM tbm_telemetry
            WHERE {where}
            ORDER BY chainage_m ASC
            LIMIT {limit}
            """,
            conn,
            params=tuple(params),
        )
        if "ts" in df.columns:
            df["ts"] = pd.to_datetime(df["ts"]).dt.strftime("%Y-%m-%d %H:%M:%S")
        res = df.replace({np.nan: None}).to_dict(orient="records")
        conn.close()
        return res

    def tbm_progress(self, project_id, machine_id):
        self.tunnel_ensure_schema()
        conn = mysql.connector.connect(**db_config)
        df = pd.read_sql(
            """
            SELECT
              record_id, project_id, machine_id, ts, chainage_m, ring_no, status
            FROM tbm_telemetry
            WHERE project_id = %s AND machine_id = %s
            ORDER BY ts DESC
            LIMIT 1
            """,
            conn,
            params=(project_id, machine_id),
        )
        conn.close()
        if df.empty:
            return None
        row = df.replace({np.nan: None}).to_dict(orient="records")[0]
        if row.get("ts") is not None:
            row["ts"] = str(row["ts"])
        return row
