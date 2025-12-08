import { simd, threads } from 'https://unpkg.com/wasm-feature-detect@1.6.1/dist/esm/index.js'
import * as ort from 'https://unpkg.com/onnxruntime-web@1.16.2/dist/ort.es6.min.js'
import { defaultONNX, defaultMaxResolution } from './config.js'
import { loadModel, loadWASM } from './network.js'
import {
  imageSourceToImageData,
  imageDataResize,
  imageDataToFloat32Array,
  calculateProportionalSize,
  imageDataToBlob
} from './utils.js'

export async function rmbg(image, options) {
  const {
    model,
    onnx = defaultONNX,
    maxResolution = defaultMaxResolution,
    abortController,
    onProgress
  } = options

  // Handle different export shapes: ESM, UMD default, or global window.ort
  const runtime =
    (ort && ort.env ? ort : null) ??
    (ort?.default && ort.default.env ? ort.default : null) ??
    (typeof window !== 'undefined' ? window.ort : null)
  if (!runtime || !runtime.env || !runtime.env.wasm) {
    throw new Error('ONNX Runtime Web 加载失败，无法访问 env.wasm')
  }
  const wasmLoadController = new AbortController()
  const modelLoadController = new AbortController()
  let processInterval = null

  abortController?.signal.addEventListener('abort', () => {
    wasmLoadController.abort()
    modelLoadController.abort()
    if (processInterval) clearInterval(processInterval)
  })

  try {
    let progress = 0

    const capabilities = {
      simd: await simd(),
      threads: await threads(),
      SharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
      numThreads: navigator?.hardwareConcurrency ?? 4,
      webgpu: typeof navigator !== 'undefined' && navigator.gpu !== undefined
    }
    runtime.env.wasm.numThreads = capabilities.numThreads
    runtime.env.wasm.simd = capabilities.simd
    runtime.env.wasm.proxy = true

    const wasms = await loadWASM(onnx, {
      abortController: wasmLoadController,
      onProgress(value) {
        if (onProgress) {
          onProgress(progress + (1 / 3) * value, progress + (1 / 3) * value, 0)
        }
      }
    })
    runtime.env.wasm.wasmPaths = wasms.reduce((acc, item) => {
      acc[item[0]] = URL.createObjectURL(item[1])
      return acc
    }, {})
    progress += 1 / 3

    const modelData = await (
      await loadModel(model, {
        abortController: modelLoadController,
        onProgress(value) {
          if (onProgress) {
            onProgress(
              progress + (1 / 3) * value,
              progress + (2 / 3) * value,
              0
            )
          }
        }
      })
    ).arrayBuffer()

    const session = await runtime.InferenceSession.create(modelData, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
      executionMode: 'parallel',
      enableCpuMemArena: true
    }).catch((e) => {
      throw new Error(`Failed to create session: ${e}.`)
    })

    wasms.forEach((wasm) => {
      const wasmPaths = runtime.env.wasm.wasmPaths
      URL.revokeObjectURL(wasmPaths[wasm[0]])
    })
    progress += 1 / 3

    if (onProgress) {
      processInterval = setInterval(() => {
        if (progress >= 0.99 && processInterval) {
          clearInterval(processInterval)
          return
        }
        progress = Math.min(progress + 0.01, 0.99)
        onProgress(progress, 1, Math.min((1 - progress) * 3, 0.99))
      }, 1000)
    }

    let imageData = await imageSourceToImageData(image)
    let tensorImage = await imageDataResize(
      imageData,
      model.resolution,
      model.resolution
    )
    const tensorImageData = imageDataToFloat32Array(tensorImage)
    const outputData = await session.run(
      {
        [session.inputNames[0]]: new runtime.Tensor(
          'float32',
          new Float32Array(tensorImageData),
          [1, 3, model.resolution, model.resolution]
        )
      },
      {
        terminate: false
      }
    )
    const { outputNames } = session
    session.release().catch(() => {})

    const predictionsDict = []
    for (const key of outputNames) {
      const output = outputData[key]
      predictionsDict.push({
        data: output.data,
        shape: output.dims,
        dataType: 'float32'
      })
    }

    const stride = 4 * model.resolution * model.resolution
    for (let i = 0; i < stride; i += 4) {
      const idx = i / 4
      const alpha = predictionsDict[0].data[idx]
      tensorImage.data[i + 3] = alpha * 255
    }
    tensorImage = await imageDataResize(
      tensorImage,
      imageData.width,
      imageData.height
    )
    for (let i = 0; i < imageData.data.length; i += 4) {
      const idx = i + 3
      if (tensorImage.data[idx] === 0) {
        imageData.data[idx - 3] = 0
        imageData.data[idx - 2] = 0
        imageData.data[idx - 1] = 0
      }
      imageData.data[idx] = tensorImage.data[idx]
    }

    const [width, height] = calculateProportionalSize(
      imageData.width,
      imageData.height,
      maxResolution,
      maxResolution
    )
    if (width !== imageData.width || height !== imageData.height) {
      imageData = await imageDataResize(imageData, width, height)
    }

    // push a final 100% update before returning
    onProgress?.(1, 1, 1)
    return imageDataToBlob(imageData)
  } finally {
    if (processInterval) clearInterval(processInterval)
  }
}

export default rmbg
