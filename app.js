const flows = [
  {
    id: 'rmbg',
    name: 'RMBG 抠图',
    description: 'BRIA RMBG 1.4 · ONNX WASM 浏览器去背',
    url: './rmbg/' // 末尾斜杠确保资源相对路径指向 /rmbg/ 下的文件
  },
  {
    id: 'slicer',
    name: '多图切割',
    description: '网格调整 + 边距 + 间距，单张/批量导出',
    url: './slicer/' // 新的切割工具
  },
  {
    id: 'image2bitmap',
    name: '图片矢量化',
    description: 'ImageTracer.js 将位图转换为 SVG',
    url: './image2bitmap/' // 矢量化工具
  },
  {
    id: 'convert',
    name: '格式转换',
    description: 'PNG/JPG/WebP/ICO 格式互转',
    url: './convert/' // 格式转换工具
  },
  {
    id: 'gif',
    name: 'GIF 制作',
    description: '多图合成 GIF 动画，支持拖拽排序',
    url: './gif/' // GIF 制作工具
  },
  {
    id: 'whaledesign',
    name: 'Whale 设计器',
    description: 'Datawhale Town 角色创建器 · AI 像素风格',
    url: './whaledesign/dist/' // Whale 设计工具
  },
  {
    id: 'whaleui',
    name: 'Whale UI',
    description: 'Web UI with Backend Communication · React 组件库',
    url: './whaleui/build/' // Whale UI 工具
  }
  // 可在此继续添加更多工作流，保持 id 唯一且 url 指向对应入口
]

let activeId = null

const start = () => {
  const ensureContainers = () => {
    let tabBar = document.querySelector('#tab-bar')
    let frames = document.querySelector('#frames')

    if (tabBar && frames) return { tabBar, frames }

    // 容器缺失时自动补齐，避免空指针；也方便嵌入到空白页
    const section = document.createElement('section')
    section.className = 'tabs'

    tabBar = document.createElement('div')
    tabBar.id = 'tab-bar'
    tabBar.className = 'tab-bar'

    frames = document.createElement('div')
    frames.id = 'frames'
    frames.className = 'frames'

    section.appendChild(tabBar)
    section.appendChild(frames)
    document.body.appendChild(section)

    return { tabBar, frames }
  }

  const { tabBar, frames } = ensureContainers()

  const activate = (id) => {
    if (activeId === id) return
    activeId = id
    const tabs = tabBar.querySelectorAll('.tab')
    const flowFrames = frames.querySelectorAll('.flow-frame')

    tabs.forEach((tab) => {
      const isActive = tab.dataset.id === id
      tab.classList.toggle('active', isActive)
      tab.setAttribute('aria-selected', isActive)
    })

    flowFrames.forEach((frame) => {
      const isActive = frame.dataset.id === id
      frame.classList.toggle('active', isActive)
    })
  }

  const createTab = (flow) => {
    const button = document.createElement('button')
    button.className = 'tab'
    button.textContent = flow.name
    button.title = flow.description
    button.dataset.id = flow.id
    button.addEventListener('click', () => activate(flow.id))
    tabBar.appendChild(button)
  }

  const createFrame = (flow) => {
    const iframe = document.createElement('iframe')
    iframe.className = 'flow-frame'
    iframe.dataset.id = flow.id
    iframe.src = flow.url // 创建时加载一次，后续切换不重载
    iframe.title = flow.name
    frames.appendChild(iframe)
  }

  const bootstrap = () => {
    if (!flows.length) return
    flows.forEach((flow) => {
      createTab(flow)
      createFrame(flow)
    })
    activate(flows[0].id)
  }

  bootstrap()
}

// 剪贴板面板管理
const initClipboard = () => {
  const panel = document.querySelector('#clipboard-panel')
  const toggle = document.querySelector('#clipboard-toggle')
  const clear = document.querySelector('#clipboard-clear')
  const count = document.querySelector('#clipboard-count')
  const items = document.querySelector('#clipboard-items')
  const header = document.querySelector('.clipboard-header')

  if (!panel || !window.globalClipboard) return

  // 切换展开/收起
  const togglePanel = () => {
    panel.classList.toggle('collapsed')
    toggle.textContent = panel.classList.contains('collapsed') ? '▲' : '▼'
  }

  header.addEventListener('click', (e) => {
    if (e.target === header || e.target.tagName === 'STRONG' || e.target.id === 'clipboard-count') {
      togglePanel()
    }
  })

  toggle.addEventListener('click', (e) => {
    e.stopPropagation()
    togglePanel()
  })

  // 清空剪贴板
  clear.addEventListener('click', (e) => {
    e.stopPropagation()
    if (confirm('确定要清空剪贴板吗？')) {
      window.clipboardClear()
    }
  })

  // 渲染剪贴板项目
  const renderItems = (clipboardItems) => {
    count.textContent = clipboardItems.length
    items.innerHTML = ''

    clipboardItems.forEach((item) => {
      const div = document.createElement('div')
      div.className = 'clipboard-item'
      div.title = '点击查看详情'

      const thumb = document.createElement('img')
      thumb.className = 'clipboard-item-thumb'
      thumb.src = item.url
      thumb.alt = item.name

      const info = document.createElement('div')
      info.className = 'clipboard-item-info'

      const name = document.createElement('div')
      name.className = 'clipboard-item-name'
      name.textContent = item.name

      const meta = document.createElement('div')
      meta.className = 'clipboard-item-meta'
      const time = new Date(item.timestamp).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      })
      meta.textContent = `${item.source} · ${time}`

      info.appendChild(name)
      info.appendChild(meta)

      const removeBtn = document.createElement('button')
      removeBtn.className = 'clipboard-item-remove'
      removeBtn.textContent = '×'
      removeBtn.title = '删除'
      removeBtn.onclick = (e) => {
        e.stopPropagation()
        window.clipboardRemove(item.id)
      }

      div.appendChild(thumb)
      div.appendChild(info)
      div.appendChild(removeBtn)

      // 点击项目时发送消息到当前激活的 iframe
      div.addEventListener('click', () => {
        const activeFrame = document.querySelector('.flow-frame.active')
        if (activeFrame && activeFrame.contentWindow) {
          activeFrame.contentWindow.postMessage(
            {
              type: 'clipboard-paste',
              item: item
            },
            '*'
          )
        }
      })

      items.appendChild(div)
    })
  }

  // 监听剪贴板变化
  window.clipboardOnChange(renderItems)

  // 初始渲染
  renderItems(window.clipboardGetAll())
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    start()
    initClipboard()
  })
} else {
  start()
  initClipboard()
}
