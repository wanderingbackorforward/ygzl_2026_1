// 振动监测图表绘制脚本
document.addEventListener('DOMContentLoaded', function() {
    // 初始化振动监测图表
    initVibrationCharts();
    
    // 绑定上传按钮事件
    document.getElementById('upload-button').addEventListener('click', showUploadModal);
    document.getElementById('select-file-btn').addEventListener('click', function() {
        document.getElementById('file-input').click();
    });
    
    // 绑定文件选择和拖放事件
    document.getElementById('file-input').addEventListener('change', handleFileSelect);
    
    // 绑定文件上传事件
    document.getElementById('upload-file-btn').addEventListener('click', uploadFiles);
    
    // 绑定模态框关闭按钮
    document.querySelector('.close').addEventListener('click', function() {
        document.getElementById('upload-modal').style.display = 'none';
    });
    
    // 绑定拖放区域事件
    const dropArea = document.getElementById('drop-area');
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    dropArea.addEventListener('drop', handleDrop, false);
    
    // 绑定数据集选择器事件
    document.getElementById('dataset-selector').addEventListener('change', function() {
        const datasetId = this.value;
        if (datasetId) {
            loadDataset(datasetId);
        }
    });
    
    // 绑定通道选择器事件
    document.getElementById('channel-selector').addEventListener('change', function() {
        const channelId = this.value;
        const datasetId = document.getElementById('dataset-selector').value;
        if (channelId && datasetId) {
            loadChannelData(datasetId, channelId);
        }
    });
});

// 全局变量存储图表实例
let charts = {
    timeDomain: null,
    frequencyDomain: null,
    waveformFactor: null,
    pulseFactor: null,
    frequencyMetrics: null,
    featureRadar: null
};

// 全局变量存储数据集
let datasets = [];
let currentDataset = null;
let currentChannel = null;

// 阻止默认行为
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// 高亮拖放区域
function highlight() {
    document.getElementById('drop-area').classList.add('highlight');
}

// 取消高亮
function unhighlight() {
    document.getElementById('drop-area').classList.remove('highlight');
}

// 初始化所有振动图表
function initVibrationCharts() {
    console.log('开始初始化振动图表...');
    
    // 注册自定义主题
    initCyberpunkTheme();
    
    // 加载数据集列表
    loadDatasetList()
        .then(() => {
            console.log('数据集列表加载完成');
            
            // 初始化图表
            initTimeDomainChart();
            initFrequencyDomainChart();
            initWaveformFactorChart();
            initPulseFactorChart();
            initFrequencyMetricsChart();
            initFeatureRadarChart();
            
            // 为图表添加放大功能
            setupChartZoom();
            
            console.log('振动图表初始化完成');
        })
        .catch(error => {
            console.error('初始化振动图表失败:', error);
            showNotification('初始化图表失败，请检查数据是否已导入', 'error');
        });
}

// 注册主题
function initCyberpunkTheme() {
    const neonColors = {
        primary: '#00e5ff',
        secondary: '#0088ff',
        warning: '#ff3e5f',
        success: '#00e676',
        neutral: '#7986cb',
        purple: '#bf5af2',
        orange: '#ff9e0d'
    };
    
    const cyberTheme = {
        color: [
            neonColors.primary,
            neonColors.success,
            neonColors.warning,
            neonColors.purple,
            neonColors.orange,
            neonColors.neutral
        ],
        backgroundColor: 'transparent',
        textStyle: {
            color: '#e0f7fa'
        },
        title: {
            textStyle: {
                color: neonColors.primary
            }
        },
        line: {
            width: 3,
            opacity: 0.9,
            smooth: true
        },
        radar: {
            itemStyle: {
                borderWidth: 1
            },
            lineStyle: {
                width: 2
            },
            symbolSize: 6,
            symbol: 'circle',
            smooth: true
        },
        bar: {
            itemStyle: {
                barBorderWidth: 0,
                barBorderColor: '#ccc'
            }
        },
        pie: {
            itemStyle: {
                borderWidth: 0,
                borderColor: '#ccc'
            }
        },
        categoryAxis: {
            axisLine: {
                show: true,
                lineStyle: {
                    color: 'rgba(0, 229, 255, 0.3)'
                }
            },
            axisTick: {
                show: true,
                alignWithLabel: true,
                lineStyle: {
                    color: 'rgba(0, 229, 255, 0.3)'
                }
            },
            axisLabel: {
                show: true,
                color: 'rgba(224, 247, 250, 0.7)',
                fontSize: 18
            },
            splitLine: {
                show: false,
                lineStyle: {
                    color: ['rgba(0, 229, 255, 0.1)']
                }
            }
        },
        valueAxis: {
            axisLine: {
                show: true,
                lineStyle: {
                    color: 'rgba(0, 229, 255, 0.3)'
                }
            },
            axisTick: {
                show: true,
                lineStyle: {
                    color: 'rgba(0, 229, 255, 0.3)'
                }
            },
            axisLabel: {
                show: true,
                color: 'rgba(224, 247, 250, 0.7)',
                fontSize: 18
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: ['rgba(0, 229, 255, 0.1)'],
                    type: 'dashed'
                }
            }
        },
        tooltip: {
            backgroundColor: 'rgba(16, 23, 41, 0.9)',
            borderColor: neonColors.primary,
            borderWidth: 1,
            textStyle: {
                color: '#e0f7fa',
                fontSize: 16
            }
        }
    };

    // 注册主题
    echarts.registerTheme('cyberpunk', cyberTheme);
}

// 加载数据集列表
function loadDatasetList() {
    return fetch('/api/vibration/datasets')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                datasets = data.data;
                updateDatasetSelector(datasets);
            } else {
                console.error('获取数据集列表失败:', data.message);
                throw new Error(data.message);
            }
        });
}

// 更新数据集选择器
function updateDatasetSelector(datasets) {
    const selector = document.getElementById('dataset-selector');
    
    // 清空旧选项
    selector.innerHTML = '<option value="">请选择数据集</option>';
    
    // 添加新选项
    datasets.forEach(dataset => {
        const option = document.createElement('option');
        option.value = dataset.id;
        option.textContent = dataset.name || `数据集 ${dataset.id}`;
        selector.appendChild(option);
    });
}

// 加载指定数据集
function loadDataset(datasetId) {
    return fetch(`/api/vibration/dataset/${datasetId}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                currentDataset = data.data;
                updateVibrationStats(currentDataset.stats);
                
                // 自动选择第一个通道
                if (currentDataset.channels && currentDataset.channels.length > 0) {
                    const channelSelector = document.getElementById('channel-selector');
                    channelSelector.value = "1"; // 默认选第一个通道
                    loadChannelData(datasetId, "1");
                }
            } else {
                console.error('获取数据集数据失败:', data.message);
                showNotification('加载数据集失败', 'error');
            }
        })
        .catch(error => {
            console.error('加载数据集失败:', error);
            showNotification('加载数据集失败', 'error');
        });
}

// 加载指定通道的数据
function loadChannelData(datasetId, channelId) {
    document.getElementById('selected-channel').textContent = `通道${channelId}`;
    
    return fetch(`/api/vibration/data/${datasetId}/${channelId}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                currentChannel = data.data;
                
                // 更新图表
                updateTimeDomainChart(currentChannel.timeData);
                updateFrequencyDomainChart(currentChannel.freqData);
                updateFeatureCharts(currentChannel.features);
                updateChannelDetails(currentChannel.features);
            } else {
                console.error('获取通道数据失败:', data.message);
                showNotification(`加载通道${channelId}数据失败`, 'error');
            }
        })
        .catch(error => {
            console.error('加载通道数据失败:', error);
            showNotification(`加载通道${channelId}数据失败`, 'error');
        });
}

// 更新振动指标概览
function updateVibrationStats(stats) {
    document.getElementById('mean-value').textContent = stats.mean_value.toFixed(4);
    document.getElementById('std-value').textContent = stats.standard_deviation.toFixed(4);
    document.getElementById('peak-value').textContent = stats.peak_value.toFixed(4);
    document.getElementById('rms-value').textContent = stats.root_mean_square.toFixed(4);
    document.getElementById('center-freq').textContent = stats.center_frequency.toFixed(2) + ' Hz';
}

// 初始化时域图表
function initTimeDomainChart() {
    const chart = echarts.init(document.getElementById('time-domain-chart'), 'cyberpunk');
    
    const option = {
        title: {
            text: '时域波形',
            left: 'center',
            top: 10,
            textStyle: {
                fontSize: 24
            },
            subtextStyle: {
                fontSize: 16
            }
        },
        tooltip: {
            trigger: 'axis',
            formatter: '{b}s: {c}',
            textStyle: { fontSize: 16 }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            name: '时间 (s)',
            nameTextStyle: { fontSize: 18 },
            data: [],
            axisLabel: { fontSize: 18 }
        },
        yAxis: {
            type: 'value',
            name: '振幅',
            nameTextStyle: { fontSize: 18 },
            axisLabel: { fontSize: 18 }
        },
        dataZoom: [
            { type: 'inside', start: 0, end: 100 },
            {
                show: true,
                type: 'slider',
                bottom: 10,
                start: 0,
                end: 100,
                textStyle: { fontSize: 16 }
            }
        ],
        series: [{
            name: '振幅',
            type: 'line',
            sampling: 'lttb',
            data: [],
            showSymbol: false,
            lineStyle: { width: 1 }
        }]
    };
    
    chart.setOption(option);
    charts.timeDomain = chart;
    
    // 窗口大小变化时重绘图表
    window.addEventListener('resize', function() {
        if (charts.timeDomain && !charts.timeDomain.isDisposed()) {
            charts.timeDomain.resize();
        }
    });
}

// 更新时域图表
function updateTimeDomainChart(timeData) {
    if (!charts.timeDomain) return;
    
    const option = {
        xAxis: {
            data: timeData.time
        },
        series: [{
            data: timeData.amplitude
        }],
        title: {
            subtext: `采样频率: ${timeData.sampling_rate} Hz | 采样点数: ${timeData.amplitude.length}`
        }
    };
    
    charts.timeDomain.setOption(option);
}

// 初始化频域图表
function initFrequencyDomainChart() {
    const chart = echarts.init(document.getElementById('frequency-domain-chart'), 'cyberpunk');
    
    const option = {
        title: {
            text: '频域分析',
            left: 'center',
            top: 10,
            textStyle: {
                fontSize: 24
            },
            subtextStyle: {
                fontSize: 16
            }
        },
        tooltip: {
            trigger: 'axis',
            formatter: '{b} Hz: {c}',
            textStyle: { fontSize: 16 }
        },
        toolbox: {
            feature: {
                dataZoom: {}
            },
            right: 15
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            name: '频率 (Hz)',
            nameTextStyle: { fontSize: 18 },
            data: [],
            axisLabel: { fontSize: 18 }
        },
        yAxis: {
            type: 'value',
            name: '振幅',
            nameTextStyle: { fontSize: 18 },
            axisLabel: { fontSize: 18 }
        },
        dataZoom: [
            {
                type: 'inside',
                start: 0,
                end: 50
            },
            {
                show: true,
                type: 'slider',
                bottom: 10,
                start: 0,
                end: 50,
                textStyle: { fontSize: 16 }
            }
        ],
        series: [{
            name: '频谱振幅',
            type: 'bar',
            data: [],
            itemStyle: {
                color: '#00e5ff'
            }
        }]
    };
    
    chart.setOption(option);
    charts.frequencyDomain = chart;
    
    // 窗口大小变化时重绘图表
    window.addEventListener('resize', function() {
        if (charts.frequencyDomain && !charts.frequencyDomain.isDisposed()) {
            charts.frequencyDomain.resize();
        }
    });
}

// 更新频域图表
function updateFrequencyDomainChart(freqData) {
    if (!charts.frequencyDomain) return;
    
    // 找出主要频率（振幅最大的频率）
    const maxIndex = freqData.amplitude.indexOf(Math.max(...freqData.amplitude));
    const peakFrequency = freqData.frequency[maxIndex];
    
    const option = {
        xAxis: {
            data: freqData.frequency
        },
        series: [{
            data: freqData.amplitude
        }],
        title: {
            subtext: `峰值频率: ${peakFrequency.toFixed(2)} Hz | 采样频率: ${freqData.sampling_rate} Hz`
        }
    };
    
    charts.frequencyDomain.setOption(option);
}

// 初始化波形因子图表
function initWaveformFactorChart() {
    const chart = echarts.init(document.getElementById('waveform-factor-chart'), 'cyberpunk');
    
    const option = {
        title: {
            text: '波形/峰值因子',
            left: 'center',
            textStyle: {
                fontSize: 24
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            },
            textStyle: { fontSize: 16 }
        },
        legend: {
            data: ['波形因子', '峰值因子'],
            top: 30,
            textStyle: { fontSize: 18 }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: 60,
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: ['通道1', '通道2', '通道3', '通道4', '通道5', '通道6', '通道7', '通道8'],
            axisLabel: { fontSize: 18 }
        },
        yAxis: {
            type: 'value',
            name: '因子值',
            nameTextStyle: { fontSize: 18 },
            axisLabel: { fontSize: 18 }
        },
        series: [
            {
                name: '波形因子',
                type: 'bar',
                data: [0, 0, 0, 0, 0, 0, 0, 0]
            },
            {
                name: '峰值因子',
                type: 'bar',
                data: [0, 0, 0, 0, 0, 0, 0, 0]
            }
        ]
    };
    
    chart.setOption(option);
    charts.waveformFactor = chart;
    
    // 窗口大小变化时重绘图表
    window.addEventListener('resize', function() {
        if (charts.waveformFactor && !charts.waveformFactor.isDisposed()) {
            charts.waveformFactor.resize();
        }
    });
}

// 初始化脉冲因子图表
function initPulseFactorChart() {
    const chart = echarts.init(document.getElementById('pulse-factor-chart'), 'cyberpunk');
    
    const option = {
        title: {
            text: '脉冲/间隙因子',
            left: 'center',
            textStyle: {
                fontSize: 24
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            },
            textStyle: { fontSize: 16 }
        },
        legend: {
            data: ['脉冲因子', '间隙因子'],
            top: 30,
            textStyle: { fontSize: 18 }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: 60,
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: ['通道1', '通道2', '通道3', '通道4', '通道5', '通道6', '通道7', '通道8'],
            axisLabel: { fontSize: 18 }
        },
        yAxis: {
            type: 'value',
            name: '因子值',
            nameTextStyle: { fontSize: 18 },
            axisLabel: { fontSize: 18 }
        },
        series: [
            {
                name: '脉冲因子',
                type: 'bar',
                data: [0, 0, 0, 0, 0, 0, 0, 0]
            },
            {
                name: '间隙因子',
                type: 'bar',
                data: [0, 0, 0, 0, 0, 0, 0, 0]
            }
        ]
    };
    
    chart.setOption(option);
    charts.pulseFactor = chart;
    
    // 窗口大小变化时重绘图表
    window.addEventListener('resize', function() {
        if (charts.pulseFactor && !charts.pulseFactor.isDisposed()) {
            charts.pulseFactor.resize();
        }
    });
}

// 初始化频率指标图表
function initFrequencyMetricsChart() {
    const chart = echarts.init(document.getElementById('frequency-metrics-chart'), 'cyberpunk');
    
    const option = {
        title: {
            text: '频率指标分析',
            left: 'center',
            textStyle: {
                fontSize: 24
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            },
            textStyle: { fontSize: 16 }
        },
        legend: {
            data: ['中心频率', '均方根频率', '频率标准差'],
            top: 30,
            textStyle: { fontSize: 18 }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: 60,
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: ['通道1', '通道2', '通道3', '通道4', '通道5', '通道6', '通道7', '通道8'],
            axisLabel: { fontSize: 18 }
        },
        yAxis: {
            type: 'value',
            name: '频率 (Hz)',
            nameTextStyle: { fontSize: 18 },
            axisLabel: { fontSize: 18 }
        },
        series: [
            {
                name: '中心频率',
                type: 'bar',
                data: [0, 0, 0, 0, 0, 0, 0, 0]
            },
            {
                name: '均方根频率',
                type: 'bar',
                data: [0, 0, 0, 0, 0, 0, 0, 0]
            },
            {
                name: '频率标准差',
                type: 'bar',
                data: [0, 0, 0, 0, 0, 0, 0, 0]
            }
        ]
    };
    
    chart.setOption(option);
    charts.frequencyMetrics = chart;
    
    // 窗口大小变化时重绘图表
    window.addEventListener('resize', function() {
        if (charts.frequencyMetrics && !charts.frequencyMetrics.isDisposed()) {
            charts.frequencyMetrics.resize();
        }
    });
}

// 初始化特征值雷达图
function initFeatureRadarChart() {
    const chart = echarts.init(document.getElementById('feature-radar-chart'), 'cyberpunk');
    
    const option = {
        title: {
            text: '特征值雷达图',
            left: 'center',
            textStyle: {
                fontSize: 24
            }
        },
        tooltip: {
            trigger: 'item',
            textStyle: { fontSize: 16 }
        },
        legend: {
            data: ['当前通道'],
            bottom: 0,
            textStyle: { fontSize: 18 }
        },
        radar: {
            indicator: [
                { name: '均值', max: 1 },
                { name: '标准差', max: 1 },
                { name: '峰值', max: 1 },
                { name: '均方根', max: 1 },
                { name: '波形因子', max: 5 },
                { name: '峰值因子', max: 5 }
            ],
            radius: '60%',
            name: {
                textStyle: {
                    fontSize: 18
                }
            }
        },
        series: [
            {
                name: '特征值雷达图',
                type: 'radar',
                emphasis: {
                    lineStyle: {
                        width: 4
                    }
                },
                data: [
                    {
                        value: [0, 0, 0, 0, 0, 0],
                        name: '当前通道'
                    }
                ]
            }
        ]
    };
    
    chart.setOption(option);
    charts.featureRadar = chart;
    
    // 窗口大小变化时重绘图表
    window.addEventListener('resize', function() {
        if (charts.featureRadar && !charts.featureRadar.isDisposed()) {
            charts.featureRadar.resize();
        }
    });
}

// 更新特征图表（波形因子、脉冲因子、频率指标图表）
function updateFeatureCharts(features) {
    // 确保有数据集信息
    if (!currentDataset || !currentDataset.channels) return;
    
    // 准备需要的数据
    const channelLabels = currentDataset.channels.map(ch => `通道${ch.channel_id}`);
    
    // 波形因子和峰值因子
    const waveformFactors = currentDataset.channels.map(ch => ch.features.wave_form_factor || 0);
    const peakFactors = currentDataset.channels.map(ch => ch.features.peak_factor || 0);
    
    // 脉冲因子和间隙因子
    const pulseFactors = currentDataset.channels.map(ch => ch.features.pulse_factor || 0);
    const clearanceFactors = currentDataset.channels.map(ch => ch.features.clearance_factor || 0);
    
    // 频率指标
    const centerFreqs = currentDataset.channels.map(ch => ch.features.center_frequency || 0);
    const rmsFreqs = currentDataset.channels.map(ch => ch.features.root_mean_square_frequency || 0);
    const freqStdDevs = currentDataset.channels.map(ch => ch.features.frequency_standard_deviation || 0);
    
    // 更新波形因子图表
    if (charts.waveformFactor) {
        const waveformOption = {
            xAxis: {
                data: channelLabels
            },
            series: [
                {
                    name: '波形因子',
                    data: waveformFactors
                },
                {
                    name: '峰值因子',
                    data: peakFactors
                }
            ]
        };
        charts.waveformFactor.setOption(waveformOption);
    }
    
    // 更新脉冲因子图表
    if (charts.pulseFactor) {
        const pulseOption = {
            xAxis: {
                data: channelLabels
            },
            series: [
                {
                    name: '脉冲因子',
                    data: pulseFactors
                },
                {
                    name: '间隙因子',
                    data: clearanceFactors
                }
            ]
        };
        charts.pulseFactor.setOption(pulseOption);
    }
    
    // 更新频率指标图表
    if (charts.frequencyMetrics) {
        const freqOption = {
            xAxis: {
                data: channelLabels
            },
            series: [
                {
                    name: '中心频率',
                    data: centerFreqs
                },
                {
                    name: '均方根频率',
                    data: rmsFreqs
                },
                {
                    name: '频率标准差',
                    data: freqStdDevs
                }
            ]
        };
        charts.frequencyMetrics.setOption(freqOption);
    }
    
    // 更新特征雷达图
    if (charts.featureRadar && features) {
        // 找出所有特征的最大值作为雷达图的标准
        const maxMean = Math.max(...currentDataset.channels.map(ch => ch.features.mean_value || 0)) * 1.2;
        const maxStd = Math.max(...currentDataset.channels.map(ch => ch.features.standard_deviation || 0)) * 1.2;
        const maxPeak = Math.max(...currentDataset.channels.map(ch => ch.features.peak_value || 0)) * 1.2;
        const maxRms = Math.max(...currentDataset.channels.map(ch => ch.features.root_mean_square || 0)) * 1.2;
        const maxWaveform = Math.max(...waveformFactors) * 1.2;
        const maxPeakFactor = Math.max(...peakFactors) * 1.2;
        
        const channelIndex = parseInt(currentChannel.channel_id) - 1;
        
        const radarOption = {
            radar: {
                indicator: [
                    { name: '均值', max: maxMean },
                    { name: '标准差', max: maxStd },
                    { name: '峰值', max: maxPeak },
                    { name: '均方根', max: maxRms },
                    { name: '波形因子', max: maxWaveform },
                    { name: '峰值因子', max: maxPeakFactor }
                ]
            },
            series: [
                {
                    data: [
                        {
                            value: [
                                features.mean_value || 0,
                                features.standard_deviation || 0,
                                features.peak_value || 0,
                                features.root_mean_square || 0,
                                features.wave_form_factor || 0,
                                features.peak_factor || 0
                            ],
                            name: `通道${currentChannel.channel_id}`
                        }
                    ]
                }
            ]
        };
        charts.featureRadar.setOption(radarOption);
    }
}

// 更新通道详情
function updateChannelDetails(features) {
    const detailsPanel = document.getElementById('channel-details');
    
    if (!features) {
        detailsPanel.innerHTML = '<p class="empty-state"><i class="fas fa-exclamation-circle"></i> 未找到通道数据</p>';
        return;
    }
    
    // 构建详情HTML
    let detailsHTML = `
        <table class="data-table feature-table">
            <tr>
                <th colspan="2">特征值</th>
            </tr>
            <tr>
                <td>均值</td>
                <td>${features.mean_value.toFixed(6)}</td>
            </tr>
            <tr>
                <td>标准差</td>
                <td>${features.standard_deviation.toFixed(6)}</td>
            </tr>
            <tr>
                <td>峰度</td>
                <td>${features.kurtosis.toFixed(6)}</td>
            </tr>
            <tr>
                <td>均方根</td>
                <td>${features.root_mean_square.toFixed(6)}</td>
            </tr>
            <tr>
                <td>波形因子</td>
                <td>${features.wave_form_factor.toFixed(6)}</td>
            </tr>
            <tr>
                <td>峰值因子</td>
                <td>${features.peak_factor.toFixed(6)}</td>
            </tr>
            <tr>
                <td>脉冲因子</td>
                <td>${features.pulse_factor.toFixed(6)}</td>
            </tr>
            <tr>
                <td>间隙因子</td>
                <td>${features.clearance_factor.toFixed(6)}</td>
            </tr>
            <tr>
                <td>峰值</td>
                <td>${features.peak_value.toFixed(6)}</td>
            </tr>
            <tr>
                <td>中心频率</td>
                <td>${features.center_frequency.toFixed(4)} Hz</td>
            </tr>
            <tr>
                <td>频率方差</td>
                <td>${features.frequency_variance.toFixed(4)}</td>
            </tr>
            <tr>
                <td>均方频率</td>
                <td>${features.mean_square_frequency.toFixed(4)} Hz</td>
            </tr>
            <tr>
                <td>均方根频率</td>
                <td>${features.root_mean_square_frequency.toFixed(4)} Hz</td>
            </tr>
            <tr>
                <td>频率标准差</td>
                <td>${features.frequency_standard_deviation.toFixed(4)} Hz</td>
            </tr>
            <tr>
                <td>波形中心</td>
                <td>${features.waveform_center.toFixed(4)}</td>
            </tr>
            <tr>
                <td>时间带宽</td>
                <td>${features.time_width.toFixed(4)}</td>
            </tr>
        </table>
    `;
    
    // 更新详情内容
    detailsPanel.innerHTML = detailsHTML;
}

// 处理文件选择
function handleFileSelect(event) {
    const files = event.target.files;
    validateAndDisplayFiles(files);
}

// 处理文件拖放
function handleDrop(event) {
    const dt = event.dataTransfer;
    const files = dt.files;
    validateAndDisplayFiles(files);
}

// 验证并显示选择的文件
function validateAndDisplayFiles(files) {
    // 检查是否已选择文件
    if (!files || files.length === 0) return;
    
    // 检查文件数量是否为8个
    if (files.length !== 8) {
        showNotification('请选择8个数据文件 (data1.csv ~ data8.csv)', 'error');
        return;
    }
    
    // 检查文件类型和命名
    const fileList = Array.from(files);
    const isValid = fileList.every(file => {
        return file.name.match(/^data[1-8]\.csv$/i);
    });
    
    if (!isValid) {
        showNotification('文件命名必须为data1.csv到data8.csv', 'error');
        return;
    }
    
    // 显示所选文件列表
    const fileListContainer = document.getElementById('selected-files-list');
    fileListContainer.innerHTML = '';
    
    fileList.sort((a, b) => {
        const numA = parseInt(a.name.match(/\d+/)[0]);
        const numB = parseInt(b.name.match(/\d+/)[0]);
        return numA - numB;
    }).forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <i class="fas fa-file-csv"></i>
            <span>${file.name}</span>
            <span class="file-size">(${formatFileSize(file.size)})</span>
        `;
        fileListContainer.appendChild(fileItem);
    });
    
    // 显示文件信息区域
    document.getElementById('file-info').style.display = 'block';
    document.getElementById('drop-area').style.display = 'none';
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    else return (bytes / 1048576).toFixed(2) + ' MB';
}

// 上传文件
function uploadFiles() {
    const files = document.getElementById('file-input').files;
    
    // 检查是否已选择文件
    if (!files || files.length === 0) {
        showNotification('请先选择文件', 'error');
        return;
    }
    
    // 准备表单数据
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }
    
    // 显示上传进度
    document.getElementById('file-info').style.display = 'none';
    document.getElementById('upload-progress').style.display = 'block';
    
    // 发送上传请求
    const xhr = new XMLHttpRequest();
    
    // 处理上传进度
    xhr.upload.addEventListener('progress', function(e) {
        if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            document.getElementById('progress-bar-fill').style.width = percentComplete + '%';
            document.getElementById('progress-text').textContent = `上传中... ${percentComplete}%`;
        }
    });
    
    // 处理上传完成
    xhr.addEventListener('load', function() {
        if (xhr.status === 200) {
            try {
                const response = JSON.parse(xhr.responseText);
                
                if (response.status === 'success') {
                    // 显示处理状态
                    document.getElementById('upload-progress').style.display = 'none';
                    document.getElementById('processing-status').style.display = 'block';
                    
                    // 轮询处理状态
                    checkProcessingStatus(response.task_id);
                } else {
                    document.getElementById('upload-progress').style.display = 'none';
                    document.getElementById('upload-message').textContent = response.message || '上传失败';
                    document.getElementById('upload-message').style.color = '#ff6060';
                }
            } catch (e) {
                document.getElementById('upload-progress').style.display = 'none';
                document.getElementById('upload-message').textContent = '解析响应失败';
                document.getElementById('upload-message').style.color = '#ff6060';
            }
        } else {
            document.getElementById('upload-progress').style.display = 'none';
            document.getElementById('upload-message').textContent = '上传失败，服务器返回错误';
            document.getElementById('upload-message').style.color = '#ff6060';
        }
    });
    
    // 处理上传错误
    xhr.addEventListener('error', function() {
        document.getElementById('upload-progress').style.display = 'none';
        document.getElementById('upload-message').textContent = '上传失败，请检查网络连接';
        document.getElementById('upload-message').style.color = '#ff6060';
    });
    
    // 发送请求
    xhr.open('POST', '/api/vibration/upload', true);
    xhr.send(formData);
}

// 检查处理状态
function checkProcessingStatus(taskId) {
    const statusText = document.getElementById('status-text');
    
    const interval = setInterval(function() {
        fetch(`/api/vibration/status/${taskId}`)
            .then(response => response.json())
            .then(data => {
                statusText.textContent = data.message || '正在处理数据...';
                
                if (data.status === 'completed') {
                    clearInterval(interval);
                    
                    // 更新界面
                    document.getElementById('processing-status').style.display = 'none';
                    document.getElementById('upload-message').textContent = '数据处理完成！';
                    document.getElementById('upload-message').style.color = '#40c060';
                    
                    // 显示成功通知
                    showNotification('数据处理完成，正在刷新页面...', 'success');
                    
                    // 延迟刷新页面
                    setTimeout(function() {
                        location.reload();
                    }, 2000);
                } else if (data.status === 'failed') {
                    clearInterval(interval);
                    
                    document.getElementById('processing-status').style.display = 'none';
                    document.getElementById('upload-message').textContent = '处理失败: ' + data.message;
                    document.getElementById('upload-message').style.color = '#ff6060';
                }
            })
            .catch(error => {
                console.error('检查状态失败:', error);
            });
    }, 2000);
}

// 显示上传模态框
function showUploadModal() {
    const modal = document.getElementById('upload-modal');
    modal.style.display = 'block';
    
    // 重置模态框
    document.getElementById('drop-area').style.display = 'block';
    document.getElementById('file-info').style.display = 'none';
    document.getElementById('upload-progress').style.display = 'none';
    document.getElementById('processing-status').style.display = 'none';
    document.getElementById('upload-message').textContent = '';
    document.getElementById('file-input').value = '';
}

// 设置图表放大功能
function setupChartZoom() {
    // 为每个图表容器添加缩放按钮
    const chartContainers = document.querySelectorAll('.chart-container');
    
    chartContainers.forEach(container => {
        const chartBody = container.querySelector('.chart-body');
        const chartTitle = container.querySelector('.chart-title').textContent;
        const chart = chartBody.querySelector('.chart');
        
        if (chart) {
            const chartId = chart.id;
            
            // 添加缩放按钮
            const zoomButton = document.createElement('button');
            zoomButton.className = 'zoom-button';
            zoomButton.innerHTML = '<i class="fas fa-expand-alt"></i>';
            zoomButton.title = '放大图表';
            
            container.querySelector('.chart-header').appendChild(zoomButton);
            
            // 绑定点击事件
            zoomButton.addEventListener('click', function() {
                openZoomModal(chartId, chartTitle);
            });
        }
    });
    
    // 创建缩放模态框（如果不存在）
    if (!document.getElementById('zoom-modal')) {
        const zoomModal = document.createElement('div');
        zoomModal.id = 'zoom-modal';
        zoomModal.className = 'modal zoom-modal';
        
        zoomModal.innerHTML = `
            <div class="modal-content zoom-modal-content">
                <div class="modal-header">
                    <h3 id="zoom-chart-title"></h3>
                    <span class="close zoom-close">&times;</span>
                </div>
                <div class="modal-body zoom-modal-body">
                    <div id="zoom-chart" class="zoom-chart"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(zoomModal);
        
        // 绑定关闭按钮事件
        document.querySelector('.zoom-close').addEventListener('click', closeZoomModal);
        
        // 点击模态框外部关闭
        zoomModal.addEventListener('click', function(event) {
            if (event.target === zoomModal) {
                closeZoomModal();
            }
        });
    }
}

// Open zoom modal
function openZoomModal(chartId, chartTitle) {
    const zoomModal = document.getElementById('zoom-modal');
    const zoomChartTitle = document.getElementById('zoom-chart-title');
    const zoomChart = document.getElementById('zoom-chart');
    const modalHeader = zoomModal.querySelector('.modal-header');

    // Find or create the description paragraph in the modal
    let zoomChartDescription = document.getElementById('zoom-chart-description');
    if (!zoomChartDescription) {
        zoomChartDescription = document.createElement('p');
        zoomChartDescription.id = 'zoom-chart-description';
        modalHeader.insertBefore(zoomChartDescription, zoomChartTitle.nextSibling);
    }
    zoomChartDescription.textContent = ''; // Clear previous

    // Find original description
    const chartElement = document.getElementById(chartId);
    const chartContainer = chartElement.closest('.chart-container');
    let descriptionText = '';
    if (chartContainer) {
        // Vibration page might use different structure, adjust if needed
        const descriptionElement = chartContainer.querySelector('.chart-header .chart-description'); 
        if (descriptionElement) {
            descriptionText = descriptionElement.textContent;
        }
    }

    // Set title
    zoomChartTitle.textContent = chartTitle;
    // Set description
    zoomChartDescription.textContent = descriptionText;

    // Show modal
    zoomModal.style.display = 'block';
    
    // 确保图表容器有明确的尺寸
    zoomChart.style.width = '100%';
    zoomChart.style.height = '500px';
    
    // 根据原始图表ID获取对应的图表实例
    let sourceChart = null;
    
    switch (chartId) {
        case 'time-domain-chart':
            sourceChart = charts.timeDomain;
            break;
        case 'frequency-domain-chart':
            sourceChart = charts.frequencyDomain;
            break;
        case 'waveform-factor-chart':
            sourceChart = charts.waveformFactor;
            break;
        case 'pulse-factor-chart':
            sourceChart = charts.pulseFactor;
            break;
        case 'frequency-metrics-chart':
            sourceChart = charts.frequencyMetrics;
            break;
        case 'feature-radar-chart':
            sourceChart = charts.featureRadar;
            break;
    }
    
    if (sourceChart) {
        // 使用setTimeout确保模态框已完全显示并应用样式后再初始化图表
        setTimeout(() => {
            // 创建新的图表实例
            const zoomedChart = echarts.init(zoomChart);
            
            // 获取原始图表的选项并应用到放大图表
            const option = sourceChart.getOption();
            zoomedChart.setOption(option);
            
            // 强制执行一次重绘以适应容器
            zoomedChart.resize();
            
            // 为窗口大小变化添加监听器
            window.addEventListener('resize', function() {
                zoomedChart.resize();
            });
        }, 100);
    } else {
        zoomChart.innerHTML = '<div class="empty-chart"><p>无法加载图表数据</p></div>';
    }
}

// Close zoom modal
function closeZoomModal() {
    const zoomModal = document.getElementById('zoom-modal');

    // Clear the description text
    const zoomChartDescription = document.getElementById('zoom-chart-description');
    if (zoomChartDescription) {
        zoomChartDescription.textContent = '';
    }

    // Remove window resize listener
    const zoomChart = document.getElementById('zoom-chart');
    const chart = echarts.getInstanceByDom(zoomChart);
    if (chart) {
        chart.dispose();
    }

    zoomModal.style.display = 'none';
}

// 显示通知
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notification-text');
    
    notificationText.textContent = message;
    notification.className = 'notification';
    
    if (type === 'error') {
        notification.style.borderLeftColor = '#ff4040';
    } else if (type === 'success') {
        notification.style.borderLeftColor = '#40c060';
    } else {
        notification.style.borderLeftColor = '#0088ff';
    }
    
    notification.style.display = 'block';
    
    setTimeout(function() {
        notification.style.display = 'none';
    }, 5000);
}
