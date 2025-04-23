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

    // Animation Control Elements
    const animationControlsContainer = document.getElementById('animation-controls');
    const playPauseButton = document.getElementById('play-pause-button');
    const speedSlider = document.getElementById('speed-slider');
    const speedDisplay = document.getElementById('speed-display');

    // Check for test page elements
    if (!container || !canvas || !THREE || !modelSelector || !btnForward || !btnBackward || !pointIdInput || !btnRecord || !recordedViewpointsOutput || !animationControlsContainer || !playPauseButton || !speedSlider || !speedDisplay) {
        console.error('[three_viewer.js] Required elements for the test page (check IDs in three_test.html) not found.');
        return;
    }
    console.log('[three_viewer.js] Initializing viewer for Test Page...');

    // --- Model Definitions (Added Combined View) ---
    const singleModels = [ // Renamed from availableModels
        '181-end.glb',
        '101-152.glb',
        '9.glb',
        '004-051.glb',
        '052-100.glb',
        '153-180.glb',
        '10.glb',
        '9-10Ground.glb',
        '9-10Suidaobody.glb' // Added the single body here too if needed individually
    ];
    const COMBINED_VIEW_VALUE = 'combined_special_view'; // Internal value
    const COMBINED_VIEW_NAME = '组合视图 (地面+隧道+中心线)'; // Display name
    const combinedModelPaths = [ // Models for the combined view
        'glb/9-10Ground.glb',
        'glb/9-10Suidaobody.glb',
        'glb/CenterLine.glb'
    ];

    let scene, camera, renderer, controls, loader;
    // --- Modified Model Tracking ---
    let currentSingleModel = null; // Holds the individually loaded model
    let combinedModelsGroup = null; // Holds the group for combined models

    // Animation variables
    let clock, mixer, currentAction;

    // --- Predefined Viewpoints ---
    const presetViewpoints = { /* ... */ };

    // --- Populate Model Selector (Modified) ---
    function populateModelSelector() {
        console.log('[three_viewer.js] Populating model selector...');
        modelSelector.innerHTML = ''; // Clear existing options

        // Add combined view option first
        const combinedOption = document.createElement('option');
        combinedOption.value = COMBINED_VIEW_VALUE;
        combinedOption.textContent = COMBINED_VIEW_NAME;
        modelSelector.appendChild(combinedOption);

        // Add single model options
        singleModels.forEach(filename => {
            const option = document.createElement('option');
            option.value = `glb/${filename}`; // Use path as value for singles
            option.textContent = filename;
            modelSelector.appendChild(option);
        });
        console.log('[three_viewer.js] Model selector populated.');
        // Set default selection? Or leave as is? Let's default to combined for now.
        modelSelector.value = COMBINED_VIEW_VALUE;
    }

    // --- Populate Preset View Selector ---
    function populatePresetViewSelector() {
        console.log('[three_viewer.js] Populating preset view selector...');
        // Check if the element actually exists before proceeding
        const selectorElement = document.getElementById('preset-view-selector');
        if (!selectorElement) {
            console.warn('[three_viewer.js] Preset view selector element not found in HTML. Skipping population.');
            return;
        }

        // Clear existing options except the first placeholder
        selectorElement.innerHTML = '<option value="">--选择预设视角--</option>';

        // Check if presetViewpoints exists
        if (typeof presetViewpoints !== 'undefined' && presetViewpoints) {
             for (const viewName in presetViewpoints) {
                 const option = document.createElement('option');
                 option.value = viewName;
                 option.textContent = viewName;
                 selectorElement.appendChild(option);
             }
             console.log('[three_viewer.js] Preset view selector populated.');
        } else {
            console.warn('[three_viewer.js] presetViewpoints data object not found. Cannot populate preset views.');
        }
    }

    // --- Handle Model Selection Change (Reverted) ---
    function handleModelSelectChange(event) {
        const selectedValue = event.target.value;
        console.log('[three_viewer.js] Selected model value:', selectedValue);
        clearSceneModels();
        if (selectedValue === COMBINED_VIEW_VALUE) {
            loadCombinedModels();
        } else if (selectedValue) {
            loadSingleModelWithScaling(selectedValue);
        }
    }

    // --- Handle Preset View Selection Change (Reverted) ---
    function handlePresetViewSelectChange(event) {
        const selectedViewName = event.target.value;
        if (selectedViewName && presetViewpoints[selectedViewName]) {
            console.log('[three_viewer.js] Selected preset view:', selectedViewName);
            const viewData = presetViewpoints[selectedViewName];
            goToView(viewData.position, viewData.target);
        }
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

    // --- Initialization (Reverted) ---
    function init() {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x101522); // Dark blue background

        clock = new THREE.Clock(); // Add clock for animation delta

        const aspect = container.clientWidth / container.clientHeight;
        camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 2000000); // Significantly increased far plane
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
        populatePresetViewSelector();
        handleModelSelectChange({ target: modelSelector }); // Load default

        animate();

        window.addEventListener('resize', onWindowResize, false);
        modelSelector.addEventListener('change', handleModelSelectChange);
        presetViewSelector.addEventListener('change', handlePresetViewSelectChange);
        btnForward.addEventListener('click', () => moveCamera(true));
        btnBackward.addEventListener('click', () => moveCamera(false));
        btnRecord.addEventListener('click', recordViewpoint); // recordViewpoint is now async

        // Add listeners for animation controls
        playPauseButton.addEventListener('click', togglePlayPause);
        speedSlider.addEventListener('input', handleSpeedChange);

        console.log('[three_viewer.js] Test page initialization complete.');
    }

    // --- Clear Scene Function (Reverted) ---
    function clearSceneModels() {
        console.log('[three_viewer.js] Clearing previous models...');
        if (currentSingleModel) {
            scene.remove(currentSingleModel);
            currentSingleModel = null;
            console.log('[three_viewer.js] Removed single model.');
        }
        if (combinedModelsGroup) {
            while (combinedModelsGroup.children.length > 0) {
                combinedModelsGroup.remove(combinedModelsGroup.children[0]);
            }
            scene.remove(combinedModelsGroup);
            combinedModelsGroup = null;
            console.log('[three_viewer.js] Removed combined models group.');
        }
         if (mixer) {
             mixer.stopAllAction();
             mixer = null;
             currentAction = null;
             if (animationControlsContainer) animationControlsContainer.style.display = 'none';
         }
    }

    // --- Load Combined Models Function (Reverted) ---
    function loadCombinedModels() {
        console.log('[three_viewer.js] Loading combined models...');
        if (loadingIndicator) {
             loadingIndicator.style.display = 'block';
             loadingIndicator.textContent = `加载组合模型 (0/${combinedModelPaths.length})...`;
             loadingIndicator.style.color = 'white'; // Reset color
        }

        if (!combinedModelsGroup) {
            combinedModelsGroup = new THREE.Group();
            scene.add(combinedModelsGroup);
            console.log('[three_viewer.js] Created combined models group.');
        }

        let loadedCount = 0;
        const loadPromises = combinedModelPaths.map(url => {
            return new Promise((resolve, reject) => {
                loader.load(url, (gltf) => {
                    console.log(`[three_viewer.js] Combined model part loaded: ${url}`);
                    // --- CRITICAL: Add directly to the group, NO centering/scaling ---
                    combinedModelsGroup.add(gltf.scene);
                    loadedCount++;
                    if (loadingIndicator) loadingIndicator.textContent = `加载组合模型 (${loadedCount}/${combinedModelPaths.length})...`;
                    resolve(gltf);
                }, undefined, (error) => {
                    console.error(`[three_viewer.js] Error loading combined part ${url}:`, error);
                    reject(error);
                });
            });
        });

        Promise.all(loadPromises)
            .then(() => {
                console.log('[three_viewer.js] All combined models loaded.');
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                adjustCameraToFitGroup(combinedModelsGroup, true);
            })
            .catch(error => {
                console.error('[three_viewer.js] Failed to load one or more combined models.', error);
                 if (loadingIndicator) {
                     loadingIndicator.textContent = '组合模型加载失败!';
                     loadingIndicator.style.color = 'red';
                 }
            });
    }

    // --- MODIFIED: Load Single Model Function (With Scaling/Centering) ---
    // Renamed from loadModel to be clear
    function loadSingleModelWithScaling(url) {
        console.log(`[three_viewer.js] Loading single model with scaling: ${url}`);
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
            loadingIndicator.textContent = '加载模型中...';
             loadingIndicator.style.color = 'white'; // Reset color
        }
        // Clear scene handled by caller (handleModelSelectChange)

        loader.load(url, (gltf) => {
            console.log('[three_viewer.js] Single model loaded successfully:', url);
            currentSingleModel = gltf.scene; // Store reference

            // --- Apply Scaling and Centering for SINGLE models ---
            const box = new THREE.Box3().setFromObject(currentSingleModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = maxDim > 0 ? (5 / maxDim) : 1; // Use a suitable scale factor (e.g., 5)
            currentSingleModel.scale.set(scale, scale, scale);
            const scaledCenter = center.multiplyScalar(scale);
            currentSingleModel.position.sub(scaledCenter);
            // ----------------------------------------------------

            scene.add(currentSingleModel); // Add centered/scaled model to scene

            // Handle potential Animations for the single model
            if (gltf.animations && gltf.animations.length > 0) {
                 console.log('[three_viewer.js] Animations found for single model.');
                 mixer = new THREE.AnimationMixer(currentSingleModel);
                 currentAction = mixer.clipAction(gltf.animations[0]);
                 currentAction.timeScale = parseFloat(speedSlider.value);
                 currentAction.paused = false;
                 currentAction.play();
                 if(animationControlsContainer) animationControlsContainer.style.display = 'flex';
                 updatePlayPauseButton(false);
                 updateSpeedDisplay();
            } else {
                 console.log('[three_viewer.js] No animations found in single model.');
                 if(animationControlsContainer) animationControlsContainer.style.display = 'none';
                 mixer = null;
                 currentAction = null;
            }

            // Adjust camera to fit this single, scaled model
            adjustCameraToFitGroup(currentSingleModel); // Pass the single model group/scene

            if (loadingIndicator) loadingIndicator.style.display = 'none';
        },
        (xhr) => {
             const percent = ((xhr.loaded / xhr.total) * 100).toFixed(0);
             console.log(`[three_viewer.js] Single model loading progress: ${percent}%`);
             if (loadingIndicator) loadingIndicator.textContent = `加载模型中... ${percent}%`;
        },
        (error) => {
             console.error('[three_viewer.js] Error loading single model:', error);
             if (loadingIndicator) {
                loadingIndicator.textContent = '模型加载失败!';
                loadingIndicator.style.color = 'red';
             }
             if(animationControlsContainer) animationControlsContainer.style.display = 'none';
         });
    }

    // --- Go To View Function (For smooth camera transitions) ---
    function goToView(positionArray, targetArray, onCompleteCallback = null) {
        if (!camera || !controls) return;

        const targetPosition = new THREE.Vector3(...positionArray);
        const targetTarget = new THREE.Vector3(...targetArray);

        // Smooth Transition Logic
        const startPosition = camera.position.clone();
        const startTarget = controls.target.clone();
        let progress = 0;
        const duration = 0.75; // Transition duration in seconds (adjust as needed)

        function animateTransition(timestamp) {
            if (!clock) clock = new THREE.Clock(); // Ensure clock exists
            const delta = clock.getDelta();

            // Check if another navigation event interrupted (optional, basic check)
            // A more robust system might use flags or cancel previous tweens

            if (progress < 1) {
                progress += delta / duration;
                progress = Math.min(progress, 1);

                camera.position.lerpVectors(startPosition, targetPosition, easeOutQuad(progress));
                controls.target.lerpVectors(startTarget, targetTarget, easeOutQuad(progress));
                // controls.update(); // Update in main animate loop is usually sufficient

                requestAnimationFrame(animateTransition);
            } else {
                camera.position.copy(targetPosition); // Ensure final exact position
                controls.target.copy(targetTarget);
                console.log(`[goToView] Transition complete.`);
                if (onCompleteCallback) onCompleteCallback();
            }
        }

        if (!clock) clock = new THREE.Clock(); // Ensure clock exists before starting
        requestAnimationFrame(animateTransition);
    }

    // Easing function for smoother transition
    function easeOutQuad(t) {
        return t * (2 - t);
    }

    // --- NEW/MODIFIED: Adjust Camera Function (Simplified Positioning) ---
    function adjustCameraToFitGroup(targetGroup, isCombined = false) {
        if (!camera || !controls || !targetGroup) return;

        const box = new THREE.Box3().setFromObject(targetGroup);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // --- Log Raw Box Info ---
        console.log(`[adjustCameraToFitGroup] Raw Box Min: ${box.min.toArray().map(p=>p.toFixed(1)).join(', ')}, Max: ${box.max.toArray().map(p=>p.toFixed(1)).join(', ')}`);
        console.log(`[adjustCameraToFitGroup] Calculated Center: ${center.toArray().map(p=>p.toFixed(1)).join(', ')}, Size: ${size.toArray().map(p=>p.toFixed(1)).join(', ')}`);
        // -----------------------

        if (size.lengthSq() === 0) {
            console.warn("[adjustCameraToFitGroup] Bounding box is empty or zero size. Setting a default distant view.");
            // Set a very distant default view, hoping to catch something
            camera.position.set(center.x, center.y + 100000, center.z + 500000); // Example distant position
            controls.target.copy(center); // Look towards the calculated center (even if size is 0)
            controls.update();
            return;
        }

        // --- Simplified Camera Positioning Logic ---
        const sizeMagnitude = size.length(); // Get diagonal length of the bounding box as a reference scale
        // Position camera offset from the center, scaled by the size magnitude.
        // Place it somewhat above (Y+) and behind (Z+) the center. Adjust multipliers as needed.
        const offsetFactor = 1.0; // Adjust this factor to move camera closer/further
        const offset = new THREE.Vector3(
            size.x * 0.3 * offsetFactor,  // Offset slightly to the side based on X size
            size.y * 0.5 * offsetFactor,  // Offset above based on Y size
            size.z * 1.0 * offsetFactor   // Offset behind based on Z size (main distance component)
        );
        // Add a minimum offset to prevent being too close if size is small in one dimension
        offset.set(
           Math.max(offset.x, sizeMagnitude * 0.1),
           Math.max(offset.y, sizeMagnitude * 0.2),
           Math.max(offset.z, sizeMagnitude * 0.5) // Ensure a minimum distance back
        );

        const newPosition = center.clone().add(offset);

        console.log(`[adjustCameraToFitGroup] Simplified New Pos: ${newPosition.toArray().map(p=>p.toFixed(1)).join(', ')}`);
        console.log(`[adjustCameraToFitGroup] Target: ${center.toArray().map(p=>p.toFixed(1)).join(', ')}`);

        // Use smooth transition to this new position, looking at the center
        goToView(newPosition.toArray(), center.toArray());

        /* --- Original Camera Positioning Logic (Commented out for testing) ---
        const maxDim = Math.max(size.x, size.y, size.z);
        const fitOffset = 1.2;
        const distance = maxDim > 0 ? (maxDim / 2 / Math.tan(Math.PI * camera.fov / 360) * fitOffset) : 10;
        const direction = new THREE.Vector3();
        if (isCombined) {
            direction.set(0.5, 0.5, 0.7).normalize();
        } else {
            const offsetDirection = new THREE.Vector3(0, 0, 1);
            direction.copy(offsetDirection);
        }
        const originalNewPosition = center.clone().add(direction.multiplyScalar(Math.max(distance, 0.1)));
        console.log(`[adjustCameraToFitGroup] Original Calculated New Pos: ${originalNewPosition.toArray().map(p=>p.toFixed(1))}`);
        goToView(originalNewPosition.toArray(), center.toArray());
        */
    }

    // --- Main Animation Loop (Reverted) ---
    function animate() {
        // The main loop only requests the *next* frame for itself
        // The centerline roam loop runs independently when active
        requestAnimationFrame(animate);

        if (controls) controls.update(); // Always update controls

        // Update animation mixer if a single model with animations is loaded
        if (mixer) { // Always update mixer if it exists
             if (!clock) clock = new THREE.Clock();
             mixer.update(clock.getDelta());
         }

        if (renderer && scene && camera) renderer.render(scene, camera);
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

     // --- Animation Control Functions ---
     function togglePlayPause() {
         if (!currentAction) return;
         currentAction.paused = !currentAction.paused;
         updatePlayPauseButton(currentAction.paused);
     }

     function handleSpeedChange() {
         if (!currentAction) return;
         const speed = parseFloat(speedSlider.value);
         currentAction.timeScale = speed;
         updateSpeedDisplay();
     }

     function updatePlayPauseButton(isPaused) {
         if (isPaused) {
             playPauseButton.innerHTML = '<i class="fas fa-play"></i> 播放';
         } else {
             playPauseButton.innerHTML = '<i class="fas fa-pause"></i> 暂停';
         }
     }

     function updateSpeedDisplay() {
          speedDisplay.textContent = parseFloat(speedSlider.value).toFixed(2);
     }

    // --- Start ---
    init();
});