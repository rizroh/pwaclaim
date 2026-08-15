# 開支索償 PWA — Redesign (pwaclaim)

Mobile-first 開支索償 PWA：相機／上傳收據 → OCR / Gemini / Grok Vision 分析 → 儲存 → PDF 匯出。

## 已完成

- 模組化架構（Vite + vite-plugin-pwa）
- 相機、多圖上傳 + 壓縮
- 本地 Tesseract OCR（中英）
- Gemini AI 多圖分析 + 月結報告（modal 顯示，避免中文亂碼）
- Grok Vision（用 xAI API Key，已移除 OAuth 登入）
- PDF 生成（中文支援）
- 設定頁：Gemini / xAI API Key + 模型選擇
- PWA 安裝按鈕 + placeholder icons

## 環境變數（Vercel）

```
GEMINI_API_KEY=...
XAI_API_KEY=xai-...
```

（已不再需要 GROK_CLIENT_ID / GROK_CLIENT_SECRET）

## 本機開發

```bash
npm install
npm run dev
```

## 部署

Push 到 GitHub → Vercel 自動 build（Framework: Vite，Output: dist）

## Offline / 安裝注意

1. Icons：public/icons/icon-192.png、icon-512.png 而家係純色 placeholder，正式上線請換成真正 logo。
2. HTTPS：PWA 安裝同 Service Worker 需要 HTTPS（Vercel 預設有）。
3. 安裝：Chrome「加到主畫面」／Safari「分享 → 加入主畫面」。Header 有「📲 安裝」按鈕。
4. Offline：vite-plugin-pwa 會 cache 靜態資源；API 呼叫（Gemini/Grok）離線時會失敗屬正常。本地已儲存嘅開支可離線睇。

## 模型列表（已清理）

Gemini：gemini-2.5-flash（預設）、gemini-2.5-flash-lite、gemini-2.0-flash、gemini-1.5-flash、gemini-1.5-flash-8b

Grok Vision：grok-2-vision-latest（預設）、grok-2-vision、grok-4.5
