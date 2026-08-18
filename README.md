# 開支索償 PWA — pwaclaim

Mobile-first 開支索償：相機／上傳收據 → OCR / Gemini / Grok / **LLM Aggregator** → 儲存 → PDF 匯出。

## 功能

- Vite + vite-plugin-pwa（可安裝、離線殼）
- 相機／多圖上傳 + 壓縮（最多 10 張）
- 本地 Tesseract OCR（中英）
- **Provider registry**：Gemini、Grok Vision、OpenAI-compatible Aggregator（OpenRouter 等）
- 共用多圖分析合併邏輯（`analyze-multiple.js`）
- IndexedDB 儲存 + 匯出／匯入
- PDF（Noto Sans TC 字型）+ 手機預覽／下載
- AI 月結報告
- Security：CORS 同 host、CSP／安全 headers、toast XSS 防護、API 簡易 rate limit

## 架構（重點）

```
src/services/providers.js     ← 加新 AI 主要改呢度
src/services/analyze-multiple.js
src/ui/add-expense.js         ← shell
src/ui/add-expense-media.js   ← 相機／上傳
src/ui/add-expense-analyze.js ← OCR + providers
api/*                         ← Vercel serverless proxy
lib/cors.js, lib/rate-limit.js
```

## 環境變數（Vercel，可選）

```
GEMINI_API_KEY=
XAI_API_KEY=
OPENROUTER_API_KEY=
LLM_BASE_URL=https://openrouter.ai/api/v1
```

用戶亦可在 App **設定** 自填 Key（存 localStorage）。

## 設定：LLM Aggregator

1. API Key（例如 OpenRouter `sk-or-...`）
2. Base URL：`https://openrouter.ai/api/v1`（或其他兼容端點）
3. Model ID（需 **Vision**），例：`google/gemini-2.0-flash-001`

## 本機

```bash
npm install
npm run dev
```

## 部署

Push GitHub → Vercel（Framework: Vite，Output: `dist`）

## 注意

- Icons 仍為 placeholder，正式上線請換 logo
- PWA 需 HTTPS
- Rate limit 係 per-instance 記憶體限制，唔係全網全局
