#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import argparse

def parse_arguments():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description='生成项目文件树结构')
    parser.add_argument('-d', '--directory', type=str, default='.',
                        help='要扫描的目录路径 (默认: 当前目录)')
    parser.add_argument('-o', '--output', type=str, default='project_tree.txt',
                        help='输出文件名 (默认: project_tree.txt)')
    parser.add_argument('-i', '--ignore', type=str, nargs='+',
                        default=['.git', '.idea', 'node_modules', '__pycache__', 'venv', 'target', 'out', 'build', 'dist', '.gradle'],
                        help='要忽略的目录或文件名列表')
    parser.add_argument('-x', '--ignore-extensions', type=str, nargs='+',
                        default=['.class', '.jar', '.war', '.log'],
                        help='要忽略的文件扩展名列表')
    parser.add_argument('-m', '--max-depth', type=int, default=None,
                        help='最大扫描深度（默认无限制）')
    parser.add_argument('--no-files', action='store_true',
                        help='只显示目录，不显示文件')
    parser.add_argument('--root-name', type=str, default=None,
                        help='项目根目录显示名称（默认使用实际目录名）')
    return parser.parse_args()

def should_ignore(path, ignore_dirs, ignore_extensions):
    """判断是否应该忽略某个路径"""
    basename = os.path.basename(path)

    # 检查是否在忽略列表中
    if basename in ignore_dirs:
        return True

    # 检查扩展名
    if os.path.isfile(path):
        ext = os.path.splitext(path)[1].lower()
        if ext in ignore_extensions:
            return True

    return False

def generate_tree(directory, prefix="", is_last=True, ignore_dirs=None, ignore_extensions=None,
                  max_depth=None, current_depth=0, show_files=True):
    """递归生成树状结构"""
    if max_depth is not None and current_depth > max_depth:
        return ""

    result = []

    if ignore_dirs is None:
        ignore_dirs = []
    if ignore_extensions is None:
        ignore_extensions = []

    if current_depth == 0:
        # 根目录特殊处理
        root_name = os.path.basename(os.path.abspath(directory))
        result.append(root_name)
        new_prefix = ""
    else:
        # 非根目录
        connector = "└── " if is_last else "├── "
        dir_name = os.path.basename(directory)
        result.append(f"{prefix}{connector}{dir_name}")
        new_prefix = prefix + ("    " if is_last else "│   ")

    # 获取子目录和文件
    try:
        items = []
        for name in sorted(os.listdir(directory)):
            path = os.path.join(directory, name)
            if not should_ignore(path, ignore_dirs, ignore_extensions):
                items.append(path)

        # 如果不显示文件，过滤掉文件
        if not show_files:
            items = [path for path in items if os.path.isdir(path)]

        # 生成子项
        for i, path in enumerate(items):
            is_last_item = i == len(items) - 1

            if os.path.isdir(path):
                # 目录递归处理
                subtree = generate_tree(
                    path, new_prefix, is_last_item, ignore_dirs, ignore_extensions,
                    max_depth, current_depth + 1, show_files
                )
                result.append(subtree)
            else:
                # 文件直接添加
                connector = "└── " if is_last_item else "├── "
                result.append(f"{new_prefix}{connector}{os.path.basename(path)}")

    except PermissionError:
        result.append(f"{new_prefix}└── [无权限访问此目录]")
    except Exception as e:
        result.append(f"{new_prefix}└── [错误: {str(e)}]")

    return "\n".join(result)

def main():
    """主函数"""
    args = parse_arguments()

    directory = os.path.abspath(args.directory)
    if not os.path.exists(directory):
        print(f"错误: 目录 '{directory}' 不存在")
        sys.exit(1)

    if not os.path.isdir(directory):
        print(f"错误: '{directory}' 不是目录")
        sys.exit(1)

    # 自定义根目录名称
    if args.root_name:
        original_basename = os.path.basename(directory)
        temp_dir = os.path.dirname(directory)
        new_root_dir = os.path.join(temp_dir, args.root_name)

        # 临时重命名目录以获取正确的树形结构
        try:
            os.rename(directory, new_root_dir)
            tree = generate_tree(
                new_root_dir, ignore_dirs=args.ignore,
                ignore_extensions=args.ignore_extensions,
                max_depth=args.max_depth, show_files=not args.no_files
            )
            os.rename(new_root_dir, directory)
        except Exception as e:
            print(f"无法重命名目录: {str(e)}")
            # 回退到默认行为
            tree = generate_tree(
                directory, ignore_dirs=args.ignore,
                ignore_extensions=args.ignore_extensions,
                max_depth=args.max_depth, show_files=not args.no_files
            )
    else:
        tree = generate_tree(
            directory, ignore_dirs=args.ignore,
            ignore_extensions=args.ignore_extensions,
            max_depth=args.max_depth, show_files=not args.no_files
        )

    # 保存到文件
    with open(args.output, 'w', encoding='utf-8') as f:
        f.write(tree)

    print(f"项目树已生成到文件 '{args.output}'")

    # 同时在控制台显示
    print("\n" + tree)

if __name__ == "__main__":
    main()