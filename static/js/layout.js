;(function(){
  if(typeof window.APP_AUTO_LAYOUT==='undefined'){window.APP_AUTO_LAYOUT=true}
  function adjustCanvas(el){
    var canvas=el.querySelector('canvas')
    if(!canvas)return
    var w=el.clientWidth,h=el.clientHeight
    if(w>0&&h>0){canvas.style.width=w+'px';canvas.style.height=h+'px'}
  }
  function init(){
    if(!window.APP_AUTO_LAYOUT)return
    var grids=document.querySelectorAll('[data-grid="auto"]')
    grids.forEach(function(g){g.classList.add('dashboard-grid')})
    var ro=new ResizeObserver(function(entries){
      entries.forEach(function(entry){
        var el=entry.target
        if(el.classList.contains('viewer-box')||el.id==='viewer-container'){adjustCanvas(el);window.dispatchEvent(new CustomEvent('layout:container-resize',{detail:{el:el,width:el.clientWidth,height:el.clientHeight}}))}
      })
    })
    document.querySelectorAll('.viewer-box,#viewer-container').forEach(function(el){ro.observe(el);adjustCanvas(el)})
    window.addEventListener('resize',function(){document.querySelectorAll('.viewer-box,#viewer-container').forEach(adjustCanvas)})
  }
  document.addEventListener('DOMContentLoaded',init)
})()
