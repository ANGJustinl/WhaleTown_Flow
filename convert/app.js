const elements = {
  fileInput: document.querySelector('#file-input'),
  dropZone: document.querySelector('#drop-zone'),
  status: document.querySelector('#status'),
  preview: document.querySelector('#preview'),
  previewPlaceholder: document.querySelector('#preview-placeholder'),
  fileInfo: document.querySelector('#file-info'),
  formatRadios: document.querySelectorAll('input[name="format"]'),
  qualityControl: document.querySelector('#quality-control'),
  qualitySlider: document.querySelector('#quality-slider'),
  qualityValue: document.querySelector('#quality-value'),
  icoSizes: document.querySelector('#ico-sizes'),
  convertBtn: document.querySelector('#convert-btn'),
  resultPreview: document.querySelector('#result-preview'),
  resultPlaceholder: document.querySelector('#result-placeholder'),
  resultInfo: document.querySelector('#result-info'),
  resultSize: document.querySelector('#result-size'),
  downloadBtn: document.querySelector('#download-btn'),
  sendToClipboard: document.querySelector('#send-to-clipboard'),
  importClipboard: document.querySelector('#import-clipboard'),
  icoResults: document.querySelector('#ico-results')
}

let currentFile = null
let convertedBlob = null
let convertedUrl = null
let icoBlobs = [] // Store multiple ICO blobs

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

const showPreview = (file) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    elements.preview.src = e.target.result
    elements.preview.hidden = false
    elements.previewPlaceholder.hidden = true
    
    const ext = file.name.split('.').pop().toUpperCase()
    elements.fileInfo.textContent = `${ext} · ${formatBytes(file.size)}`
  }
  reader.readAsDataURL(file)
}

const clearResult = () => {
  elements.resultPreview.hidden = true
  elements.icoResults.hidden = true
  elements.icoResults.innerHTML = ''
  elements.resultPlaceholder.hidden = false
  elements.resultInfo.hidden = true
  elements.downloadBtn.disabled = true
  elements.sendToClipboard.disabled = true
  
  if (convertedUrl) {
    URL.revokeObjectURL(convertedUrl)
    convertedUrl = null
  }
  
  // Clean up ICO blobs
  icoBlobs.forEach(item => {
    if (item.url) URL.revokeObjectURL(item.url)
  })
  icoBlobs = []
  
  convertedBlob = null
}

const getSelectedFormat = () => {
  const selected = Array.from(elements.formatRadios).find(r => r.checked)
  return selected ? selected.value : 'png'
}

const getQuality = () => {
  return parseInt(elements.qualitySlider.value) / 100
}

const getIcoSizes = () => {
  const checkboxes = elements.icoSizes.querySelectorAll('input[type="checkbox"]:checked')
  return Array.from(checkboxes).map(cb => parseInt(cb.value))
}

const updateFormatUI = () => {
  const format = getSelectedFormat()
  
  // Show/hide quality control
  if (format === 'jpeg' || format === 'webp') {
    elements.qualityControl.hidden = false
  } else {
    elements.qualityControl.hidden = true
  }
  
  // Show/hide ICO sizes
  if (format === 'ico') {
    elements.icoSizes.hidden = false
  } else {
    elements.icoSizes.hidden = true
  }
  
  // Update download button text
  if (format === 'ico' && !elements.downloadBtn.disabled) {
    elements.downloadBtn.textContent = '打包下载'
  } else {
    elements.downloadBtn.textContent = '下载文件'
  }
}

const convertImage = async () => {
  if (!currentFile) return
  
  const format = getSelectedFormat()
  setStatus('正在转换...')
  clearResult()
  
  try {
    if (format === 'ico') {
      await convertToIco()
    } else {
      await convertToFormat(format)
    }
  } catch (error) {
    console.error('转换失败:', error)
    setStatus('转换失败，请重试')
  }
}

const convertToFormat = async (format) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        
        const ctx = canvas.getContext('2d')
        
        // For JPEG, fill white background
        if (format === 'jpeg') {
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
        
        ctx.drawImage(img, 0, 0)
        
        const mimeType = format === 'jpeg' ? 'image/jpeg' : 
                        format === 'webp' ? 'image/webp' : 'image/png'
        const quality = (format === 'jpeg' || format === 'webp') ? getQuality() : undefined
        
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('转换失败'))
            return
          }
          
          convertedBlob = blob
          convertedUrl = URL.createObjectURL(blob)
          
          elements.resultPreview.src = convertedUrl
          elements.resultPreview.hidden = false
          elements.resultPlaceholder.hidden = true
          elements.resultInfo.hidden = false
          
          const originalSize = currentFile.size
          const newSize = blob.size
          const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(1)
          
          elements.resultSize.textContent = `${formatBytes(newSize)} ${
            newSize < originalSize ? `(减少 ${reduction}%)` : 
            newSize > originalSize ? `(增加 ${((newSize - originalSize) / originalSize * 100).toFixed(1)}%)` : 
            '(大小相同)'
          }`
          
          elements.downloadBtn.disabled = false
          elements.sendToClipboard.disabled = false
          setStatus('转换完成')
          resolve()
        }, mimeType, quality)
      } catch (error) {
        reject(error)
      }
    }
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = URL.createObjectURL(currentFile)
  })
}

const convertToIco = async () => {
  const sizes = getIcoSizes()
  if (sizes.length === 0) {
    setStatus('请至少选择一个 ICO 尺寸')
    return
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = async () => {
      try {
        icoBlobs = []
        let totalSize = 0
        let completed = 0
        
        // Create PNG for each size
        const promises = sizes.map(size => {
          return new Promise((resolveBlob) => {
            const canvas = document.createElement('canvas')
            canvas.width = size
            canvas.height = size
            
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, size, size)
            
            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob)
                icoBlobs.push({ size, blob, url })
                totalSize += blob.size
              }
              completed++
              resolveBlob()
            }, 'image/png')
          })
        })
        
        await Promise.all(promises)
        
        // Sort by size
        icoBlobs.sort((a, b) => a.size - b.size)
        
        // Display all ICO results
        elements.icoResults.innerHTML = ''
        icoBlobs.forEach((item, index) => {
          const div = document.createElement('div')
          div.className = 'ico-item'
          
          const img = document.createElement('img')
          img.src = item.url
          img.alt = `${item.size}×${item.size}`
          
          const label = document.createElement('div')
          label.className = 'ico-item-label'
          label.textContent = `${item.size}×${item.size}`
          
          const sizeText = document.createElement('div')
          sizeText.className = 'ico-item-size'
          sizeText.textContent = formatBytes(item.blob.size)
          
          const downloadBtn = document.createElement('button')
          downloadBtn.className = 'ico-item-download'
          downloadBtn.textContent = '下载'
          downloadBtn.onclick = () => {
            const a = document.createElement('a')
            a.href = item.url
            a.download = `favicon-${item.size}x${item.size}.png`
            a.click()
          }
          
          div.appendChild(img)
          div.appendChild(label)
          div.appendChild(sizeText)
          div.appendChild(downloadBtn)
          elements.icoResults.appendChild(div)
        })
        
        elements.icoResults.hidden = false
        elements.resultPlaceholder.hidden = true
        elements.resultInfo.hidden = false
        
        elements.resultSize.textContent = `共 ${sizes.length} 个尺寸，总大小 ${formatBytes(totalSize)}`
        
        elements.downloadBtn.disabled = false
        elements.sendToClipboard.disabled = false
        elements.downloadBtn.textContent = '打包下载'
        setStatus(`转换完成，生成 ${sizes.length} 个尺寸`)
        resolve()
      } catch (error) {
        reject(error)
      }
    }
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = URL.createObjectURL(currentFile)
  })
}

const handleFiles = (files) => {
  if (!files?.length) return
  const [file] = files
  
  if (!file.type.startsWith('image/')) {
    setStatus('请选择图片文件')
    return
  }
  
  currentFile = file
  showPreview(file)
  clearResult()
  elements.convertBtn.disabled = false
  setStatus('已选择文件，请选择格式后点击转换')
}

const downloadResult = async () => {
  const format = getSelectedFormat()
  
  if (format === 'ico' && icoBlobs.length > 0) {
    // Download all ICO sizes as ZIP
    await downloadIcoAsZip()
  } else if (convertedBlob) {
    // Single file download
    const ext = format === 'jpeg' ? 'jpg' : format
    const filename = `converted.${ext}`
    
    const a = document.createElement('a')
    a.href = convertedUrl
    a.download = filename
    a.click()
  }
}

const downloadIcoAsZip = async () => {
  // Import JSZip dynamically
  if (typeof JSZip === 'undefined') {
    // Fallback: download largest size only
    if (icoBlobs.length > 0) {
      const largest = icoBlobs[icoBlobs.length - 1]
      const a = document.createElement('a')
      a.href = largest.url
      a.download = `favicon-${largest.size}x${largest.size}.png`
      a.click()
    }
    return
  }
  
  const zip = new JSZip()
  
  // Add each ICO size to ZIP
  for (const item of icoBlobs) {
    zip.file(`favicon-${item.size}x${item.size}.png`, item.blob)
  }
  
  // Generate ZIP and download
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(zipBlob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = 'favicons.zip'
  a.click()
  
  setTimeout(() => URL.revokeObjectURL(url), 1000)
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
  
  // Use the first item
  const item = clipboardItems[0]
  if (!item || !item.url) {
    setStatus('剪贴板项目无效')
    return
  }
  
  setStatus(`正在导入: ${item.name}`)
  
  try {
    const response = await fetch(item.url)
    const blob = await response.blob()
    const file = new File([blob], item.name, { type: item.type })
    handleFiles([file])
  } catch (error) {
    console.error('导入失败:', error)
    setStatus(`导入失败: ${error.message}`)
  }
}

// Listen for clipboard paste messages
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
      handleFiles([file])
    } catch (error) {
      console.error('导入失败:', error)
      setStatus(`导入失败: ${error.message}`)
    }
  }
})

const wireEvents = () => {
  elements.fileInput.addEventListener('change', (e) => handleFiles(e.target.files))
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
  
  elements.formatRadios.forEach(radio => {
    radio.addEventListener('change', updateFormatUI)
  })
  
  elements.qualitySlider.addEventListener('input', (e) => {
    elements.qualityValue.textContent = e.target.value
  })
  
  elements.convertBtn.addEventListener('click', convertImage)
  elements.downloadBtn.addEventListener('click', downloadResult)
  
  elements.sendToClipboard.addEventListener('click', () => {
    const format = getSelectedFormat()
    
    if (format === 'ico' && icoBlobs.length > 0) {
      // Send all ICO sizes
      if (typeof window.parent.clipboardAddMultiple === 'function') {
        const items = icoBlobs.map((item) => ({
          name: `favicon-${item.size}x${item.size}.png`,
          url: item.url,
          blob: item.blob,
          type: 'image/png',
          source: '格式转换',
          metadata: {
            format: 'ico',
            size: item.size
          }
        }))
        
        window.parent.clipboardAddMultiple(items)
        setStatus(`✓ 已发送 ${items.length} 个 ICO 尺寸到剪贴板`)
      }
    } else if (convertedBlob && convertedUrl) {
      // Send single converted image
      if (typeof window.parent.clipboardAdd === 'function') {
        const ext = format === 'jpeg' ? 'jpg' : format
        const name = currentFile ? currentFile.name.replace(/\.[^.]+$/, '') + `.${ext}` : `converted.${ext}`
        
        window.parent.clipboardAdd({
          name: name,
          url: convertedUrl,
          blob: convertedBlob,
          type: convertedBlob.type,
          source: '格式转换',
          metadata: {
            format: format,
            original: currentFile?.name
          }
        })
        
        setStatus('✓ 已发送到剪贴板')
      }
    } else {
      setStatus('没有可发送的结果')
    }
  })
}

const bootstrap = () => {
  setStatus('未选择文件')
  updateFormatUI()
  wireEvents()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap)
} else {
  bootstrap()
}
