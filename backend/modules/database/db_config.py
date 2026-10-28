# -*- coding: utf-8 -*-
"""MySQL connection config for ETL / batch scripts and MySQLRepo.

Online API code should prefer ``modules.db.vendor.get_repo()`` (works with
``DB_VENDOR=supabase_http``). This module stays MySQL-oriented on purpose.

Environment (optional; defaults preserve historical local-dev behavior):

- MYSQL_HOST (default: localhost)
- MYSQL_PORT (default: 3306) — used in SQLAlchemy URLs only
- MYSQL_USER (default: root)
- MYSQL_PASSWORD (default: 123456)
- MYSQL_DATABASE (default: settlement_monitoring)
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Dict
from urllib.parse import quote_plus

import mysql.connector


def _env(key: str, default: str) -> str:
    val = os.environ.get(key)
    if val is None or str(val).strip() == '':
        return default
    return str(val).strip()


def load_db_config() -> Dict[str, object]:
    """Build mysql.connector kwargs from env with legacy defaults."""
    return {
        'user': _env('MYSQL_USER', 'root'),
        'password': _env('MYSQL_PASSWORD', '123456'),
        'host': _env('MYSQL_HOST', 'localhost'),
        'database': _env('MYSQL_DATABASE', 'settlement_monitoring'),
        'charset': 'utf8mb4',
        'use_unicode': True,
    }


# Mutable module-level dict kept for ``from ... import db_config`` call sites.
db_config = load_db_config()


def reload_db_config() -> Dict[str, object]:
    """Refresh ``db_config`` from the current process environment."""
    db_config.clear()
    db_config.update(load_db_config())
    return db_config


def sqlalchemy_url(driver: str = 'pymysql', include_database: bool = True) -> str:
    """SQLAlchemy URL for ETL scripts (pymysql or mysqlconnector).

    Password is URL-encoded so special characters in MYSQL_PASSWORD are safe.
    """
    cfg = db_config
    user = quote_plus(str(cfg['user']))
    password = quote_plus(str(cfg['password']))
    host = str(cfg['host'])
    port = _env('MYSQL_PORT', '3306')
    database = str(cfg['database'])
    base = f"mysql+{driver}://{user}:{password}@{host}:{port}"
    if include_database:
        return f"{base}/{database}"
    return base


def get_db_connection():
    """Create a mysql.connector connection using ``db_config``."""
    try:
        return mysql.connector.connect(**db_config)
    except mysql.connector.Error as err:
        print(f"数据库连接错误: {err}")
        return None


@contextmanager
def get_db_cursor():
    """Yield a dict cursor; commit on success, rollback on error."""
    conn = get_db_connection()
    if conn is None:
        raise Exception("无法建立数据库连接")

    try:
        cursor = conn.cursor(dictionary=True)
        yield cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()
