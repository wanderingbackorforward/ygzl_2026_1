from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

FALLBACK_MODULES = [
    {"module_key": "cover", "route_path": "/cover", "display_name": "封面", "icon_class": "fas fa-home", "sort_order": 10, "status": "developed", "is_visible": True},
    {"module_key": "settlement", "route_path": "/settlement", "display_name": "沉降", "icon_class": "fas fa-chart-area", "sort_order": 20, "status": "developed", "is_visible": True},
    {"module_key": "temperature", "route_path": "/temperature", "display_name": "温度", "icon_class": "fas fa-thermometer-half", "sort_order": 30, "status": "developed", "is_visible": True},
    {"module_key": "cracks", "route_path": "/cracks", "display_name": "裂缝", "icon_class": "fas fa-bug", "sort_order": 40, "status": "developed", "is_visible": True},
    {"module_key": "vibration", "route_path": "/vibration", "display_name": "振动", "icon_class": "fas fa-wave-square", "sort_order": 50, "status": "developed", "is_visible": True},
    {"module_key": "insar", "route_path": "/insar", "display_name": "InSAR", "icon_class": "fas fa-satellite", "sort_order": 60, "status": "developed", "is_visible": True},
    {"module_key": "advanced", "route_path": "/advanced", "display_name": "高级分析", "icon_class": "fas fa-microscope", "sort_order": 65, "status": "developed", "is_visible": True},
    {"module_key": "overview", "route_path": "/overview", "display_name": "数据总览", "icon_class": "fas fa-chart-line", "sort_order": 70, "status": "developed", "is_visible": True},
    {"module_key": "three", "route_path": "/three", "display_name": "3D模型", "icon_class": "fas fa-cubes", "sort_order": 80, "status": "developed", "is_visible": True},
    {"module_key": "tickets", "route_path": "/tickets", "display_name": "工单", "icon_class": "fas fa-ticket-alt", "sort_order": 90, "status": "developed", "is_visible": True},
]


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
