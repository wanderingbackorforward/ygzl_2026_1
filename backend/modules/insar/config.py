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
        """解析数据目录：环境变量 > 默认路径"""
        if env_dir := os.getenv("INSAR_DATA_DIR"):
            return os.path.abspath(env_dir)

        # 默认路径：从当前工作目录查找 static/data/insar
        cwd = os.getcwd()
        default_path = os.path.join(cwd, "static", "data", "insar")
        if os.path.isdir(default_path):
            return default_path

        # 回退：frontend/public/static/data/insar
        frontend_path = os.path.join(cwd, "frontend", "public", "static", "data", "insar")
        if os.path.isdir(frontend_path):
            return frontend_path

        # 最终回退：创建默认目录
        os.makedirs(default_path, exist_ok=True)
        return default_path

    def _resolve_cache_dir(self) -> str:
        """解析缓存目录：环境变量 > Serverless 临时目录 > 数据目录"""
        if env_dir := os.getenv("INSAR_CACHE_DIR"):
            return os.path.abspath(env_dir)

        if self._is_serverless():
            cache_path = os.path.join("/tmp", "insar", "processed")
            os.makedirs(cache_path, exist_ok=True)
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
