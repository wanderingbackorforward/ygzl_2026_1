版本化选项评估

Git LFS

- 适用：少量必须跟踪的大二进制（模型、纹理）
- 配置：git lfs install；对特定后缀执行 git lfs track
- 影响：提升大文件推送与拉取体验，需团队安装 LFS

Sparse-Checkout

- 适用：仅展开部分目录进行开发
- 配置：git sparse-checkout init；git sparse-checkout set repo_src
- 影响：本地工作区更轻量，CI 仍可完整检出
