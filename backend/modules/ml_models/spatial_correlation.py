# -*- coding: utf-8 -*-
"""
空间关联分析模块
分析多个监测点之间的空间相关性
"""
import numpy as np
import pandas as pd
from scipy.spatial.distance import cdist
from scipy.stats import pearsonr, spearmanr
import warnings
warnings.filterwarnings('ignore')


class SpatialCorrelationAnalyzer:
    """空间关联分析器"""

    def __init__(self, distance_threshold=50.0):
        """
        初始化分析器

        Args:
            distance_threshold: 距离阈值（米），小于此距离的点被认为是邻居
        """
        self.distance_threshold = distance_threshold
        self.adjacency_matrix = None
        self.correlation_matrix = None
        self.points_info = None

    def build_adjacency_matrix(self, coordinates):
        """
        构建邻接矩阵（基于距离）

        Args:
            coordinates: 监测点坐标列表 [(x1, y1), (x2, y2), ...]

        Returns:
            adj_matrix: 邻接矩阵
        """
        n = len(coordinates)
        coords_array = np.array(coordinates)

        # 计算所有点之间的欧氏距离
        distances = cdist(coords_array, coords_array, metric='euclidean')

        # 构建邻接矩阵
        adj_matrix = np.zeros((n, n))

        for i in range(n):
            for j in range(n):
                if i != j and distances[i, j] < self.distance_threshold:
                    # 权重与距离成反比
                    adj_matrix[i, j] = 1.0 / (distances[i, j] + 1e-6)

        # 添加自环
        adj_matrix += np.eye(n)

        # 归一化（对称归一化）
        degree = np.sum(adj_matrix, axis=1)
        degree_inv_sqrt = np.power(degree, -0.5)
        degree_inv_sqrt[np.isinf(degree_inv_sqrt)] = 0.0
        degree_matrix = np.diag(degree_inv_sqrt)
        adj_normalized = degree_matrix @ adj_matrix @ degree_matrix

        self.adjacency_matrix = adj_normalized

        return adj_normalized

    def calculate_correlation_matrix(self, settlement_data):
        """
        计算沉降数据的相关性矩阵

        Args:
            settlement_data: 沉降数据矩阵 (n_points, n_timesteps)

        Returns:
            corr_matrix: 相关性矩阵
        """
        n_points = settlement_data.shape[0]
        corr_matrix = np.zeros((n_points, n_points))

        for i in range(n_points):
            for j in range(n_points):
                if i == j:
                    corr_matrix[i, j] = 1.0
                else:
                    # 计算皮尔逊相关系数
                    try:
                        corr, _ = pearsonr(settlement_data[i], settlement_data[j])
                        corr_matrix[i, j] = corr if not np.isnan(corr) else 0.0
                    except:
                        corr_matrix[i, j] = 0.0

        self.correlation_matrix = corr_matrix

        return corr_matrix

    def find_spatial_clusters(self, coordinates, settlement_data, min_correlation=0.7):
        """
        识别空间聚类（相关性高且距离近的点群）

        Args:
            coordinates: 坐标列表
            settlement_data: 沉降数据矩阵
            min_correlation: 最小相关系数阈值

        Returns:
            clusters: 聚类列表
        """
        # 构建邻接矩阵和相关性矩阵
        self.build_adjacency_matrix(coordinates)
        self.calculate_correlation_matrix(settlement_data)

        n_points = len(coordinates)
        visited = [False] * n_points
        clusters = []

        def dfs(node, cluster):
            """深度优先搜索"""
            visited[node] = True
            cluster.append(node)

            for neighbor in range(n_points):
                if not visited[neighbor]:
                    # 检查是否满足空间邻近和高相关性
                    is_neighbor = self.adjacency_matrix[node, neighbor] > 0
                    is_correlated = abs(self.correlation_matrix[node, neighbor]) > min_correlation

                    if is_neighbor and is_correlated:
                        dfs(neighbor, cluster)

        # 查找所有聚类
        for i in range(n_points):
            if not visited[i]:
                cluster = []
                dfs(i, cluster)
                if len(cluster) > 1:  # 只保留包含多个点的聚类
                    clusters.append(cluster)

        return clusters

    def analyze_influence_propagation(self, source_point_idx, coordinates, settlement_data):
        """
        分析异常从源点向周围传播的路径

        Args:
            source_point_idx: 源点索引
            coordinates: 坐标列表
            settlement_data: 沉降数据矩阵

        Returns:
            propagation_path: 传播路径和影响强度
        """
        # 构建邻接矩阵和相关性矩阵
        self.build_adjacency_matrix(coordinates)
        self.calculate_correlation_matrix(settlement_data)

        n_points = len(coordinates)
        influence_scores = np.zeros(n_points)
        influence_scores[source_point_idx] = 1.0

        # 计算影响分数（结合距离和相关性）
        for i in range(n_points):
            if i != source_point_idx:
                spatial_weight = self.adjacency_matrix[source_point_idx, i]
                correlation = abs(self.correlation_matrix[source_point_idx, i])
                influence_scores[i] = spatial_weight * correlation

        # 排序并返回影响路径
        sorted_indices = np.argsort(influence_scores)[::-1]

        propagation_path = []
        for idx in sorted_indices:
            if influence_scores[idx] > 0.1:  # 阈值
                propagation_path.append({
                    'point_index': int(idx),
                    'influence_score': float(influence_scores[idx]),
                    'correlation': float(self.correlation_matrix[source_point_idx, idx]),
                    'distance': float(cdist([coordinates[source_point_idx]],
                                          [coordinates[idx]])[0][0])
                })

        return propagation_path


def analyze_spatial_correlation(conn, distance_threshold=50.0):
    """
    分析所有监测点的空间关联

    Args:
        conn: 数据库连接
        distance_threshold: 距离阈值

    Returns:
        result: 分析结果
    """
    # 查询监测点坐标
    query_points = """
        SELECT DISTINCT point_id, x_coord, y_coord
        FROM monitoring_points
        ORDER BY point_id
    """

    points_df = pd.read_sql(query_points, conn)

    if len(points_df) < 2:
        return {
            'success': False,
            'message': '监测点数量不足，至少需要2个点'
        }

    # 查询沉降数据
    query_settlement = """
        SELECT point_id, measurement_date, cumulative_change
        FROM processed_settlement_data
        ORDER BY point_id, measurement_date
    """

    settlement_df = pd.read_sql(query_settlement, conn)

    # 转换为矩阵格式
    pivot_df = settlement_df.pivot(index='measurement_date',
                                   columns='point_id',
                                   values='cumulative_change')

    settlement_matrix = pivot_df.values.T  # (n_points, n_timesteps)

    # 提取坐标
    coordinates = list(zip(points_df['x_coord'], points_df['y_coord']))

    # 创建分析器
    analyzer = SpatialCorrelationAnalyzer(distance_threshold=distance_threshold)

    # 构建邻接矩阵
    adj_matrix = analyzer.build_adjacency_matrix(coordinates)

    # 计算相关性矩阵
    corr_matrix = analyzer.calculate_correlation_matrix(settlement_matrix)

    # 识别聚类
    clusters = analyzer.find_spatial_clusters(coordinates, settlement_matrix, min_correlation=0.7)

    return {
        'success': True,
        'points': points_df.to_dict('records'),
        'adjacency_matrix': adj_matrix.tolist(),
        'correlation_matrix': corr_matrix.tolist(),
        'clusters': clusters,
        'cluster_count': len(clusters)
    }


# 测试代码
if __name__ == '__main__':
    print("[测试] 空间关联分析模块")

    # 模拟10个监测点
    np.random.seed(42)
    coordinates = [
        (0, 0), (10, 0), (20, 0),
        (0, 10), (10, 10), (20, 10),
        (0, 20), (10, 20), (20, 20), (50, 50)
    ]

    # 模拟沉降数据（前9个点相关，最后1个点独立）
    n_timesteps = 50
    settlement_data = np.zeros((10, n_timesteps))

    for i in range(9):
        base_trend = np.linspace(0, 5, n_timesteps)
        noise = np.random.randn(n_timesteps) * 0.2
        settlement_data[i] = base_trend + noise

    # 最后一个点独立
    settlement_data[9] = np.linspace(0, 2, n_timesteps) + np.random.randn(n_timesteps) * 0.1

    print(f"[数据] 10个监测点，{n_timesteps}个时间步")

    # 创建分析器
    analyzer = SpatialCorrelationAnalyzer(distance_threshold=30.0)

    # 构建邻接矩阵
    print("\n[步骤1] 构建空间邻接矩阵...")
    adj_matrix = analyzer.build_adjacency_matrix(coordinates)
    print(f"[成功] 邻接矩阵形状: {adj_matrix.shape}")

    # 计算相关性矩阵
    print("\n[步骤2] 计算沉降相关性矩阵...")
    corr_matrix = analyzer.calculate_correlation_matrix(settlement_data)
    print(f"[成功] 相关性矩阵形状: {corr_matrix.shape}")
    print(f"[统计] 平均相关系数: {np.mean(corr_matrix[corr_matrix != 1.0]):.3f}")

    # 识别聚类
    print("\n[步骤3] 识别空间聚类...")
    clusters = analyzer.find_spatial_clusters(coordinates, settlement_data, min_correlation=0.7)
    print(f"[结果] 发现 {len(clusters)} 个聚类")
    for i, cluster in enumerate(clusters, 1):
        print(f"  聚类{i}: 包含点 {cluster}")

    # 分析影响传播
    print("\n[步骤4] 分析异常传播路径（从点0开始）...")
    propagation = analyzer.analyze_influence_propagation(0, coordinates, settlement_data)
    print(f"[结果] 影响路径（前5个）:")
    for item in propagation[:5]:
        print(f"  点{item['point_index']}: 影响分数={item['influence_score']:.3f}, "
              f"相关性={item['correlation']:.3f}, 距离={item['distance']:.1f}m")

    print("\n[测试完成]")
