export function calculateProportionalSize(
  originalWidth,
  originalHeight,
  maxWidth,
  maxHeight
) {
  if (originalWidth > maxWidth || originalHeight > maxHeight) {
    const widthRatio = maxWidth / originalWidth
    const heightRatio = maxHeight / originalHeight
    const scalingFactor = Math.min(widthRatio, heightRatio)
    const newWidth = Math.floor(originalWidth * scalingFactor)
    const newHeight = Math.floor(originalHeight * scalingFactor)
    return [newWidth, newHeight]
  }
  return [originalWidth, originalHeight]
}

export function isAbsoluteURL(url) {
  return /^(?:[a-z+]+:)?\/\//i.test(url)
}

export function ensureAbsoluteURL(url) {
  if (isAbsoluteURL(url)) {
    return url
  } else {
    return new URL(url, window.location.href).href
  }
}

export async function imageSourceToImageData(image) {
  if (typeof image === 'string') {
    image = ensureAbsoluteURL(image)
    image = new URL(image)
  }
  if (image instanceof URL) {
    const response = await fetch(image, {})
    image = await response.blob()
  }
  if (image instanceof ArrayBuffer || ArrayBuffer.isView(image)) {
    image = new Blob([image])
  }
  if (image instanceof Blob) {
    image = await blobToImageData(image)
  }
  return image
}

export async function imageDataResize(imageData, newWidth, newHeight) {
  const bitmap = await createImageBitmap(imageData, {
    resizeWidth: newWidth,
    resizeHeight: newHeight,
    resizeQuality: 'high',
    premultiplyAlpha: 'premultiply'
  })
  return imageBitmapToImageData(bitmap)
}

export function imageBitmapToImageData(imageBitmap) {
  if (window.OffscreenCanvas) {
    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(imageBitmap, 0, 0)
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  }
  const canvas = document.createElement('canvas')
  canvas.width = imageBitmap.width
  canvas.height = imageBitmap.height
  const context = canvas.getContext('2d')
  context.drawImage(imageBitmap, 0, 0)
  return context.getImageData(0, 0, canvas.width, canvas.height)
}

export async function blobToImageData(blob) {
  const imageBitmap = await createImageBitmap(blob)
  const imageData = imageBitmapToImageData(imageBitmap)
  return imageData
}

export function imageDataToFloat32Array(
  image,
  mean = [128, 128, 128],
  std = [256, 256, 256]
) {
  const imageBufferData = image.data
  const stride = image.width * image.height
  const float32Data = new Float32Array(3 * stride)

  for (let i = 0, j = 0; i < imageBufferData.length; i += 4, j += 1) {
    float32Data[j] = (imageBufferData[i] - mean[0]) / std[0]
    float32Data[j + stride] = (imageBufferData[i + 1] - mean[1]) / std[1]
    float32Data[j + stride + stride] =
      (imageBufferData[i + 2] - mean[2]) / std[2]
  }

  return float32Data
}

export async function imageDataToBlob(
  imageData,
  quality = 0.8,
  type = 'image/png'
) {
  if (window.OffscreenCanvas) {
    const canvas = new OffscreenCanvas(imageData.width, imageData.height)
    const ctx = canvas.getContext('2d')
    ctx.putImageData(imageData, 0, 0)
    return canvas.convertToBlob({ quality, type })
  }
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const context = canvas.getContext('2d')
  context.putImageData(imageData, 0, 0)
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob)
      },
      type,
      quality
    )
  })
}
