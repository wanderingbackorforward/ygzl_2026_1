import os
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = ROOT
DEST = os.path.join(ROOT, "repo_src")

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def copy_file(src, dest):
    ensure_dir(os.path.dirname(dest))
    shutil.copy2(src, dest)

def copy_tree(src, dest, dir_exclude=None, file_exts=None):
    dir_exclude = set(dir_exclude or [])
    ensure_dir(dest)
    for root, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if d not in dir_exclude]
        rel = os.path.relpath(root, src)
        out_dir = os.path.join(dest, rel) if rel != "." else dest
        ensure_dir(out_dir)
        for f in files:
            if f.endswith((".pyc", ".pyo")):
                continue
            if file_exts and not any(f.endswith(ext) for ext in file_exts):
                continue
            copy_file(os.path.join(root, f), os.path.join(out_dir, f))

def exists(path):
    return os.path.exists(path)

def main():
    ensure_dir(DEST)
    if exists(os.path.join(SRC, "modules")):
        copy_tree(os.path.join(SRC, "modules"), os.path.join(DEST, "modules"), dir_exclude={"__pycache__"})
    if exists(os.path.join(SRC, "static", "js")):
        copy_tree(os.path.join(SRC, "static", "js"), os.path.join(DEST, "static", "js"))
    if exists(os.path.join(SRC, "static", "css")):
        copy_tree(os.path.join(SRC, "static", "css"), os.path.join(DEST, "static", "css"))
    if exists(os.path.join(SRC, "pre")):
        copy_tree(os.path.join(SRC, "pre"), os.path.join(DEST, "pre"))
    if exists(os.path.join(SRC, "Algorithm Prediction")):
        copy_tree(os.path.join(SRC, "Algorithm Prediction"), os.path.join(DEST, "Algorithm Prediction"), file_exts={".py"})
    root_files = [
        "start_system.py",
        "analyze_mdb.py",
        "signaling-server.js",
        "requirements.txt",
        "README.md",
        "README-Advanced.md",
        "advanced-readme.md",
        "render-streaming-implementation.md",
        "setup-steps.txt"
    ]
    for f in root_files:
        p = os.path.join(SRC, f)
        if exists(p):
            copy_file(p, os.path.join(DEST, f))

if __name__ == "__main__":
    main()
