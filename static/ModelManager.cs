using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using System;
using Newtonsoft.Json;

// 相机设置数据结构
[Serializable]
public class CameraSettings
{
    public float distance = 10f;
    public float height = 3f;
    public float speed = 1f;
}

public class ModelManager : MonoBehaviour
{
    // 相机引用
    public Camera mainCamera;
    
    // 监测点预制体
    public GameObject pointPrefab;
    
    // 监测点容器
    public Transform pointsContainer;
    
    // 所有监测点的引用
    private Dictionary<string, Transform> monitoringPoints = new Dictionary<string, Transform>();
    
    // 相机目标位置和旋转
    private Vector3 targetCameraPosition;
    private Quaternion targetCameraRotation;
    
    // 相机设置
    private CameraSettings cameraSettings = new CameraSettings();
    
    // 当前选中的监测点
    private string currentPointId = "";
    
    // 模型的旋转速度
    public float rotationSpeed = 10f;
    
    // 旋转开关
    private bool isRotatingLeft = false;
    private bool isRotatingRight = false;
    
    // WebGL JavaScript接口
    [System.Runtime.InteropServices.DllImport("__Internal")]
    private static extern void unitySendSelectedPoint(string pointId);
    
    void Start()
    {
        // 初始化相机
        if (mainCamera == null)
        {
            mainCamera = Camera.main;
        }
        
        // 记录初始相机位置作为目标位置
        targetCameraPosition = mainCamera.transform.position;
        targetCameraRotation = mainCamera.transform.rotation;
        
        // 查找并初始化所有监测点
        InitializeMonitoringPoints();
    }
    
    void Update()
    {
        // 处理旋转
        if (isRotatingLeft)
        {
            transform.Rotate(Vector3.up, -rotationSpeed * Time.deltaTime);
        }
        else if (isRotatingRight)
        {
            transform.Rotate(Vector3.up, rotationSpeed * Time.deltaTime);
        }
        
        // 平滑移动相机到目标位置
        mainCamera.transform.position = Vector3.Lerp(
            mainCamera.transform.position, 
            targetCameraPosition, 
            cameraSettings.speed * Time.deltaTime
        );
        
        mainCamera.transform.rotation = Quaternion.Slerp(
            mainCamera.transform.rotation, 
            targetCameraRotation, 
            cameraSettings.speed * Time.deltaTime
        );
    }
    
    // 初始化监测点
    private void InitializeMonitoringPoints()
    {
        monitoringPoints.Clear();
        
        // 两种方式查找监测点：
        
        // 1. 如果提供了点位容器，就从容器中查找所有子对象
        if (pointsContainer != null)
        {
            foreach (Transform child in pointsContainer)
            {
                if (!monitoringPoints.ContainsKey(child.name))
                {
                    monitoringPoints.Add(child.name, child);
                    Debug.Log($"找到监测点: {child.name}");
                }
            }
        }
        
        // 2. 查找场景中所有带有"MonitoringPoint"标签的对象
        GameObject[] taggedPoints = GameObject.FindGameObjectsWithTag("MonitoringPoint");
        foreach (GameObject point in taggedPoints)
        {
            if (!monitoringPoints.ContainsKey(point.name))
            {
                monitoringPoints.Add(point.name, point.transform);
                Debug.Log($"找到标签监测点: {point.name}");
            }
        }
        
        Debug.Log($"总共找到 {monitoringPoints.Count} 个监测点");
    }
    
    // 从网页调用：聚焦到指定监测点
    public void FocusOnPoint(string pointId)
    {
        Debug.Log($"尝试聚焦到监测点: {pointId}");
        
        if (monitoringPoints.TryGetValue(pointId, out Transform point))
        {
            currentPointId = pointId;
            FocusCameraOnTransform(point);
            Debug.Log($"相机聚焦到监测点: {pointId}");
        }
        else
        {
            Debug.LogWarning($"未找到监测点: {pointId}");
        }
    }
    
    // 设置相机聚焦到特定Transform
    private void FocusCameraOnTransform(Transform target)
    {
        if (target == null || mainCamera == null) return;
        
        // 计算相机位置：在目标后方一定距离，并抬高一定高度
        Vector3 directionFromTarget = -transform.forward;
        Vector3 targetPosition = target.position - directionFromTarget * cameraSettings.distance;
        targetPosition.y += cameraSettings.height;
        
        // 更新目标位置
        targetCameraPosition = targetPosition;
        
        // 让相机看向目标
        Vector3 directionToTarget = target.position - targetPosition;
        Quaternion targetRotation = Quaternion.LookRotation(directionToTarget);
        targetCameraRotation = targetRotation;
    }
    
    // 从网页调用：向左旋转模型
    public void RotateLeft()
    {
        StartCoroutine(RotateLeftForDuration(1.0f));
    }
    
    // 从网页调用：向右旋转模型
    public void RotateRight()
    {
        StartCoroutine(RotateRightForDuration(1.0f));
    }
    
    // 从网页调用：重置视图
    public void ResetView()
    {
        // 重置旋转
        transform.rotation = Quaternion.identity;
        
        // 重置相机位置和旋转
        targetCameraPosition = new Vector3(0, 5, -10);
        targetCameraRotation = Quaternion.Euler(30, 0, 0);
        
        // 清除当前选中点位
        currentPointId = "";
    }
    
    // 从网页调用：更新相机设置
    public void UpdateCameraSettings(string settingsJson)
    {
        try
        {
            CameraSettings newSettings = JsonConvert.DeserializeObject<CameraSettings>(settingsJson);
            cameraSettings = newSettings;
            Debug.Log($"更新相机设置: 距离={cameraSettings.distance}, 高度={cameraSettings.height}, 速度={cameraSettings.speed}");
            
            // 如果有当前选中点位，重新聚焦以应用新设置
            if (!string.IsNullOrEmpty(currentPointId) && monitoringPoints.TryGetValue(currentPointId, out Transform point))
            {
                FocusCameraOnTransform(point);
            }
        }
        catch (Exception ex)
        {
            Debug.LogError($"解析相机设置JSON失败: {ex.Message}");
        }
    }
    
    // 向左旋转一段时间
    private IEnumerator RotateLeftForDuration(float duration)
    {
        isRotatingLeft = true;
        yield return new WaitForSeconds(duration);
        isRotatingLeft = false;
    }
    
    // 向右旋转一段时间
    private IEnumerator RotateRightForDuration(float duration)
    {
        isRotatingRight = true;
        yield return new WaitForSeconds(duration);
        isRotatingRight = false;
    }
    
    // 点击监测点后发送点位ID到网页
    public void OnPointClicked(string pointId)
    {
        // 在WebGL中调用JavaScript函数
        #if UNITY_WEBGL && !UNITY_EDITOR
        unitySendSelectedPoint(pointId);
        #else
        Debug.Log($"点击了监测点: {pointId}");
        #endif
        
        // 同时在Unity中处理选中逻辑
        FocusOnPoint(pointId);
    }
    
    // 创建所有监测点（如果需要测试用）
    public void CreateTestPoints()
    {
        if (pointPrefab == null || pointsContainer == null)
        {
            Debug.LogError("缺少点位预制体或容器引用");
            return;
        }
        
        // 清除现有点位
        foreach (Transform child in pointsContainer)
        {
            Destroy(child.gameObject);
        }
        
        // 创建25个监测点用于测试
        for (int i = 1; i <= 25; i++)
        {
            string pointId = $"S{i}";
            
            // 在半径为10的圆上均匀分布点位
            float angle = (i - 1) * (360f / 25f) * Mathf.Deg2Rad;
            float x = Mathf.Sin(angle) * 10f;
            float z = Mathf.Cos(angle) * 10f;
            
            // 随机高度
            float y = UnityEngine.Random.Range(0f, 3f);
            
            // 创建点位
            GameObject point = Instantiate(pointPrefab, new Vector3(x, y, z), Quaternion.identity, pointsContainer);
            point.name = pointId;
            
            // 添加到字典
            monitoringPoints[pointId] = point.transform;
        }
        
        Debug.Log("创建了25个测试监测点");
    }
} 