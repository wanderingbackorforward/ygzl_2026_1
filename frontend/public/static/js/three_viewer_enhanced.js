// -*- coding: utf-8 -*-
// three_viewer_enhanced.js - Enhanced 3D viewer with monitoring point interaction
// Implements: offset mapping, click switching, hover popups, mode restriction, auto-calibration
(function() {
    'use strict';

    // =========================================================
    // Configuration
    // =========================================================
    const CONFIG = {
        // GLB model offset per section (meters in model space)
        // These values represent the offset between monitoring points
        MODEL_SECTIONS: [
            { name: '004-051', startMeter: 4, endMeter: 51, file: 'glb/004-051.glb' },
            { name: '052-100', startMeter: 52, endMeter: 100, file: 'glb/052-100.glb' },
            { name: '101-152', startMeter: 101, endMeter: 152, file: 'glb/101-152.glb' },
            { name: '153-180', startMeter: 153, endMeter: 180, file: 'glb/153-180.glb' },
            { name: '181-end', startMeter: 181, endMeter: 220, file: 'glb/181-end.glb' }
        ],
        // Known calibration points (S1-S4 have accurate positions)
        KNOWN_POINTS: {
            'S1': { position: [0.191, -0.005, 2.444], target: [0.000, 0.000, 0.000], meter: 9 },
            'S2': { position: [0.052, -0.001, 0.666], target: [-0.062, 0.002, -0.798], meter: 10 },
            'S3': { position: [-0.042, 0.001, -0.531], target: [-0.156, 0.004, -1.994], meter: 15 },
            'S4': { position: [-0.034, 0.020, -1.028], target: [-0.156, 0.004, -1.994], meter: 20 }
        },
        // Monitoring point marker style
        MARKER: {
            radius: 0.05,
            color: 0x00e5ff,
            hoverColor: 0xff3e5f,
            selectedColor: 0x00e676,
            emissive: 0x00e5ff,
            emissiveIntensity: 0.3
        },
        // Popup style
        POPUP: {
            width: 220,
            padding: 12,
            backgroundColor: 'rgba(10, 22, 40, 0.95)',
            borderColor: '#00e5ff',
            textColor: '#e0f7fa'
        }
    };

    // =========================================================
    // State
    // =========================================================
    let scene, camera, renderer, controls;
    let initialized = false;
    let monitoringPoints = [];
    let pointMarkers = new Map();  // point_id -> THREE.Mesh
    let selectedPointId = null;
    let hoveredPointId = null;
    let currentDataType = 'settlement';  // 'settlement' or 'temperature'
    let isOriginalViewMode = true;  // Only enable interaction in original view mode
    let raycaster, mouse;
    let popupElement = null;
    let pointDataCache = new Map();

    // Performance optimization state
    let rafId = null;
    let pendingMouseEvent = null;
    let lastRaycastTime = 0;
    const RAYCAST_THROTTLE_MS = 16; // ~60fps

    // =========================================================
    // Offset Mapping Functions (Requirement 1 & 5)
    // =========================================================

    /**
     * Calculate 3D position for a monitoring point based on its ID
     * Uses linear interpolation based on known points S1-S4
     * For points beyond S4, extrapolates using the established pattern
     */
    function calculatePointPosition(pointId) {
        // Extract the numeric part from point ID (e.g., 'S19' -> 19)
        const match = pointId.match(/[A-Za-z]*(\d+)/);
        if (!match) return null;
        const pointNum = parseInt(match[1], 10);

        // Get known calibration data
        const knownKeys = Object.keys(CONFIG.KNOWN_POINTS);
        const knownData = knownKeys.map(k => ({
            id: k,
            num: parseInt(k.replace(/\D/g, ''), 10),
            ...CONFIG.KNOWN_POINTS[k]
        })).sort((a, b) => a.num - b.num);

        // If this is a known point, return its calibrated position
        if (CONFIG.KNOWN_POINTS[pointId]) {
            return CONFIG.KNOWN_POINTS[pointId];
        }

        // For points beyond the known range, extrapolate
        if (pointNum > knownData[knownData.length - 1].num) {
            return extrapolatePosition(pointNum, knownData);
        }

        // For points within the known range, interpolate
        return interpolatePosition(pointNum, knownData);
    }

    /**
     * Linear interpolation between known points
     */
    function interpolatePosition(targetNum, knownData) {
        // Find the two nearest known points
        let lower = knownData[0];
        let upper = knownData[knownData.length - 1];

        for (let i = 0; i < knownData.length - 1; i++) {
            if (knownData[i].num <= targetNum && knownData[i + 1].num >= targetNum) {
                lower = knownData[i];
                upper = knownData[i + 1];
                break;
            }
        }

        // Calculate interpolation factor
        const range = upper.num - lower.num;
        const t = range > 0 ? (targetNum - lower.num) / range : 0;

        // Interpolate position
        const position = [
            lower.position[0] + t * (upper.position[0] - lower.position[0]),
            lower.position[1] + t * (upper.position[1] - lower.position[1]),
            lower.position[2] + t * (upper.position[2] - lower.position[2])
        ];

        // Interpolate target
        const target = [
            lower.target[0] + t * (upper.target[0] - lower.target[0]),
            lower.target[1] + t * (upper.target[1] - lower.target[1]),
            lower.target[2] + t * (upper.target[2] - lower.target[2])
        ];

        // Estimate meter position
        const meter = lower.meter + t * (upper.meter - lower.meter);

        return { position, target, meter };
    }

    /**
     * Extrapolate position for points beyond known range
     * Uses the average delta from known points to project forward
     */
    function extrapolatePosition(targetNum, knownData) {
        if (knownData.length < 2) {
            // Fallback if insufficient data
            return {
                position: [0, 0, -targetNum * 0.5],
                target: [0, 0, -targetNum * 0.5 - 1],
                meter: targetNum * 5
            };
        }

        // Calculate average delta per point number
        const lastTwo = knownData.slice(-2);
        const delta = lastTwo[1].num - lastTwo[0].num;

        const deltaPos = [
            (lastTwo[1].position[0] - lastTwo[0].position[0]) / delta,
            (lastTwo[1].position[1] - lastTwo[0].position[1]) / delta,
            (lastTwo[1].position[2] - lastTwo[0].position[2]) / delta
        ];

        const deltaTgt = [
            (lastTwo[1].target[0] - lastTwo[0].target[0]) / delta,
            (lastTwo[1].target[1] - lastTwo[0].target[1]) / delta,
            (lastTwo[1].target[2] - lastTwo[0].target[2]) / delta
        ];

        const deltaMeter = (lastTwo[1].meter - lastTwo[0].meter) / delta;

        // Project from the last known point
        const last = lastTwo[1];
        const steps = targetNum - last.num;

        return {
            position: [
                last.position[0] + steps * deltaPos[0],
                last.position[1] + steps * deltaPos[1],
                last.position[2] + steps * deltaPos[2]
            ],
            target: [
                last.target[0] + steps * deltaTgt[0],
                last.target[1] + steps * deltaTgt[1],
                last.target[2] + steps * deltaTgt[2]
            ],
            meter: last.meter + steps * deltaMeter
        };
    }

    // =========================================================
    // Scene Initialization
    // =========================================================

    function init() {
        const canvas = document.getElementById('viewer-canvas');
        const indicator = document.getElementById('loading-indicator');

        if (!canvas) {
            console.error('[three_viewer_enhanced] Canvas element not found');
            return false;
        }

        try {
            // Create scene
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x0a1628);

            // Get container dimensions
            const container = canvas.parentElement;
            const w = container ? container.clientWidth : window.innerWidth;
            const h = container ? container.clientHeight : window.innerHeight;

            // Create camera
            camera = new THREE.PerspectiveCamera(60, w / h, 0.01, 500000);
            camera.position.set(0, 2, 10);

            // Create renderer
            renderer = new THREE.WebGLRenderer({
                canvas: canvas,
                antialias: true,
                alpha: false
            });
            renderer.setSize(w, h);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

            // Create controls
            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.08;
            controls.minDistance = 0.1;
            controls.maxDistance = 100000;

            // Add lighting
            const ambient = new THREE.AmbientLight(0xffffff, 0.5);
            scene.add(ambient);

            const directional = new THREE.DirectionalLight(0xffffff, 0.8);
            directional.position.set(10000, 20000, 10000);
            scene.add(directional);

            // Add grid helper
            const grid = new THREE.GridHelper(50000, 50, 0x00f2ff, 0x444444);
            grid.material.opacity = 0.15;
            grid.material.transparent = true;
            scene.add(grid);

            // Add axes helper
            const axes = new THREE.AxesHelper(5000);
            scene.add(axes);

            // Initialize raycaster for mouse interaction
            raycaster = new THREE.Raycaster();
            mouse = new THREE.Vector2();

            // Set up event listeners
            setupEventListeners(canvas);

            // Create popup element
            createPopupElement();

            // Start animation loop
            animate();

            // Load default model
            if (indicator) {
                indicator.style.display = 'block';
                indicator.innerHTML = 'Loading model...';
            }

            loadModel('glb/004-051.glb', function() {
                if (indicator) indicator.style.display = 'none';
                // Load monitoring points after model is loaded
                loadMonitoringPoints();
            });

            // Handle window resize
            window.addEventListener('resize', onResize);

            initialized = true;
            console.log('[three_viewer_enhanced] Initialization complete');

            // Dispatch ready event
            document.dispatchEvent(new Event('threeViewerReady'));

            return true;
        } catch (e) {
            console.error('[three_viewer_enhanced] Initialization failed:', e);
            if (indicator) {
                indicator.innerHTML = '3D initialization failed';
                indicator.style.display = 'block';
            }
            return false;
        }
    }

    // =========================================================
    // Model Loading
    // =========================================================

    function loadModel(path, onComplete) {
        const loader = new THREE.GLTFLoader();
        loader.load(
            path,
            function(gltf) {
                scene.add(gltf.scene);
                console.log('[three_viewer_enhanced] Model loaded:', path);
                if (onComplete) onComplete(gltf);
            },
            function(progress) {
                // Progress callback
                if (progress.lengthComputable) {
                    const pct = Math.round((progress.loaded / progress.total) * 100);
                    const indicator = document.getElementById('loading-indicator');
                    if (indicator) {
                        indicator.innerHTML = 'Loading... ' + pct + '%';
                    }
                }
            },
            function(error) {
                console.error('[three_viewer_enhanced] Model load error:', error);
            }
        );
    }

    // =========================================================
    // Monitoring Points
    // =========================================================

    function loadMonitoringPoints() {
        // Fetch monitoring points from API based on current data type
        const apiUrl = currentDataType === 'temperature'
            ? '/api/temperature/points'
            : '/api/points';

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                // Handle different API response formats
                const points = data.data || data;
                if (Array.isArray(points)) {
                    monitoringPoints = points;
                    createPointMarkers();
                }
            })
            .catch(error => {
                console.error('[three_viewer_enhanced] Failed to load monitoring points:', error);
            });
    }

    function createPointMarkers() {
        // Remove existing markers
        pointMarkers.forEach((marker, id) => {
            scene.remove(marker);
        });
        pointMarkers.clear();

        // Create a marker for each monitoring point
        monitoringPoints.forEach(point => {
            const pointId = point.point_id || point.sensor_id;
            if (!pointId) return;

            const posData = calculatePointPosition(pointId);
            if (!posData) return;

            // Create sphere marker
            const geometry = new THREE.SphereGeometry(CONFIG.MARKER.radius, 16, 16);
            const material = new THREE.MeshStandardMaterial({
                color: CONFIG.MARKER.color,
                emissive: CONFIG.MARKER.emissive,
                emissiveIntensity: CONFIG.MARKER.emissiveIntensity,
                metalness: 0.5,
                roughness: 0.5
            });

            const marker = new THREE.Mesh(geometry, material);
            marker.position.set(...posData.position);
            marker.userData = {
                pointId: pointId,
                pointData: point,
                posData: posData
            };

            scene.add(marker);
            pointMarkers.set(pointId, marker);
        });

        console.log('[three_viewer_enhanced] Created', pointMarkers.size, 'point markers');
    }

    // =========================================================
    // Event Handlers (Performance Optimized)
    // =========================================================

    function setupEventListeners(canvas) {
        // Mouse move for hover detection - use pointermove for better performance
        canvas.addEventListener('pointermove', onPointerMove, { passive: true });

        // Click for selection
        canvas.addEventListener('click', onClick, false);

        // Double click for data type switch (Requirement 2)
        canvas.addEventListener('dblclick', onDoubleClick, false);

        // Mouse leave to hide popup
        canvas.addEventListener('pointerleave', onPointerLeave, false);
    }

    /**
     * Pointer move handler with requestAnimationFrame throttling
     * Requirement 5: Performance optimization
     */
    function onPointerMove(event) {
        if (!isOriginalViewMode) return;

        // Store the pending event for RAF processing
        pendingMouseEvent = event;

        // Only schedule a new RAF if one isn't already pending
        if (!rafId) {
            rafId = requestAnimationFrame(processMouseMove);
        }
    }

    /**
     * Process mouse move in animation frame for smooth performance
     */
    function processMouseMove() {
        rafId = null;

        if (!pendingMouseEvent || !isOriginalViewMode) return;

        const event = pendingMouseEvent;
        pendingMouseEvent = null;

        // Additional throttle check
        const now = performance.now();
        if (now - lastRaycastTime < RAYCAST_THROTTLE_MS) {
            // Schedule next check
            if (pendingMouseEvent) {
                rafId = requestAnimationFrame(processMouseMove);
            }
            return;
        }
        lastRaycastTime = now;

        performRaycast(event);
    }

    /**
     * Perform the actual raycast detection
     * Requirement 1: Raycast detection for GLB monitoring points
     */
    function performRaycast(event) {
        if (!renderer || !camera || !raycaster) return;

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Check for intersections with point markers
        raycaster.setFromCamera(mouse, camera);
        const markers = Array.from(pointMarkers.values());
        const intersects = raycaster.intersectObjects(markers, false);

        if (intersects.length > 0) {
            const intersectedMarker = intersects[0].object;
            const pointId = intersectedMarker.userData.pointId;

            if (hoveredPointId !== pointId) {
                // Reset previous hover
                if (hoveredPointId && pointMarkers.has(hoveredPointId)) {
                    const prevMarker = pointMarkers.get(hoveredPointId);
                    if (hoveredPointId !== selectedPointId) {
                        prevMarker.material.color.setHex(CONFIG.MARKER.color);
                        prevMarker.material.emissiveIntensity = CONFIG.MARKER.emissiveIntensity;
                    }
                }

                // Set new hover
                hoveredPointId = pointId;
                if (pointId !== selectedPointId) {
                    intersectedMarker.material.color.setHex(CONFIG.MARKER.hoverColor);
                    intersectedMarker.material.emissiveIntensity = 0.6;
                }

                // Show popup with data (Requirement 2 & 3)
                showPopup(event, intersectedMarker.userData);

                // Fetch detailed data if not cached
                fetchPointDetails(pointId);
            } else {
                // Update popup position only
                updatePopupPosition(event);
            }

            renderer.domElement.style.cursor = 'pointer';
        } else {
            // No intersection - reset state
            resetHoverState();
        }
    }

    /**
     * Reset hover state when not hovering any point
     */
    function resetHoverState() {
        if (hoveredPointId && pointMarkers.has(hoveredPointId)) {
            const prevMarker = pointMarkers.get(hoveredPointId);
            if (hoveredPointId !== selectedPointId) {
                prevMarker.material.color.setHex(CONFIG.MARKER.color);
                prevMarker.material.emissiveIntensity = CONFIG.MARKER.emissiveIntensity;
            }
        }
        hoveredPointId = null;
        hidePopup();
        if (renderer) {
            renderer.domElement.style.cursor = 'default';
        }
    }

    /**
     * Handle pointer leave event
     */
    function onPointerLeave(event) {
        resetHoverState();
    }

    /**
     * Fetch detailed point data for popup
     * Requirement 3: Data filling
     */
    function fetchPointDetails(pointId) {
        // Check cache first
        if (pointDataCache.has(pointId)) {
            return;
        }

        // Determine API endpoint based on data type
        const apiUrl = currentDataType === 'temperature'
            ? '/api/temperature/data/' + pointId
            : '/api/point/' + pointId;

        fetch(apiUrl)
            .then(function(response) { return response.json(); })
            .then(function(data) {
                const detailData = data.data || data;
                pointDataCache.set(pointId, detailData);

                // Update popup if still hovering this point
                if (hoveredPointId === pointId && popupElement) {
                    const marker = pointMarkers.get(pointId);
                    if (marker) {
                        updatePopupContent(pointId, marker.userData.pointData, detailData);
                    }
                }
            })
            .catch(function(err) {
                console.warn('[three_viewer_enhanced] Failed to fetch point details:', err);
            });
    }

    function onClick(event) {
        if (!isOriginalViewMode) return;  // Requirement 4

        if (hoveredPointId) {
            selectPoint(hoveredPointId);
        }
    }

    function onDoubleClick(event) {
        if (!isOriginalViewMode) return;  // Requirement 4

        // Toggle data type (Requirement 2)
        if (hoveredPointId) {
            switchDataType();
        }
    }

    // =========================================================
    // Point Selection and Data Type Switching
    // =========================================================

    function selectPoint(pointId) {
        // Reset previous selection
        if (selectedPointId && pointMarkers.has(selectedPointId)) {
            const prevMarker = pointMarkers.get(selectedPointId);
            prevMarker.material.color.setHex(CONFIG.MARKER.color);
        }

        // Set new selection
        selectedPointId = pointId;
        if (pointMarkers.has(pointId)) {
            const marker = pointMarkers.get(pointId);
            marker.material.color.setHex(CONFIG.MARKER.selectedColor);

            // Move camera to viewpoint
            const posData = marker.userData.posData;
            if (posData) {
                animateCameraTo(posData.position, posData.target);
            }
        }

        // Notify charts.js
        if (typeof window.loadPointData === 'function') {
            window.loadPointData(pointId);
        }

        // Update point selector dropdown
        const selector = document.getElementById('point-selector');
        if (selector) {
            selector.value = pointId;
        }

        console.log('[three_viewer_enhanced] Selected point:', pointId);
    }

    function switchDataType() {
        // Toggle between settlement and temperature (Requirement 2)
        currentDataType = currentDataType === 'settlement' ? 'temperature' : 'settlement';
        console.log('[three_viewer_enhanced] Switched data type to:', currentDataType);

        // Reload monitoring points for new data type
        loadMonitoringPoints();

        // Update popup if visible
        if (hoveredPointId && popupElement) {
            const marker = pointMarkers.get(hoveredPointId);
            if (marker) {
                showPopup(null, marker.userData, true);
            }
        }

        // Show notification
        showNotification('Data type switched to ' + (currentDataType === 'settlement' ? 'Settlement' : 'Temperature'));
    }

    // =========================================================
    // Popup / Tooltip (Requirements 2, 3, 4)
    // =========================================================

    /**
     * Create the floating popup element
     * Requirement 2: Floating HTML card that tracks mouse position
     * Requirement 4: Correct z-index above 3D canvas, pointer-events: none
     */
    function createPopupElement() {
        if (popupElement) return;

        popupElement = document.createElement('div');
        popupElement.id = 'point-popup';
        popupElement.className = 'three-viewer-tooltip';

        // Requirement 4: z-index 9999 ensures it's above the canvas
        // pointer-events: none prevents blocking mouse triggers
        popupElement.style.cssText = [
            'position: fixed',
            'z-index: 9999',
            'padding: 14px 16px',
            'background: linear-gradient(135deg, rgba(10, 22, 40, 0.98) 0%, rgba(15, 35, 60, 0.95) 100%)',
            'border: 1px solid ' + CONFIG.POPUP.borderColor,
            'border-left: 3px solid ' + CONFIG.POPUP.borderColor,
            'border-radius: 8px',
            'color: ' + CONFIG.POPUP.textColor,
            'font-size: 13px',
            'font-family: Rajdhani, "Microsoft YaHei", sans-serif',
            'pointer-events: none',
            'display: none',
            'min-width: 180px',
            'max-width: 260px',
            'box-shadow: 0 8px 32px rgba(0, 229, 255, 0.25), 0 0 0 1px rgba(0, 229, 255, 0.1)',
            'backdrop-filter: blur(8px)',
            'transition: opacity 0.15s ease, transform 0.15s ease',
            'opacity: 0',
            'transform: translateY(5px)'
        ].join(';');

        // Add CSS animation keyframes if not already present
        if (!document.getElementById('tooltip-styles')) {
            const style = document.createElement('style');
            style.id = 'tooltip-styles';
            style.textContent = [
                '.three-viewer-tooltip.visible {',
                '  opacity: 1 !important;',
                '  transform: translateY(0) !important;',
                '}',
                '.tooltip-header {',
                '  display: flex;',
                '  align-items: center;',
                '  margin-bottom: 10px;',
                '  padding-bottom: 8px;',
                '  border-bottom: 1px solid rgba(0, 229, 255, 0.2);',
                '}',
                '.tooltip-id {',
                '  font-weight: 700;',
                '  font-size: 18px;',
                '  color: #00e5ff;',
                '  text-shadow: 0 0 10px rgba(0, 229, 255, 0.5);',
                '}',
                '.tooltip-type-badge {',
                '  margin-left: auto;',
                '  padding: 2px 8px;',
                '  border-radius: 4px;',
                '  font-size: 11px;',
                '  font-weight: 600;',
                '  text-transform: uppercase;',
                '}',
                '.tooltip-type-settlement {',
                '  background: rgba(0, 230, 118, 0.2);',
                '  color: #00e676;',
                '  border: 1px solid rgba(0, 230, 118, 0.4);',
                '}',
                '.tooltip-type-temperature {',
                '  background: rgba(255, 158, 13, 0.2);',
                '  color: #ff9e0d;',
                '  border: 1px solid rgba(255, 158, 13, 0.4);',
                '}',
                '.tooltip-row {',
                '  display: flex;',
                '  justify-content: space-between;',
                '  margin-bottom: 6px;',
                '  font-size: 12px;',
                '}',
                '.tooltip-label {',
                '  color: #90a4ae;',
                '}',
                '.tooltip-value {',
                '  font-weight: 600;',
                '  color: #e0f7fa;',
                '}',
                '.tooltip-value.positive {',
                '  color: #00e676;',
                '}',
                '.tooltip-value.negative {',
                '  color: #ff3e5f;',
                '}',
                '.tooltip-value.warning {',
                '  color: #ff9e0d;',
                '}',
                '.tooltip-alert {',
                '  margin-top: 8px;',
                '  padding: 6px 10px;',
                '  border-radius: 4px;',
                '  font-size: 12px;',
                '  font-weight: 600;',
                '  text-align: center;',
                '}',
                '.tooltip-alert.normal {',
                '  background: rgba(0, 230, 118, 0.15);',
                '  color: #00e676;',
                '  border: 1px solid rgba(0, 230, 118, 0.3);',
                '}',
                '.tooltip-alert.caution {',
                '  background: rgba(255, 158, 13, 0.15);',
                '  color: #ff9e0d;',
                '  border: 1px solid rgba(255, 158, 13, 0.3);',
                '}',
                '.tooltip-alert.warning {',
                '  background: rgba(255, 62, 95, 0.15);',
                '  color: #ff3e5f;',
                '  border: 1px solid rgba(255, 62, 95, 0.3);',
                '}',
                '.tooltip-footer {',
                '  margin-top: 10px;',
                '  padding-top: 8px;',
                '  border-top: 1px solid rgba(0, 229, 255, 0.1);',
                '  font-size: 10px;',
                '  color: #607d8b;',
                '  text-align: center;',
                '}'
            ].join('\n');
            document.head.appendChild(style);
        }

        document.body.appendChild(popupElement);
    }

    /**
     * Show popup with initial data
     * Requirement 3: Display point ID, current value, alert status
     */
    function showPopup(event, userData, forceRefresh) {
        if (!popupElement || !isOriginalViewMode) return;

        const pointId = userData.pointId;
        const pointData = userData.pointData;
        const cachedData = pointDataCache.get(pointId);

        // Build popup content
        updatePopupContent(pointId, pointData, cachedData);

        popupElement.style.display = 'block';

        if (event) {
            updatePopupPosition(event);
        }

        // Trigger animation
        requestAnimationFrame(function() {
            popupElement.classList.add('visible');
        });
    }

    /**
     * Update popup content with detailed data
     * Requirement 3: Data filling - point ID, current value, alert status
     */
    function updatePopupContent(pointId, pointData, detailData) {
        if (!popupElement) return;

        const isSettlement = currentDataType === 'settlement';
        const typeClass = isSettlement ? 'tooltip-type-settlement' : 'tooltip-type-temperature';
        const typeLabel = isSettlement ? 'Settlement' : 'Temp';

        let html = '';

        // Header with ID and type badge
        html += '<div class="tooltip-header">';
        html += '<span class="tooltip-id">' + pointId + '</span>';
        html += '<span class="tooltip-type-badge ' + typeClass + '">' + typeLabel + '</span>';
        html += '</div>';

        if (isSettlement) {
            // Settlement data display
            let currentValue = '--';
            let changeRate = '--';
            let alertLevel = 'Normal';
            let trendType = '--';

            if (detailData) {
                if (detailData.analysisData) {
                    currentValue = typeof detailData.analysisData.current_value === 'number'
                        ? detailData.analysisData.current_value.toFixed(2) + ' mm'
                        : '--';
                    changeRate = typeof detailData.analysisData.change_rate === 'number'
                        ? detailData.analysisData.change_rate.toFixed(3) + ' mm/d'
                        : '--';
                    alertLevel = detailData.analysisData.alert_level || 'Normal';
                    trendType = detailData.analysisData.trend_type || '--';
                } else if (detailData.current_value !== undefined) {
                    currentValue = detailData.current_value.toFixed(2) + ' mm';
                    changeRate = detailData.change_rate ? detailData.change_rate.toFixed(3) + ' mm/d' : '--';
                    alertLevel = detailData.alert_level || 'Normal';
                    trendType = detailData.trend_type || '--';
                }
            } else if (pointData) {
                currentValue = pointData.current_value !== undefined
                    ? pointData.current_value.toFixed(2) + ' mm'
                    : '--';
                alertLevel = pointData.alert_level || 'Normal';
                trendType = pointData.trend_type || '--';
            }

            // Determine value class based on sign
            let valueClass = '';
            if (currentValue !== '--') {
                const numVal = parseFloat(currentValue);
                valueClass = numVal > 0 ? 'positive' : (numVal < 0 ? 'negative' : '');
            }

            html += '<div class="tooltip-row">';
            html += '<span class="tooltip-label">Current Value</span>';
            html += '<span class="tooltip-value ' + valueClass + '">' + currentValue + '</span>';
            html += '</div>';

            html += '<div class="tooltip-row">';
            html += '<span class="tooltip-label">Change Rate</span>';
            html += '<span class="tooltip-value">' + changeRate + '</span>';
            html += '</div>';

            html += '<div class="tooltip-row">';
            html += '<span class="tooltip-label">Trend</span>';
            html += '<span class="tooltip-value">' + trendType + '</span>';
            html += '</div>';

            // Alert status
            let alertClass = alertLevel === 'Warning' ? 'warning' :
                             alertLevel === 'Caution' ? 'caution' : 'normal';
            let alertText = alertLevel === 'Warning' ? 'Warning' :
                            alertLevel === 'Caution' ? 'Caution' : 'Normal';
            let alertIcon = alertLevel === 'Warning' ? '!' :
                            alertLevel === 'Caution' ? '!' : '';

            html += '<div class="tooltip-alert ' + alertClass + '">';
            if (alertIcon) html += alertIcon + ' ';
            html += alertText;
            html += '</div>';

        } else {
            // Temperature data display
            let avgTemp = '--';
            let minTemp = '--';
            let maxTemp = '--';
            let trendType = '--';

            if (detailData) {
                // Handle array of temperature readings
                if (Array.isArray(detailData) && detailData.length > 0) {
                    const temps = detailData.map(function(d) { return d.temperature || d.temp_value; }).filter(function(t) { return typeof t === 'number'; });
                    if (temps.length > 0) {
                        avgTemp = (temps.reduce(function(a, b) { return a + b; }, 0) / temps.length).toFixed(1) + ' C';
                        minTemp = Math.min.apply(null, temps).toFixed(1) + ' C';
                        maxTemp = Math.max.apply(null, temps).toFixed(1) + ' C';
                    }
                } else if (typeof detailData.avg_temp === 'number') {
                    avgTemp = detailData.avg_temp.toFixed(1) + ' C';
                    minTemp = detailData.min_temp ? detailData.min_temp.toFixed(1) + ' C' : '--';
                    maxTemp = detailData.max_temp ? detailData.max_temp.toFixed(1) + ' C' : '--';
                    trendType = detailData.trend_type || '--';
                }
            } else if (pointData) {
                avgTemp = pointData.avg_temp !== undefined ? pointData.avg_temp.toFixed(1) + ' C' : '--';
                trendType = pointData.trend_type || '--';
            }

            html += '<div class="tooltip-row">';
            html += '<span class="tooltip-label">Average Temp</span>';
            html += '<span class="tooltip-value">' + avgTemp + '</span>';
            html += '</div>';

            html += '<div class="tooltip-row">';
            html += '<span class="tooltip-label">Min / Max</span>';
            html += '<span class="tooltip-value">' + minTemp + ' / ' + maxTemp + '</span>';
            html += '</div>';

            html += '<div class="tooltip-row">';
            html += '<span class="tooltip-label">Trend</span>';
            html += '<span class="tooltip-value">' + trendType + '</span>';
            html += '</div>';

            // Temperature status based on thresholds
            let statusClass = 'normal';
            let statusText = 'Normal';
            if (avgTemp !== '--') {
                const tempVal = parseFloat(avgTemp);
                if (tempVal > 35 || tempVal < 5) {
                    statusClass = 'warning';
                    statusText = 'Abnormal';
                } else if (tempVal > 30 || tempVal < 10) {
                    statusClass = 'caution';
                    statusText = 'Caution';
                }
            }

            html += '<div class="tooltip-alert ' + statusClass + '">' + statusText + '</div>';
        }

        // Footer hint
        html += '<div class="tooltip-footer">Click to select | Double-click to switch type</div>';

        popupElement.innerHTML = html;
    }

    /**
     * Update popup position to follow mouse
     * Requirement 2: Real-time tracking of mouse position
     */
    function updatePopupPosition(event) {
        if (!popupElement) return;

        // Calculate position with offset
        let x = event.clientX + 18;
        let y = event.clientY + 18;

        // Get popup dimensions after content is set
        const popupRect = popupElement.getBoundingClientRect();
        const popupWidth = popupRect.width || 200;
        const popupHeight = popupRect.height || 150;

        // Keep popup within viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Adjust horizontal position
        if (x + popupWidth > viewportWidth - 20) {
            x = event.clientX - popupWidth - 18;
        }

        // Adjust vertical position
        if (y + popupHeight > viewportHeight - 20) {
            y = event.clientY - popupHeight - 18;
        }

        // Ensure minimum bounds
        x = Math.max(10, x);
        y = Math.max(10, y);

        popupElement.style.left = x + 'px';
        popupElement.style.top = y + 'px';
    }

    /**
     * Hide the popup
     */
    function hidePopup() {
        if (popupElement) {
            popupElement.classList.remove('visible');
            // Delay hiding to allow fade animation
            setTimeout(function() {
                if (!popupElement.classList.contains('visible')) {
                    popupElement.style.display = 'none';
                }
            }, 150);
        }
    }

    // =========================================================
    // Camera Animation
    // =========================================================

    function animateCameraTo(position, target, duration) {
        duration = duration || 1000;

        const startPos = camera.position.clone();
        const startTarget = controls.target.clone();
        const endPos = new THREE.Vector3(...position);
        const endTarget = new THREE.Vector3(...target);

        const startTime = Date.now();

        function update() {
            const elapsed = Date.now() - startTime;
            const t = Math.min(elapsed / duration, 1);

            // Ease in-out cubic
            const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

            camera.position.lerpVectors(startPos, endPos, eased);
            controls.target.lerpVectors(startTarget, endTarget, eased);
            controls.update();

            if (t < 1) {
                requestAnimationFrame(update);
            }
        }

        update();
    }

    // =========================================================
    // Animation Loop
    // =========================================================

    function animate() {
        requestAnimationFrame(animate);

        if (controls) {
            controls.update();
        }

        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    }

    // =========================================================
    // Utility Functions
    // =========================================================

    function onResize() {
        if (!renderer || !camera) return;

        const container = renderer.domElement.parentElement;
        const w = container ? container.clientWidth : window.innerWidth;
        const h = container ? container.clientHeight : window.innerHeight;

        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }

    function showNotification(message) {
        // Use existing notification system if available
        if (typeof window.showNotification === 'function') {
            window.showNotification(message);
            return;
        }

        // Create temporary notification
        const notif = document.createElement('div');
        notif.style.cssText = [
            'position: fixed',
            'top: 20px',
            'right: 20px',
            'padding: 12px 20px',
            'background: rgba(0, 229, 255, 0.9)',
            'color: #0a1628',
            'border-radius: 6px',
            'font-weight: 600',
            'z-index: 10000',
            'animation: fadeInOut 2s ease'
        ].join(';');
        notif.textContent = message;
        document.body.appendChild(notif);

        setTimeout(function() {
            notif.remove();
        }, 2000);
    }

    // =========================================================
    // Mode Control (Requirement 4)
    // =========================================================

    /**
     * Set the view mode. Interaction is only enabled in original view mode.
     */
    function setViewMode(isOriginal) {
        isOriginalViewMode = isOriginal;

        if (!isOriginal) {
            // Hide popup and reset hover state
            hidePopup();
            if (hoveredPointId && pointMarkers.has(hoveredPointId)) {
                const marker = pointMarkers.get(hoveredPointId);
                if (hoveredPointId !== selectedPointId) {
                    marker.material.color.setHex(CONFIG.MARKER.color);
                }
            }
            hoveredPointId = null;
            renderer.domElement.style.cursor = 'default';
        }

        console.log('[three_viewer_enhanced] View mode set to:', isOriginal ? 'original' : 'card');
    }

    // =========================================================
    // Public API
    // =========================================================

    window.goToViewpoint = function(pointId) {
        if (!initialized || !camera) return;

        if (pointId === 'Default' || !pointId) {
            // Return to default view
            animateCameraTo([0, 2, 10], [0, 0, 0]);
            return;
        }

        const posData = calculatePointPosition(pointId);
        if (posData) {
            animateCameraTo(posData.position, posData.target);
            selectPoint(pointId);
        } else {
            console.warn('[three_viewer_enhanced] Unknown point:', pointId);
        }
    };

    window.setThreeViewerMode = function(isOriginal) {
        setViewMode(isOriginal);
    };

    window.switchThreeViewerDataType = function() {
        switchDataType();
    };

    window.refreshThreeViewerPoints = function() {
        loadMonitoringPoints();
    };

    // =========================================================
    // Auto-Calibration (Requirement 5)
    // =========================================================

    /**
     * Save current camera position as calibration point for a monitoring point
     */
    window.calibratePoint = function(pointId) {
        if (!camera || !controls) return;

        const pos = [camera.position.x, camera.position.y, camera.position.z];
        const target = [controls.target.x, controls.target.y, controls.target.z];

        // Add to known points config
        CONFIG.KNOWN_POINTS[pointId] = {
            position: pos,
            target: target,
            meter: 0  // User should provide this
        };

        // Optionally save to backend
        fetch('/api/viewpoints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                point_id: pointId,
                position: pos,
                target: target
            })
        }).then(function(resp) {
            console.log('[three_viewer_enhanced] Calibration saved for:', pointId);
        }).catch(function(err) {
            console.error('[three_viewer_enhanced] Failed to save calibration:', err);
        });

        // Recreate markers with updated positions
        createPointMarkers();

        return { position: pos, target: target };
    };

    /**
     * Load saved calibration points from backend
     */
    function loadCalibrationData() {
        fetch('/api/viewpoints')
            .then(function(resp) { return resp.json(); })
            .then(function(data) {
                if (data.success && data.data) {
                    Object.keys(data.data).forEach(function(pointId) {
                        const vp = data.data[pointId];
                        CONFIG.KNOWN_POINTS[pointId] = {
                            position: vp.position,
                            target: vp.target,
                            meter: 0
                        };
                    });
                    console.log('[three_viewer_enhanced] Loaded', Object.keys(data.data).length, 'calibration points');
                    // Recreate markers with loaded calibration
                    if (monitoringPoints.length > 0) {
                        createPointMarkers();
                    }
                }
            })
            .catch(function(err) {
                console.warn('[three_viewer_enhanced] No calibration data found:', err);
            });
    }

    // =========================================================
    // Initialization
    // =========================================================

    window.addEventListener('load', function() {
        if (typeof THREE === 'undefined') {
            console.error('[three_viewer_enhanced] THREE.js not loaded');
            return;
        }

        if (!THREE.OrbitControls || !THREE.GLTFLoader) {
            console.error('[three_viewer_enhanced] Required THREE.js extensions not loaded');
            return;
        }

        if (init()) {
            // Load calibration data after initialization
            loadCalibrationData();
        }
    });

})();
