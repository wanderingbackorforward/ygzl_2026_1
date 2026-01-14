// three_viewer.js - Adapted for Settlement Page Background
document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on the settlement page by looking for a specific element
    if (!document.getElementById('settlement-points')) { 
        console.log('Not on settlement page, Three.js viewer (background) not initialized.');
        return;
    }

    console.log('Initializing Three.js background for settlement page...');

    const container = document.getElementById('threejs-background'); // Use the new background container ID
    const canvas = document.getElementById('viewer-canvas');
    const loadingIndicator = document.getElementById('loading-indicator');
    // Remove selector references
    // const modelSelector = document.getElementById('model-selector');
    // const pointSelectorContainer = document.getElementById('point-selector-container');
    // const pointSelector = document.getElementById('point-selector');

    if (!container || !canvas || !THREE) {
        console.error('Viewer container, canvas, or Three.js library not found for background.');
        return;
    }

    // Model for this page is fixed
    const targetModelPath = 'glb/004-051.glb'; 

    // --- Predefined Viewpoints (Keep this, needs adjustment based on model) ---
    const viewpoints = {
        'Default': { position: [0, 2, 10], target: [0, 1, 0] } 
    };
    for (let i = 1; i <= 25; i++) {
        const pointId = `S${i}`;
        const angle = (i / 25) * Math.PI * 2;
        const x = Math.cos(angle) * 8;
        const z = Math.sin(angle) * 8;
        const y = 4;
        viewpoints[pointId] = {
            position: [x, y, z],
            target: [0, 0.5, 0] 
        };
    }

    let scene, camera, renderer, controls, loader, currentModel;

    // --- REMOVED Populate Selector Functions ---
    // function populateModelSelector() { ... }
    // function populatePointSelector() { ... }

    // --- REMOVED Handle Selector Change Functions ---
    // function handleModelSelectChange(event) { ... }
    // function handlePointSelectChange(event) { ... }

     // --- Go To Viewpoint (Make Globally Accessible) --- 
    window.goToViewpoint = function(pointId) { // Assign to window
        const view = viewpoints[pointId] || viewpoints['Default']; // Fallback to default
        if (!view || !camera || !controls) {
            console.warn(`Viewpoint '${pointId}' not found or camera/controls not ready.`);
             return;
        }

        console.log(`Moving camera to viewpoint '${pointId}': pos=${view.position}, target=${view.target}`);
        camera.position.set(...view.position);
        controls.target.set(...view.target);
        controls.update();
        // Add smooth transition later if needed
    }

    // --- Initialization ---
    function init() {
        // ... (Scene, Camera, Renderer, Controls, Lighting setup - same as before) ...
        scene = new THREE.Scene();
        scene.background = null;
        const aspect = container.clientWidth / container.clientHeight;
        camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        camera.position.set(0, 2, 5);
        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.outputEncoding = THREE.sRGBEncoding;
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.screenSpacePanning = false;
        controls.target.set(0, 1, 0);
        controls.update();
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7.5);
        scene.add(directionalLight);
        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight2.position.set(-5, -5, -7.5);
        scene.add(directionalLight2);

        // Loader
        loader = new THREE.GLTFLoader();

        // REMOVED Populate Selectors

        // Load the specific model for this page
        loadModel(targetModelPath);

        // Start animation loop
        animate();

        // Handle window resize
        window.addEventListener('resize', onWindowResize, false);

        // REMOVED Selector Event Listeners
    }

    // --- Model Loading (Simplified to load only the target model) ---
    function loadModel(url) {
        if (currentModelUrl === url && currentModel) return; // Avoid reloading same model
        currentModelUrl = url;

        if (loadingIndicator) { /* ... show loading ... */ }
        if (currentModel) { scene.remove(currentModel); }
        
        // REMOVED logic to show/hide point selector

        loader.load(
            url,
            (gltf) => {
                 console.log('Background model loaded successfully:', url);
                 currentModel = gltf.scene;
                 // ... (centering/scaling logic) ...
                 const box = new THREE.Box3().setFromObject(currentModel);
                 const center = box.getCenter(new THREE.Vector3());
                 const size = box.getSize(new THREE.Vector3());
                 const maxDim = Math.max(size.x, size.y, size.z);
                 const scale = maxDim > 0 ? (5 / maxDim) : 1; 
                 currentModel.scale.set(scale, scale, scale);
                 currentModel.position.sub(center.multiplyScalar(scale));
                 scene.add(currentModel);

                 // Set initial view to Default AFTER model is loaded
                 if (window.goToViewpoint) { // Check if function is available
                     window.goToViewpoint('Default');
                 } else {
                     // Fallback if something went wrong
                     controls.target.copy(currentModel.position);
                     controls.update();
                 }

                 if (loadingIndicator) loadingIndicator.style.display = 'none';
             },
             (xhr) => { /* ... progress ... */ },
             (error) => { /* ... error ... */ }
        );
    }

    // --- Animation Loop --- 
    function animate() { /* ... same ... */
         requestAnimationFrame(animate);
         controls.update();
         renderer.render(scene, camera);
     }

    // --- Resize Handler --- 
    function onWindowResize() { /* ... same ... */
         if (container && camera && renderer) {
             const width = container.clientWidth;
             const height = container.clientHeight;
             camera.aspect = width / height;
             camera.updateProjectionMatrix();
             renderer.setSize(width, height);
         }
     }

    // --- Start --- 
    init();
}); 