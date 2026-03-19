// -*- coding: utf-8 -*-
// three_viewer_enhanced.js - Digital Twin Tunnel Walkthrough Platform
// Procedural tunnel scene + Orbit/FPS/Fly navigation + Auto-tour
(function() {
    'use strict';

    // =========================================================
    // Configuration
    // =========================================================
    var TUNNEL_LENGTH = 220;   // meters
    var TUNNEL_RADIUS = 4.5;   // meters
    var TUNNEL_SEGMENTS = 64;
    var TUNNEL_RINGS = 200;
    var NUM_MONITOR_POINTS = 20;
    var MOVE_SPEED = 8;        // m/s base
    var FLY_SPEED = 15;
    var MOUSE_SENSITIVITY = 0.002;
    var TOUR_SPEED = 0.8;      // path-index per second (lower = slower tour)

    // Monitoring point colors by status
    var STATUS_COLORS = {
        normal:  0x00e676,
        warning: 0xffc107,
        danger:  0xff3e5f
    };

    // =========================================================
    // State
    // =========================================================
    var scene, camera, renderer, clock;
    var orbitControls;
    var navMode = 'orbit';  // 'orbit' | 'fps' | 'fly'
    var moveState = { forward: false, backward: false, left: false, right: false, up: false, down: false };
    var euler, velocity, direction;  // initialized in init() after THREE is loaded
    var speedMultiplier = 1;

    // Auto-tour
    var touring = false;
    var tourProgress = 0;
    var tourPath = [];

    // Monitoring points
    var monitorMarkers = [];
    var raycaster, mouse;
    var hoveredMarker = null;
    var popupEl = null;

    // Minimap
    var minimapCtx = null;

    // FPS counter
    var fpsFrames = 0, fpsTime = 0, fpsValue = 60;
    var frameCount = 0;  // deterministic throttle instead of Math.random()

    // =========================================================
    // Procedural Tunnel Generation
    // =========================================================
    function createTunnelScene() {
        // -- Tunnel shell (half-cylinder arch) --
        var tunnelGeo = new THREE.CylinderGeometry(
            TUNNEL_RADIUS, TUNNEL_RADIUS, TUNNEL_LENGTH,
            TUNNEL_SEGMENTS, TUNNEL_RINGS, true,
            0, Math.PI
        );
        // Rotate so tunnel runs along Z axis
        tunnelGeo.rotateX(Math.PI / 2);
        tunnelGeo.rotateZ(Math.PI);
        // Shift so tunnel starts at z=0, ends at z=-TUNNEL_LENGTH
        tunnelGeo.translate(0, TUNNEL_RADIUS * 0.15, -TUNNEL_LENGTH / 2);

        var tunnelMat = new THREE.MeshPhongMaterial({
            color: 0x3a3a4a,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85
        });
        var tunnel = new THREE.Mesh(tunnelGeo, tunnelMat);
        tunnel.name = 'tunnel_shell';
        scene.add(tunnel);

        // -- Inner lining rings (every 15m, reduced for performance) --
        for (var i = 0; i <= TUNNEL_LENGTH; i += 15) {
            var ringGeo = new THREE.TorusGeometry(TUNNEL_RADIUS * 0.98, 0.08, 8, TUNNEL_SEGMENTS, Math.PI);
            var ringMat = new THREE.MeshPhongMaterial({ color: 0x607d8b, emissive: 0x1a237e, emissiveIntensity: 0.1 });
            var ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.y = Math.PI / 2;
            ring.rotation.x = Math.PI;
            ring.position.set(0, TUNNEL_RADIUS * 0.15, -i);
            scene.add(ring);
        }

        // -- Ground plane inside tunnel --
        var groundGeo = new THREE.PlaneGeometry(TUNNEL_RADIUS * 2.2, TUNNEL_LENGTH);
        var groundMat = new THREE.MeshPhongMaterial({ color: 0x2c2c3e, side: THREE.DoubleSide });
        var ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(0, -0.05, -TUNNEL_LENGTH / 2);
        scene.add(ground);

        // -- Exterior terrain --
        var terrainGeo = new THREE.PlaneGeometry(500, 500, 80, 80);
        var positions = terrainGeo.attributes.position;
        for (var j = 0; j < positions.count; j++) {
            var x = positions.getX(j);
            var y = positions.getY(j);
            var h = Math.sin(x * 0.03) * 2 + Math.cos(y * 0.02) * 3 + Math.random() * 0.5;
            positions.setZ(j, h);
        }
        terrainGeo.computeVertexNormals();
        var terrainMat = new THREE.MeshPhongMaterial({ color: 0x2e4a1e, flatShading: true, side: THREE.DoubleSide });
        var terrain = new THREE.Mesh(terrainGeo, terrainMat);
        terrain.rotation.x = -Math.PI / 2;
        terrain.position.set(0, -0.1, -TUNNEL_LENGTH / 2);
        scene.add(terrain);

        // -- Tunnel entrance portal --
        createPortal(0);
        createPortal(-TUNNEL_LENGTH);

        // -- Tunnel interior lights (every 25m, reduced for performance) --
        for (var k = 5; k < TUNNEL_LENGTH; k += 25) {
            var light = new THREE.PointLight(0xffe0b2, 0.4, 15);
            light.position.set(0, TUNNEL_RADIUS * 0.8, -k);
            scene.add(light);

            // Light fixture visual
            var fixGeo = new THREE.BoxGeometry(0.3, 0.1, 0.3);
            var fixMat = new THREE.MeshBasicMaterial({ color: 0xfff9c4 });
            var fixture = new THREE.Mesh(fixGeo, fixMat);
            fixture.position.copy(light.position);
            scene.add(fixture);
        }

        // -- Monitoring point markers --
        createMonitoringMarkers();

        // -- Build tour path --
        buildTourPath();
    }

    function createPortal(zPos) {
        var portalGeo = new THREE.TorusGeometry(TUNNEL_RADIUS, 0.3, 16, TUNNEL_SEGMENTS, Math.PI);
        var portalMat = new THREE.MeshPhongMaterial({
            color: 0x455a64,
            emissive: 0x00bcd4,
            emissiveIntensity: 0.15
        });
        var portal = new THREE.Mesh(portalGeo, portalMat);
        portal.rotation.y = Math.PI / 2;
        portal.rotation.x = Math.PI;
        portal.position.set(0, TUNNEL_RADIUS * 0.15, zPos);
        scene.add(portal);

        // Portal frame pillars
        for (var side = -1; side <= 1; side += 2) {
            var pillarGeo = new THREE.BoxGeometry(0.4, TUNNEL_RADIUS * 2, 0.4);
            var pillarMat = new THREE.MeshPhongMaterial({ color: 0x546e7a });
            var pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(side * TUNNEL_RADIUS, TUNNEL_RADIUS * 0.5, zPos);
            scene.add(pillar);
        }
    }

    // =========================================================
    // Monitoring Point Markers
    // =========================================================
    function createMonitoringMarkers() {
        var spacing = TUNNEL_LENGTH / (NUM_MONITOR_POINTS + 1);
        for (var i = 1; i <= NUM_MONITOR_POINTS; i++) {
            var z = -i * spacing;
            var status = Math.random() < 0.6 ? 'normal' : (Math.random() < 0.5 ? 'warning' : 'danger');
            var settlement = status === 'normal' ? (Math.random() * 5).toFixed(1)
                           : status === 'warning' ? (5 + Math.random() * 10).toFixed(1)
                           : (15 + Math.random() * 15).toFixed(1);

            // Sphere marker
            var geo = new THREE.SphereGeometry(0.15, 16, 16);
            var mat = new THREE.MeshPhongMaterial({
                color: STATUS_COLORS[status],
                emissive: STATUS_COLORS[status],
                emissiveIntensity: 0.4,
                transparent: true,
                opacity: 0.9
            });
            var marker = new THREE.Mesh(geo, mat);
            marker.position.set((Math.random() - 0.5) * 2, TUNNEL_RADIUS * 0.6, z);
            marker.userData = {
                pointId: 'S' + i,
                mileage: 'K0+' + String(Math.round(i * spacing)).padStart(3, '0'),
                status: status,
                settlement: settlement + ' mm',
                type: i % 3 === 0 ? 'convergence' : (i % 3 === 1 ? 'vault' : 'surface')
            };
            scene.add(marker);
            monitorMarkers.push(marker);

            // Glow ring
            var ringGeo = new THREE.RingGeometry(0.2, 0.28, 32);
            var ringMat = new THREE.MeshBasicMaterial({
                color: STATUS_COLORS[status],
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide
            });
            var ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.copy(marker.position);
            ring.rotation.x = -Math.PI / 2;  // horizontal ring on ground plane
            scene.add(ring);

            // Vertical line to ground
            var lineGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(marker.position.x, 0, z),
                new THREE.Vector3(marker.position.x, marker.position.y, z)
            ]);
            var lineMat = new THREE.LineBasicMaterial({ color: STATUS_COLORS[status], transparent: true, opacity: 0.4 });
            scene.add(new THREE.Line(lineGeo, lineMat));
        }
    }

    // =========================================================
    // Tour Path
    // =========================================================
    function buildTourPath() {
        tourPath = [];
        // Approach from outside
        tourPath.push({ pos: [0, 3, 15], target: [0, 2, 0] });
        // Enter tunnel
        for (var i = 0; i <= TUNNEL_LENGTH; i += 2) {
            tourPath.push({
                pos: [Math.sin(i * 0.02) * 1.5, 2, -i],
                target: [0, 1.8, -(i + 10)]
            });
        }
        // Exit and look back
        tourPath.push({ pos: [0, 5, -(TUNNEL_LENGTH + 20)], target: [0, 2, -TUNNEL_LENGTH] });
    }

    // =========================================================
    // Scene Initialization
    // =========================================================
    function init() {
        var canvas = document.getElementById('viewer-canvas');
        if (!canvas) return;

        // Initialize THREE-dependent objects
        euler = new THREE.Euler(0, 0, 0, 'YXZ');
        velocity = new THREE.Vector3();
        direction = new THREE.Vector3();

        clock = new THREE.Clock();
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a1628);
        scene.fog = new THREE.FogExp2(0x0a1628, 0.004);

        var w = window.innerWidth, h = window.innerHeight;
        camera = new THREE.PerspectiveCamera(65, w / h, 0.1, 2000);
        camera.position.set(0, 5, 20);

        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;

        // Orbit controls (default mode)
        orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
        orbitControls.enableDamping = true;
        orbitControls.dampingFactor = 0.08;
        orbitControls.target.set(0, 2, -10);

        // Lighting
        var amb = new THREE.AmbientLight(0xb0bec5, 0.5);
        scene.add(amb);
        var sun = new THREE.DirectionalLight(0xffffff, 0.7);
        sun.position.set(50, 80, 30);
        scene.add(sun);
        var hemi = new THREE.HemisphereLight(0x87ceeb, 0x3e2723, 0.3);
        scene.add(hemi);

        // Sky sphere
        var skyGeo = new THREE.SphereGeometry(800, 32, 32);
        var skyMat = new THREE.MeshBasicMaterial({
            color: 0x0a1628, side: THREE.BackSide
        });
        scene.add(new THREE.Mesh(skyGeo, skyMat));

        // Raycaster for hover
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();

        // Generate the tunnel scene
        createTunnelScene();

        // Create popup
        createPopup();

        // Setup minimap
        setupMinimap();

        // Event listeners
        setupEvents(canvas);

        // Hide loading
        var loading = document.getElementById('loading-indicator');
        if (loading) loading.classList.add('hidden');

        // Start loop
        animate();
    }

    // =========================================================
    // Popup (hover info)
    // =========================================================
    function createPopup() {
        popupEl = document.createElement('div');
        popupEl.style.cssText = [
            'position:fixed', 'display:none', 'padding:12px 16px',
            'background:rgba(10,22,40,0.95)', 'border:1px solid #00e5ff',
            'border-radius:8px', 'color:#e0f7fa', 'font-family:Rajdhani,monospace',
            'font-size:13px', 'pointer-events:none', 'z-index:60',
            'min-width:180px', 'backdrop-filter:blur(8px)'
        ].join(';');
        document.body.appendChild(popupEl);
    }

    function showPopup(x, y, data) {
        if (!popupEl) return;
        var statusLabel = data.status === 'normal' ? '正常'
                        : data.status === 'warning' ? '预警' : '报警';
        var statusColor = data.status === 'normal' ? '#00e676'
                        : data.status === 'warning' ? '#ffc107' : '#ff3e5f';
        popupEl.innerHTML = '<div style="color:#00e5ff;font-weight:600;margin-bottom:6px;">'
            + '<i class="fas fa-map-marker-alt"></i> ' + data.pointId + '</div>'
            + '<div>里程: ' + data.mileage + '</div>'
            + '<div>类型: ' + (data.type === 'vault' ? '拱顶沉降' : data.type === 'convergence' ? '收敛' : '地表沉降') + '</div>'
            + '<div>沉降量: <span style="color:' + statusColor + ';font-weight:600;">' + data.settlement + '</span></div>'
            + '<div>状态: <span style="color:' + statusColor + ';">' + statusLabel + '</span></div>';
        popupEl.style.display = 'block';
        popupEl.style.left = Math.min(x + 15, window.innerWidth - 220) + 'px';
        popupEl.style.top = Math.min(y + 15, window.innerHeight - 140) + 'px';
    }

    function hidePopup() {
        if (popupEl) popupEl.style.display = 'none';
    }

    // =========================================================
    // Minimap
    // =========================================================
    function setupMinimap() {
        var c = document.getElementById('minimap-canvas');
        if (!c) return;
        c.width = 160; c.height = 120;
        minimapCtx = c.getContext('2d');
    }

    function updateMinimap() {
        if (!minimapCtx) return;
        var ctx = minimapCtx;
        ctx.fillStyle = 'rgba(10,22,40,0.9)';
        ctx.fillRect(0, 0, 160, 120);

        // Draw tunnel outline
        ctx.strokeStyle = 'rgba(0,229,255,0.4)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(80, 10);
        ctx.lineTo(80, 110);
        ctx.stroke();

        // Draw monitor points
        for (var i = 0; i < monitorMarkers.length; i++) {
            var m = monitorMarkers[i];
            var my = 10 + (-m.position.z / TUNNEL_LENGTH) * 100;
            var color = m.userData.status === 'normal' ? '#00e676'
                      : m.userData.status === 'warning' ? '#ffc107' : '#ff3e5f';
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(80 + m.position.x * 5, my, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw camera position
        var cz = 10 + (-camera.position.z / TUNNEL_LENGTH) * 100;
        var cx = 80 + camera.position.x * 5;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(Math.max(10, Math.min(150, cx)), Math.max(5, Math.min(115, cz)), 4, 0, Math.PI * 2);
        ctx.fill();

        // Camera direction indicator
        if (!_minimapDir) _minimapDir = new THREE.Vector3();
        camera.getWorldDirection(_minimapDir);
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cz);
        ctx.lineTo(cx + _minimapDir.x * 12, cz - _minimapDir.z * 12);
        ctx.stroke();
    }

    // =========================================================
    // Event Listeners
    // =========================================================
    function setupEvents(canvas) {
        // Keyboard
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        // Mouse for FPS/Fly
        canvas.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        // Hover raycast
        canvas.addEventListener('mousemove', onHoverMove);
        // Scroll for speed
        canvas.addEventListener('wheel', onWheel);
        // Resize
        window.addEventListener('resize', onResize);
    }

    var mouseDown = false, mouseButton = -1;
    var prevMouseX = 0, prevMouseY = 0;

    function onMouseDown(e) {
        if (navMode === 'orbit') return; // orbit handles itself
        mouseDown = true;
        mouseButton = e.button;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
        renderer.domElement.requestPointerLock && renderer.domElement.requestPointerLock();
    }
    function onMouseUp() {
        mouseDown = false;
        mouseButton = -1;
        // Do NOT exitPointerLock here - let user keep looking around
        // Pointer lock is only released on ESC / switching to orbit mode
    }
    function onMouseMove(e) {
        if (navMode === 'orbit') return;
        var dx = e.movementX || 0;
        var dy = e.movementY || 0;
        if (!document.pointerLockElement && !mouseDown) return;
        euler.setFromQuaternion(camera.quaternion);
        euler.y -= dx * MOUSE_SENSITIVITY;
        euler.x -= dy * MOUSE_SENSITIVITY;
        euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.x));
        camera.quaternion.setFromEuler(euler);
    }

    function onHoverMove(e) {
        if (navMode !== 'orbit') { hidePopup(); return; }
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        var hits = raycaster.intersectObjects(monitorMarkers);
        if (hits.length > 0) {
            var m = hits[0].object;
            if (hoveredMarker !== m) {
                resetHover();
                hoveredMarker = m;
                m.material.emissiveIntensity = 0.9;
                m.scale.setScalar(1.4);
            }
            showPopup(e.clientX, e.clientY, m.userData);
            renderer.domElement.style.cursor = 'pointer';
        } else {
            resetHover();
            hidePopup();
            renderer.domElement.style.cursor = navMode === 'orbit' ? 'grab' : 'crosshair';
        }
    }

    function resetHover() {
        if (hoveredMarker) {
            hoveredMarker.material.emissiveIntensity = 0.4;
            hoveredMarker.scale.setScalar(1);
            hoveredMarker = null;
        }
    }

    function onWheel(e) {
        if (navMode !== 'orbit') {
            speedMultiplier = Math.max(0.2, Math.min(5, speedMultiplier - e.deltaY * 0.001));
        }
    }

    function onKeyDown(e) {
        switch(e.code) {
            case 'KeyW': moveState.forward = true; break;
            case 'KeyS': moveState.backward = true; break;
            case 'KeyA': moveState.left = true; break;
            case 'KeyD': moveState.right = true; break;
            case 'Space': moveState.up = true; e.preventDefault(); break;
            case 'ShiftLeft': case 'ShiftRight': moveState.down = true; break;
            case 'Digit1': window.setNavMode('orbit'); break;
            case 'Digit2': window.setNavMode('fps'); break;
            case 'Digit3': window.setNavMode('fly'); break;
            case 'KeyT': touring ? window.stopAutoTour() : window.startAutoTour(); break;
            case 'KeyR': window.resetCamera(); break;
            case 'KeyH': window.toggleHelp(); break;
            case 'Escape':
                if (navMode !== 'orbit') window.setNavMode('orbit');
                break;
        }
    }
    function onKeyUp(e) {
        switch(e.code) {
            case 'KeyW': moveState.forward = false; break;
            case 'KeyS': moveState.backward = false; break;
            case 'KeyA': moveState.left = false; break;
            case 'KeyD': moveState.right = false; break;
            case 'Space': moveState.up = false; break;
            case 'ShiftLeft': case 'ShiftRight': moveState.down = false; break;
        }
    }

    function onResize() {
        if (!renderer || !camera) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // =========================================================
    // Animation Loop + Navigation Update
    // =========================================================
    function animate() {
        requestAnimationFrame(animate);
        var delta = clock.getDelta();

        // FPS counter
        fpsFrames++;
        fpsTime += delta;
        if (fpsTime >= 0.5) {
            fpsValue = Math.round(fpsFrames / fpsTime);
            fpsFrames = 0; fpsTime = 0;
        }

        if (navMode === 'orbit') {
            orbitControls.update();
        } else {
            updateFreeMove(delta);
        }

        if (touring) {
            updateTour(delta);
        }

        renderer.render(scene, camera);

        // HUD/minimap update (deterministic throttle, not random)
        frameCount++;
        if (frameCount % 8 === 0) updateHUD();
        if (frameCount % 15 === 0) updateMinimap();
    }

    // Reusable vectors (avoid per-frame allocation)
    var _forward = null, _right = null, _up = null, _minimapDir = null;

    function updateFreeMove(delta) {
        if (!_forward) {
            _forward = new THREE.Vector3();
            _right = new THREE.Vector3();
            _up = new THREE.Vector3(0, 1, 0);
        }
        var speed = (navMode === 'fly' ? FLY_SPEED : MOVE_SPEED) * speedMultiplier;
        velocity.set(0, 0, 0);
        direction.set(0, 0, 0);

        if (moveState.forward) direction.z = -1;
        if (moveState.backward) direction.z = 1;
        if (moveState.left) direction.x = -1;
        if (moveState.right) direction.x = 1;
        if (moveState.up) direction.y = 1;
        if (moveState.down) direction.y = -1;

        if (direction.length() > 0) {
            direction.normalize();
            camera.getWorldDirection(_forward);
            _right.crossVectors(_forward, camera.up).normalize();

            velocity.addScaledVector(_forward, -direction.z * speed * delta);
            velocity.addScaledVector(_right, direction.x * speed * delta);
            velocity.addScaledVector(_up, direction.y * speed * delta);

            camera.position.add(velocity);
        }

        // FPS mode: clamp height above ground
        if (navMode === 'fps') {
            camera.position.y = Math.max(1.7, camera.position.y);
        }
    }

    function updateTour(delta) {
        if (tourPath.length < 2) return;
        tourProgress += TOUR_SPEED * delta;
        var idx = Math.floor(tourProgress);
        if (idx >= tourPath.length - 1) {
            touring = false;
            tourProgress = 0;
            return;
        }
        var t = tourProgress - idx;
        var a = tourPath[idx], b = tourPath[idx + 1];
        var ease = t * t * (3 - 2 * t);
        camera.position.set(
            a.pos[0] + (b.pos[0] - a.pos[0]) * ease,
            a.pos[1] + (b.pos[1] - a.pos[1]) * ease,
            a.pos[2] + (b.pos[2] - a.pos[2]) * ease
        );
        var lx = a.target[0] + (b.target[0] - a.target[0]) * ease;
        var ly = a.target[1] + (b.target[1] - a.target[1]) * ease;
        var lz = a.target[2] + (b.target[2] - a.target[2]) * ease;
        camera.lookAt(lx, ly, lz);
    }

    function updateHUD() {
        var posEl = document.getElementById('hud-pos');
        var meterEl = document.getElementById('hud-meter');
        var fpsEl = document.getElementById('hud-fps');
        if (posEl) posEl.textContent = camera.position.x.toFixed(1) + ', '
            + camera.position.y.toFixed(1) + ', ' + camera.position.z.toFixed(1);
        if (meterEl) {
            var m = Math.max(0, -camera.position.z);
            meterEl.textContent = 'K0+' + String(Math.round(m)).padStart(3, '0');
        }
        if (fpsEl) fpsEl.textContent = fpsValue;
    }

    // =========================================================
    // Public API
    // =========================================================
    window.setNavMode = function(mode) {
        navMode = mode;
        touring = false;
        var btns = document.querySelectorAll('.ctrl-btn[data-mode]');
        btns.forEach(function(b) {
            b.classList.toggle('active', b.getAttribute('data-mode') === mode);
        });
        var label = document.getElementById('mode-label');
        var crosshair = document.getElementById('crosshair');
        if (mode === 'orbit') {
            orbitControls.enabled = true;
            orbitControls.target.set(camera.position.x, camera.position.y - 1, camera.position.z - 5);
            if (label) label.textContent = '轨道';
            if (crosshair) crosshair.style.display = 'none';
            renderer.domElement.style.cursor = 'grab';
            document.exitPointerLock && document.exitPointerLock();
        } else {
            orbitControls.enabled = false;
            if (label) label.textContent = mode === 'fps' ? '漫游' : '飞行';
            if (crosshair) crosshair.style.display = 'block';
            renderer.domElement.style.cursor = 'crosshair';
        }
    };

    window.startAutoTour = function() {
        touring = true;
        tourProgress = 0;
        window.setNavMode('fly');
        // Re-enable touring after setNavMode cleared it
        touring = true;
    };

    window.stopAutoTour = function() {
        touring = false;
    };

    window.resetCamera = function() {
        touring = false;
        camera.position.set(0, 5, 20);
        camera.lookAt(0, 2, -10);
        if (orbitControls) {
            orbitControls.target.set(0, 2, -10);
        }
        window.setNavMode('orbit');
    };

    window.toggleHelp = function() {
        var el = document.getElementById('help-overlay');
        if (el) el.classList.toggle('visible');
    };

    // Legacy API compatibility
    window.goToViewpoint = function(pointId) {
        if (!camera) return;
        for (var i = 0; i < monitorMarkers.length; i++) {
            if (monitorMarkers[i].userData.pointId === pointId) {
                var p = monitorMarkers[i].position;
                camera.position.set(p.x + 2, p.y + 1, p.z + 3);
                camera.lookAt(p.x, p.y, p.z);
                if (orbitControls) orbitControls.target.copy(p);
                return;
            }
        }
    };
    window.setThreeViewerMode = function() {};
    window.switchThreeViewerDataType = function() {};
    window.refreshThreeViewerPoints = function() {};
    window.calibratePoint = function() {};

    // =========================================================
    // Boot
    // =========================================================
    window.addEventListener('load', function() {
        if (typeof THREE === 'undefined') {
            console.error('[3D] THREE.js not loaded');
            return;
        }
        init();
    });

})();
