export const NEON_COLORS = {
  primary: '#00e5ff',
  secondary: '#0088ff',
  warning: '#ff3e5f',
  success: '#00e676',
  neutral: '#7986cb',
  purple: '#bf5af2',
  orange: '#ff9e0d',
  cyan: '#00d8c9',
};

export const cyberpunkTheme = {
  color: [
    NEON_COLORS.primary,
    NEON_COLORS.success,
    NEON_COLORS.warning,
    NEON_COLORS.purple,
    NEON_COLORS.orange,
    NEON_COLORS.neutral,
    NEON_COLORS.secondary,
    NEON_COLORS.cyan,
  ],

  backgroundColor: 'transparent',

  textStyle: {
    color: '#ffffff',
    fontFamily: 'Rajdhani, Microsoft YaHei, sans-serif',
  },

  title: {
    textStyle: {
      color: NEON_COLORS.primary,
      fontSize: 16,
      fontWeight: 500,
    },
    subtextStyle: {
      color: '#cccccc',
      fontSize: 12,
    },
  },

  legend: {
    textStyle: {
      color: '#cccccc',
      fontSize: 12,
    },
    pageTextStyle: {
      color: '#cccccc',
    },
  },

  tooltip: {
    backgroundColor: 'rgba(10, 18, 30, 0.95)',
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderWidth: 1,
    textStyle: {
      color: '#ffffff',
      fontSize: 12,
    },
    extraCssText: 'box-shadow: 0 0 10px rgba(0, 229, 255, 0.2);',
  },

  axisPointer: {
    lineStyle: {
      color: 'rgba(0, 229, 255, 0.5)',
    },
    crossStyle: {
      color: 'rgba(0, 229, 255, 0.5)',
    },
  },

  xAxis: {
    axisLine: {
      lineStyle: {
        color: 'rgba(0, 229, 255, 0.3)',
      },
    },
    axisTick: {
      lineStyle: {
        color: 'rgba(0, 229, 255, 0.3)',
      },
    },
    axisLabel: {
      color: '#cccccc',
      fontSize: 11,
    },
    splitLine: {
      lineStyle: {
        color: 'rgba(0, 229, 255, 0.1)',
      },
    },
  },

  yAxis: {
    axisLine: {
      lineStyle: {
        color: 'rgba(0, 229, 255, 0.3)',
      },
    },
    axisTick: {
      lineStyle: {
        color: 'rgba(0, 229, 255, 0.3)',
      },
    },
    axisLabel: {
      color: '#cccccc',
      fontSize: 11,
    },
    splitLine: {
      lineStyle: {
        color: 'rgba(0, 229, 255, 0.1)',
      },
    },
  },

  grid: {
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },

  dataZoom: [
    {
      type: 'inside',
      textStyle: {
        color: '#cccccc',
      },
    },
    {
      type: 'slider',
      textStyle: {
        color: '#cccccc',
      },
      borderColor: 'rgba(0, 229, 255, 0.3)',
      fillerColor: 'rgba(0, 229, 255, 0.1)',
      handleStyle: {
        color: NEON_COLORS.primary,
        borderColor: NEON_COLORS.primary,
      },
      moveHandleStyle: {
        color: NEON_COLORS.primary,
      },
      selectedDataBackground: {
        lineStyle: {
          color: NEON_COLORS.primary,
        },
        areaStyle: {
          color: 'rgba(0, 229, 255, 0.2)',
        },
      },
    },
  ],

  line: {
    smooth: true,
    symbol: 'circle',
    symbolSize: 6,
    lineStyle: {
      width: 2,
    },
  },

  bar: {
    itemStyle: {
      borderRadius: [2, 2, 0, 0],
    },
  },

  pie: {
    itemStyle: {
      borderColor: 'rgba(10, 18, 30, 0.9)',
      borderWidth: 2,
    },
    label: {
      color: '#ffffff',
    },
  },

  scatter: {
    symbolSize: 8,
  },

  gauge: {
    axisLine: {
      lineStyle: {
        color: [
          [0.3, NEON_COLORS.success],
          [0.7, NEON_COLORS.primary],
          [1, NEON_COLORS.warning],
        ],
      },
    },
    pointer: {
      itemStyle: {
        color: NEON_COLORS.primary,
      },
    },
    axisTick: {
      lineStyle: {
        color: 'rgba(0, 229, 255, 0.5)',
      },
    },
    splitLine: {
      lineStyle: {
        color: 'rgba(0, 229, 255, 0.5)',
      },
    },
    axisLabel: {
      color: '#cccccc',
    },
    detail: {
      color: NEON_COLORS.primary,
    },
  },

  radar: {
    axisLine: {
      lineStyle: {
        color: 'rgba(0, 229, 255, 0.3)',
      },
    },
    splitLine: {
      lineStyle: {
        color: 'rgba(0, 229, 255, 0.2)',
      },
    },
    splitArea: {
      areaStyle: {
        color: ['rgba(0, 229, 255, 0.02)', 'rgba(0, 229, 255, 0.05)'],
      },
    },
  },
};

let themeRegistered = false;

type EChartsThemeRegistry = {
  registerTheme: (themeName: string, theme: unknown) => void;
};

export function registerCyberpunkTheme(echarts: EChartsThemeRegistry): void {
  if (!themeRegistered) {
    echarts.registerTheme('cyberpunk', cyberpunkTheme);
    themeRegistered = true;
  }
}

export default cyberpunkTheme;
