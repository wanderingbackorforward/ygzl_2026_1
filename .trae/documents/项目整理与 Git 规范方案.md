## 目标与原则
- 仅复制有效源码到新目录（不剪切），确保可运行最小集
- 大体积/构建产物/临时文件原地不动，通过 .gitignore 排除
- 保留清晰结构与依赖清单，后续迭代可控

## 新建“精简源码”目录
- 在 python_scripts 顶层新建目录：repo_src/
- 目录结构（初版）：
  - repo_src/modules/（复制有效 Python 模块）
  - repo_src/static/js, repo_src/static/css（仅前端源码，排除构建产物）
  - repo_src/pre/（必要的配置/页面源）
  - repo_src/Algorithm Prediction/（如需保留算法实验脚本）
  - 根级脚本与文档：repo_src/start_system.py, repo_src/README.md, repo_src/requirements.txt（按需）

## 文件拷贝清单（复制，不剪切）
- 必选源码
  - [modules](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/modules)
    - [api](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/modules/api)（如 [api_server.py](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/modules/api/api_server.py)）
    - [data_import](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/modules/data_import), [data_processing](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/modules/data_processing)
    - [database](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/modules/database), [ticket_system](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/modules/ticket_system)
  - 根级： [start_system.py](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/start_system.py), [analyze_mdb.py](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/analyze_mdb.py)（若仍使用）
  - 前端源码： [static/js](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/static/js), [static/css](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/static/css), [pre](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/pre)
  - 文档与清单： README*.md, requirements.txt
- 排除/原地保留
  - /.venv/ 虚拟环境
  - /static/StreamingAssets/, /static/TemplateData/, /static/glb/（构建产物/大资源）
  - **/__pycache__/, *.pyc, *.pyo（缓存）
  - /data/ 下真实数据文件（仅保留示例或生成脚本）
  - /.idea/ 等 IDE 目录

## Git 初始化与忽略策略
- 在 python_scripts 目录使用 Git 管理，repo_src/ 中为主开发入口
- .gitignore（建议内容示例）：

```gitignore
# 虚拟环境
/.venv/

# Python 缓存
**/__pycache__/
*.pyc
*.pyo

# IDE/工程
/.idea/
*.iml

# 构建产物/大型资源
/static/StreamingAssets/
/static/TemplateData/
/static/glb/

# 数据与中间文件（按需）
/data/*.csv
/data/*.parquet
/data/*.npy
/data/*.npz

# 日志与临时
*.log
*.bak
* - 副本.*
project_tree.txt
```

- 仅将 repo_src/ 及必要清单（README、requirements、启动脚本）纳入版本控制

## 可选增强
- Git LFS：若必须跟踪少量大二进制（模型/纹理），用 LFS 管理
- Sparse-Checkout：本地工作区仅展开 repo_src/ 与少量必要路径，提升体验

## 验证与回滚
- 验证：
  - 在干净环境下仅用 repo_src/ + requirements.txt 能启动 [start_system.py](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/start_system.py)
  - git status 仅显示精简源码与文档
- 回滚：原目录不动；如需恢复可从原目录重新复制或移除忽略项

## 后续维护建议
- 新增代码一律落在 repo_src/，保持清爽结构
- 数据用示例/生成脚本替代；真实数据统一忽略
- 构建产物不入库，只保留源码与构建脚本