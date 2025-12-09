// 全局剪贴板管理器
// 用于在不同工作流之间共享图片数据

class GlobalClipboard {
  constructor() {
    this.items = []
    this.listeners = []
    this.maxItems = 50 // 最多保存 50 个项目
    this.storageKey = 'whaletown_clipboard'
    
    // 尝试从 sessionStorage 恢复
    this.loadFromStorage()
  }

  // 添加项目到剪贴板
  add(item) {
    const clipboardItem = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      name: item.name || `Item ${this.items.length + 1}`,
      url: item.url, // Data URL or Blob URL
      blob: item.blob,
      type: item.type || 'image/png',
      source: item.source || 'unknown', // 来源工作流
      metadata: item.metadata || {}
    }

    this.items.unshift(clipboardItem)
    
    // 限制数量
    if (this.items.length > this.maxItems) {
      const removed = this.items.pop()
      if (removed.url && removed.url.startsWith('blob:')) {
        URL.revokeObjectURL(removed.url)
      }
    }

    this.saveToStorage()
    this.notifyListeners()
    
    return clipboardItem.id
  }

  // 批量添加
  addMultiple(items) {
    const ids = []
    items.forEach(item => {
      ids.push(this.add(item))
    })
    return ids
  }

  // 获取所有项目
  getAll() {
    return [...this.items]
  }

  // 获取单个项目
  get(id) {
    return this.items.find(item => item.id === id)
  }

  // 删除项目
  remove(id) {
    const index = this.items.findIndex(item => item.id === id)
    if (index !== -1) {
      const removed = this.items.splice(index, 1)[0]
      if (removed.url && removed.url.startsWith('blob:')) {
        URL.revokeObjectURL(removed.url)
      }
      this.saveToStorage()
      this.notifyListeners()
      return true
    }
    return false
  }

  // 清空剪贴板
  clear() {
    this.items.forEach(item => {
      if (item.url && item.url.startsWith('blob:')) {
        URL.revokeObjectURL(item.url)
      }
    })
    this.items = []
    this.saveToStorage()
    this.notifyListeners()
  }

  // 获取数量
  count() {
    return this.items.length
  }

  // 监听变化
  onChange(callback) {
    this.listeners.push(callback)
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index !== -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  // 通知监听器
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.items)
      } catch (error) {
        console.error('Clipboard listener error:', error)
      }
    })
  }

  // 保存到 sessionStorage (仅保存元数据，不保存 blob)
  saveToStorage() {
    try {
      const metadata = this.items.map(item => ({
        id: item.id,
        timestamp: item.timestamp,
        name: item.name,
        type: item.type,
        source: item.source,
        metadata: item.metadata
      }))
      sessionStorage.setItem(this.storageKey, JSON.stringify(metadata))
    } catch (error) {
      console.warn('Failed to save clipboard to storage:', error)
    }
  }

  // 从 sessionStorage 加载
  loadFromStorage() {
    try {
      const data = sessionStorage.getItem(this.storageKey)
      if (data) {
        // 仅加载元数据，实际数据需要重新生成
        // 这里只是为了显示历史记录
      }
    } catch (error) {
      console.warn('Failed to load clipboard from storage:', error)
    }
  }
}

// 创建全局实例
window.globalClipboard = window.globalClipboard || new GlobalClipboard()

// 导出便捷方法
window.clipboardAdd = (item) => window.globalClipboard.add(item)
window.clipboardAddMultiple = (items) => window.globalClipboard.addMultiple(items)
window.clipboardGetAll = () => window.globalClipboard.getAll()
window.clipboardGet = (id) => window.globalClipboard.get(id)
window.clipboardRemove = (id) => window.globalClipboard.remove(id)
window.clipboardClear = () => window.globalClipboard.clear()
window.clipboardCount = () => window.globalClipboard.count()
window.clipboardOnChange = (callback) => window.globalClipboard.onChange(callback)

console.log('✓ 全局剪贴板已加载')
