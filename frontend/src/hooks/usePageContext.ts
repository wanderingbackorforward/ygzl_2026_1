import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { PageContext } from '../types/pageContext';

/**
 * 页面上下文提取 Hook
 * 根据当前路由自动提取页面上下文信息
 */
export function usePageContext(): PageContext | null {
  const location = useLocation();
  const [context, setContext] = useState<PageContext | null>(null);

  useEffect(() => {
    const extractContext = async () => {
      const path = location.pathname;

      // 根据路径提取基础信息
      const baseContext = getBaseContext(path);

      if (!baseContext) {
        setContext(null);
        return;
      }

      // 尝试从页面 DOM 或全局状态中提取数据
      const dataSnapshot = await extractDataSnapshot(baseContext.moduleKey);

      setContext({
        ...baseContext,
        dataSnapshot,
        metadata: {
          lastUpdate: new Date().toISOString(),
          dataSource: getDataSource(baseContext.moduleKey),
          recordCount: dataSnapshot.summary?.totalCount || 0,
          hasAnomalies: dataSnapshot.summary?.anomalyCount > 0,
          anomalyCount: dataSnapshot.summary?.anomalyCount || 0,
        },
      });
    };

    extractContext();
  }, [location.pathname]);

  return context;
}

/**
 * 根据路径获取基础上下文信息
 */
function getBaseContext(path: string): Partial<PageContext> | null {
  const routeMap: Record<string, Partial<PageContext>> = {
    '/insar': {
      pagePath: '/insar',
      pageTitle: 'InSAR 监测',
      moduleKey: 'insar',
    },
    '/settlement': {
      pagePath: '/settlement',
      pageTitle: '沉降监测',
      moduleKey: 'settlement',
    },
    '/temperature': {
      pagePath: '/temperature',
      pageTitle: '温度监测',
      moduleKey: 'temperature',
    },
    '/cracks': {
      pagePath: '/cracks',
      pageTitle: '裂缝监测',
      moduleKey: 'cracks',
    },
    '/vibration': {
      pagePath: '/vibration',
      pageTitle: '振动监测',
      moduleKey: 'vibration',
    },
    '/overview': {
      pagePath: '/overview',
      pageTitle: '数据总览',
      moduleKey: 'overview',
    },
    '/advanced': {
      pagePath: '/advanced',
      pageTitle: '高级分析',
      moduleKey: 'advanced',
    },
    '/tickets': {
      pagePath: '/tickets',
      pageTitle: '工单管理',
      moduleKey: 'tickets',
    },
  };

  return routeMap[path] || null;
}

/**
 * 提取数据快照
 * 从页面 DOM 或 API 中提取当前显示的数据
 */
async function extractDataSnapshot(moduleKey: string): Promise<any> {
  // 默认空快照
  const emptySnapshot = {
    summary: {},
    selectedItems: [],
    filters: {},
    statistics: {},
  };

  try {
    // 尝试从 window 对象中获取页面数据（如果页面有暴露）
    const pageData = (window as any).__PAGE_DATA__;
    if (pageData && pageData[moduleKey]) {
      return pageData[moduleKey];
    }

    // 尝试从 localStorage 获取缓存数据
    const cachedData = localStorage.getItem(`page_data_${moduleKey}`);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      // 检查是否过期（5分钟）
      if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
        return parsed.data;
      }
    }

    // 如果都没有，返回空快照
    return emptySnapshot;
  } catch (error) {
    console.error('Failed to extract data snapshot:', error);
    return emptySnapshot;
  }
}

/**
 * 获取数据源名称
 */
function getDataSource(moduleKey: string): string {
  const sourceMap: Record<string, string> = {
    insar: 'Sentinel-1 SAR',
    settlement: '沉降监测传感器',
    temperature: '温度传感器',
    cracks: '裂缝监测仪',
    vibration: '振动传感器',
    overview: '综合数据源',
    advanced: '分析引擎',
    tickets: '工单系统',
  };

  return sourceMap[moduleKey] || '未知数据源';
}

/**
 * 辅助函数：保存页面数据到缓存
 * 页面组件可以调用此函数来缓存数据，供上下文提取使用
 */
export function cachePageData(moduleKey: string, data: any): void {
  try {
    localStorage.setItem(
      `page_data_${moduleKey}`,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      })
    );
  } catch (error) {
    console.error('Failed to cache page data:', error);
  }
}

/**
 * 辅助函数：清除页面数据缓存
 */
export function clearPageDataCache(moduleKey?: string): void {
  try {
    if (moduleKey) {
      localStorage.removeItem(`page_data_${moduleKey}`);
    } else {
      // 清除所有页面数据缓存
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('page_data_')) {
          localStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.error('Failed to clear page data cache:', error);
  }
}
