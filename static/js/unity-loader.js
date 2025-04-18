// Unity加载器
let unityInstance = null;
let unityGameObjectName = "";  // 存储有效的游戏对象名称

function loadUnityGame() {
    console.log("开始加载Unity WebGL应用...");
    const buildUrl = "Build";  // WebGL构建输出的文件夹名称
    const loaderUrl = buildUrl + "/static.loader.js";
    const config = {
        dataUrl: buildUrl + "/static.data",
        frameworkUrl: buildUrl + "/static.framework.js",
        codeUrl: buildUrl + "/static.wasm",
        streamingAssetsUrl: "StreamingAssets",
        companyName: "YourCompany",
        productName: "SettlementMonitoring",
        productVersion: "1.0",
    };

    // 显示加载进度条
    const loadingBar = document.querySelector("#unity-loading-bar");
    const progressBar = document.querySelector("#unity-progress-bar");
    if (loadingBar && progressBar) {
        loadingBar.style.display = "block";
    }

    // 创建脚本元素加载Unity加载器
    const script = document.createElement("script");
    script.src = loaderUrl;
    script.onload = () => {
        console.log("Unity加载器脚本已加载，正在创建Unity实例...");
        
        // 检查是否存在createUnityInstance函数
        if (typeof createUnityInstance !== 'function') {
            console.error("错误: createUnityInstance函数未找到");
            showUnityNotification("Unity加载错误: 找不到必要的函数", "error");
            return;
        }
        
        // 获取canvas元素
        const canvas = document.querySelector("#unity-canvas");
        if (!canvas) {
            console.error("错误: 找不到Unity canvas元素");
            return;
        }
        
        // 加载完成后创建Unity实例
        createUnityInstance(canvas, config, (progress) => {
            if (progressBar) {
                progressBar.style.width = 100 * progress + "%";
            }
            console.log(`Unity加载进度: ${Math.round(progress * 100)}%`);
        }).then((instance) => {
            // Unity加载完成
            unityInstance = instance;
            if (loadingBar) {
                loadingBar.style.display = "none";
            }

            console.log("Unity实例加载完成，尝试自动检测游戏对象...");
            window.unityInstance = instance;
            
            // 尝试自动检测游戏对象名称
            detectUnityGameObject().then(objectName => {
                if (objectName) {
                    unityGameObjectName = objectName;
                    console.log(`找到有效的Unity游戏对象: ${unityGameObjectName}`);
                    
                    // 延迟设置按钮和事件
                    setTimeout(() => {
                        setupControlButtons();
                        initPointSelectorUnityIntegration();
                        showUnityNotification("Unity场景加载完成！", "success");
                    }, 1000);
                } else {
                    console.error("无法自动检测Unity游戏对象，尝试使用备选名称...");
                    // 使用备选名称
                    tryBackupGameObjectNames();
                }
            });

        }).catch((message) => {
            console.error('Unity加载失败:', message);
            showUnityNotification("Unity加载失败: " + message, "error");
        });
    };

    script.onerror = () => {
        console.error('Unity加载器脚本加载失败');
        showUnityNotification("Unity加载器脚本加载失败", "error");
    };

    document.body.appendChild(script);
}

// 尝试检测Unity中可用的游戏对象
async function detectUnityGameObject() {
    if (!unityInstance) return null;
    
    // 可能的游戏对象名称列表
    const possibleNames = [
        '9-10Ground',
        'Model',
        'Main',
        'ModelManager',
        'GameObject'
    ];
    
    // 我们无法直接列出所有游戏对象，但可以尝试向它们发送无害的消息
    for (const name of possibleNames) {
        try {
            console.log(`尝试向 ${name} 发送测试消息...`);
            // 发送一个空的ResetView消息 - 这应该是无害的
            unityInstance.SendMessage(name, 'ResetView');
            console.log(`${name} 似乎是一个有效的游戏对象`);
            return name;
        } catch (e) {
            console.log(`${name} 不是一个有效的游戏对象: ${e.message}`);
        }
    }
    
    return null;
}

// 尝试备选游戏对象名称
function tryBackupGameObjectNames() {
    const backupNames = ['9-10Ground', 'Model', 'Main', 'GameObject'];
    console.log("尝试使用备选游戏对象名称...");
    
    // 尝试每个备选名称
    for (const name of backupNames) {
        unityGameObjectName = name;
        console.log(`尝试使用备选名称: ${name}`);
        
        // 设置按钮和事件
        setupControlButtons();
        initPointSelectorUnityIntegration();
        
        // 给一个通知
        showUnityNotification(`Unity已加载，使用备选对象名"${name}"`, "warning");
        break;  // 只使用第一个备选名称
    }
}

// 设置控制按钮
function setupControlButtons() {
    try {
        console.log("开始设置控制按钮...");
        
        if (!unityGameObjectName) {
            console.warn("未找到有效的Unity游戏对象名称，使用默认值'9-10Ground'");
            unityGameObjectName = '9-10Ground';
        }
        
        // 设置旋转按钮事件
        const rotateLeftBtn = document.getElementById('rotate-left');
        if (rotateLeftBtn) {
            rotateLeftBtn.addEventListener('click', () => {
                sendMessageToUnity(unityGameObjectName, 'RotateLeft');
            });
        }

        const rotateRightBtn = document.getElementById('rotate-right');
        if (rotateRightBtn) {
            rotateRightBtn.addEventListener('click', () => {
                sendMessageToUnity(unityGameObjectName, 'RotateRight');
            });
        }

        const resetViewBtn = document.getElementById('reset-view');
        if (resetViewBtn) {
            resetViewBtn.addEventListener('click', () => {
                sendMessageToUnity(unityGameObjectName, 'ResetView');
            });
        }
        
        console.log(`控制按钮设置完成，使用游戏对象: ${unityGameObjectName}`);
    } catch (e) {
        console.error("设置控制按钮时出错:", e);
    }
}

// 安全地发送消息到Unity
function sendMessageToUnity(gameObject, methodName, parameter) {
    if (!window.unityInstance) {
        console.error(`Unity实例未加载，无法发送消息到${gameObject}.${methodName}`);
        showUnityNotification("Unity未加载，请刷新页面重试", "error");
        return false;
    }

    try {
        console.log(`发送消息到Unity: ${gameObject}.${methodName}(${parameter || ''})`);
        
        // 使用引号包裹游戏对象名称，以防止特殊字符问题
        if (parameter !== undefined) {
            window.unityInstance.SendMessage(gameObject, methodName, parameter);
        } else {
            window.unityInstance.SendMessage(gameObject, methodName);
        }
        
        return true;
    } catch (e) {
        console.error(`发送消息到Unity失败: ${e.message}`);
        
        // 尝试使用备选名称
        if (gameObject !== '9-10Ground' && gameObject !== 'Model') {
            console.log("尝试使用备选游戏对象名称...");
            try {
                if (parameter !== undefined) {
                    window.unityInstance.SendMessage('9-10Ground', methodName, parameter);
                    unityGameObjectName = '9-10Ground';  // 更新为有效名称
                    console.log("使用'9-10Ground'成功");
                    return true;
                } else {
                    window.unityInstance.SendMessage('9-10Ground', methodName);
                    unityGameObjectName = '9-10Ground';  // 更新为有效名称
                    console.log("使用'9-10Ground'成功");
                    return true;
                }
            } catch (e2) {
                try {
                    if (parameter !== undefined) {
                        window.unityInstance.SendMessage('Model', methodName, parameter);
                        unityGameObjectName = 'Model';  // 更新为有效名称
                        console.log("使用'Model'成功");
                        return true;
                    } else {
                        window.unityInstance.SendMessage('Model', methodName);
                        unityGameObjectName = 'Model';  // 更新为有效名称
                        console.log("使用'Model'成功");
                        return true;
                    }
                } catch (e3) {
                    showUnityNotification(`Unity通信错误: ${e.message}`, "error");
                    return false;
                }
            }
        } else {
            showUnityNotification(`Unity通信错误: ${e.message}`, "error");
            return false;
        }
    }
}

// 初始化点位选择器与Unity的集成
function initPointSelectorUnityIntegration() {
    // 获取点位选择器
    const selector = document.getElementById('point-selector');
    if (selector) {
        // 为点位选择器添加事件监听
        selector.addEventListener('change', function() {
            const pointId = this.value;
            if (pointId) {
                // 不仅加载图表数据，还将选中的点位ID发送到Unity
                focusUnityViewOnPoint(pointId);
            }
        });
        console.log("点位选择器事件监听已初始化");
    } else {
        console.warn("未找到点位选择器元素");
    }

    // 将Unity模型上的点击事件传递到JS以更新选择器和图表
    window.unitySendSelectedPoint = function(pointId) {
        console.log("Unity选中了点位: " + pointId);
        
        // 更新点位选择器
        const selector = document.getElementById('point-selector');
        if (selector && pointId) {
            selector.value = pointId;
            
            // 触发change事件，以便加载此点位的数据
            const event = new Event('change');
            selector.dispatchEvent(event);
        }
    };
}

// 聚焦Unity视图到指定点位
function focusUnityViewOnPoint(pointId) {
    if (!pointId) {
        console.error("无效的点位ID");
        return;
    }
    
    console.log(`尝试聚焦到点位: ${pointId}, 使用游戏对象: ${unityGameObjectName}`);
    sendMessageToUnity(unityGameObjectName, 'FocusOnPoint', pointId);
}

// 向 Unity 发送数据的辅助函数
window.sendToUnity = function(gameObject, functionName, parameter) {
    return sendMessageToUnity(gameObject || unityGameObjectName, functionName, parameter);
};

// 显示Unity通知
function showUnityNotification(message, type = 'info') {
    console.log(`显示通知: ${message} (${type})`);
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notification-text');
    if (notification && notificationText) {
        notificationText.textContent = message;
        notification.style.borderLeftColor = type === 'error' ? '#ff4040' : (type === 'warning' ? '#ffbb00' : '#40c060');
        notification.style.display = 'block';

        setTimeout(function() {
            notification.style.display = 'none';
        }, 5000);
    } else {
        // 如果找不到通知元素，使用alert
        if (type === 'error') {
            alert(`错误: ${message}`);
        }
    }
}

// 保持向下兼容 - 此函数不再直接使用，但保留以确保兼容性
window.UpdateChartsJS = function(pointId, jsonData) {
    console.log("旧方法被调用: UpdateChartsJS");
    if (typeof window.updateChartsFromUnity === "function") {
        window.updateChartsFromUnity(pointId, jsonData);
    }
};

// 页面加载完成后加载Unity
document.addEventListener('DOMContentLoaded', loadUnityGame);