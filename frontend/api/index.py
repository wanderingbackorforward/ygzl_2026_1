import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, ".."))
backend_dir = os.path.abspath(os.path.join(project_root, "..", "backend"))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

try:
    from modules.api.api_server import app  # type: ignore
except Exception:
    from flask import Flask, jsonify, request
    from flask_cors import CORS

    from modules.module_registry.api import module_bp  # type: ignore

    app = Flask(__name__)
    CORS(app)
    app.register_blueprint(module_bp)

    @app.get("/api/health")
    def _health():
        return jsonify({"status": "healthy", "mode": "fallback"}), 200

    @app.errorhandler(404)
    def _not_found(_e):
        return jsonify({"status": "error", "message": f"Not found: {request.path}"}), 404

