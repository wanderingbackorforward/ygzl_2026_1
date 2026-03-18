import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
backend_dir = os.path.join(project_root, 'backend')
print(f"DEBUG: Adding to sys.path: {backend_dir}")
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

try:
    from modules.api.api_server import app
except Exception as e:
    print(f"WARN: Failed to import api_server: {e}, using fallback")
    from fallback_app import app
