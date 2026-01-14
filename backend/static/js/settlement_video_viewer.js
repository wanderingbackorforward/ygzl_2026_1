// settlement_video_viewer.js - 沉降监测视频展示系统（带相机动画）
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('threejs-background');
    const canvas = document.getElementById('viewer-canvas');
    const loadingIndicator = document.getElementById('loading-indicator');

    if (!container || !canvas || !THREE) {
        console.error('[settlement_video_viewer.js] Required elements not found.');
        return;
    }

    console.log('[settlement_video_viewer.js] Initializing video viewer...');

    const targetModelPath = 'glb/004-051.glb';

    // --- 预定义的拍摄角度（基于已有的S1-S4数据） ---
    const viewpoints = {
        "Default": { position: [0.000, 2.000, 10.000], target: [0.000, 1.000, 0.000] },
        "S1": { position: [0.191, -0.005, 2.444], target: [0.000, 0.000, 0.000] },
        "S2": { position: [0.052, -0.001, 0.666], target: [-0.062, 0.002, -0.798] },
        "S3": { position: [-0.042, 0.001, -0.531], target: [-0.156, 0.004, -1.994] },
        "S4": { position: [-0.034, 0.020, -1.028], target: [-0.156, 0.004, -1.994] },
        // 推测的新角度（基于S1-S4的模式）
        "S5": { position: [-0.100, 0.025, -1.500], target: [-0.200, 0.005, -2.500] },
        "S6": { position: [-0.150, 0.030, -2.000], target: [-0.250, 0.010, -3.000] },
        "S7": { position: [0.300, -0.010, 3.000], target: [0.100, 0.000, 1.000] },
        "S8": { position: [0.400, 0.000, 3.500], target: [0.200, 0.005, 1.500] }
    };

    // 漫游路径（定义视频中相机移动的顺序）
    const tourPath = ["Default", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "Default"];

    let scene, camera, renderer, controls, loader, currentModel;
    let isTourPlaying = false;
    let tourPaused = false;
    let currentTourIndex = 0;
    let animationFrameId = null;

    // --- 相机动画相关变量 ---
    let cameraAnimating = false;
    let animationStartTime = 0;
    let animationDuration = 3000; // 每段过渡3秒
    let startPosition = new THREE.Vector3();
    let endPosition = new THREE.Vector3();
    let startTarget = new THREE.Vector3();
    let endTarget = new THREE.Vector3();

    // --- 缓动函数（平滑过渡） ---
    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    // --- 平滑移动到指定视角 ---
    function smoothGoToViewpoint(pointId, onComplete) {
        const view = viewpoints[pointId] || viewpoints['Default'];
        if (!view || !camera || !controls) {
            console.warn(`[settlement_video_viewer.js] Viewpoint '${pointId}' not found.`);
            if (onComplete) onComplete();
            return;
        }

        console.log(`[settlement_video_viewer.js] Smooth transition to '${pointId}'`);

        // 保存起始位置
        startPosition.copy(camera.position);
        startTarget.copy(controls.target);

        // 设置目标位置
        endPosition.set(...view.position);
        endTarget.set(...view.target);

        // 开始动画
        cameraAnimating = true;
        animationStartTime = Date.now();

        function animateCamera() {
            if (!cameraAnimating) {
                if (onComplete) onComplete();
                return;
            }

            const elapsed = Date.now() - animationStartTime;
            const t = Math.min(elapsed / animationDuration, 1.0);
            const easedT = easeInOutCubic(t);

            // 插值计算当前位置
            camera.position.lerpVectors(startPosition, endPosition, easedT);
            controls.target.lerpVectors(startTarget, endTarget, easedT);
            controls.update();

            if (t >= 1.0) {
                cameraAnimating = false;
                console.log(`[settlement_video_viewer.js] Arrived at '${pointId}'`);
                if (onComplete) onComplete();
            } else {
                requestAnimationFrame(animateCamera);
            }
        }

        animateCamera();
    }

    // --- 立即跳转到视角（不带动画） ---
    function goToViewpoint(pointId) {
        const view = viewpoints[pointId] || viewpoints['Default'];
        if (!view || !camera || !controls) {
            console.warn(`[settlement_video_viewer.js] Viewpoint '${pointId}' not found.`);
            return;
        }

        console.log(`[settlement_video_viewer.js] Jump to '${pointId}'`);
        camera.position.set(...view.position);
        controls.target.set(...view.target);
        controls.update();
    }

    // --- 开始自动漫游 ---
    function startTour() {
        if (isTourPlaying) return;

        console.log('[settlement_video_viewer.js] Starting camera tour...');
        isTourPlaying = true;
        tourPaused = false;
        currentTourIndex = 0;

        updateTourControls();
        updateTourStatus('正在播放漫游...');
        playNextViewpoint();
    }

    // --- 播放下一个视角 ---
    function playNextViewpoint() {
        if (!isTourPlaying || tourPaused) return;

        if (currentTourIndex >= tourPath.length) {
            stopTour();
            return;
        }

        const pointId = tourPath[currentTourIndex];
        const progress = ((currentTourIndex + 1) / tourPath.length) * 100;

        updateTourStatus(`正在前往: ${pointId} (${currentTourIndex + 1}/${tourPath.length})`);
        updateProgress(progress);

        // 高亮当前按钮
        highlightViewpointButton(pointId);

        smoothGoToViewpoint(pointId, () => {
            if (isTourPlaying && !tourPaused) {
                currentTourIndex++;
                // 在每个视角停留1秒后继续
                setTimeout(() => {
                    if (isTourPlaying && !tourPaused) {
                        playNextViewpoint();
                    }
                }, 1000);
            }
        });
    }

    // --- 暂停漫游 ---
    function pauseTour() {
        if (!isTourPlaying) return;
        tourPaused = true;
        cameraAnimating = false;
        updateTourControls();
        updateTourStatus('漫游已暂停');
    }

    // --- 继续漫游 ---
    function resumeTour() {
        if (!isTourPlaying) return;
        tourPaused = false;
        updateTourControls();
        updateTourStatus('继续播放漫游...');
        playNextViewpoint();
    }

    // --- 停止漫游 ---
    function stopTour() {
        console.log('[settlement_video_viewer.js] Stopping camera tour...');
        isTourPlaying = false;
        tourPaused = false;
        cameraAnimating = false;
        currentTourIndex = 0;
        updateTourControls();
        updateTourStatus('漫游结束，准备就绪');
        updateProgress(0);
        removeAllHighlights();
    }

    // --- 更新控制按钮状态 ---
    function updateTourControls() {
        const playBtn = document.getElementById('play-tour');
        const pauseBtn = document.getElementById('pause-tour');
        const stopBtn = document.getElementById('stop-tour');

        if (isTourPlaying) {
            playBtn.disabled = true;
            pauseBtn.disabled = tourPaused;
            stopBtn.disabled = false;

            if (tourPaused) {
                playBtn.disabled = false;
                playBtn.innerHTML = '<i class="fas fa-play"></i> 继续';
            } else {
                playBtn.innerHTML = '<i class="fas fa-play"></i> 播放漫游';
            }
        } else {
            playBtn.disabled = false;
            playBtn.innerHTML = '<i class="fas fa-play"></i> 播放漫游';
            pauseBtn.disabled = true;
            stopBtn.disabled = true;
        }
    }

    // --- 更新状态文本 ---
    function updateTourStatus(text) {
        const statusElement = document.getElementById('tour-status');
        if (statusElement) {
            statusElement.innerHTML = `<i class="fas fa-info-circle"></i> ${text}`;
        }
    }

    // --- 更新进度条 ---
    function updateProgress(percent) {
        const progressFill = document.getElementById('tour-progress');
        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }
    }

    // --- 高亮视角按钮 ---
    function highlightViewpointButton(pointId) {
        removeAllHighlights();
        const btn = document.querySelector(`[data-viewpoint="${pointId}"]`);
        if (btn) {
            btn.classList.add('active');
        }
    }

    // --- 移除所有高亮 ---
    function removeAllHighlights() {
        document.querySelectorAll('.video-btn[data-viewpoint]').forEach(btn => {
            btn.classList.remove('active');
        });
    }

    // --- 初始化 ---
    function init() {
        scene = new THREE.Scene();
        scene.background = null;

        const aspect = container.clientWidth / container.clientHeight;
        camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        camera.position.set(0, 1, 5);

        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.outputEncoding = THREE.sRGBEncoding;

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.screenSpacePanning = false;
        controls.target.set(0, 0, 0);
        controls.update();

        // 照明
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7.5);
        scene.add(directionalLight);
        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight2.position.set(-5, -5, -7.5);
        scene.add(directionalLight2);

        loader = new THREE.GLTFLoader();
        loadModel(targetModelPath);

        // 创建视角按钮
        createViewpointButtons();

        // 绑定控制按钮事件
        document.getElementById('play-tour').addEventListener('click', () => {
            if (tourPaused) {
                resumeTour();
            } else {
                startTour();
            }
        });
        document.getElementById('pause-tour').addEventListener('click', pauseTour);
        document.getElementById('stop-tour').addEventListener('click', stopTour);

        animate();
        window.addEventListener('resize', onWindowResize, false);

        // 暴露函数给外部
        window.goToViewpoint = goToViewpoint;
        window.smoothGoToViewpoint = smoothGoToViewpoint;

        console.log('[settlement_video_viewer.js] Initialization complete.');
    }

    // --- 创建视角按钮 ---
    function createViewpointButtons() {
        const container = document.getElementById('viewpoint-buttons');
        if (!container) return;

        Object.keys(viewpoints).forEach(pointId => {
            if (pointId === 'Default') return; // 跳过默认视角

            const btn = document.createElement('button');
            btn.className = 'video-btn';
            btn.setAttribute('data-viewpoint', pointId);
            btn.innerHTML = `<i class="fas fa-camera"></i> ${pointId}`;
            btn.addEventListener('click', () => {
                if (isTourPlaying) {
                    stopTour();
                }
                highlightViewpointButton(pointId);
                smoothGoToViewpoint(pointId);
            });
            container.appendChild(btn);
        });
    }

    // --- 加载模型 ---
    function loadModel(url) {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if (currentModel) scene.remove(currentModel);

        loader.load(url, (gltf) => {
            console.log('[settlement_video_viewer.js] Model loaded:', url);
            currentModel = gltf.scene;

            const box = new THREE.Box3().setFromObject(currentModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = maxDim > 0 ? (5 / maxDim) : 1;
            currentModel.scale.set(scale, scale, scale);
            currentModel.position.sub(center.multiplyScalar(scale));
            scene.add(currentModel);

            goToViewpoint('Default');
            window.initialViewpointSet = true;

            if (loadingIndicator) loadingIndicator.style.display = 'none';
        },
        (xhr) => { console.log(`[settlement_video_viewer.js] Loading: ${(xhr.loaded / xhr.total * 100)}%`); },
        (error) => {
            console.error('[settlement_video_viewer.js] Error loading model:', error);
            if (loadingIndicator) loadingIndicator.textContent = '模型加载失败';
        });
    }

    // --- 动画循环 ---
    function animate() {
        requestAnimationFrame(animate);
        if (controls) controls.update();
        if (renderer && scene && camera) renderer.render(scene, camera);
    }

    // --- 窗口调整 ---
    function onWindowResize() {
        if (container && camera && renderer) {
            const width = container.clientWidth;
            const height = container.clientHeight;
            if (width > 0 && height > 0) {
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
                renderer.setSize(width, height);
            }
        }
    }

    init();
});
