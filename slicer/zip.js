// 简易 ZIP 生成（存储模式，无压缩），支持在浏览器端批量打包 blob

const textEncoder = new TextEncoder()

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

const crc32 = (data) => {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const concat = (arrays) => {
  const total = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  arrays.forEach((arr) => {
    out.set(arr, offset)
    offset += arr.length
  })
  return out
}

const encodeName = (name) => textEncoder.encode(name)

export async function zipFiles(files) {
  // files: [{ name, blob }]
  const entries = []

  for (const file of files) {
    const data = new Uint8Array(await file.blob.arrayBuffer())
    const nameBytes = encodeName(file.name)
    const crc = crc32(data)
    entries.push({ ...file, data, nameBytes, crc })
  }

  const parts = []
  const central = []
  let offset = 0

  entries.forEach((entry) => {
    const nameLen = entry.nameBytes.length
    const localHeader = new Uint8Array(30 + nameLen)
    const localView = new DataView(localHeader.buffer)

    localView.setUint32(0, 0x04034b50, true) // local file header signature
    localView.setUint16(4, 20, true) // version needed to extract
    localView.setUint16(6, 0, true) // general purpose bit flag
    localView.setUint16(8, 0, true) // compression method (0 = stored)
    localView.setUint16(10, 0, true) // last mod file time
    localView.setUint16(12, 0, true) // last mod file date
    localView.setUint32(14, entry.crc, true) // crc-32
    localView.setUint32(18, entry.data.length, true) // compressed size
    localView.setUint32(22, entry.data.length, true) // uncompressed size
    localView.setUint16(26, nameLen, true) // file name length
    localView.setUint16(28, 0, true) // extra field length
    localHeader.set(entry.nameBytes, 30)

    parts.push(localHeader, entry.data)

    const centralHeader = new Uint8Array(46 + nameLen)
    const centralView = new DataView(centralHeader.buffer)

    centralView.setUint32(0, 0x02014b50, true) // central file header signature
    centralView.setUint16(4, 20, true) // version made by
    centralView.setUint16(6, 20, true) // version needed to extract
    centralView.setUint16(8, 0, true) // general purpose bit flag
    centralView.setUint16(10, 0, true) // compression method
    centralView.setUint16(12, 0, true) // file mod time
    centralView.setUint16(14, 0, true) // file mod date
    centralView.setUint32(16, entry.crc, true) // crc-32
    centralView.setUint32(20, entry.data.length, true) // compressed size
    centralView.setUint32(24, entry.data.length, true) // uncompressed size
    centralView.setUint16(28, nameLen, true) // file name length
    centralView.setUint16(30, 0, true) // extra field length
    centralView.setUint16(32, 0, true) // file comment length
    centralView.setUint16(34, 0, true) // disk number start
    centralView.setUint16(36, 0, true) // internal file attributes
    centralView.setUint32(38, 0, true) // external file attributes
    centralView.setUint32(42, offset, true) // relative offset of local header
    centralHeader.set(entry.nameBytes, 46)

    central.push(centralHeader)
    offset += localHeader.length + entry.data.length
  })

  const centralSize = central.reduce((sum, arr) => sum + arr.length, 0)

  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true) // end of central dir signature
  endView.setUint16(4, 0, true) // number of this disk
  endView.setUint16(6, 0, true) // disk where central directory starts
  endView.setUint16(8, entries.length, true) // number of central dir records on this disk
  endView.setUint16(10, entries.length, true) // total number of central dir records
  endView.setUint32(12, centralSize, true) // size of central directory
  endView.setUint32(16, offset, true) // offset of central directory
  endView.setUint16(20, 0, true) // zip file comment length

  const blob = new Blob([concat([...parts, ...central, end])], {
    type: 'application/zip'
  })
  return blob
}
