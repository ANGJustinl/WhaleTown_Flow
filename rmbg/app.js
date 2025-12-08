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
  downloadLink: document.querySelector('#download-link')
}

let inputURL = null
let outputURL = null

const setStatus = (text) => {
  elements.status.textContent = text
}

const setProgress = (text) => {
  elements.progress.textContent = text
}

const resetOutput = () => {
  if (outputURL) URL.revokeObjectURL(outputURL)
  outputURL = null
  elements.previewOutput.src = ''
  elements.downloadLink.removeAttribute('href')
  elements.downloadLink.classList.add('hidden')
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

    outputURL = URL.createObjectURL(result)
    elements.previewOutput.src = outputURL
    elements.downloadLink.href = outputURL
    elements.downloadLink.classList.remove('hidden')
    setStatus('完成')
  } catch (error) {
    console.error(error)
    setStatus(`失败：${error.message}`)
  } finally {
    disableUI(false)
  }
})
