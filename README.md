# PWACLAIM

開支索償 PWA（Vite + Vercel）。本地 IndexedDB、相機收據、Gemini / Grok / LLM Aggregator、中文 PDF。

## Deploy

1. Push 到 GitHub，接 Vercel（Framework: Vite）
2. 可選環境變數：`GEMINI_API_KEY`、`XAI_API_KEY`、`OPENROUTER_API_KEY`、`OPENCODE_API_KEY`
3. 設定頁亦可填自己的 Key

## 安全

- CORS 只准同源；無 Origin 拒絕
- 請求要 `X-Expense-Client: pwaclaim`
- Aggregator Base URL allowlist（OpenRouter / Together / Fireworks / OpenCode）
- 匯入限 15MB / 2000 筆，sanitize `id`
- 月結報告唔送相片
