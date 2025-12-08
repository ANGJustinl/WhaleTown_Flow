# Whaletown Flows Hub

单页多工作流聚合，使用 Tab 切换且每个工作流仅创建一次（切换时不重新加载 iframe）。

## 使用
1. 在项目根目录启动静态服务（示例 `python3 -m http.server 8000` 或者 `npx serve`）。
2. 浏览器打开 `http://localhost:8000/` 看到 Tab 界面，现在已挂载 `RMBG 抠图` 和 `多图切割`。
3. 切换 Tab 时不会重开 iframe，后台任务/状态会保留。

## 添加新工作流
1. 将新的工作流静态文件放到子目录，例如 `./myflow/index.html`。
2. 在 `app.js` 的 `flows` 数组中追加（注意 URL 末尾加 `/`，确保子目录内资源能正确加载）：
   ```js
   {
     id: 'myflow',
     name: 'My Flow',
     description: '描述',
     url: './myflow/index.html'
   }
   ```
3. 刷新聚合页即可看到新的 Tab。

## 现有工作流
- `rmbg/`：BRIA RMBG 1.4 前景抠图（浏览器内 ONNX + WASM）。
- `slicer/`：多图切割工具（网格/边距/间距可调，单个或批量 ZIP 下载）。
- `image2bitmap/`：图片矢量化（基于 ImageTracer.js 将位图转换为 SVG）。
