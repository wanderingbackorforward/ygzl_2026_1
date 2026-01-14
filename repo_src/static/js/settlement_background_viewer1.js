// three_viewer.js - Adapted for Settlement Page Background
document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on the settlement page by looking for specific elements
    const container = document.getElementById('threejs-background'); // Use the background container ID
    const canvas = document.getElementById('viewer-canvas');
    const loadingIndicator = document.getElementById('loading-indicator'); // Optional loading indicator

    // Correct element check for settlement page
    if (!container || !canvas || !THREE) {
        console.error('[settlement_background_viewer.js] Required elements (#threejs-background, #viewer-canvas, or THREE library) not found for background.');
        return; // Stop execution if essential elements are missing
    }

    console.log('[settlement_background_viewer.js] Initializing Three.js background for settlement page...');

    // Model for this page is fixed (Ensure path is correct relative to HTML)
    const targetModelPath = 'glb/004-051.glb';

    // --- Predefined Viewpoints (Updated with NEW S1 & S2 data) ---
    const viewpoints = {
        "Default": { position: [0.000, 2.000, 10.000], target: [0.000, 1.000, 0.000] }, // Keep a reasonable default
        "S1": { position: [1.026, -0.027, 2.673], target: [0.000, 0.000, 0.000] },
        "S2": { position: [0.811, -0.021, 2.113], target: [-0.215, 0.006, -0.560] }
        // Add S3 to S25 data here when available
    };
    // REMOVED Placeholder loop for S1-S25

    let scene, camera, renderer, controls, loader, currentModel, currentModelUrl;

    // --- Go To Viewpoint (Local function first) ---
    function goToViewpoint(pointId) { // Keep as local function
        console.log(`[settlement_background_viewer.js] goToViewpoint called with ID: ${pointId}`);
        const view = viewpoints[pointId] || viewpoints['Default'];
        if (!view || !camera || !controls) {
            console.warn(`[settlement_background_viewer.js] Viewpoint '${pointId}' not found or camera/controls not ready.`);
             return;
        }

        console.log(`[settlement_background_viewer.js] Moving camera to viewpoint '${pointId}': pos=${view.position}, target=${view.target}`);
        camera.position.set(...view.position);
        controls.target.set(...view.target);
        controls.update();
    }

    // --- Initialization ---
    function init() {
        // ... (Scene, Camera, Renderer, Controls, Lighting setup - make sure it's appropriate for background)
        scene = new THREE.Scene();
        scene.background = null; // Use CSS background from settlement page
        const aspect = container.clientWidth / container.clientHeight;
        camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        camera.position.set(0, 1, 5); // Simple starting position
        console.log('[settlement_background_viewer.js] Camera Up vector:', camera.up); // Log camera up vector

        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.outputEncoding = THREE.sRGBEncoding;

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.screenSpacePanning = false;
        controls.target.set(0, 0, 0); // Target origin initially
        controls.update();

        // --- Unified Lighting (match three_viewer.js) ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Match test page
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Match test page
        directionalLight.position.set(5, 10, 7.5);
        scene.add(directionalLight);
        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4); // Add second directional light
        directionalLight2.position.set(-5, -5, -7.5); // Match test page
        scene.add(directionalLight2);
        // --- End Unified Lighting ---

        // Loader
        loader = new THREE.GLTFLoader();

        // Load the specific model for this page
        loadModel(targetModelPath);

        // Start animation loop
        animate();

        // Handle window resize
        window.addEventListener('resize', onWindowResize, false);

        // Make the function globally available AFTER init logic is complete
        window.goToViewpoint = goToViewpoint;
        console.log('[settlement_background_viewer.js] goToViewpoint function assigned to window.');

        // Optional: Dispatch a ready event if charts.js needs it
        // document.dispatchEvent(new Event('threeViewerReady'));
    }

    // --- Model Loading (Simplified for background) ---
    function loadModel(url) {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if (currentModel) scene.remove(currentModel);

        loader.load(url, (gltf) => {
            console.log('[settlement_background_viewer.js] Background model loaded successfully:', url);
            currentModel = gltf.scene;

            const box = new THREE.Box3().setFromObject(currentModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            // --- Unified Scaling (match three_viewer.js) ---
            const scale = maxDim > 0 ? (5 / maxDim) : 1;
            currentModel.scale.set(scale, scale, scale);
            currentModel.position.sub(center.multiplyScalar(scale));
            scene.add(currentModel);

            // Set initial view to Default AFTER model is loaded
            goToViewpoint('Default'); // Call local function
            window.initialViewpointSet = true; // Set flag used by charts.js fallback

            if (loadingIndicator) loadingIndicator.style.display = 'none';
        },
        (xhr) => { console.log(`[settlement_background_viewer.js] Model loading progress: ${(xhr.loaded / xhr.total * 100)}%`); },
        (error) => {
            console.error('[settlement_background_viewer.js] Error loading background model:', error);
            if (loadingIndicator) loadingIndicator.textContent = '模型加载失败';
        });
    }

    // --- Animation Loop ---
    function animate() {
        requestAnimationFrame(animate);
        // Ensure controls and renderer are updated
        if(controls) controls.update();
        if(renderer && scene && camera) renderer.render(scene, camera);
    }

    // --- Resize Handler ---
    function onWindowResize() {
         if (container && camera && renderer) {
             const width = container.clientWidth;
             const height = container.clientHeight;
             console.log(`[settlement_background_viewer.js] Resizing to: ${width}x${height}`); // Log resize
             if (width > 0 && height > 0) { // Ensure valid dimensions
                 camera.aspect = width / height;
                 camera.updateProjectionMatrix();
                 renderer.setSize(width, height);
             } else {
                 console.warn('[settlement_background_viewer.js] Invalid container dimensions on resize.');
             }
         }
     }

    // --- Start ---
    init();
});
