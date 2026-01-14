// 简化版 Three.js 视图器，用于沉降页背景与选择跳转
// 初始化 3D 场景与相机，并暴露 window.goToViewpoint(pointId)
(function() {
  let scene, camera, renderer, controls, initialized = false;
  const canvas = document.getElementById('viewer-canvas');
  const indicator = document.getElementById('loading-indicator');
  function init() {
    if (!canvas) return;
    try {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a1628);
      const w = canvas.parentElement.clientWidth || window.innerWidth;
      const h = canvas.parentElement.clientHeight || window.innerHeight;
      camera = new THREE.PerspectiveCamera(60, w / h, 1, 500000);
      camera.position.set(0, 8000, 15000);
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      renderer.setSize(w, h);
      renderer.setPixelRatio(window.devicePixelRatio);
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 500;
      controls.maxDistance = 100000;
      const ambient = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambient);
      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(10000, 20000, 10000);
      scene.add(dir);
      const grid = new THREE.GridHelper(50000, 50, 0x00f2ff, 0x444444);
      grid.material.opacity = 0.15; grid.material.transparent = true;
      scene.add(grid);
      const axes = new THREE.AxesHelper(5000);
      scene.add(axes);
      animate();
      // 可选：加载地面模型（如需要）
      if (indicator) { indicator.style.display = 'block'; indicator.innerHTML = '加载模型中...'; }
      const loader = new THREE.GLTFLoader();
      loader.load('glb/004-051.glb', function(gltf) {
        scene.add(gltf.scene);
        if (indicator) indicator.style.display = 'none';
      }, undefined, function() {
        if (indicator) { indicator.style.display = 'none'; }
      });
      window.addEventListener('resize', onResize);
      initialized = true;
    } catch (e) {
      if (indicator) { indicator.innerHTML = '3D初始化失败'; indicator.style.display = 'block'; }
    }
  }
  function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
  }
  function onResize() {
    if (!renderer || !camera || !canvas) return;
    const w = canvas.parentElement.clientWidth || window.innerWidth;
    const h = canvas.parentElement.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  // 简化版视角跳转：根据点位编号数字部分调整相机 X/Z
  window.goToViewpoint = function(pointId) {
    if (!initialized || !camera) return;
    const num = parseInt(String(pointId).replace(/\D/g, '')) || 0;
    const x = (num % 50) * 200 - 5000;
    const z = Math.floor(num / 50) * 200 - 5000;
    camera.position.set(x, 6000, 12000);
    controls.target.set(0, 0, 0);
    controls.update();
  };
  // 初始化
  window.addEventListener('load', function() {
    if (typeof THREE === 'undefined') return;
    if (!THREE.OrbitControls || !THREE.GLTFLoader) return;
    init();
    const evt = new Event('threeViewerReady');
    document.dispatchEvent(evt);
  });
})();
