import { zipFiles } from './zip.js'

const elements = {
  file: document.querySelector('#file-input'),
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
  sliceInfo: document.querySelector('#slice-info'),
  results: document.querySelector('#results'),
  resultGrid: document.querySelector('#result-grid'),
  downloadAll: document.querySelector('#download-all'),
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
  gifURL: null
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

const drawOverlay = () => {
  if (!state.image) return
  const rows = readNumber(elements.rows, 1, 200, 1)
  const cols = readNumber(elements.cols, 1, 200, 1)
  const marginTop = readNumber(elements.marginTop, 0)
  const marginBottom = readNumber(elements.marginBottom, 0)
  const marginLeft = readNumber(elements.marginLeft, 0)
  const marginRight = readNumber(elements.marginRight, 0)
  const gapX = readNumber(elements.gapX, 0)
  const gapY = readNumber(elements.gapY, 0)

  const { width, height } = state.image
  elements.canvas.width = width
  elements.canvas.height = height

  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(state.image, 0, 0, width, height)

  const usableWidth = width - marginLeft - marginRight - gapX * (cols - 1)
  const usableHeight = height - marginTop - marginBottom - gapY * (rows - 1)
  if (usableWidth <= 0 || usableHeight <= 0) {
    elements.sliceInfo.textContent = '参数过大，超出图片尺寸'
    return
  }
  const cellW = usableWidth / cols
  const cellH = usableHeight / rows

  ctx.save()
  ctx.strokeStyle = '#ef4444'
  ctx.lineWidth = 2

  // outer border
  ctx.strokeRect(marginLeft, marginTop, usableWidth + gapX * (cols - 1), usableHeight + gapY * (rows - 1))

  // vertical grid lines
  let x = marginLeft
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath()
    ctx.moveTo(x, marginTop)
    ctx.lineTo(x, marginTop + usableHeight + gapY * (rows - 1))
    ctx.stroke()
    x += cellW
    if (c < cols) x += gapX
  }

  // horizontal grid lines
  let y = marginTop
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath()
    ctx.moveTo(marginLeft, y)
    ctx.lineTo(marginLeft + usableWidth + gapX * (cols - 1), y)
    ctx.stroke()
    y += cellH
    if (r < rows) y += gapY
  }

  ctx.restore()
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
  let cells
  try {
    cells = computeCells()
  } catch (err) {
    elements.sliceInfo.textContent = err.message
    return
  }
  const { rows, cols, cellW, cellH, marginTop, marginLeft, gapX, gapY, padX, padY } = cells
  const slices = []
  let index = 1

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sx = marginLeft + c * (cellW + gapX) + padX
      const sy = marginTop + r * (cellH + gapY) + padY
      const sWidth = cellW - padX * 2
      const sHeight = cellH - padY * 2
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

const setupUpload = () => {
  elements.file.addEventListener('change', (e) => {
    const file = e.target.files?.[0]
    handleFile(file)
  })

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

const setupActions = () => {
  elements.sliceBtn.addEventListener('click', sliceImage)
  elements.downloadAll.addEventListener('click', downloadAll)
  elements.generateGifBtn.addEventListener('click', generateGif)
  elements.downloadGifBtn.addEventListener('click', downloadGif)
}

const init = () => {
  setupUpload()
  setupControls()
  setupActions()
}

init()
