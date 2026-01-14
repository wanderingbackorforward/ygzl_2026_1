/**
 * Overview Viewer - 3D Model with Floating Panels
 * Loads 9-10Ground.glb and displays data in floating semi-transparent panels
 */

// ========== Three.js 3D Viewer ==========
let scene, camera, renderer, controls, model;
let isAnimating = false;

// Viewpoint presets
const viewpoints = {
    default: { position: [0, 50, 100], target: [0, 0, 0] },
    top: { position: [0, 150, 0.1], target: [0, 0, 0] },
    front: { position: [0, 30, 120], target: [0, 0, 0] },
    side: { position: [120, 30, 0], target: [0, 0, 0] },
    bird: { position: [80, 100, 80], target: [0, 0, 0] }
};

function init3DViewer() {
    console.log('Initializing 3D viewer...');

    // Check if Three.js is loaded
    if (typeof THREE === 'undefined') {
        console.error('Three.js library not loaded!');
        return;
    }

    const canvas = document.getElementById('viewer-canvas');
    const container = document.getElementById('viewer-container');
    const loadingIndicator = document.getElementById('loading-indicator');

    if (!canvas || !container || !loadingIndicator) {
        console.error('Required DOM elements not found', { canvas, container, loadingIndicator });
        return;
    }

    console.log('DOM elements found, creating scene...');

    // Create scene
    scene = new THREE.Scene();
    // Use a subtle dark background instead of transparent
    scene.background = new THREE.Color(0x0a1628);

    // Create camera
    camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.set(0, 50, 100);

    // Create renderer
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0x00f2ff, 0.3);
    directionalLight2.position.set(-50, 50, -50);
    scene.add(directionalLight2);

    // Add OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 10;
    controls.maxDistance = 300;
    controls.target.set(0, 0, 0);

    // Load GLB model
    loadingIndicator.style.display = 'block';
    const loader = new THREE.GLTFLoader();
    loader.load(
        'glb/9-10Ground.glb',
        function (gltf) {
            model = gltf.scene;

            console.log('Model loaded:', model);

            // Center and scale model
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            console.log('Model size:', size);
            console.log('Model center:', center);

            model.position.x = -center.x;
            model.position.y = -center.y;
            model.position.z = -center.z;

            // Scale model to fit view
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 80 / maxDim;
            model.scale.set(scale, scale, scale);

            console.log('Model scale:', scale);
            console.log('Model position:', model.position);

            scene.add(model);
            loadingIndicator.style.display = 'none';

            console.log('9-10Ground.glb loaded successfully and added to scene');
            console.log('Scene children count:', scene.children.length);
        },
        function (xhr) {
            const percent = (xhr.loaded / xhr.total * 100).toFixed(0);
            loadingIndicator.textContent = `加载中... ${percent}%`;
        },
        function (error) {
            console.error('Error loading model:', error);
            loadingIndicator.textContent = '模型加载失败';
            loadingIndicator.style.color = '#ff4444';
        }
    );

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    const container = document.getElementById('viewer-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// Smooth camera transition with easing
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function smoothTransitionToViewpoint(viewName) {
    if (isAnimating) return;

    const viewpoint = viewpoints[viewName];
    if (!viewpoint) return;

    isAnimating = true;

    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const endPos = new THREE.Vector3(...viewpoint.position);
    const endTarget = new THREE.Vector3(...viewpoint.target);

    const duration = 1500; // ms
    const startTime = Date.now();

    function animateTransition() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeInOutCubic(progress);

        camera.position.lerpVectors(startPos, endPos, easedProgress);
        controls.target.lerpVectors(startTarget, endTarget, easedProgress);
        controls.update();

        if (progress < 1) {
            requestAnimationFrame(animateTransition);
        } else {
            isAnimating = false;
        }
    }

    animateTransition();
}

// ========== ECharts Configuration ==========
const charts = {};

function initAllCharts() {
    // Check if ECharts is loaded
    if (typeof echarts === 'undefined') {
        console.error('ECharts library not loaded!');
        return;
    }

    console.log('Initializing ECharts...');

    // Trend Chart (Settlement Trends)
    const trendEl = document.getElementById('trend-chart');
    if (!trendEl) {
        console.error('trend-chart element not found');
        return;
    }
    charts.trend = echarts.init(trendEl);
    charts.trend.setOption({
        tooltip: { trigger: 'item' },
        grid: { left: '5%', right: '5%', top: '10%', bottom: '10%', containLabel: true },
        xAxis: {
            type: 'category',
            data: ['加速', '匀速', '减速', '稳定'],
            axisLine: { lineStyle: { color: '#00f2ff' } },
            axisLabel: { color: '#aaddff', fontSize: 10 }
        },
        yAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: '#00f2ff' } },
            axisLabel: { color: '#aaddff', fontSize: 10 },
            splitLine: { lineStyle: { color: 'rgba(0, 242, 255, 0.1)' } }
        },
        series: [{
            type: 'bar',
            data: [12, 28, 35, 11], // Test data
            itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#00f2ff' },
                    { offset: 1, color: 'rgba(0, 242, 255, 0.3)' }
                ]),
                barBorderRadius: [4, 4, 0, 0]
            },
            barWidth: '35%'
        }]
    });
    console.log('Trend chart initialized');

    // Alert Level Chart
    charts.alert = echarts.init(document.getElementById('alert-chart'));
    charts.alert.setOption({
        tooltip: { trigger: 'item' },
        legend: {
            orient: 'horizontal',
            bottom: '5%',
            textStyle: { color: '#aaddff', fontSize: 10 }
        },
        series: [{
            type: 'pie',
            radius: ['30%', '60%'],
            center: ['50%', '45%'],
            data: [
                { value: 0, name: '正常', itemStyle: { color: '#00ff88' } },
                { value: 0, name: '蓝色', itemStyle: { color: '#40aeff' } },
                { value: 0, name: '黄色', itemStyle: { color: '#ffd700' } },
                { value: 0, name: '橙色', itemStyle: { color: '#ff8c00' } },
                { value: 0, name: '红色', itemStyle: { color: '#ff4444' } }
            ],
            label: { fontSize: 10, color: '#ffffff' }
        }]
    });

    // Temperature Distribution Chart
    charts.tempDist = echarts.init(document.getElementById('temp-distribution-chart'));
    charts.tempDist.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: '5%', right: '5%', top: '10%', bottom: '10%', containLabel: true },
        xAxis: {
            type: 'category',
            data: ['<10°C', '10-15°C', '15-20°C', '20-25°C', '>25°C'],
            axisLine: { lineStyle: { color: '#00f2ff' } },
            axisLabel: { color: '#aaddff', fontSize: 9, rotate: 20 }
        },
        yAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: '#00f2ff' } },
            axisLabel: { color: '#aaddff', fontSize: 10 },
            splitLine: { lineStyle: { color: 'rgba(0, 242, 255, 0.1)' } }
        },
        series: [{
            type: 'line',
            data: [0, 0, 0, 0, 0],
            smooth: true,
            lineStyle: { color: '#ffd700', width: 3 },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(255, 215, 0, 0.4)' },
                    { offset: 1, color: 'rgba(255, 215, 0, 0.05)' }
                ])
            },
            itemStyle: { color: '#ffd700' }
        }]
    });

    // Crack Comparison Chart
    charts.crackCompare = echarts.init(document.getElementById('crack-compare-chart'));
    charts.crackCompare.setOption({
        tooltip: { trigger: 'axis' },
        legend: {
            textStyle: { color: '#aaddff', fontSize: 10 },
            top: '5%'
        },
        grid: { left: '8%', right: '8%', top: '20%', bottom: '10%', containLabel: true },
        xAxis: {
            type: 'category',
            data: [],
            axisLine: { lineStyle: { color: '#00f2ff' } },
            axisLabel: { color: '#aaddff', fontSize: 9 }
        },
        yAxis: {
            type: 'value',
            name: 'mm',
            nameTextStyle: { color: '#aaddff', fontSize: 10 },
            axisLine: { lineStyle: { color: '#00f2ff' } },
            axisLabel: { color: '#aaddff', fontSize: 10 },
            splitLine: { lineStyle: { color: 'rgba(0, 242, 255, 0.1)' } }
        },
        series: [
            {
                name: '最大宽度',
                type: 'bar',
                data: [],
                itemStyle: { color: '#ff4444' },
                barWidth: '15px'
            },
            {
                name: '平均宽度',
                type: 'bar',
                data: [],
                itemStyle: { color: '#40aeff' },
                barWidth: '15px'
            }
        ]
    });

    // Point Comparison Chart
    charts.pointCompare = echarts.init(document.getElementById('point-compare-chart'));
    charts.pointCompare.setOption({
        tooltip: { trigger: 'axis' },
        legend: {
            textStyle: { color: '#aaddff', fontSize: 10 },
            top: '5%'
        },
        grid: { left: '8%', right: '8%', top: '20%', bottom: '10%', containLabel: true },
        xAxis: {
            type: 'category',
            data: [],
            axisLine: { lineStyle: { color: '#00f2ff' } },
            axisLabel: { color: '#aaddff', fontSize: 9 }
        },
        yAxis: {
            type: 'value',
            name: 'mm',
            nameTextStyle: { color: '#aaddff', fontSize: 10 },
            axisLine: { lineStyle: { color: '#00f2ff' } },
            axisLabel: { color: '#aaddff', fontSize: 10 },
            splitLine: { lineStyle: { color: 'rgba(0, 242, 255, 0.1)' } }
        },
        series: [{
            name: '累积沉降',
            type: 'line',
            data: [],
            smooth: true,
            lineStyle: { color: '#00f2ff', width: 3 },
            itemStyle: { color: '#00f2ff' }
        }]
    });
}

// ========== Data Loading ==========
function loadDashboardData() {
    console.log('Loading dashboard data...');

    // Load settlement summary
    $.get('/api/summary', function(data) {
        console.log('Settlement data loaded:', data);
        if (data && data.length > 0) {
            const summary = data[0];

            // Update KPIs
            $('#kpi-total-points').text(summary.monitoring_point_count || '--');
            $('#kpi-max-settlement').text((summary.max_cumulative || 0).toFixed(2));
            $('#kpi-avg-temp').text('--'); // Will be updated from temperature API

            // Update trend chart
            const trendData = [
                summary.accelerating_count || 0,
                summary.uniform_count || 0,
                summary.decelerating_count || 0,
                summary.stable_count || 0
            ];
            charts.trend.setOption({
                series: [{ data: trendData }]
            });

            // Update alert chart
            const alertData = [
                { value: summary.normal_count || 0, name: '正常' },
                { value: summary.blue_count || 0, name: '蓝色' },
                { value: summary.yellow_count || 0, name: '黄色' },
                { value: summary.orange_count || 0, name: '橙色' },
                { value: summary.red_count || 0, name: '红色' }
            ];
            charts.alert.setOption({
                series: [{ data: alertData }]
            });

            // Update point comparison chart with top 10 points
            if (summary.top_settlements && summary.top_settlements.length > 0) {
                const pointNames = summary.top_settlements.map(p => p.point_name);
                const pointValues = summary.top_settlements.map(p => p.cumulative);
                charts.pointCompare.setOption({
                    xAxis: { data: pointNames },
                    series: [{ data: pointValues }]
                });
            }

            // Update last update time
            if (summary.last_update) {
                $('#settlement-update').text(summary.last_update.split(' ')[0]);
            }
        }
    }).fail(function(err) {
        console.error('Failed to load settlement data:', err);
    });

    // Load crack statistics
    $.get('/api/crack/stats_overview', function(data) {
        console.log('Crack data loaded:', data);
        if (data) {
            $('#kpi-active-cracks').text(data.total_cracks || '--');

            // Update crack comparison chart
            if (data.crack_details && data.crack_details.length > 0) {
                const crackNames = data.crack_details.map(c => c.crack_name);
                const maxWidths = data.crack_details.map(c => c.max_width);
                const avgWidths = data.crack_details.map(c => c.avg_width);

                charts.crackCompare.setOption({
                    xAxis: { data: crackNames },
                    series: [
                        { data: maxWidths },
                        { data: avgWidths }
                    ]
                });
            }

            if (data.last_update) {
                $('#crack-update').text(data.last_update.split(' ')[0]);
            }
        }
    }).fail(function(err) {
        console.error('Failed to load crack data:', err);
    });

    // Load temperature statistics
    $.get('/api/temperature/stats', function(data) {
        console.log('Temperature data loaded:', data);
        if (data) {
            const avgTemp = data.avg_temperature || 0;
            $('#kpi-avg-temp').text(avgTemp.toFixed(1));

            // Create temperature distribution data
            const tempRanges = [
                data.temp_below_10 || 0,
                data.temp_10_15 || 0,
                data.temp_15_20 || 0,
                data.temp_20_25 || 0,
                data.temp_above_25 || 0
            ];

            charts.tempDist.setOption({
                series: [{ data: tempRanges }]
            });

            if (data.last_update) {
                $('#temp-update').text(data.last_update.split(' ')[0]);
            }
        }
    }).fail(function(err) {
        console.error('Failed to load temperature data:', err);
    });

    // Mock vibration update time
    const now = new Date();
    $('#vibration-update').text(now.toISOString().split('T')[0]);

    // Update alert count
    setTimeout(() => {
        const alertCount = parseInt($('#kpi-active-cracks').text()) || 0;
        $('#alert-count').text(alertCount > 0 ? alertCount : '0');
    }, 500);
}

// ========== Event Handlers ==========
function initEventHandlers() {
    // Viewpoint button handlers
    $('.viewpoint-btn').click(function() {
        const viewName = $(this).data('view');
        $('.viewpoint-btn').removeClass('active');
        $(this).addClass('active');
        smoothTransitionToViewpoint(viewName);
    });
}

// ========== Initialization ==========
$(document).ready(function() {
    console.log('Initializing Overview Dashboard...');
    console.log('jQuery version:', $.fn.jquery);
    console.log('Three.js available:', typeof THREE !== 'undefined');
    console.log('ECharts available:', typeof echarts !== 'undefined');

    // Initialize 3D viewer
    init3DViewer();

    // Initialize all charts
    initAllCharts();

    // Load data
    loadDashboardData();

    // Initialize event handlers
    initEventHandlers();

    // Resize charts on window resize
    window.addEventListener('resize', function() {
        Object.values(charts).forEach(chart => chart.resize());
    });

    // Refresh data every 30 seconds
    setInterval(loadDashboardData, 30000);
});
