import subprocess
import time
import webbrowser
import os
import sys
import re
import yaml
import uuid
import json
from collections import defaultdict


def main():
    print("启动沉降监测数字孪生系统...")

    # 切换到脚本所在目录（确保从项目根目录运行）
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    print(f"工作目录: {os.getcwd()}")

    # 启动API服务
    api_script = os.path.join(script_dir, "modules", "api", "api_server.py")
    print(f"启动API脚本: {api_script}")

    api_process = subprocess.Popen([sys.executable, api_script])

    print("API服务已启动，等待服务就绪...")
    time.sleep(3)  # 等待API服务启动

    # 打开浏览器访问根路径（若存在 React 构建则进入 React 应用）
    webbrowser.open("http://localhost:5000/")

    print("系统已启动，按Ctrl+C退出...")

    try:
        # 保持脚本运行
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("正在关闭系统...")
        api_process.terminate()
        print("系统已关闭")


class UnityProjectAnalyzer:
    def __init__(self, project_path):
        self.project_path = project_path
        self.assets_path = os.path.join(project_path, "Assets")
        self.scenes_path = os.path.join(self.assets_path, "Scenes")
        self.scripts_path = os.path.join(self.assets_path, "Scripts")

        # 存储所有找到的脚本文件
        self.scripts = {}
        # 存储所有游戏对象的层次结构
        self.hierarchy = {}
        # 存储脚本GUID到文件路径的映射
        self.script_guid_map = {}
        # 存储游戏对象到脚本的映射
        self.object_script_map = {}

    def analyze(self):
        """执行项目分析"""
        print(f"开始分析Unity项目: {self.project_path}")

        # 1. 映射所有脚本文件
        self.map_scripts()

        # 2. 构建脚本GUID映射表
        self.build_script_guid_map()

        # 3. 分析场景文件
        self.analyze_scenes()

        # 4. 生成报告
        self.generate_report()

    def map_scripts(self):
        """扫描并映射所有C#脚本文件"""
        print("正在扫描C#脚本文件...")

        # 扫描整个Assets文件夹寻找.cs文件
        for root, _, files in os.walk(self.assets_path):
            for file in files:
                if file.endswith(".cs"):
                    script_path = os.path.join(root, file)
                    rel_path = os.path.relpath(script_path, self.project_path)

                    # 解析脚本提取类名
                    script_name = os.path.splitext(file)[0]

                    # 读取脚本内容以提取更多信息
                    try:
                        with open(script_path, 'r', encoding='utf-8') as f:
                            content = f.read()

                        # 尝试提取类名和继承
                        class_match = re.search(r'class\s+(\w+)\s*:\s*(\w+)', content)
                        if class_match:
                            class_name = class_match.group(1)
                            parent_class = class_match.group(2)
                        else:
                            class_name = script_name
                            parent_class = "Unknown"

                        self.scripts[script_path] = {
                            'name': script_name,
                            'class_name': class_name,
                            'parent_class': parent_class,
                            'path': rel_path
                        }

                    except Exception as e:
                        print(f"无法解析脚本 {script_path}: {e}")

        print(f"找到 {len(self.scripts)} 个C#脚本")

    def build_script_guid_map(self):
        """构建脚本GUID到文件路径的映射"""
        print("正在构建脚本GUID映射...")

        meta_files = []
        # 查找所有.cs.meta文件
        for root, _, files in os.walk(self.assets_path):
            for file in files:
                if file.endswith(".cs.meta"):
                    meta_path = os.path.join(root, file)
                    script_path = meta_path[:-5]  # 移除.meta后缀

                    if os.path.exists(script_path):
                        try:
                            with open(meta_path, 'r', encoding='utf-8') as f:
                                meta_content = f.read()

                            # 从meta文件中提取GUID
                            guid_match = re.search(r'guid: (\w+)', meta_content)
                            if guid_match:
                                guid = guid_match.group(1)
                                self.script_guid_map[guid] = script_path
                                meta_files.append(meta_path)
                        except Exception as e:
                            print(f"无法解析meta文件 {meta_path}: {e}")

        print(f"处理了 {len(meta_files)} 个meta文件")

    def analyze_scenes(self):
        """分析所有场景文件"""
        print("正在分析场景文件...")

        # 查找所有.unity场景文件
        scenes = []
        for root, _, files in os.walk(self.assets_path):
            for file in files:
                if file.endswith(".unity"):
                    scene_path = os.path.join(root, file)
                    scenes.append(scene_path)

        for scene_path in scenes:
            scene_name = os.path.basename(scene_path)
            print(f"分析场景: {scene_name}")

            try:
                self.analyze_scene(scene_path, scene_name)
            except Exception as e:
                print(f"无法解析场景 {scene_path}: {e}")

        print(f"分析了 {len(scenes)} 个场景")

    def analyze_scene(self, scene_path, scene_name):
        """分析单个场景文件"""
        try:
            # 由于Unity的YAML格式比较特殊，我们用正则表达式提取关键信息
            with open(scene_path, 'r', encoding='utf-8') as f:
                scene_content = f.read()

            # 提取所有GameObject部分
            gameobjects = {}
            transforms = {}
            components = []

            # 提取GameObject部分
            go_sections = re.finditer(
                r'--- !u!1 &(\d+)\s+GameObject:\s+m_ObjectHideFlags:[^\n]+\s+m_CorrespondingSourceObject:[^\n]+\s+m_PrefabInstance:[^\n]+\s+m_PrefabAsset:[^\n]+\s+serializedVersion:[^\n]+\s+m_Component:((?:\s+- component: {fileID: \d+})+)[^\n]*\s+m_Layer:[^\n]+\s+m_Name: ([^\n]+)',
                scene_content)

            for section in go_sections:
                go_id = section.group(1)
                components_text = section.group(2)
                go_name = section.group(3).strip()

                component_ids = re.findall(r'fileID: (\d+)', components_text)
                gameobjects[go_id] = {
                    'name': go_name,
                    'components': component_ids
                }

            # 提取Transform部分
            transform_sections = re.finditer(
                r'--- !u!4 &(\d+)\s+Transform:\s+[^\n]+\s+m_GameObject: {fileID: (\d+)}[^\n]*\s+m_LocalRotation:[^\n]+\s+m_LocalPosition:[^\n]+\s+m_LocalScale:[^\n]+\s+m_ConstrainProportionsScale:[^\n]+\s+m_Children:((?:\s+- {fileID: \d+})*)[^\n]*\s+m_Father: {fileID: (\d+)}',
                scene_content)

            for section in transform_sections:
                transform_id = section.group(1)
                go_id = section.group(2)
                children_text = section.group(3)
                parent_id = section.group(4)

                children_ids = re.findall(r'fileID: (\d+)', children_text)
                transforms[transform_id] = {
                    'gameobject': go_id,
                    'children': children_ids,
                    'parent': parent_id
                }

            # 提取MonoBehaviour部分，这些部分包含脚本引用
            mono_sections = re.finditer(
                r'--- !u!114 &(\d+)\s+MonoBehaviour:\s+[^\n]+\s+m_GameObject: {fileID: (\d+)}[^\n]*\s+m_Enabled:[^\n]+\s+m_EditorHideFlags:[^\n]+\s+m_Script: {fileID: \d+, guid: ([a-f0-9]+)}',
                scene_content)

            for section in mono_sections:
                component_id = section.group(1)
                go_id = section.group(2)
                script_guid = section.group(3)

                components.append({
                    'id': component_id,
                    'gameobject': go_id,
                    'script_guid': script_guid
                })

            # 构建层次结构
            hierarchy = {}
            root_transforms = [t_id for t_id, t in transforms.items() if t['parent'] == "0"]

            for root_id in root_transforms:
                root_data = transforms[root_id]
                go_id = root_data['gameobject']
                if go_id in gameobjects:
                    go_data = gameobjects[go_id]
                    hierarchy[go_data['name']] = self.build_hierarchy_recursive(root_id, transforms, gameobjects,
                                                                                components)

            self.hierarchy[scene_name] = hierarchy

        except Exception as e:
            print(f"解析场景时出错 {scene_path}: {e}")
            raise e

    def build_hierarchy_recursive(self, transform_id, transforms, gameobjects, components):
        """递归构建层次结构"""
        transform_data = transforms.get(transform_id, {})
        go_id = transform_data.get('gameobject', '')

        if not go_id or go_id not in gameobjects:
            return {}

        go_data = gameobjects[go_id]
        name = go_data['name']

        # 查找游戏对象的脚本
        scripts = []
        for component in components:
            if component['gameobject'] == go_id:
                script_guid = component['script_guid']
                script_path = self.script_guid_map.get(script_guid, '')

                if script_path and script_path in self.scripts:
                    script_info = self.scripts[script_path]
                    scripts.append({
                        'name': script_info['name'],
                        'class_name': script_info['class_name'],
                        'path': script_info['path']
                    })

        # 记录对象到脚本的映射
        if scripts:
            self.object_script_map[name] = scripts

        # 处理子对象
        children = {}
        for child_id in transform_data.get('children', []):
            child_result = self.build_hierarchy_recursive(child_id, transforms, gameobjects, components)
            if child_result:
                for child_name, child_data in child_result.items():
                    children[child_name] = child_data

        return {
            'name': name,
            'scripts': scripts,
            'children': children
        }

    def generate_report(self):
        """生成分析报告"""
        report = {
            'project_path': self.project_path,
            'total_scripts': len(self.scripts),
            'scenes': self.hierarchy,
            'scripts': {path: info for path, info in self.scripts.items()},
            'object_script_map': self.object_script_map
        }

        report_path = os.path.join(self.project_path, "unity_project_analysis.json")
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        print(f"分析报告已生成: {report_path}")

        # 生成可读性更好的文本报告
        text_report_path = os.path.join(self.project_path, "unity_project_analysis.txt")
        self.generate_text_report(text_report_path)

        print(f"文本报告已生成: {text_report_path}")

    def generate_text_report(self, report_path):
        """生成文本格式的分析报告"""
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(f"Unity项目分析报告\n")
            f.write(f"{'=' * 50}\n")
            f.write(f"项目路径: {self.project_path}\n")
            f.write(f"总脚本数量: {len(self.scripts)}\n")
            f.write(f"\n场景层次结构\n")
            f.write(f"{'-' * 50}\n")

            for scene_name, hierarchy in self.hierarchy.items():
                f.write(f"\n场景: {scene_name}\n")
                self.write_hierarchy(f, hierarchy, 0)

            f.write(f"\n脚本到游戏对象映射\n")
            f.write(f"{'-' * 50}\n")

            for script_path, script_info in self.scripts.items():
                f.write(f"\n脚本: {script_info['name']} ({script_info['class_name']})\n")
                f.write(f"路径: {script_info['path']}\n")

                # 列出使用此脚本的游戏对象
                script_users = []
                for obj_name, scripts in self.object_script_map.items():
                    for script in scripts:
                        if script['class_name'] == script_info['class_name']:
                            script_users.append(obj_name)

                if script_users:
                    f.write(f"使用此脚本的游戏对象:\n")
                    for user in script_users:
                        f.write(f"  - {user}\n")

    def write_hierarchy(self, file, hierarchy, depth):
        """递归写入层次结构"""
        indent = "  " * depth
        for obj_name, obj_data in hierarchy.items():
            file.write(f"{indent}- {obj_name}\n")

            # 写入脚本
            if 'scripts' in obj_data and obj_data['scripts']:
                file.write(f"{indent}  脚本:\n")
                for script in obj_data['scripts']:
                    file.write(f"{indent}    - {script['name']} ({script['class_name']})\n")

            # 写入子对象
            if 'children' in obj_data and obj_data['children']:
                self.write_hierarchy(file, obj_data['children'], depth + 1)


if __name__ == "__main__":
    # 在Python中单独运行分析器部分
    # from start_system import UnityProjectAnalyzer
    #
    # project_path = r"D:\Self-Made Digital Twin Terrain Settlement (V1)\unity_project\SettlementMonitoring"
    # analyzer = UnityProjectAnalyzer(project_path)
    # analyzer.analyze()

    main()
