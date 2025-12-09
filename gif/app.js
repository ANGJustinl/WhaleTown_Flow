const elements = {
  fileInput: document.querySelector('#file-input'),
  zipInput: document.querySelector('#zip-input'),
  importClipboard: document.querySelector('#import-clipboard'),
  dropZone: document.querySelector('#drop-zone'),
  status: document.querySelector('#status'),
  framesSection: document.querySelector('#frames-section'),
  framesGrid: document.querySelector('#frames-grid'),
  clearFrames: document.querySelector('#clear-frames'),
  controlsSection: document.querySelector('#controls-section'),
  gifDelay: document.querySelector('#gif-delay'),
  gifOrder: document.querySelector('#gif-order'),
  gifQuality: document.querySelector('#gif-quality'),
  gifWidth: document.querySelector('#gif-width'),
  generateBtn: document.querySelector('#generate-btn'),
  resultSection: document.querySelector('#result-section'),
  gifPreview: document.querySelector('#gif-preview'),
  resultPlaceholder: document.querySelector('#result-placeholder'),
  resultInfo: document.querySelector('#result-info'),
  resultSize: document.querySelector('#result-size'),
  downloadBtn: document.querySelector('#download-btn')
}

const state = {
  frames: [],
  gifBlob: null,
  gifURL: null,
  draggedIndex: null
}

const setStatus = (text) => {
  elements.status.textContent = text
}

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const loadImageFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => resolve({ file, url: e.target.result, img })
      img.onerror = () => reject(new Error(`无法加载图片: ${file.name}`))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error(`无法读取文件: ${file.name}`))
    reader.readAsDataURL(file)
  })
}

const extractZip = async (file) => {
  if (typeof JSZip === 'undefined') {
    throw new Error('ZIP 库未加载')
  }
  
  const zip = new JSZip()
  const zipData = await zip.loadAsync(file)
  
  const imageFiles = []
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp'
  }
  
  for (const [filename, zipEntry] of Object.entries(zipData.files)) {
    if (zipEntry.dir) continue
    
    const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
    const mimeType = mimeTypes[ext]
    
    if (mimeType) {
      const blob = await zipEntry.async('blob')
      const imageFile = new File([blob], filename, { type: mimeType })
      imageFiles.push(imageFile)
    }
  }
  
  // Sort by filename with natural number sorting
  imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
  
  return imageFiles
}

const addFrames = async (files) => {
  if (!files || files.length === 0) return
  
  setStatus(`正在加载 ${files.length} 个文件...`)
  
  try {
    const imageFiles = []
    
    // Check if any file is a ZIP
    for (const file of Array.from(files)) {
      if (file.name.toLowerCase().endsWith('.zip')) {
        setStatus(`正在解压 ${file.name}...`)
        const extractedFiles = await extractZip(file)
        imageFiles.push(...extractedFiles)
        setStatus(`从 ${file.name} 提取了 ${extractedFiles.length} 张图片`)
      } else if (file.type.startsWith('image/')) {
        imageFiles.push(file)
      }
    }
    
    if (imageFiles.length === 0) {
      setStatus('未找到有效的图片文件')
      return
    }
    
    setStatus(`正在加载 ${imageFiles.length} 张图片...`)
    
    // Load images one by one, skip failed ones
    const newFrames = []
    let failedCount = 0
    
    for (let i = 0; i < imageFiles.length; i++) {
      try {
        const frame = await loadImageFile(imageFiles[i])
        newFrames.push(frame)
        setStatus(`正在加载 ${i + 1}/${imageFiles.length} 张图片...`)
      } catch (error) {
        console.warn(`跳过图片 ${imageFiles[i].name}:`, error)
        failedCount++
      }
    }
    
    if (newFrames.length === 0) {
      setStatus('所有图片加载失败')
      return
    }
    
    state.frames.push(...newFrames)
    renderFrames()
    
    elements.framesSection.hidden = false
    elements.controlsSection.hidden = false
    
    if (failedCount > 0) {
      setStatus(`已添加 ${newFrames.length} 张图片，${failedCount} 张失败，共 ${state.frames.length} 帧`)
    } else {
      setStatus(`已添加 ${newFrames.length} 张图片，共 ${state.frames.length} 帧`)
    }
  } catch (error) {
    console.error('加载失败:', error)
    setStatus(`加载失败: ${error.message}`)
  }
}

const removeFrame = (index) => {
  state.frames.splice(index, 1)
  renderFrames()
  
  if (state.frames.length === 0) {
    elements.framesSection.hidden = true
    elements.controlsSection.hidden = true
    setStatus('未选择文件')
  } else {
    setStatus(`剩余 ${state.frames.length} 帧`)
  }
}

const clearAllFrames = () => {
  state.frames = []
  elements.framesGrid.innerHTML = ''
  elements.framesSection.hidden = true
  elements.controlsSection.hidden = true
  elements.resultSection.hidden = true
  setStatus('未选择文件')
}

const renderFrames = () => {
  elements.framesGrid.innerHTML = ''
  
  state.frames.forEach((frame, index) => {
    const div = document.createElement('div')
    div.className = 'frame-item'
    div.draggable = true
    div.dataset.index = index
    
    const img = document.createElement('img')
    img.src = frame.url
    img.alt = `Frame ${index + 1}`
    
    const number = document.createElement('div')
    number.className = 'frame-number'
    number.textContent = index + 1
    
    const removeBtn = document.createElement('button')
    removeBtn.className = 'frame-remove'
    removeBtn.textContent = '×'
    removeBtn.onclick = (e) => {
      e.stopPropagation()
      removeFrame(index)
    }
    
    // Drag events
    div.addEventListener('dragstart', handleDragStart)
    div.addEventListener('dragover', handleDragOver)
    div.addEventListener('drop', handleDrop)
    div.addEventListener('dragend', handleDragEnd)
    div.addEventListener('dragleave', handleDragLeave)
    
    div.appendChild(img)
    div.appendChild(number)
    div.appendChild(removeBtn)
    elements.framesGrid.appendChild(div)
  })
}

const handleDragStart = (e) => {
  state.draggedIndex = parseInt(e.target.dataset.index)
  e.target.classList.add('dragging')
  e.dataTransfer.effectAllowed = 'move'
}

const handleDragOver = (e) => {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  const target = e.target.closest('.frame-item')
  if (target) {
    target.classList.add('drag-over')
  }
}

const handleDragLeave = (e) => {
  const target = e.target.closest('.frame-item')
  if (target) {
    target.classList.remove('drag-over')
  }
}

const handleDrop = (e) => {
  e.preventDefault()
  const target = e.target.closest('.frame-item')
  if (!target) return
  
  target.classList.remove('drag-over')
  
  const dropIndex = parseInt(target.dataset.index)
  if (state.draggedIndex !== null && state.draggedIndex !== dropIndex) {
    const [draggedFrame] = state.frames.splice(state.draggedIndex, 1)
    state.frames.splice(dropIndex, 0, draggedFrame)
    renderFrames()
  }
}

const handleDragEnd = (e) => {
  e.target.classList.remove('dragging')
  document.querySelectorAll('.frame-item').forEach(item => {
    item.classList.remove('drag-over')
  })
  state.draggedIndex = null
}

const generateGif = async () => {
  if (state.frames.length === 0) {
    setStatus('请先添加图片')
    return
  }
  
  elements.generateBtn.disabled = true
  elements.generateBtn.textContent = '生成中...'
  elements.resultSection.hidden = false
  elements.resultPlaceholder.hidden = false
  elements.gifPreview.hidden = true
  elements.resultInfo.hidden = true
  elements.downloadBtn.disabled = true
  
  try {
    const delay = parseInt(elements.gifDelay.value) || 200
    const order = elements.gifOrder.value
    const quality = parseInt(elements.gifQuality.value) || 10
    const width = parseInt(elements.gifWidth.value) || null
    
    // Prepare frame order
    let frames = [...state.frames]
    if (order === 'reverse') {
      frames = frames.reverse()
    } else if (order === 'pingpong') {
      frames = [...frames, ...frames.slice(0, -1).reverse()]
    }
    
    setStatus(`正在生成 GIF (${frames.length} 帧)...`)
    
    // Check if gifshot is loaded
    if (typeof gifshot === 'undefined') {
      throw new Error('GIF 库未加载，请刷新页面重试')
    }
    
    // Load all images
    const imageElements = frames.map(f => f.img)
    
    const interval = delay / 1000
    
    // Create GIF
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('生成超时，请减少帧数或降低图片尺寸'))
      }, 60000)
      
      const options = {
        images: imageElements,
        interval: interval,
        sampleInterval: quality,
        numWorkers: 2
      }
      
      if (width) {
        options.gifWidth = width
      }
      
      gifshot.createGIF(options, (obj) => {
        clearTimeout(timeout)
        if (obj.error) {
          reject(new Error(obj.error))
        } else {
          resolve(obj)
        }
      })
    })
    
    // Convert base64 to blob
    const base64Data = result.image.split(',')[1]
    const binaryData = atob(base64Data)
    const bytes = new Uint8Array(binaryData.length)
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: 'image/gif' })
    
    // Clean up old GIF
    if (state.gifURL) {
      URL.revokeObjectURL(state.gifURL)
    }
    
    state.gifBlob = blob
    state.gifURL = URL.createObjectURL(blob)
    
    elements.gifPreview.src = state.gifURL
    elements.gifPreview.hidden = false
    elements.resultPlaceholder.hidden = true
    elements.resultInfo.hidden = false
    elements.downloadBtn.disabled = false
    
    const sizeKB = (blob.size / 1024).toFixed(1)
    elements.resultSize.textContent = `大小: ${sizeKB} KB，帧数: ${frames.length}`
    
    setStatus('✓ GIF 生成成功')
  } catch (error) {
    console.error('GIF 生成失败:', error)
    setStatus(`✗ 生成失败: ${error.message}`)
    elements.resultPlaceholder.textContent = `生成失败: ${error.message}`
  } finally {
    elements.generateBtn.disabled = false
    elements.generateBtn.textContent = '生成 GIF'
  }
}

const downloadGif = () => {
  if (!state.gifBlob) return
  
  const a = document.createElement('a')
  a.href = state.gifURL
  a.download = 'animation.gif'
  a.click()
}

const handleFiles = (files) => {
  addFrames(files)
}

const importFromClipboard = async () => {
  if (typeof window.parent.clipboardGetAll !== 'function') {
    setStatus('剪贴板功能不可用')
    return
  }
  
  const clipboardItems = window.parent.clipboardGetAll()
  
  if (!clipboardItems || clipboardItems.length === 0) {
    setStatus('剪贴板为空')
    return
  }
  
  setStatus(`正在从剪贴板导入 ${clipboardItems.length} 张图片...`)
  
  try {
    // Convert clipboard items to File objects
    const files = await Promise.all(
      clipboardItems.map(async (item) => {
        if (!item || !item.url) {
          throw new Error('无效的剪贴板项目')
        }
        const response = await fetch(item.url)
        const blob = await response.blob()
        return new File([blob], item.name, { type: item.type })
      })
    )
    
    await addFrames(files)
  } catch (error) {
    console.error('从剪贴板导入失败:', error)
    setStatus(`导入失败: ${error.message}`)
  }
}

// 监听来自父窗口的剪贴板粘贴消息
window.addEventListener('message', async (event) => {
  if (event.data.type === 'clipboard-paste' && event.data.item) {
    const item = event.data.item
    if (!item || !item.url) {
      setStatus('剪贴板项目无效')
      return
    }
    
    setStatus(`正在导入: ${item.name}`)
    
    try {
      const response = await fetch(item.url)
      const blob = await response.blob()
      const file = new File([blob], item.name, { type: item.type })
      await addFrames([file])
    } catch (error) {
      console.error('导入失败:', error)
      setStatus(`导入失败: ${error.message}`)
    }
  }
})

const wireEvents = () => {
  elements.fileInput.addEventListener('change', (e) => handleFiles(e.target.files))
  elements.zipInput.addEventListener('change', (e) => handleFiles(e.target.files))
  elements.importClipboard.addEventListener('click', importFromClipboard)
  
  elements.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault()
    elements.dropZone.classList.add('dragging')
  })
  
  elements.dropZone.addEventListener('dragleave', () => {
    elements.dropZone.classList.remove('dragging')
  })
  
  elements.dropZone.addEventListener('drop', (e) => {
    e.preventDefault()
    elements.dropZone.classList.remove('dragging')
    handleFiles(e.dataTransfer.files)
  })
  
  elements.clearFrames.addEventListener('click', clearAllFrames)
  elements.generateBtn.addEventListener('click', generateGif)
  elements.downloadBtn.addEventListener('click', downloadGif)
}

const bootstrap = () => {
  setStatus('未选择文件')
  wireEvents()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap)
} else {
  bootstrap()
}
