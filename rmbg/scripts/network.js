import { defaultONNXPublicPath, defaultONNXWasms } from './config.js'

export async function loadResponse(response, onProgress) {
  if (response.body === null) return []
  let receivedLength = 0
  const chunks = []
  const reader = response.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    receivedLength += value.length
    onProgress(receivedLength)
  }
  return chunks
}

export async function loadFile(
  name,
  files,
  mime,
  size,
  abortController,
  onProgress
) {
  const controllers = {}
  let aborted = false
  const abort = () => {
    if (aborted) return
    aborted = true
    if (abortController?.signal.aborted === false) {
      abortController.abort()
    }
    files.forEach((_, index) => {
      controllers[index]?.abort()
      controllers[index] = undefined
    })
  }
  abortController?.signal.addEventListener('abort', abort)

  const loaded = Array(files.length)
  const chunks = await Promise.all(
    files.map(async (url, index) => {
      try {
        const controller =
          typeof AbortController !== 'undefined'
            ? new AbortController()
            : undefined
        if (controller) controllers[index] = controller
        loaded[index] = 0
        const response = await fetch(url, {
          signal: controller?.signal
        })
        const result = await (onProgress !== undefined
          ? new Blob(
              await loadResponse(response, (length) => {
                loaded[index] = length
                onProgress(
                  loaded.reduce((sum, item = 0) => sum + item, 0) / size
                )
              })
            ).arrayBuffer()
          : (await response.blob()).arrayBuffer())

        controllers[index] = undefined
        return result
      } catch (error) {
        abort()
        throw error
      }
    })
  )

  const data = new Blob(chunks, { type: mime })
  if (data.size !== size) {
    throw new Error(
      `Failed to fetch ${name}  with size ${size} but got ${data.size}`
    )
  }
  return data
}

export async function loadModel(model, options) {
  const { abortController, onProgress } = options ?? {}
  const file = await loadFile(
    model.name,
    model.files.map((file) => model.publicPath + file),
    model.mime,
    model.size,
    abortController,
    onProgress
  )
  return file
}

export async function loadWASM(
  { publicPath = defaultONNXPublicPath, wasms = defaultONNXWasms },
  options
) {
  const { abortController, onProgress } = options ?? {}
  const loaded = Array(wasms.length)
  const totalSize = wasms.reduce((sum, item) => sum + item.size, 0)
  const result = await Promise.all(
    wasms.map(async (wasm, index) => {
      loaded[index] = 0
      const ratio = wasm.size / totalSize
      const file = await loadFile(
        wasm.name,
        wasm.files.map((file) => publicPath + file),
        wasm.mime,
        wasm.size,
        abortController,
        onProgress
          ? (progress) => {
              loaded[index] = progress
              onProgress(loaded.reduce((sum, item = 0) => sum + item * ratio, 0))
            }
          : undefined
      )
      return [wasm.name, file]
    })
  )
  return result
}
