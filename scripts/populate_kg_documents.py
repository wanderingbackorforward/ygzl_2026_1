# -*- coding: utf-8 -*-
"""
批量添加知识图谱文献 - 沉降监测领域示例文献
"""
import os
import sys
import requests

# 添加项目根目录到路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# 加载环境变量
try:
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(__file__), '../.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
except ImportError:
    pass

SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', '')

def _headers():
    return {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    }

# 20篇沉降监测领域文献
DOCUMENTS = [
    {
        'title': '地铁隧道施工引起的地表沉降规律研究',
        'content': '''地铁隧道施工过程中，盾构掘进会引起周围土体应力重分布，导致地表产生沉降。研究表明，沉降槽宽度与隧道埋深、土层性质密切相关。

监测点 S1-S5 位于隧道正上方，累计沉降达到 15-25mm。S3 点位沉降最大，达到 24.5mm，接近预警阈值 30mm。

沉降速率在盾构通过时达到峰值 2-3mm/day，通过后逐渐稳定至 0.5mm/day 以下。粘土层比砂土层沉降更显著，需加密监测频率。''',
        'source_type': 'text',
    },
    {
        'title': '深基坑开挖对邻近建筑物沉降影响分析',
        'content': '''深基坑开挖卸载效应会引起坑底隆起和周边地表沉降。监测数据显示，距离基坑 10m 范围内的建筑物沉降风险最高。

S7、S8、S9 三个监测点位于基坑东侧 8m 处，累计沉降分别为 18mm、22mm、19mm。S8 点位出现异常沉降加速，需立即采取加固措施。

建议在基坑周边设置隔离桩或注浆加固，控制沉降速率在 1mm/day 以内。''',
        'source_type': 'text',
    },
    {
        'title': '软土地基沉降预测的时间序列模型',
        'content': '''软土地基沉降具有长期性和非线性特征。采用 ARIMA 模型和 LSTM 神经网络对沉降趋势进行预测，准确率达到 85% 以上。

历史数据表明，S12 点位沉降曲线呈现双曲线特征，初期沉降速率 3mm/day，后期逐渐收敛至 0.2mm/day。

预测未来 30 天内，S12 累计沉降将达到 32mm，超过预警阈值，建议提前采取预防措施。''',
        'source_type': 'text',
    },
    {
        'title': '地下水位变化对地表沉降的影响机理',
        'content': '''地下水位下降会导致土体有效应力增加，引发压缩沉降。监测表明，水位每下降 1m，地表沉降增加约 5-8mm。

S15、S16 点位位于地下水降落漏斗中心，累计沉降达到 28mm 和 31mm，其中 S16 已超过预警阈值。

建议采取回灌措施，控制地下水位下降速率，避免引发区域性沉降灾害。''',
        'source_type': 'text',
    },
    {
        'title': '盾构隧道施工参数对地表沉降的影响',
        'content': '''盾构推进速度、刀盘转速、注浆压力等参数直接影响地表沉降量。优化施工参数可有效控制沉降在安全范围内。

实测数据显示，推进速度从 8mm/min 降至 5mm/min 后，S4 点位沉降速率从 2.5mm/day 降至 1.2mm/day。

同步注浆压力保持在 0.2-0.3MPa 时，沉降控制效果最佳。过高或过低的注浆压力都会导致沉降异常。''',
        'source_type': 'text',
    },
    {
        'title': '裂缝与沉降的关联性分析',
        'content': '''建筑物裂缝往往是沉降不均匀的外在表现。当相邻监测点沉降差超过 10mm 时，裂缝风险显著增加。

S6 和 S7 点位沉降差达到 12mm，导致两点之间墙体出现 2mm 宽裂缝。裂缝呈 45 度斜向分布，属于典型的差异沉降裂缝。

建议在沉降差超过 8mm 时及时采取加固措施，避免裂缝进一步扩展。''',
        'source_type': 'text',
    },
    {
        'title': '温度变化对沉降监测数据的影响',
        'content': '''温度变化会引起测量仪器和建筑结构的热胀冷缩，对沉降监测数据产生干扰。日温差超过 15°C 时，误差可达 ±2mm。

S10 点位在夏季高温时段出现 3mm 的"虚假隆起"，经温度修正后实际沉降为 1mm。

建议在数据处理时进行温度补偿，或选择温度稳定时段（清晨）进行监测。''',
        'source_type': 'text',
    },
    {
        'title': '爆破振动对邻近结构沉降的影响',
        'content': '''爆破施工产生的振动会引起土体扰动和结构沉降。振动速度超过 2cm/s 时，沉降风险显著增加。

S18 点位在爆破后 24 小时内沉降增量达到 5mm，远超正常沉降速率。振动监测显示峰值速度为 3.2cm/s。

建议采用微差爆破技术，控制单次爆破药量，将振动速度控制在 1.5cm/s 以内。''',
        'source_type': 'text',
    },
    {
        'title': '溶洞地区沉降监测与预警',
        'content': '''岩溶地区地下存在溶洞，施工扰动可能导致溶洞顶板坍塌，引发突发性沉降。

S20 点位在 3 天内突发沉降 18mm，地质雷达探测发现地下 8m 处存在直径 3m 的溶洞。

建议采用注浆充填技术处理溶洞，并加密监测频率至每日 2 次，设置 5mm/day 的紧急预警阈值。''',
        'source_type': 'text',
    },
    {
        'title': '沉降监测数据的异常值识别与处理',
        'content': '''监测数据中常出现粗差和异常值，需采用统计方法进行识别和剔除。3σ 准则和格拉布斯检验是常用方法。

S11 点位某次监测数据为 -50mm（隆起），明显异常。经核查为仪器故障导致，应剔除该数据点。

建议建立数据质量控制流程，对超出 ±3σ 范围的数据进行人工复核。''',
        'source_type': 'text',
    },
    {
        'title': '多源监测数据融合技术在沉降分析中的应用',
        'content': '''结合水准测量、GPS、InSAR 等多种监测手段，可提高沉降监测的精度和可靠性。

S13 点位水准测量结果为 -15mm，GPS 测量为 -14mm，InSAR 测量为 -16mm，融合后结果为 -15mm，标准差 0.8mm。

多源数据融合可有效降低单一手段的系统误差，提高监测可靠性。''',
        'source_type': 'text',
    },
    {
        'title': '沉降监测网优化设计方法',
        'content': '''监测点位布设应遵循代表性、经济性和可操作性原则。关键区域加密布点，非关键区域适当减少。

隧道正上方每 10m 布设一个监测点（S1-S5），两侧 20m 范围内每 15m 布设一个点（S6-S10）。

优化后的监测网既保证了关键区域的监测精度，又降低了 30% 的监测成本。''',
        'source_type': 'text',
    },
    {
        'title': '沉降速率阈值的动态调整策略',
        'content': '''固定阈值难以适应不同施工阶段的沉降特征。动态阈值根据历史数据和施工进度实时调整。

盾构掘进阶段，S2 点位阈值设为 3mm/day；稳定阶段调整为 1mm/day。动态阈值减少了 40% 的误报率。

建议根据施工阶段、地质条件和历史趋势，建立分级动态预警体系。''',
        'source_type': 'text',
    },
    {
        'title': '沉降引起的管线变形分析',
        'content': '''地表沉降会导致地下管线产生弯曲变形，当曲率半径小于 15000m 时，管线存在破裂风险。

S14-S15-S16 三点连线处管线曲率半径为 12000m，接近安全下限。管线应力监测显示拉应力达到 80MPa。

建议对管线进行加固或改线，避免因沉降导致管线破裂事故。''',
        'source_type': 'text',
    },
    {
        'title': '沉降监测自动化系统设计',
        'content': '''自动化监测系统可实现 24 小时连续监测和实时预警。系统包括传感器、数据采集、传输和分析模块。

S17 点位安装自动化水准仪，每小时自动采集一次数据，通过 4G 网络实时上传至云平台。

系统检测到沉降速率超过 2mm/day 时，自动发送短信和邮件预警，响应时间小于 5 分钟。''',
        'source_type': 'text',
    },
    {
        'title': '季节性冻融对沉降的影响',
        'content': '''寒区土体冻融循环会引起周期性的冻胀和融沉。冻胀量可达 20-50mm，融沉量为冻胀量的 60-80%。

S19 点位冬季冻胀 35mm，春季融沉 28mm，净沉降 7mm。多年冻融循环导致累计沉降达到 45mm。

建议采取保温措施，减少冻融循环次数，或在设计时预留冻胀变形量。''',
        'source_type': 'text',
    },
    {
        'title': '沉降监测数据的可视化与智能分析',
        'content': '''三维可视化和机器学习技术可提升沉降数据的分析效率。热力图、等值线图、时空演化动画等方式直观展示沉降分布。

S1-S25 全部监测点数据生成沉降热力图，清晰显示 S3、S8、S16 三个高风险区域。

机器学习模型自动识别异常模式，预测准确率达到 90%，大幅提升预警效率。''',
        'source_type': 'text',
    },
    {
        'title': '沉降控制的工程措施与效果评估',
        'content': '''常用沉降控制措施包括注浆加固、隔离桩、预应力锚索等。措施实施后需持续监测评估效果。

S21 点位实施注浆加固后，沉降速率从 2.8mm/day 降至 0.6mm/day，控制效果显著。

建议在沉降速率超过 2mm/day 时及时采取工程措施，避免沉降失控。''',
        'source_type': 'text',
    },
    {
        'title': '沉降监测成果在施工反馈中的应用',
        'content': '''监测数据应及时反馈至施工单位，指导施工参数调整。信息化施工可实现监测-反馈-调整的闭环管理。

S22 点位沉降超限后，施工单位立即降低掘进速度并增加注浆量，3 天后沉降速率恢复正常。

建议建立监测数据共享平台，实现施工方、监测方、设计方的实时信息交互。''',
        'source_type': 'text',
    },
    {
        'title': '沉降监测规范与标准解读',
        'content': '''《建筑变形测量规范》（JGJ 8-2016）规定了沉降监测的精度要求、监测频率和预警阈值。

一级建筑物沉降监测精度应达到 ±0.5mm，监测频率不低于每周 1 次。当沉降速率超过 2mm/day 时应加密至每日监测。

S23、S24、S25 点位按照规范要求布设，监测精度和频率均满足一级建筑物标准。''',
        'source_type': 'text',
    },
]

def add_document(doc):
    """添加单个文献"""
    try:
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/kg_documents",
            headers=_headers(),
            json=doc,
            timeout=15,
        )
        r.raise_for_status()
        result = r.json()
        doc_id = result[0]['id'] if isinstance(result, list) else result.get('id')
        print(f"[成功] 添加文献: {doc['title']} (ID: {doc_id})")

        # 触发处理（提取实体和关系）
        try:
            r2 = requests.post(
                f"{SUPABASE_URL}/rest/v1/rpc/process_kg_document",
                headers=_headers(),
                json={'doc_id': doc_id},
                timeout=30,
            )
            # 如果 RPC 不存在，直接调用 Python 处理逻辑
            if r2.status_code == 404:
                from backend.modules.ml_models.supabase_kg import SupabaseKnowledgeGraph
                kg = SupabaseKnowledgeGraph()
                kg.process_document(doc_id)
                print(f"  [处理] 已提取实体和关系")
        except Exception as e:
            print(f"  [警告] 自动处理失败: {e}，请手动触发处理")

        return True
    except Exception as e:
        print(f"[失败] 添加文献失败: {doc['title']} - {e}")
        return False

def main():
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print("[错误] 缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY 环境变量")
        return

    print(f"开始批量添加 {len(DOCUMENTS)} 篇文献到知识图谱...")
    print(f"Supabase URL: {SUPABASE_URL}\n")

    success_count = 0
    for i, doc in enumerate(DOCUMENTS, 1):
        print(f"[{i}/{len(DOCUMENTS)}] ", end='')
        if add_document(doc):
            success_count += 1
        print()

    print(f"\n完成！成功添加 {success_count}/{len(DOCUMENTS)} 篇文献")
    print("请访问前端查看知识图谱效果")

if __name__ == '__main__':
    main()
