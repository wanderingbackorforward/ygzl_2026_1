# -*- coding: utf-8 -*-
"""InSAR 模块配置管理 - 统一路径发现和环境变量处理"""
import os
from typing import Optional


class InsarConfig:
    """InSAR 模块配置 - 极简路径管理"""

    def __init__(self):
        self.data_dir = self._resolve_data_dir()
        self.raw_dir = os.path.join(self.data_dir, "raw")
        self.processed_dir = os.path.join(self.data_dir, "processed")
        self.cache_dir = self._resolve_cache_dir()

    def _resolve_data_dir(self) -> str:
        """解析数据目录：环境变量 > 多路径探测"""
        if env_dir := os.getenv("INSAR_DATA_DIR"):
            return os.path.abspath(env_dir)

        # 候选路径列表（Vercel 上 cwd=/var/task，本地 cwd=backend/）
        here = os.path.abspath(os.path.dirname(__file__))
        cwd = os.getcwd()
        candidates = []

        # 从模块位置向上查找（backend/modules/insar/ → 项目根）
        for up in [
            os.path.join(here, "..", "..", "..", ".."),          # → python_scripts/
            os.path.join(here, "..", "..", ".."),                # → backend/../
        ]:
            candidates.append(os.path.abspath(up))

        # 从 cwd 向上查找
        candidates.append(cwd)
        candidates.append(os.path.abspath(os.path.join(cwd, "..")))

        # 去重保序
        seen = set()
        unique = []
        for c in candidates:
            if c not in seen:
                seen.add(c)
                unique.append(c)

        # 在每个候选根下搜索 insar 数据目录
        rel_paths = [
            os.path.join("static", "data", "insar"),
            os.path.join("frontend", "public", "static", "data", "insar"),
            os.path.join("frontend", "dist", "static", "data", "insar"),
        ]

        # 优先找有 raw 或 processed 子目录的
        for root in unique:
            for rel in rel_paths:
                path = os.path.join(root, rel)
                if os.path.isdir(os.path.join(path, "raw")) or os.path.isdir(os.path.join(path, "processed")):
                    return path

        # 次选：只要目录存在即可
        for root in unique:
            for rel in rel_paths:
                path = os.path.join(root, rel)
                if os.path.isdir(path):
                    return path

        # 最终回退
        return os.path.join(cwd, "static", "data", "insar")

    def _resolve_cache_dir(self) -> str:
        """解析缓存目录：环境变量 > Serverless 临时目录 > 数据目录"""
        if env_dir := os.getenv("INSAR_CACHE_DIR"):
            return os.path.abspath(env_dir)

        if self._is_serverless():
            cache_path = os.path.join("/tmp", "insar", "processed")
            try:
                os.makedirs(cache_path, exist_ok=True)
            except OSError:
                pass
            return cache_path

        return self.processed_dir

    @staticmethod
    def _is_serverless() -> bool:
        """检测是否运行在 Serverless 环境"""
        return (
            os.getenv("VERCEL") == "1" or
            bool(os.getenv("AWS_LAMBDA_FUNCTION_NAME")) or
            bool(os.getenv("NOW_REGION"))
        )


# 全局配置实例
config = InsarConfig()
