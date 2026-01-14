// three_viewer.js - Adapted for Settlement Page Background
document.addEventListener('DOMContentLoaded', () => {
    console.log('[settlement_test_viewer.js] DOMContentLoaded event fired. Script starting...'); // <-- STEP 1: Verify script start

    if (typeof THREE === 'undefined') {
        console.error('[settlement_test_viewer.js] THREE.js library not loaded!');
        return;
    } else {
        console.log('[settlement_test_viewer.js] THREE object found:', THREE); // <-- STEP 2: Verify THREE object
    }

    // Check if we are on the settlement page by looking for specific elements
    const container = document.getElementById('threejs-background'); // Use the background container ID
    const canvas = document.getElementById('viewer-canvas');
    const loadingIndicator = document.getElementById('loading-indicator'); // Optional loading indicator

    if (!container || !canvas || !THREE) {
        console.error('[settlement_test_viewer.js] Required elements (#threejs-background, #viewer-canvas, or THREE library) not found.');
        return; // Stop execution if essential elements are missing
    }

    console.log('[settlement_test_viewer.js] Initializing Three.js background...');

    // Model for this page is fixed (Ensure path is correct relative to HTML)
    const targetModelPath = 'glb/004-051.glb';

    // --- Predefined Viewpoints (Keep for later, but don't use yet) ---
    const viewpoints = {
        "Default": { position: [0.000, 2.000, 10.000], target: [0.000, 1.000, 0.000] },
        "S1": { position: [0.191, -0.005, 2.444], target: [0.000, 0.000, 0.000] },
        "S2": { position: [0.052, -0.001, 0.666], target: [-0.062, 0.002, -0.798] },
        "S3": { position: [-0.042, 0.001, -0.531], target: [-0.156, 0.004, -1.994] },
        "S4": { position: [-0.034, 0.020, -1.028], target: [-0.156, 0.004, -1.994] }
    };

    let scene, camera, renderer, controls, loader, currentModel;

    // --- Go To Viewpoint (Restore definition) ---
    function goToViewpoint(pointId) {
        console.log(`[settlement_test_viewer.js] goToViewpoint called with ID: ${pointId}`);
        const view = viewpoints[pointId] || viewpoints['Default'];
        if (!view || !camera || !controls) {
            console.warn(`[settlement_test_viewer.js] Viewpoint '${pointId}' not found or camera/controls not ready.`);
             return;
        }

        console.log(`[settlement_test_viewer.js] Moving camera to viewpoint '${pointId}': pos=${view.position}, target=${view.target}`);
        // Smooth transition (optional, can add later)
        // new TWEEN.Tween(camera.position).to(new THREE.Vector3(...view.position), 600).easing(TWEEN.Easing.Quadratic.InOut).start();
        // new TWEEN.Tween(controls.target).to(new THREE.Vector3(...view.target), 600).easing(TWEEN.Easing.Quadratic.InOut).start();
        camera.position.set(...view.position);
        controls.target.set(...view.target);

        // Important: Tell controls the target has changed programmatically
        controls.update();
    }

    // --- Initialization ---
    function init() {
        scene = new THREE.Scene();
        // Use a transparent background to see HTML behind if needed, or set a color
        // scene.background = null; // Fully transparent
        scene.background = new THREE.Color(0x1a202c); // Dark background similar to panels

        const aspect = container.clientWidth / container.clientHeight;
        camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        camera.position.set(0, 1, 7); // Adjusted default position

        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.outputEncoding = THREE.sRGBEncoding;

        // Attach OrbitControls back to the CANVAS element (standard way)
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        console.log('[settlement_test_viewer.js] Controls object created:', controls); // Log controls creation
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.screenSpacePanning = true;
        controls.target.set(0, 0, 0); // Target origin initially
        controls.update(); // Initial update

        console.log('[settlement_test_viewer.js] OrbitControls initialized.');

        // --- Unified Lighting --- (Keep as is)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7.5);
        scene.add(directionalLight);
        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight2.position.set(-5, -5, -7.5);
        scene.add(directionalLight2);

        // <-- STEP 3: Add a visible cube -->
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // Green cube
        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);
        console.log('[settlement_test_viewer.js] Added test cube to scene.');
        // <-- End STEP 3 -->

        // Loader
        loader = new THREE.GLTFLoader();

        // Temporarily disable model loading and viewpoint setting for debugging controls
        // console.log('[settlement_test_viewer.js] Skipping model load for controls debug.');
        // loadModel(targetModelPath);

        // Start animation loop
        animate();

        // Handle window resize
        window.addEventListener('resize', onWindowResize, false);

        // Restore global assignment for charts.js
        window.goToViewpoint = goToViewpoint;
        console.log('[settlement_test_viewer.js] goToViewpoint function assigned to window.');

        console.log('[settlement_test_viewer.js] Initialization complete.');
    }

    // --- Model Loading --- (Keep scaling logic)
    function loadModel(url) {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if (currentModel) scene.remove(currentModel);

        loader.load(url, (gltf) => {
            console.log('[settlement_test_viewer.js] Model loaded successfully:', url);
            currentModel = gltf.scene;

            const box = new THREE.Box3().setFromObject(currentModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = maxDim > 0 ? (5 / maxDim) : 1;
            currentModel.scale.set(scale, scale, scale);
            currentModel.position.sub(center.multiplyScalar(scale));
            scene.add(currentModel);

            // Restore automatic viewpoint setting - KEEP COMMENTED FOR NOW
            // goToViewpoint('Default');
            // window.initialViewpointSet = true; // Flag might still be useful for charts.js

            if (loadingIndicator) loadingIndicator.style.display = 'none';
        },
        (xhr) => { console.log(`[settlement_test_viewer.js] Model loading progress: ${(xhr.loaded / xhr.total * 100)}%`); },
        (error) => {
            console.error('[settlement_test_viewer.js] Error loading model:', error);
            if (loadingIndicator) loadingIndicator.textContent = '模型加载失败';
        });
    }

    // --- Animation Loop --- (Add TWEEN update if using transitions)
    function animate() {
        requestAnimationFrame(animate);
        // console.log('[settlement_test_viewer.js] Animate loop running...'); // Can comment this out if too verbose
        // TWEEN.update(); // Add if using TWEEN for smooth transitions
        if(controls) {
             console.log(`[settlement_test_viewer.js] Updating controls. Enabled: ${controls.enabled}`); // Log controls update & enabled state
             controls.update(); // Crucial for damping and manual control
        }
        if(renderer && scene && camera) renderer.render(scene, camera);
    }

    // --- Resize Handler --- (Keep as is)
    function onWindowResize() {
         if (container && camera && renderer) {
             const width = container.clientWidth;
             const height = container.clientHeight;
             console.log(`[settlement_test_viewer.js] Resizing to: ${width}x${height}`);
             if (width > 0 && height > 0) {
                 camera.aspect = width / height;
                 camera.updateProjectionMatrix();
                 renderer.setSize(width, height);
             } else {
                 console.warn('[settlement_test_viewer.js] Invalid container dimensions on resize.');
             }
         }
     }

    // --- Start ---
    console.log('[settlement_test_viewer.js] Calling init()...'); // <-- STEP 4: Verify init call
    init();
});
