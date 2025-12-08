export function createBriaaiModel(publicPath = './models/') {
  return {
    name: 'briaai',
    files: [
      'briaai-1.onnx',
      'briaai-2.onnx',
      'briaai-3.onnx',
      'briaai-4.onnx',
      'briaai-5.onnx'
    ],
    mime: 'application/octet-stream',
    publicPath,
    resolution: 1024,
    size: 44403226
  }
}
