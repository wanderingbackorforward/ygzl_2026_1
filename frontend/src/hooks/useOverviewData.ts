import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../lib/api';

/**
 * Overview 汇总数据类型
 */
export interface OverviewSummary {
    settlement: {
        total_points: number;
        max_value: number;
        alert_count: number;
        trend_distribution: Record<string, number>;
        error?: string;
    };
    cracks: {
        total_points: number;
        expanding_count: number;
        shrinking_count: number;
        stable_count: number;
        critical_count: number;
        error?: string;
    };
    temperature: {
        total_sensors: number;
        avg_temp: number;
        min_temp: number;
        max_temp: number;
        trend_distribution: Record<string, number>;
        error?: string;
    };
    vibration: {
        total_datasets: number;
        status: string;
        error?: string;
    };
    safety_score: number;
}

/**
 * 获取 Overview 汇总数据的 Hook
 */
export function useOverviewData(): {
    data: OverviewSummary | null;
    loading: boolean;
    error: string | null;
    refetch: () => void;
} {
    const [data, setData] = useState<OverviewSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await apiGet<OverviewSummary>('/overview/summary');
            setData(result);
        } catch (e) {
            setError(e instanceof Error ? e.message : '加载汇总数据失败');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, error, refetch: fetchData };
}
