import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = current_dir
backend_dir = os.path.join(project_root, 'backend')
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from modules.api.api_server import app

