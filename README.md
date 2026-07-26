# 開支索償 PWA — Redesign (v2 Working Skeleton)

這是根據原有 `expenseepwa` 做的 **Priority 1 + Priority 2** 重構，已移植主要功能。

## 已完成功能

### 架構 (Priority 1)
- 從單一巨型 `index.html` 拆成清晰模組
- Vite 開發環境 + vite-plugin-pwa
- 簡單 reactive state
- 保留原有 Vercel Serverless Functions

### 視覺與互動 (Priority 2)
- 更現代底部導航（中間 FAB）
- 乾淨卡片 + empty state
- 改善 toast
- 統一設計系統

### 已移植核心功能
- ✅ 相機拍照（後置鏡頭優先）
- ✅ 多圖上傳 + 壓縮
- ✅ 本地 Tesseract OCR（中英）
- ✅ Gemini AI 多圖分析（自動加總、填表）
- ✅ PDF 生成（支援中文、收據相片頁）
- ✅ Gemini 月結報告
- ✅ Grok OAuth 登入流程
- ✅ 設定頁（自備 Gemini Key）

## 目錄結構

```
expenseepwa-redesign/
├── index.html
├── package.json
├── vite.config.js
├── README.md
├── api/                    # Serverless (Gemini + Grok OAuth)
│   ├── gemini.js
│   ├── auth-login.js
│   └── auth-callback.js
└── src/
    ├── main.js
    ├── app.js
    ├── state.js
    ├── utils.js
    ├── ui/
    │   ├── dashboard.js
    │   ├── add-expense.js
    │   ├── settings.js
    │   └── toast.js
    └── services/
        ├── storage.js
        ├── ocr.js
        ├── gemini.js
        └── pdf.js
```

## 如何運行

```bash
cd expenseepwa-redesign
npm install
npm run dev
```

然後打開 http://localhost:5173

> 注意：Gemini 同 Grok OAuth 需要部署到 Vercel 並設定環境變數（GEMINI_API_KEY、GROK_CLIENT_ID、GROK_CLIENT_SECRET）先可以完整使用。本地開發時 OCR 同 UI 可以正常運作。

## 下一步可做

1. 生成真正高質素 PWA icons
2. 把 Tailwind 轉成正式 build
3. 改善月結報告顯示方式（用 modal 代替 alert）
4. 加入資料匯出 / 匯入
5. 更完善的 offline 體驗

原專案：https://github.com/rizroh/expenseepwa
