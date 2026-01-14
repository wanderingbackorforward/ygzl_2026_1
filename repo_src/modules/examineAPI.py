import requests
import json

base_url = "http://127.0.0.1:5000/api"

# 测试监测点API
response = requests.get(f"{base_url}/crack/monitoring_points")
data = response.json()
print("监测点API状态:", data["status"])
print("数据样例:", json.dumps(data["data"][0], indent=2, ensure_ascii=False))

# 检查是否有"NaN"字符串或特殊标记
print("\n检查NaN值:")
json_str = json.dumps(data)
if "NaN" in json_str:
    print("警告: JSON中包含'NaN'字符串")
else:
    print("成功: JSON中不包含'NaN'字符串")

# 类似地，你可以测试其他API
apis = [
    "/crack/data",
    "/crack/analysis_results",
    "/crack/trend_data",
    "/crack/stats_overview"
]

for api in apis:
    print(f"\n测试API: {api}")
    response = requests.get(f"{base_url}{api}")
    data = response.json()
    print("状态:", data["status"])

    # 检查NaN
    json_str = json.dumps(data)
    if "NaN" in json_str:
        print("警告: JSON中包含'NaN'字符串")
    else:
        print("成功: JSON中不包含'NaN'字符串")