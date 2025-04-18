import os
from start_system import UnityProjectAnalyzer


def analyze_unity():
    print("开始分析Unity项目结构...")

    # 设置Unity项目路径
    project_path = r"D:\Self-Made Digital Twin Terrain Settlement (V1)\unity_project\SettlementMonitoring"

    # 检查路径是否存在
    if not os.path.exists(project_path):
        print(f"错误: 项目路径不存在: {project_path}")
        print("请修改脚本中的project_path变量指向正确的Unity项目路径。")
        return

    # 创建分析器实例
    analyzer = UnityProjectAnalyzer(project_path)

    # 运行分析
    analyzer.analyze()

    print("Unity项目分析完成!")
    print(f"分析报告已保存到: {os.path.join(project_path, 'unity_project_analysis.json')}")
    print(f"文本报告已保存到: {os.path.join(project_path, 'unity_project_analysis.txt')}")


if __name__ == "__main__":
    analyze_unity()