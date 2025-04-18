using UnityEngine;
using System.Collections;
using System.Collections.Generic;
using System.Runtime.InteropServices;

/// <summary>
/// 监测点控制器 - 负责处理监测点的交互和与Web界面的通信
/// </summary>
public class MonitoringPointController : MonoBehaviour
{
    [Header("监测点设置")]
    [Tooltip("场景中所有的监测点游戏对象")]
    public List<GameObject> monitoringPoints = new List<GameObject>();
    
    [Tooltip("点位名称与游戏对象的映射字典")]
    private Dictionary<string, GameObject> pointDictionary = new Dictionary<string, GameObject>();
    
    [Header("相机设置")]
    [Tooltip("主相机对象，用于聚焦到监测点")]
    public Camera mainCamera;
    
    [Tooltip("相机缓动速度")]
    public float cameraLerpSpeed = 2.0f;
    
    [Tooltip("相机与监测点的距离")]
    public float cameraDistance = 5.0f;
    
    [Tooltip("相机在监测点上方的高度")]
    public float cameraHeight = 2.0f;
    
    [Tooltip("正在缓动中")]
    private bool isLerping = false;
    
    [Tooltip("缓动目标位置")]
    private Vector3 targetPosition;
    
    [Tooltip("缓动目标旋转")]
    private Quaternion targetRotation;
    
    [Header("Web交互")]
    [Tooltip("与Web界面通信的JavaScript库函数")]
    [DllImport("__Internal")]
    private static extern void unitySendSelectedPoint(string pointId);
    
    [Tooltip("当前选中的点位ID")]
    private string selectedPointId;
    
    [Tooltip("是否运行在WebGL模式")]
    private bool isWebGLMode = false;

    // 初始化
    void Start()
    {
        // 检测运行环境
        #if UNITY_WEBGL && !UNITY_EDITOR
            isWebGLMode = true;
        #endif
        
        // 如果没有指定相机，则使用主相机
        if (mainCamera == null)
        {
            mainCamera = Camera.main;
        }
        
        // 初始化监测点字典
        InitializePointDictionary();
        
        // 为每个监测点添加点击事件
        SetupPointInteractions();
        
        Debug.Log("监测点控制器初始化完成，共有 " + monitoringPoints.Count + " 个监测点");
    }
    
    // 每帧更新
    void Update()
    {
        // 处理相机平滑移动
        if (isLerping)
        {
            // 平滑插值移动相机
            mainCamera.transform.position = Vector3.Lerp(
                mainCamera.transform.position, 
                targetPosition, 
                Time.deltaTime * cameraLerpSpeed
            );
            
            // 平滑插值旋转相机
            mainCamera.transform.rotation = Quaternion.Slerp(
                mainCamera.transform.rotation,
                targetRotation,
                Time.deltaTime * cameraLerpSpeed
            );
            
            // 如果已经非常接近目标位置和旋转，则停止缓动
            if (Vector3.Distance(mainCamera.transform.position, targetPosition) < 0.01f &&
                Quaternion.Angle(mainCamera.transform.rotation, targetRotation) < 0.01f)
            {
                isLerping = false;
            }
        }
    }
    
    // 初始化点位字典
    void InitializePointDictionary()
    {
        pointDictionary.Clear();
        
        // 如果监测点列表为空，尝试在场景中自动查找
        if (monitoringPoints.Count == 0)
        {
            // 尝试查找所有带有 "Point" 标签的游戏对象
            GameObject[] pointObjects = GameObject.FindGameObjectsWithTag("MonitoringPoint");
            if (pointObjects.Length > 0)
            {
                monitoringPoints.AddRange(pointObjects);
            }
            else
            {
                // 如果没有标签，则尝试根据命名规则查找
                // 通常监测点会被命名为 S1, S2, S3 等
                for (int i = 1; i <= 50; i++)
                {
                    GameObject pointObj = GameObject.Find("S" + i);
                    if (pointObj != null)
                    {
                        monitoringPoints.Add(pointObj);
                    }
                }
            }
        }
        
        // 将所有监测点添加到字典中
        foreach (GameObject point in monitoringPoints)
        {
            if (point != null)
            {
                string pointName = point.name;
                if (!pointDictionary.ContainsKey(pointName))
                {
                    pointDictionary.Add(pointName, point);
                    Debug.Log("添加监测点到字典: " + pointName);
                }
            }
        }
    }
    
    // 为监测点设置交互
    void SetupPointInteractions()
    {
        foreach (GameObject point in monitoringPoints)
        {
            if (point != null)
            {
                // 添加碰撞器（如果没有）
                if (point.GetComponent<Collider>() == null)
                {
                    point.AddComponent<SphereCollider>().radius = 0.5f;
                }
                
                // 添加监测点行为脚本
                MonitoringPointBehavior behavior = point.GetComponent<MonitoringPointBehavior>();
                if (behavior == null)
                {
                    behavior = point.AddComponent<MonitoringPointBehavior>();
                }
                
                // 设置点击事件回调
                behavior.OnPointClicked += HandlePointClick;
            }
        }
    }
    
    // 处理点位点击事件
    void HandlePointClick(string pointId)
    {
        Debug.Log("点击了监测点: " + pointId);
        
        // 更新选中状态
        selectedPointId = pointId;
        
        // 聚焦相机到该点位
        FocusOnPoint(pointId);
        
        // 通知Web界面
        if (isWebGLMode)
        {
            try
            {
                unitySendSelectedPoint(pointId);
            }
            catch (System.Exception e)
            {
                Debug.LogError("通知Web界面失败: " + e.Message);
            }
        }
    }
    
    // JavaScript调用此方法聚焦到监测点
    public void FocusOnPoint(string pointId)
    {
        Debug.Log("收到聚焦命令: " + pointId);
        
        if (string.IsNullOrEmpty(pointId))
        {
            Debug.LogWarning("点位ID为空");
            return;
        }
        
        // 将点位ID设为当前选中
        selectedPointId = pointId;
        
        // 查找对应的游戏对象
        GameObject point = null;
        if (pointDictionary.TryGetValue(pointId, out point))
        {
            // 计算相机目标位置（在监测点后上方）
            Vector3 pointPosition = point.transform.position;
            
            // 计算从原点到监测点的方向
            Vector3 directionFromOrigin = (pointPosition - Vector3.zero).normalized;
            
            // 计算相机位置，在监测点后方一定距离
            targetPosition = pointPosition - directionFromOrigin * cameraDistance;
            targetPosition.y += cameraHeight; // 在Y轴（高度）上抬高一些
            
            // 计算相机旋转，使其朝向监测点
            targetRotation = Quaternion.LookRotation(pointPosition - targetPosition);
            
            // 开始缓动
            isLerping = true;
            
            // 高亮显示选中的监测点
            HighlightPoint(point);
        }
        else
        {
            Debug.LogWarning("找不到监测点: " + pointId);
        }
    }
    
    // 高亮显示选中的监测点
    void HighlightPoint(GameObject point)
    {
        // 取消所有监测点的高亮
        foreach (GameObject p in monitoringPoints)
        {
            if (p != null)
            {
                // 恢复正常状态
                Renderer renderer = p.GetComponent<Renderer>();
                if (renderer != null)
                {
                    renderer.material.color = Color.white;
                    renderer.material.SetFloat("_EmissionIntensity", 0);
                }
            }
        }
        
        // 高亮选中的监测点
        Renderer selectedRenderer = point.GetComponent<Renderer>();
        if (selectedRenderer != null)
        {
            // 设置为高亮颜色和发光效果
            selectedRenderer.material.color = Color.cyan;
            selectedRenderer.material.SetFloat("_EmissionIntensity", 1.5f);
        }
    }
    
    // 重置相机视图（JavaScript调用）
    public void ResetView()
    {
        Debug.Log("重置相机视图");
        
        // 设置相机回到初始位置
        targetPosition = new Vector3(0, 15, -15);
        targetRotation = Quaternion.Euler(45, 0, 0);
        
        // 开始缓动
        isLerping = true;
        
        // 清除选中状态
        selectedPointId = "";
        
        // 取消所有点的高亮
        foreach (GameObject point in monitoringPoints)
        {
            if (point != null)
            {
                Renderer renderer = point.GetComponent<Renderer>();
                if (renderer != null)
                {
                    renderer.material.color = Color.white;
                    renderer.material.SetFloat("_EmissionIntensity", 0);
                }
            }
        }
    }
    
    // 向左旋转（JavaScript调用）
    public void RotateLeft()
    {
        if (mainCamera != null)
        {
            mainCamera.transform.RotateAround(Vector3.zero, Vector3.up, 15);
        }
    }
    
    // 向右旋转（JavaScript调用）
    public void RotateRight()
    {
        if (mainCamera != null)
        {
            mainCamera.transform.RotateAround(Vector3.zero, Vector3.up, -15);
        }
    }
}

/// <summary>
/// 监测点行为组件 - 负责处理单个监测点的交互
/// </summary>
public class MonitoringPointBehavior : MonoBehaviour
{
    // 点位点击事件委托
    public delegate void PointClickHandler(string pointId);
    public event PointClickHandler OnPointClicked;
    
    void OnMouseDown()
    {
        // 触发点击事件
        if (OnPointClicked != null)
        {
            OnPointClicked(gameObject.name);
        }
    }
} 