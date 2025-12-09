import { zipFiles } from './zip.js'

const elements = {
  file: document.querySelector('#file-input'),
  importClipboard: document.querySelector('#import-clipboard'),
  uploader: document.querySelector('#uploader'),
  uploadStatus: document.querySelector('#upload-status'),
  canvas: document.querySelector('#preview-canvas'),
  rows: document.querySelector('#rows'),
  cols: document.querySelector('#cols'),
  padX: document.querySelector('#pad-x'),
  padY: document.querySelector('#pad-y'),
  marginTop: document.querySelector('#margin-top'),
  marginBottom: document.querySelector('#margin-bottom'),
  marginLeft: document.querySelector('#margin-left'),
  marginRight: document.querySelector('#margin-right'),
  gapX: document.querySelector('#gap-x'),
  gapY: document.querySelector('#gap-y'),
  format: document.querySelector('#format'),
  sliceBtn: document.querySelector('#slice-btn'),
  resetGrid: document.querySelector('#reset-grid'),
  sliceInfo: document.querySelector('#slice-info'),
  results: document.querySelector('#results'),
  resultGrid: document.querySelector('#result-grid'),
  downloadAll: document.querySelector('#download-all'),
  sendToClipboard: document.querySelector('#send-to-clipboard'),
  gifSection: document.querySelector('#gif-section'),
  gifDelay: document.querySelector('#gif-delay'),
  gifOrder: document.querySelector('#gif-order'),
  gifRepeat: document.querySelector('#gif-repeat'),
  generateGifBtn: document.querySelector('#generate-gif-btn'),
  downloadGifBtn: document.querySelector('#download-gif-btn'),
  gifPreviewContainer: document.querySelector('#gif-preview-container'),
  gifPreview: document.querySelector('#gif-preview'),
  gifInfo: document.querySelector('#gif-info')
}

const state = {
  image: null,
  imageURL: null,
  slices: [],
  gifBlob: null,
  gifURL: null,
  dragging: null, // { type: 'margin-top' | 'margin-left' | 'vline' | 'hline', index: number }
  dragStart: null,
  customVLines: [], // Custom vertical line positions (x coordinates)
  customHLines: []  // Custom horizontal line positions (y coordinates)
}

const ctx = elements.canvas.getContext('2d')

const readNumber = (input, min = 0, max = 9999, fallback = 0) => {
  const value = Number(input.value)
  if (Number.isNaN(value)) return fallback
  return Math.min(Math.max(value, min), max)
}

const clearSlices = () => {
  state.slices.forEach((slice) => URL.revokeObjectURL(slice.url))
  state.slices = []
  elements.resultGrid.innerHTML = ''
  elements.results.hidden = true
  elements.sliceInfo.textContent = ''
}

// Calculate grid line positions
const calculateGridLines = () => {
  if (!state.image) return { vLines: [], hLines: [] }
  
  const rows = readNumber(elements.rows, 1, 200, 1)
  const cols = readNumber(elements.cols, 1, 200, 1)
  const marginTop = readNumber(elements.marginTop, 0)
  const marginBottom = readNumber(elements.marginBottom, 0)
  const marginLeft = readNumber(elements.marginLeft, 0)
  const marginRight = readNumber(elements.marginRight, 0)
  const gapX = readNumber(elements.gapX, 0)
  const gapY = readNumber(elements.gapY, 0)
  const { width, height } = state.image
  
  const usableWidth = width - marginLeft - marginRight - gapX * (cols - 1)
  const usableHeight = height - marginTop - marginBottom - gapY * (rows - 1)
  
  if (usableWidth <= 0 || usableHeight <= 0) {
    return { vLines: [], hLines: [], cellW: 0, cellH: 0 }
  }
  
  const cellW = usableWidth / cols
  const cellH = usableHeight / rows
  
  // Initialize custom lines if needed
  if (state.customVLines.length !== cols - 1) {
    state.customVLines = []
    let x = marginLeft + cellW
    for (let c = 1; c < cols; c++) {
      state.customVLines.push(x)
      x += cellW + gapX
    }
  }
  
  if (state.customHLines.length !== rows - 1) {
    state.customHLines = []
    let y = marginTop + cellH
    for (let r = 1; r < rows; r++) {
      state.customHLines.push(y)
      y += cellH + gapY
    }
  }
  
  // Vertical lines (including borders)
  const vLines = [marginLeft, ...state.customVLines, width - marginRight]
  
  // Horizontal lines (including borders)
  const hLines = [marginTop, ...state.customHLines, height - marginBottom]
  
  return { vLines, hLines, cellW, cellH, marginTop, marginLeft, marginRight, marginBottom, usableWidth, usableHeight }
}

const drawOverlay = () => {
  if (!state.image) return
  
  const { width, height } = state.image
  elements.canvas.width = width
  elements.canvas.height = height

  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(state.image, 0, 0, width, height)

  const { vLines, hLines, usableWidth, usableHeight, marginTop, marginLeft } = calculateGridLines()
  
  if (vLines.length === 0 || hLines.length === 0) {
    elements.sliceInfo.textContent = '参数过大，超出图片尺寸'
    return
  }

  ctx.save()
  ctx.strokeStyle = '#ef4444'
  ctx.lineWidth = 2

  // Draw vertical lines
  vLines.forEach((x, index) => {
    // Highlight draggable internal lines
    if (index > 0 && index < vLines.length - 1) {
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
    } else {
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 3
    }
    
    ctx.beginPath()
    ctx.moveTo(x, marginTop)
    ctx.lineTo(x, marginTop + usableHeight)
    ctx.stroke()
  })

  // Draw horizontal lines
  hLines.forEach((y, index) => {
    // Highlight draggable internal lines
    if (index > 0 && index < hLines.length - 1) {
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
    } else {
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 3
    }
    
    ctx.beginPath()
    ctx.moveTo(marginLeft, y)
    ctx.lineTo(marginLeft + usableWidth, y)
    ctx.stroke()
  })

  ctx.restore()
  
  // Draw hint
  if (!state.dragging) {
    ctx.save()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.fillRect(10, 10, 240, 30)
    ctx.fillStyle = '#fff'
    ctx.font = '12px sans-serif'
    ctx.fillText('💡 拖拽任意网格线可微调位置', 20, 30)
    ctx.restore()
  }
}

// Get mouse position relative to canvas
const getMousePos = (e) => {
  const rect = elements.canvas.getBoundingClientRect()
  const scaleX = elements.canvas.width / rect.width
  const scaleY = elements.canvas.height / rect.height
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  }
}

// Check if mouse is near a line
const getNearestLine = (mouseX, mouseY, threshold = 10) => {
  if (!state.image) return null
  
  const { vLines, hLines, marginTop, marginLeft, usableWidth, usableHeight } = calculateGridLines()
  if (vLines.length === 0 || hLines.length === 0) return null
  
  const { width, height } = state.image
  const marginBottom = readNumber(elements.marginBottom, 0)
  const marginRight = readNumber(elements.marginRight, 0)
  
  // Check vertical lines (including internal ones)
  for (let i = 0; i < vLines.length; i++) {
    const x = vLines[i]
    if (Math.abs(mouseX - x) < threshold && mouseY >= marginTop && mouseY <= marginTop + usableHeight) {
      if (i === 0) {
        return { type: 'margin-left', value: marginLeft, index: i }
      } else if (i === vLines.length - 1) {
        return { type: 'margin-right', value: marginRight, index: i }
      } else {
        return { type: 'vline', value: x, index: i - 1 } // index in customVLines array
      }
    }
  }
  
  // Check horizontal lines (including internal ones)
  for (let i = 0; i < hLines.length; i++) {
    const y = hLines[i]
    if (Math.abs(mouseY - y) < threshold && mouseX >= marginLeft && mouseX <= marginLeft + usableWidth) {
      if (i === 0) {
        return { type: 'margin-top', value: marginTop, index: i }
      } else if (i === hLines.length - 1) {
        return { type: 'margin-bottom', value: marginBottom, index: i }
      } else {
        return { type: 'hline', value: y, index: i - 1 } // index in customHLines array
      }
    }
  }
  
  return null
}

// Canvas mouse events
const setupCanvasInteraction = () => {
  let hoveredLine = null
  
  elements.canvas.addEventListener('mousemove', (e) => {
    if (!state.image) return
    
    const pos = getMousePos(e)
    
    if (state.dragging) {
      const { vLines, hLines, marginTop, marginLeft } = calculateGridLines()
      
      if (state.dragging.type === 'margin-top') {
        const newValue = Math.max(0, Math.min(state.image.height / 2, state.dragging.originalValue + (pos.y - state.dragStart.y)))
        elements.marginTop.value = Math.round(newValue)
      } else if (state.dragging.type === 'margin-bottom') {
        const newValue = Math.max(0, Math.min(state.image.height / 2, state.dragging.originalValue - (pos.y - state.dragStart.y)))
        elements.marginBottom.value = Math.round(newValue)
      } else if (state.dragging.type === 'margin-left') {
        const newValue = Math.max(0, Math.min(state.image.width / 2, state.dragging.originalValue + (pos.x - state.dragStart.x)))
        elements.marginLeft.value = Math.round(newValue)
      } else if (state.dragging.type === 'margin-right') {
        const newValue = Math.max(0, Math.min(state.image.width / 2, state.dragging.originalValue - (pos.x - state.dragStart.x)))
        elements.marginRight.value = Math.round(newValue)
      } else if (state.dragging.type === 'vline') {
        // Constrain between adjacent lines
        const index = state.dragging.index
        // vLines = [leftBorder, ...customVLines, rightBorder]
        // So customVLines[index] is at vLines[index + 1]
        const minX = vLines[index] + 10  // Previous line in vLines
        const maxX = vLines[index + 2] - 10  // Next line in vLines
        const newX = Math.max(minX, Math.min(maxX, pos.x))
        state.customVLines[index] = newX
        console.log(`Dragging vline ${index}: ${newX} (between ${minX} and ${maxX})`)
      } else if (state.dragging.type === 'hline') {
        // Constrain between adjacent lines
        const index = state.dragging.index
        // hLines = [topBorder, ...customHLines, bottomBorder]
        // So customHLines[index] is at hLines[index + 1]
        const minY = hLines[index] + 10  // Previous line in hLines
        const maxY = hLines[index + 2] - 10  // Next line in hLines
        const newY = Math.max(minY, Math.min(maxY, pos.y))
        state.customHLines[index] = newY
        console.log(`Dragging hline ${index}: ${newY} (between ${minY} and ${maxY})`)
      }
      
      drawOverlay()
      elements.canvas.style.cursor = 'grabbing'
    } else {
      // Check if hovering over a line
      hoveredLine = getNearestLine(pos.x, pos.y)
      
      if (hoveredLine) {
        const isVertical = hoveredLine.type === 'margin-left' || hoveredLine.type === 'margin-right' || hoveredLine.type === 'vline'
        elements.canvas.style.cursor = isVertical ? 'ew-resize' : 'ns-resize'
      } else {
        elements.canvas.style.cursor = 'default'
      }
    }
  })
  
  elements.canvas.addEventListener('mousedown', (e) => {
    if (!state.image) return
    
    const pos = getMousePos(e)
    const line = getNearestLine(pos.x, pos.y)
    
    if (line) {
      state.dragging = {
        type: line.type,
        originalValue: line.value,
        index: line.index  // Important: save the index!
      }
      state.dragStart = pos
      e.preventDefault()
      console.log('Started dragging:', state.dragging)
    }
  })
  
  elements.canvas.addEventListener('mouseup', () => {
    state.dragging = null
    state.dragStart = null
  })
  
  elements.canvas.addEventListener('mouseleave', () => {
    state.dragging = null
    state.dragStart = null
    elements.canvas.style.cursor = 'default'
  })
}

const loadImage = (file) => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve({ img, url })
    img.onerror = reject
    img.src = url
  })
}

const handleFile = async (file) => {
  if (!file) return
  clearSlices()
  try {
    const { img, url } = await loadImage(file)
    if (state.imageURL) URL.revokeObjectURL(state.imageURL)
    state.image = img
    state.imageURL = url
    elements.uploadStatus.textContent = `✓ 已上传 (${img.width}×${img.height})`
    drawOverlay()
  } catch (error) {
    console.error(error)
    elements.uploadStatus.textContent = '加载图片失败'
  }
}

const computeCells = () => {
  const rows = readNumber(elements.rows, 1, 200, 1)
  const cols = readNumber(elements.cols, 1, 200, 1)
  const marginTop = readNumber(elements.marginTop, 0)
  const marginBottom = readNumber(elements.marginBottom, 0)
  const marginLeft = readNumber(elements.marginLeft, 0)
  const marginRight = readNumber(elements.marginRight, 0)
  const gapX = readNumber(elements.gapX, 0)
  const gapY = readNumber(elements.gapY, 0)
  const padX = readNumber(elements.padX, 0)
  const padY = readNumber(elements.padY, 0)

  const { width, height } = state.image
  const usableWidth = width - marginLeft - marginRight - gapX * (cols - 1)
  const usableHeight = height - marginTop - marginBottom - gapY * (rows - 1)
  if (usableWidth <= 0 || usableHeight <= 0) {
    throw new Error('参数过大导致可用区域为 0')
  }
  const cellW = usableWidth / cols
  const cellH = usableHeight / rows

  return {
    rows,
    cols,
    cellW,
    cellH,
    marginTop,
    marginLeft,
    gapX,
    gapY,
    padX,
    padY
  }
}

const createSlice = (cell, format) => {
  const offscreen = document.createElement('canvas')
  offscreen.width = cell.width
  offscreen.height = cell.height
  const offCtx = offscreen.getContext('2d')
  offCtx.drawImage(
    state.image,
    cell.sx,
    cell.sy,
    cell.sWidth,
    cell.sHeight,
    0,
    0,
    cell.width,
    cell.height
  )
  return new Promise((resolve) => {
    offscreen.toBlob((blob) => resolve(blob), format, format === 'image/jpeg' ? 0.92 : undefined)
  })
}

const sliceImage = async () => {
  if (!state.image) {
    elements.sliceInfo.textContent = '请先上传图片'
    return
  }
  
  const format = elements.format.value
  const { vLines, hLines } = calculateGridLines()
  
  if (vLines.length < 2 || hLines.length < 2) {
    elements.sliceInfo.textContent = '网格配置无效'
    return
  }
  
  const rows = hLines.length - 1
  const cols = vLines.length - 1
  const padX = readNumber(elements.padX, 0)
  const padY = readNumber(elements.padY, 0)
  
  const slices = []
  let index = 1

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x1 = vLines[c]
      const x2 = vLines[c + 1]
      const y1 = hLines[r]
      const y2 = hLines[r + 1]
      
      const sx = x1 + padX
      const sy = y1 + padY
      const sWidth = (x2 - x1) - padX * 2
      const sHeight = (y2 - y1) - padY * 2
      
      if (sWidth <= 0 || sHeight <= 0) continue
      
      const blob = await createSlice(
        {
          sx,
          sy,
          sWidth,
          sHeight,
          width: sWidth,
          height: sHeight
        },
        format
      )
      const url = URL.createObjectURL(blob)
      const name = `slice-${r + 1}-${c + 1}.${format === 'image/png' ? 'png' : 'jpg'}`
      slices.push({ blob, url, name, index: index++, row: r + 1, col: c + 1 })
    }
  }

  clearSlices()
  state.slices = slices
  renderResults()
  elements.sliceInfo.textContent = `切割完成：${rows} x ${cols} = ${rows * cols} 个`
}

const renderResults = () => {
  if (!state.slices.length) return
  elements.results.hidden = false
  elements.gifSection.hidden = false
  const frag = document.createDocumentFragment()
  state.slices.forEach((slice) => {
    const card = document.createElement('div')
    card.className = 'thumb'

    const img = document.createElement('img')
    img.src = slice.url
    img.alt = slice.name

    const label = document.createElement('div')
    label.textContent = `${slice.row} 行 ${slice.col} 列`

    const btn = document.createElement('button')
    btn.textContent = '下载'
    btn.addEventListener('click', () => downloadBlob(slice.blob, slice.name))

    card.appendChild(img)
    card.appendChild(label)
    card.appendChild(btn)
    frag.appendChild(card)
  })
  elements.resultGrid.innerHTML = ''
  elements.resultGrid.appendChild(frag)
}

const downloadBlob = (blob, name) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

const downloadAll = async () => {
  if (!state.slices.length) return
  elements.downloadAll.disabled = true
  elements.downloadAll.textContent = '正在打包...'
  try {
    const zipBlob = await zipFiles(state.slices.map(({ name, blob }) => ({ name, blob })))
    downloadBlob(zipBlob, 'slices.zip')
  } catch (error) {
    console.error(error)
    elements.sliceInfo.textContent = '打包失败，请重试'
  } finally {
    elements.downloadAll.disabled = false
    elements.downloadAll.textContent = '批量下载 ZIP'
  }
}

const importFromClipboard = async () => {
  if (typeof window.parent.clipboardGetAll !== 'function') {
    elements.uploadStatus.textContent = '剪贴板功能不可用'
    return
  }
  
  const clipboardItems = window.parent.clipboardGetAll()
  
  if (!clipboardItems || clipboardItems.length === 0) {
    elements.uploadStatus.textContent = '剪贴板为空'
    return
  }
  
  // Use the first item
  const item = clipboardItems[0]
  if (!item || !item.url) {
    elements.uploadStatus.textContent = '剪贴板项目无效'
    return
  }
  
  elements.uploadStatus.textContent = `正在导入: ${item.name}`
  
  try {
    const response = await fetch(item.url)
    const blob = await response.blob()
    const file = new File([blob], item.name, { type: item.type })
    await handleFile(file)
  } catch (error) {
    console.error('导入失败:', error)
    elements.uploadStatus.textContent = `导入失败: ${error.message}`
  }
}

// Listen for clipboard paste messages
window.addEventListener('message', async (event) => {
  if (event.data.type === 'clipboard-paste' && event.data.item) {
    const item = event.data.item
    if (!item || !item.url) {
      elements.uploadStatus.textContent = '剪贴板项目无效'
      return
    }
    
    elements.uploadStatus.textContent = `正在导入: ${item.name}`
    
    try {
      const response = await fetch(item.url)
      const blob = await response.blob()
      const file = new File([blob], item.name, { type: item.type })
      await handleFile(file)
    } catch (error) {
      console.error('导入失败:', error)
      elements.uploadStatus.textContent = `导入失败: ${error.message}`
    }
  }
})

const setupUpload = () => {
  elements.file.addEventListener('change', (e) => {
    const file = e.target.files?.[0]
    handleFile(file)
  })
  
  elements.importClipboard.addEventListener('click', importFromClipboard)

  const preventDefaults = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  ;['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
    elements.uploader.addEventListener(eventName, preventDefaults, false)
  })

  elements.uploader.addEventListener(
    'dragenter',
    () => elements.uploader.classList.add('dragging'),
    false
  )
  elements.uploader.addEventListener(
    'dragleave',
    () => elements.uploader.classList.remove('dragging'),
    false
  )
  elements.uploader.addEventListener('drop', (e) => {
    const dt = e.dataTransfer
    const file = dt?.files?.[0]
    elements.uploader.classList.remove('dragging')
    handleFile(file)
  })
}

const setupControls = () => {
  const inputs = [
    elements.rows,
    elements.cols,
    elements.marginTop,
    elements.marginBottom,
    elements.marginLeft,
    elements.marginRight,
    elements.gapX,
    elements.gapY
  ]
  inputs.forEach((input) => input.addEventListener('input', drawOverlay))
}

const generateGif = async () => {
  if (!state.slices.length) {
    elements.gifInfo.textContent = '请先切割图片'
    elements.gifPreviewContainer.hidden = false
    return
  }

  elements.generateGifBtn.disabled = true
  elements.generateGifBtn.textContent = '生成中...'
  elements.gifPreviewContainer.hidden = false
  elements.gifInfo.textContent = '正在准备帧数据...'
  elements.downloadGifBtn.disabled = true

  try {
    const delay = readNumber(elements.gifDelay, 10, 5000, 100)
    const order = elements.gifOrder.value

    // Prepare frame order
    let frames = [...state.slices]
    if (order === 'reverse') {
      frames = frames.reverse()
    } else if (order === 'pingpong') {
      frames = [...frames, ...frames.slice(0, -1).reverse()]
    }

    console.log('准备生成 GIF，帧数:', frames.length)

    // Check if gifshot is loaded
    if (typeof gifshot === 'undefined') {
      throw new Error('GIF 库未加载，请刷新页面重试')
    }

    elements.gifInfo.textContent = `正在生成 GIF (${frames.length} 帧)...`

    // Load all images first
    const imageElements = await Promise.all(
      frames.map((frame) => {
        return new Promise((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = () => reject(new Error('图片加载失败'))
          img.src = frame.url
        })
      })
    )

    console.log('图片加载完成，开始生成 GIF')

    // Convert delay from ms to seconds (gifshot uses seconds)
    const interval = delay / 1000

    // Create GIF using gifshot with loaded images
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('生成超时，请减少帧数或降低图片尺寸'))
      }, 30000) // 30 second timeout

      gifshot.createGIF(
        {
          images: imageElements,
          interval: interval,
          sampleInterval: 10,
          numWorkers: 2
        },
        (obj) => {
          clearTimeout(timeout)
          if (obj.error) {
            reject(new Error(obj.error))
          } else {
            resolve(obj)
          }
        }
      )
    })

    console.log('GIF 生成完成')

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
    elements.downloadGifBtn.disabled = false

    const sizeKB = (blob.size / 1024).toFixed(1)
    elements.gifInfo.textContent = `✓ GIF 生成成功！大小: ${sizeKB} KB，帧数: ${frames.length}`
  } catch (error) {
    console.error('GIF 生成失败:', error)
    elements.gifInfo.textContent = `✗ 生成失败: ${error.message}`
  } finally {
    elements.generateGifBtn.disabled = false
    elements.generateGifBtn.textContent = '生成 GIF 预览'
  }
}

const downloadGif = () => {
  if (!state.gifBlob) return
  downloadBlob(state.gifBlob, 'animation.gif')
}

const sendToClipboard = () => {
  if (!state.slices.length) return
  
  if (typeof window.parent.clipboardAddMultiple === 'function') {
    const items = state.slices.map((slice) => ({
      name: slice.name,
      url: slice.url,
      blob: slice.blob,
      type: slice.blob.type,
      source: '多图切割',
      metadata: {
        row: slice.row,
        col: slice.col,
        index: slice.index
      }
    }))
    
    window.parent.clipboardAddMultiple(items)
    elements.sliceInfo.textContent = `✓ 已发送 ${items.length} 张图片到剪贴板`
  } else {
    elements.sliceInfo.textContent = '剪贴板功能不可用'
  }
}

const resetGrid = () => {
  state.customVLines = []
  state.customHLines = []
  drawOverlay()
  elements.sliceInfo.textContent = '网格已重置为等比例'
}

const setupActions = () => {
  elements.sliceBtn.addEventListener('click', sliceImage)
  elements.resetGrid.addEventListener('click', resetGrid)
  elements.downloadAll.addEventListener('click', downloadAll)
  elements.sendToClipboard.addEventListener('click', sendToClipboard)
  elements.generateGifBtn.addEventListener('click', generateGif)
  elements.downloadGifBtn.addEventListener('click', downloadGif)
}

const init = () => {
  setupUpload()
  setupControls()
  setupActions()
  setupCanvasInteraction()
}

init()
