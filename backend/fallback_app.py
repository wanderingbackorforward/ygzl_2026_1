from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

FALLBACK_MODULES = []  # 导航唯一来源：数据库 app_modules；降级时返回空，不伪造条目


@app.get("/api/modules")
@app.get("/api/modules/")
def _modules():
    return jsonify({"success": True, "data": FALLBACK_MODULES, "timestamp": datetime.now().isoformat()}), 200


@app.get("/api/health")
def _health():
    return jsonify({"status": "healthy", "mode": "fallback"}), 200


@app.errorhandler(404)
def _not_found(_e):
    return jsonify({"status": "error", "message": f"Not found: {request.path}"}), 404
