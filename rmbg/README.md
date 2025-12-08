# RMBG BRIA 精简版

只保留 BRIA RMBG 1.4 模型的最小 Web 版，直接在浏览器本地跑 ONNX + WebAssembly 去背。  
modified from [zhbhun/rmbg](https://github.com/zhbhun/rmbg)

## 目录
- `index.html` / `styles.css` / `app.js`：简易界面与控制逻辑
- `scripts/`：模型定义、下载、推理逻辑（来自主仓库简化）
- `models/`：BRIA ONNX 分片（5 个文件，约 44 MB）

## 使用方式
1. 在 `rmbg_bria` 目录开启本地静态服务，例如：
   - `python3 -m http.server 8000`  
   - 或 `npx serve`（需本地有 Node 环境）
2. 浏览器打开对应地址（如 `http://localhost:8000`）。
3. 选择图片后点击“开始去背”，等待进度完成后可预览或下载结果。

## 说明
- ONNX Runtime WASM 通过默认的 unpkg 公网地址加载，若需离线部署可将 `scripts/config.js` 中 `defaultONNXPublicPath` 指向本地静态目录并将对应 `.wasm` 文件放置其中。
- 模型文件沿用主仓库的 BRIA RMBG 1.4（仅限许可范围内使用）。
