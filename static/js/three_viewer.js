// static/js/three_viewer.js
// Logic for the 3D Model Test/Tool Page
document.addEventListener('DOMContentLoaded', () => {
    // Elements specific to three_test.html
    const container = document.getElementById('viewer-container');
    const canvas = document.getElementById('viewer-canvas');
    const loadingIndicator = document.getElementById('loading-indicator');
    const modelSelector = document.getElementById('model-selector');
    const btnForward = document.getElementById('move-forward');
    const btnBackward = document.getElementById('move-backward');
    const pointIdInput = document.getElementById('point-id-input');
    const btnRecord = document.getElementById('record-viewpoint');
    const recordedViewpointsOutput = document.getElementById('recorded-viewpoints');

    // Check for test page elements
    if (!container || !canvas || !THREE || !modelSelector || !btnForward || !btnBackward || !pointIdInput || !btnRecord || !recordedViewpointsOutput) {
        console.error('[three_viewer.js] Required elements for the test page not found. Ensure all IDs are correct in three_test.html.');
        return;
    }
    console.log('[three_viewer.js] Initializing viewer for Test Page...');

    const availableModels = [
        '181-end.glb',
        '101-152.glb',
        '9.glb',
        '004-051.glb',
        '052-100.glb',
        '153-180.glb',
        '10.glb'
    ];

    let scene, camera, renderer, controls, loader, currentModel;

    // --- Populate Model Selector ---
    function populateModelSelector() {
        console.log('[three_viewer.js] Populating model selector...');
        availableModels.forEach(filename => {
            const option = document.createElement('option');
            option.value = `glb/${filename}`;
            option.textContent = filename;
            modelSelector.appendChild(option);
        });
        console.log('[three_viewer.js] Model selector populated.');
    }

    // --- Handle Model Selection Change ---
    function handleModelSelectChange(event) {
        const selectedModelPath = event.target.value;
        if (selectedModelPath) {
            console.log('[three_viewer.js] Selected model:', selectedModelPath);
            loadModel(selectedModelPath);
        }
    }

    // --- Movement Functions ---
    const moveSpeed = 0.2;
    function moveCamera(forward) {
        if (!camera || !controls) return;
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        const step = direction.multiplyScalar(forward ? moveSpeed : -moveSpeed);
        camera.position.add(step);
        controls.target.add(step);
        controls.update();
    }

    // --- Record Viewpoint Function (Sends data to backend) ---
    async function recordViewpoint() { // Added async
        if (!camera || !controls || !pointIdInput || !recordedViewpointsOutput) return;
        const pointId = pointIdInput.value.trim();
        if (!pointId) {
            alert('请输入点位ID (例如 S1)!');
            return;
        }
        const pos = camera.position;
        const tgt = controls.target;

        // Data to send to backend
        const viewpointData = {
            point_id: pointId,
            position: [pos.x, pos.y, pos.z], // Send raw floats
            target: [tgt.x, tgt.y, tgt.z]
        };

        // --- Send POST request to backend ---
        try {
            const response = await fetch('/api/viewpoints', { // Ensure API endpoint matches Flask app
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(viewpointData),
            });
            const result = await response.json();

            if (result.success) {
                console.log(`[three_viewer.js] 视角 ${pointId} 成功保存到数据库。`);
                // Update textarea as visual confirmation (can be removed if backend is reliable)
                const outputString = `'${pointId}': { position: [${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)}], target: [${tgt.x.toFixed(3)}, ${tgt.y.toFixed(3)}, ${tgt.z.toFixed(3)}] },\n`;
                recordedViewpointsOutput.value += outputString;
                recordedViewpointsOutput.scrollTop = recordedViewpointsOutput.scrollHeight;
            } else {
                console.error(`[three_viewer.js] 保存视角 ${pointId} 到数据库失败:`, result.message);
                alert(`保存视角 ${pointId} 失败: ${result.message}`);
            }
        } catch (error) {
            console.error(`[three_viewer.js] 请求 /api/viewpoints 失败:`, error);
            alert(`无法连接到后端保存视角: ${error}`);
        }
        // --- Request end ---
    }

    // --- Initialization ---
    function init() {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x101522); // Dark blue background

        const aspect = container.clientWidth / container.clientHeight;
        camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        camera.position.set(0, 1, 5);

        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.outputEncoding = THREE.sRGBEncoding;

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.screenSpacePanning = false;
        controls.target.set(0, 0, 0);
        controls.update();

        // Standard lighting setup
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7.5);
        scene.add(directionalLight);
        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight2.position.set(-5, -5, -7.5);
        scene.add(directionalLight2);

        loader = new THREE.GLTFLoader();

        populateModelSelector();

        // Load the default model
        if (availableModels.length > 0) {
            const defaultModelPath = `glb/${availableModels[0]}`;
            modelSelector.value = defaultModelPath;
            loadModel(defaultModelPath);
        } else {
            console.warn('[three_viewer.js] No models available.');
            if (loadingIndicator) loadingIndicator.textContent = '没有可加载的模型!';
        }

        animate();

        window.addEventListener('resize', onWindowResize, false);
        modelSelector.addEventListener('change', handleModelSelectChange);
        btnForward.addEventListener('click', () => moveCamera(true));
        btnBackward.addEventListener('click', () => moveCamera(false));
        btnRecord.addEventListener('click', recordViewpoint); // recordViewpoint is now async
        console.log('[three_viewer.js] Test page initialization complete.');
    }

    // --- Model Loading (for test page) ---
    function loadModel(url) {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if (currentModel) scene.remove(currentModel);

        loader.load(url, (gltf) => {
            console.log('[three_viewer.js] Model loaded successfully:', url);
            currentModel = gltf.scene;

            const box = new THREE.Box3().setFromObject(currentModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = maxDim > 0 ? (5 / maxDim) : 1;
            currentModel.scale.set(scale, scale, scale);
            currentModel.position.sub(center.multiplyScalar(scale));
            scene.add(currentModel);

            // Reset camera view
            camera.position.set(0, size.y * scale * 0.5 + 1, maxDim * scale * 1.5);
            controls.target.set(0, 0, 0);
            if (camera.position.lengthSq() === 0) {
                camera.position.set(0, 1, 5);
            }
            controls.update();

            if (loadingIndicator) loadingIndicator.style.display = 'none';
        },
        (xhr) => { console.log(`[three_viewer.js] Model loading progress: ${(xhr.loaded / xhr.total * 100)}%`); },
        (error) => {
             console.error('[three_viewer.js] Error loading model:', error);
             if (loadingIndicator) loadingIndicator.textContent = '模型加载失败';
         });
    }

    // --- Animation Loop ---
    function animate() {
        requestAnimationFrame(animate);
        if(controls) controls.update();
        if(renderer && scene && camera) renderer.render(scene, camera);
    }

    // --- Resize Handler ---
    function onWindowResize() {
         if (container && camera && renderer) {
             const width = container.clientWidth;
             const height = container.clientHeight;
             if (width > 0 && height > 0) {
                 camera.aspect = width / height;
                 camera.updateProjectionMatrix();
                 renderer.setSize(width, height);
             } else {
                 console.warn('[three_viewer.js] Invalid container dimensions on resize.');
             }
         }
     }

    // --- Start ---
    init();
});