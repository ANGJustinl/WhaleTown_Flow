import { createBriaaiModel } from './scripts/models.js'
import { defaultONNX } from './scripts/config.js'
import { rmbg } from './scripts/rmbg.js'

const elements = {
  file: document.querySelector('#file'),
  run: document.querySelector('#run'),
  status: document.querySelector('#status'),
  progress: document.querySelector('#progress'),
  previewInput: document.querySelector('#preview-input'),
  previewOutput: document.querySelector('#preview-output'),
  downloadLink: document.querySelector('#download-link'),
  sendToClipboard: document.querySelector('#send-to-clipboard')
}

let inputURL = null
let outputURL = null
let outputBlob = null

const setStatus = (text) => {
  elements.status.textContent = text
}

const setProgress = (text) => {
  elements.progress.textContent = text
}

const resetOutput = () => {
  if (outputURL) URL.revokeObjectURL(outputURL)
  outputURL = null
  outputBlob = null
  elements.previewOutput.src = ''
  elements.downloadLink.removeAttribute('href')
  elements.downloadLink.classList.add('hidden')
  elements.sendToClipboard.classList.add('hidden')
}

const updateInputPreview = (file) => {
  if (inputURL) URL.revokeObjectURL(inputURL)
  inputURL = URL.createObjectURL(file)
  elements.previewInput.src = inputURL
}

const disableUI = (disabled) => {
  elements.run.disabled = disabled
  elements.file.disabled = disabled
}

elements.file.addEventListener('change', () => {
  const file = elements.file.files?.[0]
  if (file) {
    updateInputPreview(file)
    resetOutput()
    setStatus('文件已选择，点击开始去背')
  } else {
    setStatus('请选择图片')
  }
})

elements.run.addEventListener('click', async () => {
  const file = elements.file.files?.[0]
  if (!file) {
    setStatus('请先选择图片')
    return
  }

  disableUI(true)
  resetOutput()
  setStatus('加载模型和算子...')
  setProgress('')

  try {
    const model = createBriaaiModel('./models/')
    const result = await rmbg(file, {
      model,
      onnx: defaultONNX,
      onProgress(progress, download, process) {
        setProgress(
          `进度 ${(progress * 100).toFixed(1)}% | 下载 ${(download * 100).toFixed(
            1
          )}% | 处理 ${(process * 100).toFixed(1)}%`
        )
      }
    })

    outputBlob = result
    outputURL = URL.createObjectURL(result)
    elements.previewOutput.src = outputURL
    elements.downloadLink.href = outputURL
    elements.downloadLink.classList.remove('hidden')
    elements.sendToClipboard.classList.remove('hidden')
    setStatus('完成')
  } catch (error) {
    console.error(error)
    setStatus(`失败：${error.message}`)
  } finally {
    disableUI(false)
  }
})

// 发送到剪贴板
elements.sendToClipboard.addEventListener('click', () => {
  if (!outputBlob || !outputURL) {
    setStatus('没有可发送的结果')
    return
  }
  
  if (typeof window.parent.clipboardAdd === 'function') {
    const filename = elements.file.files[0]?.name || 'image.png'
    const name = filename.replace(/\.[^.]+$/, '') + '_rmbg.png'
    
    window.parent.clipboardAdd({
      name: name,
      url: outputURL,
      blob: outputBlob,
      type: 'image/png',
      source: 'RMBG 抠图',
      metadata: {
        original: filename
      }
    })
    
    setStatus('✓ 已发送到剪贴板')
  } else {
    setStatus('剪贴板功能不可用')
  }
})
