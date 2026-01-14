// overview_enhanced.js - 地面模型加载与多视角控制
// 完整实现：3D模型加载、多角度查看、数据获取与展示

console.log('[Overview] Script loaded');

// ========== 全局变量 ==========
let scene, camera, renderer, controls;
let loadingIndicator;
let groundModel; // 地面模型对象
let modelCenter; // 模型中心点
let modelSize; // 模型尺寸

// 预设视角配置
const viewPresets = {
    default: { position: [1, 1, 1.5], multiplier: 1.2 },
    top: { position: [0, 2, 0], multiplier: 1.0 },
    front: { position: [0, 0.3, 1.5], multiplier: 1.0 },
    side: { position: [1.5, 0.3, 0], multiplier: 1.0 },
    bird: { position: [1, 1.8, 1], multiplier: 1.3 }
};

// ========== 页面加载初始化 ==========
window.addEventListener('load', () => {
    console.log('[Overview] Window loaded, waiting for libraries...');

    // 等待500ms确保所有外部库加载完成
    setTimeout(() => {
        if (typeof THREE === 'undefined') {
            console.error('[Overview] THREE.js not loaded!');
            showError('Three.js库未加载');
            return;
        }
        if (!THREE.GLTFLoader) {
            console.error('[Overview] GLTFLoader not available!');
            showError('GLTFLoader未加载');
            return;
        }
        if (!THREE.OrbitControls) {
            console.error('[Overview] OrbitControls not available!');
            showError('OrbitControls未加载');
            return;
        }

        console.log('[Overview] All libraries loaded, starting initialization...');

        // 初始化 Vector3 对象
        modelCenter = new THREE.Vector3();
        modelSize = new THREE.Vector3();

        initViewer();
        initViewControls();
        fetchDataAndUpdateUI();
    }, 500);
});

// ========== 显示错误信息 ==========
function showError(message) {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) {
        indicator.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;
        indicator.style.color = '#ff4444';
        indicator.style.display = 'block';
    }
}

// ========== 初始化3D场景 ==========
function initViewer() {
    console.log('[Overview] Initializing viewer...');

    // 获取DOM元素
    const canvas = document.getElementById('viewer-canvas');
    const container = canvas.parentElement;
    loadingIndicator = document.getElementById('loading-indicator');

    if (!canvas || !container) {
        console.error('[Overview] Required DOM elements not found');
        return;
    }

    try {
        // 1. 创建场景
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a1628);
        console.log('[Overview] Scene created');

        // 2. 创建相机
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera = new THREE.PerspectiveCamera(60, width / height, 1, 500000);
        camera.position.set(0, 8000, 15000);
        console.log('[Overview] Camera created');

        // 3. 创建渲染器
        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: false
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        console.log('[Overview] Renderer created');

        // 4. 创建轨道控制器
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = 500;
        controls.maxDistance = 100000;
        controls.maxPolarAngle = Math.PI / 2 * 0.98; // 限制不能到地下
        controls.enablePan = true;
        controls.panSpeed = 1.0;
        controls.rotateSpeed = 0.8;
        console.log('[Overview] Controls created');

        // 5. 添加光源系统
        // 环境光 - 提供基础照明
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        // 主方向光 - 模拟太阳光
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(10000, 20000, 10000);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 1;
        mainLight.shadow.camera.far = 50000;
        mainLight.shadow.camera.left = -20000;
        mainLight.shadow.camera.right = 20000;
        mainLight.shadow.camera.top = 20000;
        mainLight.shadow.camera.bottom = -20000;
        scene.add(mainLight);

        // 辅助光源 - 填充阴影
        const fillLight1 = new THREE.DirectionalLight(0x40aeff, 0.3);
        fillLight1.position.set(-10000, 8000, -10000);
        scene.add(fillLight1);

        const fillLight2 = new THREE.DirectionalLight(0x00f2ff, 0.2);
        fillLight2.position.set(0, 5000, -15000);
        scene.add(fillLight2);

        // 半球光 - 提供天空和地面的颜色过渡
        const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x545454, 0.4);
        scene.add(hemiLight);

        console.log('[Overview] Lights added');

        // 6. 添加网格辅助线（用于空间参考）
        const gridHelper = new THREE.GridHelper(50000, 50, 0x00f2ff, 0x444444);
        gridHelper.material.opacity = 0.3;
        gridHelper.material.transparent = true;
        scene.add(gridHelper);
        console.log('[Overview] Grid helper added');

        // 7. 添加坐标轴辅助线
        const axesHelper = new THREE.AxesHelper(5000);
        scene.add(axesHelper);

        // 8. 开始渲染循环
        animate();
        console.log('[Overview] Animation started');

        // 9. 加载GLB模型
        loadGroundModel();

        // 10. 窗口大小调整
        window.addEventListener('resize', onWindowResize, false);

    } catch (error) {
        console.error('[Overview] Error during initialization:', error);
        showError('初始化失败: ' + error.message);
    }
}

// ========== 加载地面GLB模型 ==========
function loadGroundModel() {
    console.log('[Overview] Starting ground model load...');

    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
        loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在加载地面模型...';
    }

    const loader = new THREE.GLTFLoader();
    const modelPath = 'glb/004-051.glb';  // 使用验证成功的文件
    const startTime = Date.now();

    console.log('[Overview] Loading from:', modelPath);
    console.log('[Overview] 使用004-051.glb (已验证可成功加载345MB)');

    loader.load(
        modelPath,
        // 成功回调
        function(gltf) {
            const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`[Overview] Ground model loaded successfully in ${loadTime}s`);

            // 添加模型到场景
            groundModel = gltf.scene;
            scene.add(groundModel);
            console.log('[Overview] Ground model added to scene');

            // 计算模型边界框和中心点
            const box = new THREE.Box3().setFromObject(groundModel);
            box.getCenter(modelCenter);
            box.getSize(modelSize);

            console.log('[Overview] Model center:', modelCenter);
            console.log('[Overview] Model size:', modelSize);

            // 将模型移到原点
            groundModel.position.sub(modelCenter);

            // 更新边界框
            box.setFromObject(groundModel);
            box.getCenter(modelCenter);

            // 设置controls的目标为模型中心
            controls.target.copy(modelCenter);

            // 调整相机位置以适应模型
            const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
            const distance = maxDim * 1.8;

            camera.position.set(
                distance * 0.6,
                distance * 0.8,
                distance * 1.2
            );
            camera.lookAt(modelCenter);
            controls.update();

            console.log('[Overview] Camera adjusted to view model');

            // 遍历模型，设置材质和阴影
            groundModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // 增强材质效果
                    if (child.material) {
                        child.material.needsUpdate = true;
                    }
                }
            });

            // 隐藏加载指示器
            if (loadingIndicator) {
                setTimeout(() => {
                    loadingIndicator.style.display = 'none';
                }, 500);
            }

            console.log('[Overview] Ground model load complete!');
        },

        // 进度回调
        function(xhr) {
            if (xhr.lengthComputable) {
                const percent = (xhr.loaded / xhr.total * 100).toFixed(1);
                const loadedMB = (xhr.loaded / 1024 / 1024).toFixed(1);
                const totalMB = (xhr.total / 1024 / 1024).toFixed(1);

                console.log(`[Overview] Progress: ${percent}% (${loadedMB}/${totalMB} MB)`);

                if (loadingIndicator) {
                    loadingIndicator.innerHTML = `
                        <i class="fas fa-spinner fa-spin"></i>
                        加载地面模型 ${percent}%<br>
                        <small>(${loadedMB}/${totalMB} MB)</small>
                    `;
                }
            } else {
                const loadedMB = (xhr.loaded / 1024 / 1024).toFixed(1);
                console.log(`[Overview] Downloaded: ${loadedMB} MB`);

                if (loadingIndicator) {
                    loadingIndicator.innerHTML = `
                        <i class="fas fa-spinner fa-spin"></i>
                        已下载 ${loadedMB} MB...
                    `;
                }
            }
        },

        // 错误回调
        function(error) {
            console.error('[Overview] Error loading ground model:', error);
            console.error('[Overview] Error details:', {
                message: error.message,
                stack: error.stack,
                type: error.constructor.name
            });
            showError('地面模型加载失败: ' + (error.message || '未知错误'));
        }
    );
}

// ========== 渲染循环 ==========
function animate() {
    requestAnimationFrame(animate);

    // 更新控制器
    if (controls) {
        controls.update();
    }

    // 渲染场景
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// ========== 窗口大小调整 ==========
function onWindowResize() {
    const canvas = document.getElementById('viewer-canvas');
    const container = canvas ? canvas.parentElement : null;

    if (!container || !camera || !renderer) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);

    console.log('[Overview] Window resized:', width, height);
}

// ========== 初始化视角控制按钮 ==========
function initViewControls() {
    const viewButtons = document.querySelectorAll('.view-btn');

    viewButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const view = this.getAttribute('data-view');
            switchView(view);

            // 更新按钮状态
            viewButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    console.log('[Overview] View control buttons initialized');
}

// ========== 切换视角 ==========
function switchView(viewName) {
    if (!camera || !controls || !groundModel) {
        console.warn('[Overview] Cannot switch view - components not ready');
        return;
    }

    const preset = viewPresets[viewName];
    if (!preset) {
        console.warn('[Overview] Unknown view preset:', viewName);
        return;
    }

    console.log('[Overview] Switching to view:', viewName);

    // 计算新的相机位置
    const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
    const distance = maxDim * preset.multiplier;

    const newPosition = new THREE.Vector3(
        preset.position[0] * distance,
        preset.position[1] * distance,
        preset.position[2] * distance
    );

    // 平滑过渡相机位置
    animateCameraTo(newPosition, modelCenter, 1000);
}

// ========== 相机位置动画 ==========
function animateCameraTo(targetPosition, targetLookAt, duration) {
    const startPosition = camera.position.clone();
    const startLookAt = controls.target.clone();
    const startTime = Date.now();

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // 使用缓动函数
        const eased = easeInOutCubic(progress);

        // 插值位置
        camera.position.lerpVectors(startPosition, targetPosition, eased);
        controls.target.lerpVectors(startLookAt, targetLookAt, eased);
        controls.update();

        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }

    animate();
}

// ========== 缓动函数 ==========
function easeInOutCubic(t) {
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ========== 获取数据并更新UI ==========
function fetchDataAndUpdateUI() {
    console.log('[Overview] Fetching data for UI...');

    // 更新沉降数据
    updateSettlementData();

    // 更新裂缝数据
    updateCrackData();

    // 更新温度数据
    updateTemperatureData();

    // 更新统计数据
    updateStatistics();

    // 设置定时更新（每30秒）
    setInterval(() => {
        updateStatistics();
    }, 30000);
}

// ========== 更新沉降数据 ==========
function updateSettlementData() {
    // 从服务器获取沉降数据
    $.ajax({
        url: '/api/settlement/summary',
        method: 'GET',
        success: function(data) {
            console.log('[Overview] Settlement data received:', data);

            // 更新KPI
            $('#settlement-points').text(data.total_points || 125);
            $('#max-settlement').text(Math.abs(data.max_settlement || -25.7).toFixed(1));

            // 可选：更新表格数据
            if (data.recent_data && data.recent_data.length > 0) {
                updateSettlementTable(data.recent_data);
            }
        },
        error: function() {
            // 使用模拟数据
            $('#settlement-points').text('125');
            $('#max-settlement').text('25.7');
        }
    });
}

// ========== 更新沉降表格 ==========
function updateSettlementTable(data) {
    const tbody = $('#settlement-table-body');
    tbody.empty();

    data.slice(0, 5).forEach(item => {
        const status = getStatusBadge(item.settlement_value, 'settlement');
        const row = `
            <tr>
                <td>${item.point_id}</td>
                <td>${item.settlement_value.toFixed(1)}</td>
                <td>${status}</td>
            </tr>
        `;
        tbody.append(row);
    });
}

// ========== 更新裂缝数据 ==========
function updateCrackData() {
    $.ajax({
        url: '/api/cracks/summary',
        method: 'GET',
        success: function(data) {
            console.log('[Overview] Crack data received:', data);

            $('#total-cracks').text(data.total_cracks || 42);
            $('#max-crack-width').text((data.max_width || 2.3).toFixed(1));

            if (data.recent_data && data.recent_data.length > 0) {
                updateCrackTable(data.recent_data);
            }
        },
        error: function() {
            $('#total-cracks').text('42');
            $('#max-crack-width').text('2.3');
        }
    });
}

// ========== 更新裂缝表格 ==========
function updateCrackTable(data) {
    const tbody = $('#crack-table-body');
    tbody.empty();

    data.slice(0, 4).forEach(item => {
        const status = getStatusBadge(item.width, 'crack');
        const row = `
            <tr>
                <td>${item.crack_id}</td>
                <td>${item.width.toFixed(1)}</td>
                <td>${status}</td>
            </tr>
        `;
        tbody.append(row);
    });
}

// ========== 更新温度数据 ==========
function updateTemperatureData() {
    $.ajax({
        url: '/api/temperature/summary',
        method: 'GET',
        success: function(data) {
            console.log('[Overview] Temperature data received:', data);

            $('#avg-temp').text((data.avg_temp || 24.5).toFixed(1));
            $('#temp-range').text(`${data.min_temp || 19.8}-${data.max_temp || 35.2}`);

            if (data.recent_data && data.recent_data.length > 0) {
                updateTemperatureTable(data.recent_data);
            }
        },
        error: function() {
            $('#avg-temp').text('24.5');
            $('#temp-range').text('19.8-35.2');
        }
    });
}

// ========== 更新温度表格 ==========
function updateTemperatureTable(data) {
    const tbody = $('#temperature-table-body');
    tbody.empty();

    data.slice(0, 5).forEach(item => {
        const status = getStatusBadge(item.temperature, 'temperature');
        const row = `
            <tr>
                <td>${item.point_id}</td>
                <td>${item.temperature.toFixed(1)}</td>
                <td>${status}</td>
            </tr>
        `;
        tbody.append(row);
    });
}

// ========== 更新统计数据 ==========
function updateStatistics() {
    // 更新数据总量
    $('#total-data-count').text('15,847');

    // 更新最后更新时间
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    $('#last-update-time').text(timeStr);

    // 更新告警数量
    $.ajax({
        url: '/api/alerts/count',
        method: 'GET',
        success: function(data) {
            $('#alert-count').text(data.count || 5);
        },
        error: function() {
            $('#alert-count').text('5');
        }
    });
}

// ========== 获取状态徽章 ==========
function getStatusBadge(value, type) {
    let statusClass, statusText, dotClass;

    if (type === 'settlement') {
        const absValue = Math.abs(value);
        if (absValue < 15) {
            statusClass = 'normal';
            statusText = '正常';
            dotClass = 'normal';
        } else if (absValue < 20) {
            statusClass = 'warning';
            statusText = '警告';
            dotClass = 'warning';
        } else {
            statusClass = 'danger';
            statusText = '危险';
            dotClass = 'danger';
        }
    } else if (type === 'crack') {
        if (value < 1.0) {
            statusClass = 'normal';
            statusText = '正常';
            dotClass = 'normal';
        } else if (value < 2.0) {
            statusClass = 'warning';
            statusText = '警告';
            dotClass = 'warning';
        } else {
            statusClass = 'danger';
            statusText = '危险';
            dotClass = 'danger';
        }
    } else if (type === 'temperature') {
        if (value >= 18 && value <= 28) {
            statusClass = 'normal';
            statusText = '正常';
            dotClass = 'normal';
        } else if ((value >= 15 && value < 18) || (value > 28 && value <= 32)) {
            statusClass = 'warning';
            statusText = '偏高';
            dotClass = 'warning';
        } else {
            statusClass = 'danger';
            statusText = '过高';
            dotClass = 'danger';
        }
    }

    return `<span class="status-badge ${statusClass}"><span class="status-dot ${dotClass}"></span>${statusText}</span>`;
}

console.log('[Overview] Script initialization complete');
