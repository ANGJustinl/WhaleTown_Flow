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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start)
} else {
  start()
}
