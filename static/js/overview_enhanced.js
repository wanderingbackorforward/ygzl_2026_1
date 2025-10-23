// overview_enhanced.js - 简化版总览页面控制脚本
// 只专注于加载9-10Ground.glb，保留按钮但不实现功能

// 等待所有脚本加载完成
window.addEventListener('load', () => {
    console.log('[Overview Enhanced] All scripts loaded, initializing...');

    // 等待额外500ms确保所有库都初始化完成
    setTimeout(() => {
        initializeApplication();
    }, 500);
});

function initializeApplication() {
    console.log('[Overview Enhanced] Starting initialization...');

    // ========== 全局变量 ==========
    const container = document.getElementById('viewer-container');
    const canvas = document.getElementById('viewer-canvas');
    const loadingIndicator = document.getElementById('loading-indicator');

    let scene, camera, renderer, controls;
    let groundLoaded = false;

    // 检查必要元素
    if (!container || !canvas) {
        console.error('[Overview Enhanced] Required elements not found');
        return;
    }

    // 检查Three.js是否已加载
    if (typeof THREE === 'undefined') {
        console.error('[Overview Enhanced] Three.js not loaded');
        console.error('[Overview Enhanced] Available window properties:', Object.keys(window).filter(k => k.includes('THREE') || k.includes('three')));
        if (loadingIndicator) {
            loadingIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 3D库加载失败';
        }
        return;
    }

    // 检查Three.js的子组件
    if (!THREE.GLTFLoader) {
        console.error('[Overview Enhanced] GLTFLoader not available');
        if (loadingIndicator) {
            loadingIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> GLTF加载器缺失';
        }
        return;
    }

    if (!THREE.OrbitControls) {
        console.error('[Overview Enhanced] OrbitControls not available');
        if (loadingIndicator) {
            loadingIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 控制器缺失';
        }
        return;
    }

    // ========== Three.js 初始化 ==========
    function initThreeJS() {
        console.log('[Overview Enhanced] Initializing Three.js...');

        try {
            // 创建场景
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x0a1628);

            // 创建相机 - 扩大far plane以支持大模型
            const aspect = container.clientWidth / container.clientHeight;
            camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 100000);
            camera.position.set(0, 1000, 2000); // 先设置一个较远的位置

            // 创建渲染器
            renderer = new THREE.WebGLRenderer({
                canvas: canvas,
                antialias: true
            });
            renderer.setSize(container.clientWidth, container.clientHeight);
            renderer.setPixelRatio(window.devicePixelRatio);

            // 创建控制器
            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.minDistance = 1000;    // 设置最小距离
            controls.maxDistance = 100000;  // 设置最大距离
            controls.maxPolarAngle = Math.PI * 0.9; // 限制俯视角度

            // 添加基本光源
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // 降低环境光强度
            scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
            directionalLight.position.set(1000, 2000, 1000);
            directionalLight.castShadow = true;
            scene.add(directionalLight);

            // 添加补光
            const fillLight = new THREE.DirectionalLight(0x40aeff, 0.5);
            fillLight.position.set(-1000, 1000, -1000);
            scene.add(fillLight);

            // 添加边缘光
            const rimLight = new THREE.DirectionalLight(0x00f2ff, 0.3);
            rimLight.position.set(0, 2000, -2000);
            scene.add(rimLight);

            // 添加网格地面 - 增大尺寸以匹配模型尺度
            const gridHelper = new THREE.GridHelper(50000, 100, 0x444444, 0x222222);
            scene.add(gridHelper);

            // 加载地面模型
            loadGroundModel();

            // 设置事件监听
            setupEventListeners();

            // 开始渲染循环
            animate();

            console.log('[Overview Enhanced] Three.js initialized successfully');
        } catch (error) {
            console.error('[Overview Enhanced] Error initializing Three.js:', error);
            if (loadingIndicator) {
                loadingIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 3D初始化失败';
            }
        }
    }

    // ========== 加载地面模型 ==========
    function loadGroundModel() {
        console.log('[Overview Enhanced] Loading ground model...');
        if (loadingIndicator) {
            loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载地面模型中...';
        }

        // 创建加载器
        const loader = new THREE.GLTFLoader();

        // 尝试不同的路径
        const paths = [
            'glb/9-10Ground.glb',
            './glb/9-10Ground.glb',
            '/glb/9-10Ground.glb',
            'static/glb/9-10Ground.glb',
            '../static/glb/9-10Ground.glb'
        ];

        let currentPathIndex = 0;

        function tryNextPath() {
            if (currentPathIndex >= paths.length) {
                console.error('[Overview Enhanced] All paths failed to load ground model');
                if (loadingIndicator) {
                    loadingIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 地面模型加载失败';
                }
                return;
            }

            const currentPath = paths[currentPathIndex];
            console.log(`[Overview Enhanced] Trying path ${currentPathIndex + 1}/${paths.length}: ${currentPath}`);

            loader.load(
                currentPath,
                // 成功回调
                function (gltf) {
                    console.log('[Overview Enhanced] Ground model loaded successfully!');
                    groundLoaded = true;

                    // 直接添加到场景
                    const model = gltf.scene;
                    scene.add(model);

                    // 调整相机位置
                    const box = new THREE.Box3().setFromObject(model);
                    const center = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());

                    console.log('Model bounds:', { center, size });

                    // 将模型移动到原点
                    model.position.sub(center);

                    // 计算合适的相机距离
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const cameraDistance = maxDim * 2; // 距离为最大尺寸的2倍

                    // 设置相机位置（俯视角度）
                    camera.position.set(
                        0,                    // X居中
                        cameraDistance * 0.5,  // Y轴高度
                        cameraDistance           // Z轴距离
                    );
                    controls.target.set(0, 0, 0); // 看向原点
                    controls.update();

                    if (loadingIndicator) {
                        loadingIndicator.style.display = 'none';
                    }

                    console.log('[Overview Enhanced] Ground model added to scene');
                },

                // 进度回调
                function (xhr) {
                    const progress = (xhr.loaded / xhr.total * 100).toFixed(1);
                    console.log(`[Overview Enhanced] Loading progress: ${progress}%`);
                    if (loadingIndicator && xhr.total > 0) {
                        loadingIndicator.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 加载中 ${progress}%`;
                    }
                },

                // 错误回调
                function (error) {
                    console.error(`[Overview Enhanced] Failed to load from ${currentPath}:`, error);
                    currentPathIndex++;
                    tryNextPath();
                }
            );
        }

        tryNextPath();

        // 设置超时
        setTimeout(() => {
            if (!groundLoaded && loadingIndicator) {
                loadingIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 加载超时';
                console.warn('[Overview Enhanced] Loading timeout');
            }
        }, 10000);
    }

    // ========== 设置事件监听 ==========
    function setupEventListeners() {
        // 窗口大小调整
        window.addEventListener('resize', onWindowResize, false);

        // 视角切换按钮
        const viewButtons = document.querySelectorAll('.view-btn');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.getAttribute('data-view');
                switchToView(view);

                // 更新按钮状态
                viewButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // 漫游按钮
        const roamBtn = document.getElementById('centerline-roam-btn');
        if (roamBtn) {
            roamBtn.addEventListener('click', toggleRoaming);
        }
    }

    // ========== 窗口大小调整 ==========
    function onWindowResize() {
        if (!camera || !renderer) return;

        const width = container.clientWidth;
        const height = container.clientHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    // ========== 渲染循环 ==========
    function animate() {
        requestAnimationFrame(animate);

        if (controls) {
            controls.update();
        }

        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    }

    // ========== 视角切换功能 ==========
    function switchToView(viewType) {
        console.log(`[Overview Enhanced] Switching to view: ${viewType}`);

        const views = {
            default: { position: { x: 0, y: 10000, z: 20000 }, target: { x: 0, y: 0, z: 0 } },
            top: { position: { x: 0, y: 50000, z: 1000 }, target: { x: 0, y: 0, z: 0 } },
            front: { position: { x: 0, y: 15000, z: 50000 }, target: { x: 0, y: 0, z: 0 } },
            side: { position: { x: 50000, y: 15000, z: 0 }, target: { x: 0, y: 0, z: 0 } },
            bird: { position: { x: 30000, y: 40000, z: 30000 }, target: { x: 0, y: 0, z: 0 } }
        };

        const view = views[viewType] || views.default;
        animateCameraToPosition(view.position, view.target);
    }

    function animateCameraToPosition(targetPos, targetLookAt, duration = 1500) {
        const startPos = camera.position.clone();
        const startTarget = controls.target.clone();
        const startTime = Date.now();

        function updateCamera() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // 使用缓动函数
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            // 插值相机位置
            camera.position.lerpVectors(startPos, new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z), easeProgress);

            // 插值目标点
            const currentTarget = new THREE.Vector3().lerpVectors(startTarget, new THREE.Vector3(targetLookAt.x, targetLookAt.y, targetLookAt.z), easeProgress);
            controls.target.copy(currentTarget);
            controls.update();

            if (progress < 1) {
                requestAnimationFrame(updateCamera);
            }
        }

        updateCamera();
    }

    // ========== 中轴线漫游功能 ==========
    let isRoaming = false;
    let roamProgress = 0;
    let roamAnimationId = null;
    let roamPath = [];

    function toggleRoaming() {
        isRoaming = !isRoaming;

        const roamBtn = document.getElementById('centerline-roam-btn');
        if (isRoaming) {
            startRoaming();
            roamBtn.classList.add('active');
            roamBtn.innerHTML = '<i class="fas fa-stop-circle"></i><span>停止漫游</span>';
        } else {
            stopRoaming();
            roamBtn.classList.remove('active');
            roamBtn.innerHTML = '<i class="fas fa-route"></i><span>开始漫游</span>';
        }
    }

    function startRoaming() {
        console.log('[Overview Enhanced] Starting roaming');
        roamProgress = 0;

        // 创建一个简单的椭圆形路径（模拟沿着地形的漫游）
        generateRoamPath();

        if (roamPath.length > 0) {
            updateRoaming();
        }
    }

    function generateRoamPath() {
        // 生成椭圆形路径点
        const numPoints = 100;
        roamPath = [];

        for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const radiusX = 30000; // X轴半径
            const radiusZ = 20000; // Z轴半径
            const height = 8000 + Math.sin(angle * 2) * 3000; // 高度变化

            roamPath.push({
                x: Math.cos(angle) * radiusX,
                y: height,
                z: Math.sin(angle) * radiusZ,
                lookAtX: Math.cos(angle + 0.1) * radiusX * 0.8, // 向前看
                lookAtY: height * 0.8,
                lookAtZ: Math.sin(angle + 0.1) * radiusZ * 0.8
            });
        }
    }

    function stopRoaming() {
        console.log('[Overview Enhanced] Stopping roaming');
        if (roamAnimationId) {
            cancelAnimationFrame(roamAnimationId);
            roamAnimationId = null;
        }
    }

    function updateRoaming() {
        if (!isRoaming || roamPath.length === 0) return;

        // 更新进度
        roamProgress += 0.005; // 控制漫游速度
        if (roamProgress > 1) {
            roamProgress = 0; // 循环
        }

        // 获取当前路径点
        const index = Math.floor(roamProgress * (roamPath.length - 1));
        const currentPoint = roamPath[index];
        const nextPoint = roamPath[Math.min(index + 1, roamPath.length - 1)];

        if (currentPoint) {
            // 平滑插值到目标位置
            const targetPos = new THREE.Vector3(currentPoint.x, currentPoint.y, currentPoint.z);
            camera.position.lerp(targetPos, 0.1);

            // 设置相机朝向
            const lookAtPoint = new THREE.Vector3(
                currentPoint.lookAtX || nextPoint.x,
                currentPoint.lookAtY || nextPoint.y,
                currentPoint.lookAtZ || nextPoint.z
            );

            // 平滑调整相机朝向
            const currentTarget = controls.target.clone();
            currentTarget.lerp(lookAtPoint, 0.1);
            controls.target.copy(currentTarget);
            controls.update();
        }

        // 继续漫游
        roamAnimationId = requestAnimationFrame(updateRoaming);
    }

    // ========== 数据加载部分（保持原有逻辑不变） ==========
    function loadDashboardData() {
        console.log('[Overview Enhanced] Loading dashboard data...');
        loadKPIs();
        loadSettlementSummary();
        loadCrackSummary();
        loadTemperatureSummary();
        loadCharts();
        updateSystemStatus();
    }

    function loadKPIs() {
        // 使用现有的API端点
        fetch('/api/summary')
            .then(response => response.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    document.getElementById('kpi-total-points').textContent = data.length;
                    const maxSettlement = Math.max(...data.map(p => Math.abs(p.cumulative_change || 0)));
                    document.getElementById('kpi-max-settlement').textContent = maxSettlement.toFixed(2);
                }
            })
            .catch(error => {
                console.error('[Overview Enhanced] Error loading KPIs:', error);
                // 设置默认值
                document.getElementById('kpi-total-points').textContent = '0';
                document.getElementById('kpi-max-settlement').textContent = '0.0';
            });

        document.getElementById('kpi-active-cracks').textContent = '12';
        document.getElementById('kpi-avg-temp').textContent = '18.5';
    }

    function loadSettlementSummary() {
        fetch('/api/summary')
            .then(response => response.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    const tbody = document.querySelector('#settlement-summary-table tbody');
                    tbody.innerHTML = '';
                    const topData = data.slice(0, 5);
                    topData.forEach(point => {
                        const row = document.createElement('tr');
                        const statusClass = getStatusClass(point.alert_level);
                        row.innerHTML = `
                            <td>${point.point_id}</td>
                            <td>${point.cumulative_change ? point.cumulative_change.toFixed(2) : '--'}</td>
                            <td><span class="status-badge ${statusClass}">${point.alert_level || '正常'}</span></td>
                        `;
                        tbody.appendChild(row);
                    });
                }
            })
            .catch(error => {
                console.error('[Overview Enhanced] Error loading settlement summary:', error);
            });
    }

    function loadCrackSummary() {
        fetch('/api/crack/stats_overview')
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success' && data.data) {
                    const tbody = document.querySelector('#crack-summary-table tbody');
                    tbody.innerHTML = '';
                    const overview = data.data;
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>总计</td>
                        <td>${overview.total_points || 0} 个监测点</td>
                        <td><span class="status-badge normal">运行中</span></td>
                    `;
                    tbody.appendChild(row);
                }
            })
            .catch(error => {
                console.error('[Overview Enhanced] Error loading crack summary:', error);
            });
    }

    function loadTemperatureSummary() {
        fetch('/api/temperature/summary')
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success' && data.data && Array.isArray(data.data)) {
                    const tbody = document.querySelector('#temperature-summary-table tbody');
                    tbody.innerHTML = '';
                    const topData = data.data.slice(0, 5);
                    topData.forEach(point => {
                        const row = document.createElement('tr');
                        const statusClass = 'normal';
                        row.innerHTML = `
                            <td>${point.sensor_id}</td>
                            <td>${point.avg_temperature ? point.avg_temperature.toFixed(1) : '--'}</td>
                            <td><span class="status-badge ${statusClass}">正常</span></td>
                        `;
                        tbody.appendChild(row);
                    });
                }
            })
            .catch(error => {
                console.error('[Overview Enhanced] Error loading temperature summary:', error);
            });
    }

    function loadCharts() {
        const settlementTrendChart = echarts.init(document.getElementById('settlement-trend-chart'));
        const settlementOption = {
            tooltip: { trigger: 'axis' },
            grid: { left: '10%', right: '10%', bottom: '15%', top: '10%' },
            xAxis: { type: 'category', data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
            yAxis: { type: 'value', name: '沉降(mm)' },
            series: [{
                name: '平均沉降',
                type: 'line',
                data: [-0.5, -0.8, -1.2, -1.5, -1.8, -2.1, -2.3],
                smooth: true,
                itemStyle: { color: '#00f2ff' },
                areaStyle: { color: 'rgba(0, 242, 255, 0.2)' }
            }]
        };
        settlementTrendChart.setOption(settlementOption);

        const crackCompareChart = echarts.init(document.getElementById('crack-compare-chart'));
        const crackOption = {
            tooltip: { trigger: 'axis' },
            grid: { left: '15%', right: '10%', bottom: '15%', top: '10%' },
            xAxis: { type: 'category', data: ['C1', 'C2', 'C3', 'C4', 'C5'] },
            yAxis: { type: 'value', name: '宽度(mm)' },
            series: [{
                name: '裂缝宽度',
                type: 'bar',
                data: [0.15, 0.22, 0.18, 0.31, 0.25],
                itemStyle: { color: '#40aeff' }
            }]
        };
        crackCompareChart.setOption(crackOption);

        const tempDistChart = echarts.init(document.getElementById('temp-distribution-chart'));
        const tempOption = {
            tooltip: { trigger: 'item' },
            series: [{
                name: '温度分布',
                type: 'pie',
                radius: ['40%', '70%'],
                data: [
                    { value: 35, name: '10-15°C', itemStyle: { color: '#40aeff' } },
                    { value: 45, name: '15-20°C', itemStyle: { color: '#00f2ff' } },
                    { value: 20, name: '20-25°C', itemStyle: { color: '#ffd700' } }
                ]
            }]
        };
        tempDistChart.setOption(tempOption);

        window.addEventListener('resize', () => {
            settlementTrendChart.resize();
            crackCompareChart.resize();
            tempDistChart.resize();
        });
    }

    function updateSystemStatus() {
        document.getElementById('alert-count').textContent = '3';
        const now = new Date();
        const timeStr = now.toLocaleTimeString('zh-CN');
        document.getElementById('last-update').textContent = timeStr;
    }

    function getStatusClass(alertLevel) {
        if (!alertLevel || alertLevel === '正常' || alertLevel === 'normal') return 'normal';
        if (alertLevel === '蓝色' || alertLevel === 'blue') return 'normal';
        if (alertLevel === '黄色' || alertLevel === 'yellow') return 'warning';
        if (alertLevel === '橙色' || alertLevel === 'orange' || alertLevel === '红色' || alertLevel === 'red') return 'danger';
        return 'normal';
    }

    // ========== 启动应用 ==========
    initThreeJS();
    loadDashboardData();

    // 定期更新数据
    setInterval(() => {
        loadDashboardData();
    }, 30000);

    console.log('[Overview Enhanced] Initialization complete');
}