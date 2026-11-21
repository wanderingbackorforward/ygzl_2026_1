# -*- coding: utf-8 -*-
"""批量导入的幂等落库。

背景：data_import 下的三个导入历史上都是 ``to_sql(if_exists='append')``，
同一个文件重传一次整表就翻倍，进而污染 /api/summary、/api/meta/data-range
等对外数字。这里只做“按业务键跳过库里已有的行”，不改任何阈值或口径，
也不改写已有行。
"""

from __future__ import annotations

import datetime as _dt
from typing import Optional, Sequence, Tuple

import pandas as pd
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def _norm(value) -> Optional[str]:
    """把键值归一成可比较的字符串，避免 datetime / Timestamp / numpy 类型哈希不一致。"""
    if value is None:
        return None
    if isinstance(value, pd.Timestamp):
        if pd.isna(value):
            return None
        return value.strftime('%Y-%m-%d %H:%M:%S')
    if isinstance(value, _dt.datetime):
        return pd.Timestamp(value).strftime('%Y-%m-%d %H:%M:%S')
    if isinstance(value, _dt.date):
        return value.isoformat()
    if isinstance(value, float) and pd.isna(value):
        return None
    text_value = str(value).strip().replace('T', ' ')
    # 不同驱动对 DATETIME 的返回形态不一致（有的是 datetime，有的是带微秒的字符串），
    # 统一截到秒，避免同一时刻被判成两个键。
    if len(text_value) >= 19 and text_value[4] == '-' and text_value[7] == '-':
        return text_value[:19]
    return text_value


def _table_columns(engine: Engine, table: str) -> Optional[list]:
    inspector = inspect(engine)
    if table not in inspector.get_table_names():
        return None
    return [col['name'] for col in inspector.get_columns(table)]


def _existing_keys(engine: Engine, table: str, key_cols: Sequence[str]) -> set:
    cols = ', '.join(f'`{c}`' for c in key_cols)
    with engine.connect() as conn:
        rows = conn.execute(text(f'SELECT {cols} FROM `{table}`')).fetchall()
    return {tuple(_norm(v) for v in row) for row in rows}


def append_new_rows(
    df: pd.DataFrame,
    engine: Engine,
    table: str,
    key_cols: Sequence[str],
) -> Tuple[int, int]:
    """按 key_cols 去重后写入；库里已有的键直接跳过。

    返回 (新增行数, 跳过行数)。文件内部重复取最后一条，保持“后写覆盖前写”的直觉。
    表不存在、或表结构缺键列时退化为普通 append，行为与改造前一致。
    """
    if df is None or len(df) == 0:
        return 0, 0

    key_cols = list(key_cols)
    before = len(df)

    work = df.copy()
    work['__idem_key'] = work[key_cols].apply(
        lambda row: tuple(_norm(v) for v in row), axis=1
    )
    work = work.drop_duplicates(subset='__idem_key', keep='last')

    columns = _table_columns(engine, table)
    if columns is not None and all(col in columns for col in key_cols):
        existing = _existing_keys(engine, table, key_cols)
        work = work[~work['__idem_key'].isin(existing)]

    inserted = len(work)
    if inserted:
        work.drop(columns=['__idem_key']).to_sql(
            table, engine, if_exists='append', index=False
        )
    return inserted, before - inserted
