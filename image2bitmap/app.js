const elements = {
  fileInput: document.querySelector('#file-input'),
  dropZone: document.querySelector('#drop-zone'),
  status: document.querySelector('#status'),
  preview: document.querySelector('#preview'),
  previewPlaceholder: document.querySelector('#preview-placeholder'),
  svgOutput: document.querySelector('#svg-output'),
  svgPlaceholder: document.querySelector('#svg-placeholder'),
  downloadBtn: document.querySelector('#download-btn'),
  sendToClipboard: document.querySelector('#send-to-clipboard')
}

let lastSVGBlobUrl = null
let lastSVGBlob = null
let currentFileName = null

const setStatus = (text) => {
  elements.status.textContent = text
}

const clearSVG = () => {
  elements.svgOutput.innerHTML = ''
  elements.svgPlaceholder.hidden = false
  elements.downloadBtn.disabled = true
  elements.sendToClipboard.disabled = true
  if (lastSVGBlobUrl) {
    URL.revokeObjectURL(lastSVGBlobUrl)
    lastSVGBlobUrl = null
  }
  lastSVGBlob = null
}

const showPreview = (src) => {
  elements.preview.src = src
  elements.preview.hidden = false
  elements.previewPlaceholder.hidden = true
}

const handleSVGResult = (svgString) => {
  elements.svgOutput.innerHTML = svgString
  elements.svgPlaceholder.hidden = true

  // Remove inline width/height from SVG to allow CSS scaling
  const svgElement = elements.svgOutput.querySelector('svg')
  if (svgElement) {
    // Store original dimensions in viewBox if not present
    const width = svgElement.getAttribute('width')
    const height = svgElement.getAttribute('height')
    
    if (width && height && !svgElement.getAttribute('viewBox')) {
      svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`)
    }
    
    // Remove fixed dimensions to allow responsive scaling
    svgElement.removeAttribute('width')
    svgElement.removeAttribute('height')
  }

  // Prepare downloadable blob
  lastSVGBlob = new Blob([svgString], { type: 'image/svg+xml' })
  lastSVGBlobUrl = URL.createObjectURL(lastSVGBlob)
  elements.downloadBtn.disabled = false
  elements.sendToClipboard.disabled = false
}

const vectorize = (file) => {
  if (!file) return

  currentFileName = file.name
  setStatus('正在矢量化...')
  clearSVG()

  const reader = new FileReader()
  reader.onload = (e) => {
    const src = e.target.result
    showPreview(src)

    if (typeof ImageTracer === 'undefined') {
      setStatus('ImageTracer.js 未加载')
      return
    }

    // 使用数据 URL 作为输入，结果通过回调返回
    ImageTracer.imageToSVG(
      src,
      (svgString) => {
        handleSVGResult(svgString)
        setStatus(`矢量化完成，大小约 ${(svgString.length / 1024).toFixed(1)} KB`)
      },
      { ltres: 1, qtres: 1, scale: 1 }
    )
  }
  reader.onerror = () => setStatus('读取文件失败，请重试')
  reader.readAsDataURL(file)
}

const handleFiles = (files) => {
  if (!files?.length) return
  const [file] = files
  if (!file.type.startsWith('image/')) {
    setStatus('请选择图片文件')
    return
  }
  vectorize(file)
}

const wireEvents = () => {
  elements.fileInput.addEventListener('change', (e) => handleFiles(e.target.files))

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

  elements.downloadBtn.addEventListener('click', () => {
    if (!lastSVGBlobUrl) return
    const a = document.createElement('a')
    a.href = lastSVGBlobUrl
    a.download = 'vectorized.svg'
    a.click()
  })
  
  elements.sendToClipboard.addEventListener('click', () => {
    if (!lastSVGBlob || !lastSVGBlobUrl) {
      setStatus('没有可发送的结果')
      return
    }
    
    if (typeof window.parent.clipboardAdd === 'function') {
      const name = currentFileName ? currentFileName.replace(/\.[^.]+$/, '') + '.svg' : 'vectorized.svg'
      
      window.parent.clipboardAdd({
        name: name,
        url: lastSVGBlobUrl,
        blob: lastSVGBlob,
        type: 'image/svg+xml',
        source: '图片矢量化',
        metadata: {
          original: currentFileName
        }
      })
      
      setStatus('✓ 已发送到剪贴板')
    } else {
      setStatus('剪贴板功能不可用')
    }
  })
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
