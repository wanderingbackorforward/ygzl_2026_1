// 公共调试函数
function debugChartInit(chartName, initFunction) {
  console.log(`开始初始化${chartName}...`);
  try {
    // 检查DOM元素是否存在
    const elementId = chartName === '斜率趋势图' ? 'chart-slope' :
                       chartName === '平均裂缝变化速率图' ? 'chart-rate' :
                       'chart-correlation';

    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`${chartName}的DOM元素 #${elementId} 不存在`);
      return false;
    }

    // 检查数据
    console.log(`${chartName}数据准备前的monitoringPoints:`,
                monitoringPoints ? monitoringPoints.length : '未定义');

    // 调用原始初始化函数
    initFunction();

    console.log(`${chartName}初始化成功`);
    return true;
  } catch (error) {
    console.error(`${chartName}初始化失败:`, error);
    console.error('错误堆栈:', error.stack);
    return false;
  }
}

// 修改后的斜率趋势图初始化函数
function initSlopeChart() {
  try {
    console.log('斜率趋势图数据准备开始');

    // 获取DOM元素
    const chartDom = document.getElementById('chart-slope');
    console.log('斜率趋势图DOM元素:', chartDom);

    const chart = echarts.init(chartDom);
    console.log('斜率趋势图ECharts实例创建成功');

    // 检查monitoringPoints
    if (!monitoringPoints || !Array.isArray(monitoringPoints)) {
      console.error('monitoringPoints不是数组或未定义:', monitoringPoints);
      return;
    }

    console.log('monitoringPoints数量:', monitoringPoints.length);

    // 记录几个样本监测点
    console.log('监测点样本:', monitoringPoints.slice(0, 3));

    // 准备斜率数据
    const slopeData = [];
    let validPointCount = 0;
    let nullSlopeCount = 0;

    monitoringPoints.forEach(point => {
      // 检查point对象是否完整
      if (!point) {
        console.warn('发现无效的监测点对象');
        return;
      }

      console.log(`处理监测点: ${point.point_id}, 斜率值: ${point.trend_slope}`);

      if (point.trend_slope !== null) {
        validPointCount++;
        slopeData.push({
          name: point.point_id,
          value: point.trend_slope,
          itemStyle: {
            color: point.trend_slope > 0.1 ? '#c23531' :
                   point.trend_slope > 0 ? '#e98f6f' :
                   point.trend_slope > -0.1 ? '#91c7ae' : '#2f4554'
          }
        });
      } else {
        nullSlopeCount++;
      }
    });

    console.log(`有效斜率点: ${validPointCount}, 无斜率点: ${nullSlopeCount}`);
    console.log('斜率数据样本:', slopeData.slice(0, 3));

    // 按斜率排序
    slopeData.sort((a, b) => b.value - a.value);
    console.log('排序后斜率数据样本:', slopeData.slice(0, 3));

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: function(params) {
          return params[0].name + ': ' + params[0].value.toFixed(4) + ' mm/天';
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        name: '斜率(mm/天)'
      },
      yAxis: {
        type: 'category',
        data: slopeData.map(item => item.name),
        axisLabel: {
          interval: 0,
          rotate: 45
        }
      },
      series: [
        {
          name: '趋势斜率',
          type: 'bar',
          data: slopeData,
          label: {
            show: true,
            position: 'right',
            formatter: '{c}'
          }
        }
      ]
    };

    console.log('斜率趋势图配置准备完成, 开始setOption');
    console.log('yAxis数据长度:', option.yAxis.data.length);
    console.log('series数据长度:', option.series[0].data.length);

    try {
      chart.setOption(option);
      console.log('斜率趋势图setOption成功');
    } catch (setOptionError) {
      console.error('setOption失败:', setOptionError);
      console.error('setOption错误堆栈:', setOptionError.stack);
      return;
    }

    charts.slope = chart;

    window.addEventListener('resize', function() {
      chart.resize();
    });

    console.log('斜率趋势图初始化完成');
  } catch (error) {
    console.error('斜率趋势图初始化失败:', error);
    console.error('错误堆栈:', error.stack);
  }
}

// 修改后的平均裂缝变化速率图初始化函数
function initRateChart() {
  try {
    console.log('平均裂缝变化速率图初始化开始');

    const chartDom = document.getElementById('chart-rate');
    console.log('平均裂缝变化速率图DOM元素:', chartDom);

    const chart = echarts.init(chartDom);
    console.log('平均裂缝变化速率图ECharts实例创建成功');

    // 检查monitoringPoints
    if (!monitoringPoints || !Array.isArray(monitoringPoints)) {
      console.error('monitoringPoints不是数组或未定义:', monitoringPoints);
      return;
    }

    console.log('monitoringPoints数量:', monitoringPoints.length);

    // 按照变化类型分组计算平均变化率
    const changeTypeData = {};
    let pointsWithChangeType = 0;
    let pointsWithoutChangeType = 0;
    let pointsWithNullRate = 0;

    monitoringPoints.forEach(point => {
      if (!point) {
        console.warn('发现无效的监测点对象');
        return;
      }

      console.log(`处理监测点: ${point.point_id}, 变化类型: ${point.change_type}, 平均变化率: ${point.average_change_rate}`);

      if (point.change_type && point.average_change_rate !== null) {
        pointsWithChangeType++;
        if (!changeTypeData[point.change_type]) {
          changeTypeData[point.change_type] = {
            count: 0,
            sum: 0,
            points: []
          };
        }

        changeTypeData[point.change_type].count++;
        changeTypeData[point.change_type].sum += Math.abs(point.average_change_rate);
        changeTypeData[point.change_type].points.push({
          name: point.point_id,
          value: Math.abs(point.average_change_rate)
        });
      } else {
        if (!point.change_type) pointsWithoutChangeType++;
        if (point.average_change_rate === null) pointsWithNullRate++;
      }
    });

    console.log(`有变化类型的点: ${pointsWithChangeType}, 无变化类型的点: ${pointsWithoutChangeType}, 无平均变化率的点: ${pointsWithNullRate}`);
    console.log('变化类型数据:', changeTypeData);

    // 计算每种类型的平均变化率
    const avgData = [];
    for (const type in changeTypeData) {
      if (changeTypeData[type].count > 0) {
        avgData.push({
          name: type,
          value: changeTypeData[type].sum / changeTypeData[type].count,
          itemStyle: {
            color: type === '扩展' ? '#c23531' :
                   type === '收缩' ? '#2f4554' :
                   type === '稳定' ? '#61a0a8' : '#d48265'
          }
        });
      }
    }

    console.log('平均数据:', avgData);

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} (mm/天)'
      },
      legend: {
        data: avgData.map(item => item.name)
      },
      series: [
        {
          name: '平均变化速率',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          label: {
            show: true,
            formatter: '{b}: {c} mm/天'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: '18',
              fontWeight: 'bold'
            }
          },
          labelLine: {
            show: true
          },
          data: avgData
        }
      ]
    };

    console.log('平均裂缝变化速率图配置准备完成, 开始setOption');
    console.log('series数据长度:', option.series[0].data.length);

    try {
      chart.setOption(option);
      console.log('平均裂缝变化速率图setOption成功');
    } catch (setOptionError) {
      console.error('setOption失败:', setOptionError);
      console.error('setOption错误堆栈:', setOptionError.stack);
      return;
    }

    charts.rate = chart;

    window.addEventListener('resize', function() {
      chart.resize();
    });

    console.log('平均裂缝变化速率图初始化完成');
  } catch (error) {
    console.error('平均裂缝变化速率图初始化失败:', error);
    console.error('错误堆栈:', error.stack);
  }
}

// 修改后的相关性图初始化函数
function initCorrelationChart() {
  try {
    console.log('相关性图初始化开始');

    const chartDom = document.getElementById('chart-correlation');
    console.log('相关性图DOM元素:', chartDom);

    const chart = echarts.init(chartDom);
    console.log('相关性图ECharts实例创建成功');

    // 检查monitoringPoints
    if (!monitoringPoints || !Array.isArray(monitoringPoints)) {
      console.error('monitoringPoints不是数组或未定义:', monitoringPoints);
      return;
    }

    console.log('monitoringPoints数量:', monitoringPoints.length);

    // 模拟相关性数据
    // 检查是否有至少10个监测点
    const pointCount = Math.min(10, monitoringPoints.length);
    console.log(`将使用${pointCount}个监测点进行相关性分析`);

    const pointIds = monitoringPoints.slice(0, pointCount).map(p => p.point_id);
    console.log('使用的监测点ID:', pointIds);

    // 生成相关性矩阵
    const correlationData = [];
    const n = pointIds.length;

    // 简化模型：假设相邻点之间有较高相关性，非相邻点相关性较低
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        // 对角线为1
        if (i === j) {
          correlationData.push([i, j, 1]);
        } else {
          // 简单模型：相邻点相关性高，其他随距离减小
          const distance = Math.abs(i - j);
          const correlation = distance === 1 ?
            0.7 + Math.random() * 0.3 :
            Math.max(0, 0.8 - distance * 0.2) + (Math.random() - 0.5) * 0.2;

          correlationData.push([i, j, correlation.toFixed(2)]);
          correlationData.push([j, i, correlation.toFixed(2)]);
        }
      }
    }

    console.log(`相关性数据点数量: ${correlationData.length}`);
    console.log('相关性数据样本:', correlationData.slice(0, 5));

    const option = {
      tooltip: {
        position: 'top',
        formatter: function (params) {
          return pointIds[params.value[0]] + ' 与 ' +
                 pointIds[params.value[1]] + ' 的相关系数: ' +
                 params.value[2];
        }
      },
      grid: {
        left: '3%',
        right: '7%',
        bottom: '7%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: pointIds,
        axisLabel: {
          interval: 0,
          rotate: 45
        },
        splitArea: {
          show: true
        }
      },
      yAxis: {
        type: 'category',
        data: pointIds,
        axisLabel: {
          interval: 0
        },
        splitArea: {
          show: true
        }
      },
      visualMap: {
        min: -1,
        max: 1,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '0%',
        inRange: {
          color: ['#2f4554', '#ffffff', '#c23531']
        }
      },
      series: [{
        name: '相关系数',
        type: 'heatmap',
        data: correlationData,
        label: {
          show: true
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    };

    console.log('相关性图配置准备完成, 开始setOption');
    console.log('xAxis数据长度:', option.xAxis.data.length);
    console.log('yAxis数据长度:', option.yAxis.data.length);
    console.log('series数据长度:', option.series[0].data.length);

    try {
      chart.setOption(option);
      console.log('相关性图setOption成功');
    } catch (setOptionError) {
      console.error('setOption失败:', setOptionError);
      console.error('setOption错误堆栈:', setOptionError.stack);
      return;
    }

    charts.correlation = chart;

    window.addEventListener('resize', function() {
      chart.resize();
    });

    console.log('相关性图初始化完成');
  } catch (error) {
    console.error('相关性图初始化失败:', error);
    console.error('错误堆栈:', error.stack);
  }
}

// 使用下面的代码替换原来的图表初始化调用
function initAllCharts() {
  console.log('开始初始化所有图表');
  console.log('monitoringPoints类型:', typeof monitoringPoints);
  console.log('monitoringPoints是否为数组:', Array.isArray(monitoringPoints));
  if (Array.isArray(monitoringPoints)) {
    console.log('monitoringPoints长度:', monitoringPoints.length);
    if (monitoringPoints.length > 0) {
      console.log('第一个监测点样本:', monitoringPoints[0]);
    }
  }

  // 按顺序初始化图表，并在每个图表初始化后添加延迟
  setTimeout(() => {
    try {
      console.log('开始初始化斜率趋势图');
      initSlopeChart();
    } catch (error) {
      console.error('斜率趋势图初始化出错:', error);
    }

    // 延迟初始化下一个图表
    setTimeout(() => {
      try {
        console.log('开始初始化平均裂缝变化速率图');
        initRateChart();
      } catch (error) {
        console.error('平均裂缝变化速率图初始化出错:', error);
      }

      // 延迟初始化最后一个图表
      setTimeout(() => {
        try {
          console.log('开始初始化相关性图');
          initCorrelationChart();
        } catch (error) {
          console.error('相关性图初始化出错:', error);
        }
      }, 300);
    }, 300);
  }, 300);
}

// 检查全局变量
function checkGlobalVariables() {
  console.log('===== 全局变量检查 =====');
  console.log('echarts是否存在:', typeof echarts !== 'undefined');
  console.log('charts是否存在:', typeof charts !== 'undefined');
  console.log('monitoringPoints是否存在:', typeof monitoringPoints !== 'undefined');

  if (typeof monitoringPoints !== 'undefined') {
    console.log('monitoringPoints类型:', typeof monitoringPoints);
    if (Array.isArray(monitoringPoints)) {
      console.log('monitoringPoints长度:', monitoringPoints.length);
      if (monitoringPoints.length > 0) {
        // 检查第一个元素的属性
        const firstPoint = monitoringPoints[0];
        console.log('第一个监测点的属性:');
        console.log('- point_id:', firstPoint.point_id);
        console.log('- trend_slope:', firstPoint.trend_slope);
        console.log('- change_type:', firstPoint.change_type);
        console.log('- average_change_rate:', firstPoint.average_change_rate);
      }
    }
  }

  // 检查DOM元素
  console.log('chart-slope元素:', document.getElementById('chart-slope'));
  console.log('chart-rate元素:', document.getElementById('chart-rate'));
  console.log('chart-correlation元素:', document.getElementById('chart-correlation'));
}

// 添加按钮以便手动触发调试
function addDebugButtons() {
  const debugPanel = document.createElement('div');
  debugPanel.style.position = 'fixed';
  debugPanel.style.top = '10px';
  debugPanel.style.right = '10px';
  debugPanel.style.zIndex = '9999';
  debugPanel.style.background = 'rgba(255,255,255,0.9)';
  debugPanel.style.border = '1px solid #ccc';
  debugPanel.style.padding = '10px';
  debugPanel.style.borderRadius = '5px';
  debugPanel.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';

  debugPanel.innerHTML = `
    <div style="font-weight:bold;margin-bottom:10px;text-align:center;">图表调试</div>
    <button id="check-variables" style="margin:5px;padding:5px;">检查全局变量</button><br>
    <button id="init-slope" style="margin:5px;padding:5px;">初始化斜率图</button><br>
    <button id="init-rate" style="margin:5px;padding:5px;">初始化变化率图</button><br>
    <button id="init-correlation" style="margin:5px;padding:5px;">初始化相关性图</button><br>
    <button id="init-all" style="margin:5px;padding:5px;">初始化所有图表</button><br>
    <button id="close-debug" style="margin:5px;padding:5px;">关闭调试面板</button>
  `;

  document.body.appendChild(debugPanel);

  document.getElementById('check-variables').addEventListener('click', checkGlobalVariables);
  document.getElementById('init-slope').addEventListener('click', initSlopeChart);
  document.getElementById('init-rate').addEventListener('click', initRateChart);
  document.getElementById('init-correlation').addEventListener('click', initCorrelationChart);
  document.getElementById('init-all').addEventListener('click', initAllCharts);
  document.getElementById('close-debug').addEventListener('click', () => debugPanel.remove());

  console.log('调试面板已添加');
}

// 在页面加载完成后添加调试按钮
window.addEventListener('load', function() {
  console.log('页面加载完成，添加调试按钮');
  setTimeout(addDebugButtons, 1000);
});

// 添加一个全局错误处理器来捕获所有未处理的错误
window.addEventListener('error', function(event) {
  console.error('全局错误:', event.message);
  console.error('错误源:', event.filename);
  console.error('行号:', event.lineno);
  console.error('列号:', event.colno);
  console.error('错误对象:', event.error);

  if (event.error && event.error.stack) {
    console.error('错误堆栈:', event.error.stack);
  }

  // 阻止默认处理
  event.preventDefault();
});