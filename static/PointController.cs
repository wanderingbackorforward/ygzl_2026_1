using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class PointController : MonoBehaviour
{
    // 材质引用
    public Material normalMaterial;
    public Material highlightedMaterial;
    public Material selectedMaterial;
    
    // 当前状态
    private bool isHighlighted = false;
    private bool isSelected = false;
    
    // 缓存的组件引用
    private MeshRenderer meshRenderer;
    private ModelManager modelManager;
    
    // 初始材质
    private Material originalMaterial;

    void Start()
    {
        // 获取必要组件
        meshRenderer = GetComponent<MeshRenderer>();
        modelManager = FindObjectOfType<ModelManager>();
        
        // 保存初始材质
        if (meshRenderer && meshRenderer.material)
        {
            originalMaterial = meshRenderer.material;
        }
        
        // 如果没有指定材质，就用默认的
        if (normalMaterial == null)
        {
            normalMaterial = originalMaterial;
        }
        
        // 给这个物体添加一个碰撞器（如果没有）
        if (GetComponent<Collider>() == null)
        {
            gameObject.AddComponent<SphereCollider>().isTrigger = true;
        }
    }

    void OnMouseEnter()
    {
        // 当鼠标悬停时高亮显示
        if (highlightedMaterial && !isSelected && meshRenderer)
        {
            meshRenderer.material = highlightedMaterial;
            isHighlighted = true;
        }
    }

    void OnMouseExit()
    {
        // 当鼠标离开时恢复正常材质（如果未被选中）
        if (!isSelected && meshRenderer)
        {
            meshRenderer.material = normalMaterial;
            isHighlighted = false;
        }
    }

    void OnMouseDown()
    {
        // 当点击时触发选中
        SelectPoint();
    }

    // 选中此点位
    public void SelectPoint()
    {
        if (modelManager != null)
        {
            // 通知ModelManager已选中此点位
            modelManager.OnPointClicked(gameObject.name);
            
            // 更改材质为选中状态
            if (selectedMaterial && meshRenderer)
            {
                meshRenderer.material = selectedMaterial;
                isSelected = true;
                isHighlighted = false;
            }
        }
    }

    // 取消选中
    public void Deselect()
    {
        if (meshRenderer)
        {
            meshRenderer.material = normalMaterial;
            isSelected = false;
            isHighlighted = false;
        }
    }

    // 由ModelManager调用，用于在通过网页选择点位时更新视觉状态
    public void UpdateVisualState(bool selected)
    {
        if (selected)
        {
            if (selectedMaterial && meshRenderer)
            {
                meshRenderer.material = selectedMaterial;
                isSelected = true;
                isHighlighted = false;
            }
        }
        else
        {
            Deselect();
        }
    }
} 