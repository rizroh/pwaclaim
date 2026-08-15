/**
 * Settings View – dynamic Gemini models + xAI key
 */

import { showToast } from './toast.js';

export function renderSettings(container) {
  const geminiKey = localStorage.getItem('user_gemini_api_key') || '';
  const xaiKey = localStorage.getItem('user_xai_api_key') || '';
  const geminiModel = localStorage.getItem('gemini_model') || 'gemini-3.5-flash-lite';
  const grokModel = localStorage.getItem('grok_vision_model') || 'grok-2-vision-latest';

  container.innerHTML = `
    <h2 class="font-semibold text-lg mb-5">設定</h2>

    <div class="space-y-4">
      <!-- Gemini -->
      <div class="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm">
        <label class="block text-sm font-medium mb-1">Gemini API Key（可選）</label>
        <p class="text-xs text-slate-500 mb-3">優先使用你嘅 Key。亦可喺 Vercel 設定 <code>GEMINI_API_KEY</code>。</p>
        <input id="gemini-key" type="password" value="${geminiKey}" placeholder="AIza..." 
          class="w-full border border-slate-200 focus:border-primary-500 rounded-xl px-3 py-2.5 text-sm outline-none transition mb-3">
        
        <div class="flex items-center justify-between mb-1.5">
          <label class="block text-xs font-medium text-slate-500">Gemini 模型（動態）</label>
          <button type="button" id="btn-refresh-models" class="text-[11px] text-primary-700 font-medium hover:underline">重新整理列表</button>
        </div>
        <select id="gemini-model" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none">
          <option value="${geminiModel}">${geminiModel}（載入中…）</option>
        </select>
        <p id="models-status" class="text-[10px] text-slate-400 mt-1.5">正在向 Gemini 取得可用模型…</p>
      </div>

      <!-- xAI / Grok Vision -->
      <div class="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm">
        <label class="block text-sm font-medium mb-1">xAI API Key（Grok Vision，可選）</label>
        <p class="text-xs text-slate-500 mb-3">用於 Grok 收據分析。去 <a href="https://console.x.ai" target="_blank" rel="noopener" class="text-primary-700 underline">console.x.ai</a> 申請。</p>
        <input id="xai-key" type="password" value="${xaiKey}" placeholder="xai-..." 
          class="w-full border border-slate-200 focus:border-primary-500 rounded-xl px-3 py-2.5 text-sm outline-none transition mb-3">
        
        <label class="block text-xs font-medium text-slate-500 mb-1.5">Grok Vision 模型</label>
        <select id="grok-model" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none">
          <option value="grok-2-vision-latest" ${grokModel === 'grok-2-vision-latest' ? 'selected' : ''}>grok-2-vision-latest（推薦）</option>
          <option value="grok-2-vision" ${grokModel === 'grok-2-vision' ? 'selected' : ''}>grok-2-vision</option>
          <option value="grok-4.5" ${grokModel === 'grok-4.5' ? 'selected' : ''}>grok-4.5</option>
        </select>
      </div>

      <button id="btn-save-key" class="w-full bg-primary-800 text-white py-3 rounded-2xl text-sm font-medium active:scale-[0.98] transition">
        儲存所有設定
      </button>

      <div class="bg-slate-100 rounded-3xl p-4 text-xs text-slate-600 space-y-1.5">
        <p>• 模型列表會跟你嘅 API Key 動態載入</p>
        <p>• 建議用 <b>gemini-3.5-flash-lite</b>（Free Tier 額度通常最高）</p>
        <p>• 系統亦可喺 Vercel 設定 <code>GEMINI_API_KEY</code> 同 <code>XAI_API_KEY</code></p>
      </div>

      <button id="btn-clear" class="w-full border border-red-200 text-red-600 py-3 rounded-2xl text-sm font-medium hover:bg-red-50 active:scale-[0.98] transition">
        清除所有本地數據
      </button>
    </div>
  `;

  loadGeminiModels(geminiKey, geminiModel);

  document.getElementById('btn-refresh-models')?.addEventListener('click', () => {
    const key = document.getElementById('gemini-key')?.value.trim() || '';
    loadGeminiModels(key, document.getElementById('gemini-model')?.value);
  });

  document.getElementById('btn-save-key')?.addEventListener('click', () => {
    const gKey = document.getElementById('gemini-key').value.trim();
    const xKey = document.getElementById('xai-key').value.trim();
    const gModel = document.getElementById('gemini-model').value;
    const grModel = document.getElementById('grok-model').value;

    if (gKey) localStorage.setItem('user_gemini_api_key', gKey);
    else localStorage.removeItem('user_gemini_api_key');

    if (xKey) localStorage.setItem('user_xai_api_key', xKey);
    else localStorage.removeItem('user_xai_api_key');

    localStorage.setItem('gemini_model', gModel);
    localStorage.setItem('grok_vision_model', grModel);

    showToast('設定已儲存', 'success');
  });

  document.getElementById('btn-clear')?.addEventListener('click', () => {
    if (!confirm('確定要清除所有開支同設定？此操作無法復原。')) return;
    localStorage.clear();
    showToast('已清除所有數據', 'success');
    setTimeout(() => location.reload(), 800);
  });
}

async function loadGeminiModels(userKey, selectedId) {
  const select = document.getElementById('gemini-model');
  const status = document.getElementById('models-status');
  if (!select) return;

  if (status) status.textContent = '正在向 Gemini 取得可用模型…';

  try {
    const res = await fetch('/api/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userApiKey: userKey || '' })
    });
    const data = await res.json().catch(() => ({}));
    const models = Array.isArray(data.models) ? data.models : [];
    const defaultModel = data.defaultModel || 'gemini-3.5-flash-lite';
    const current = selectedId || localStorage.getItem('gemini_model') || defaultModel;

    if (models.length === 0) {
      if (status) status.textContent = '無法取得列表，已用後備模型';
      fillSelect(select, [
        { id: 'gemini-3.5-flash-lite' },
        { id: 'gemini-3.5-flash' },
        { id: 'gemini-2.5-flash' }
      ], current);
      return;
    }

    fillSelect(select, models, current);

    // If saved model not in list, switch to default
    const ids = models.map(m => m.id);
    if (!ids.includes(current)) {
      select.value = defaultModel;
      localStorage.setItem('gemini_model', defaultModel);
    }

    if (status) {
      status.textContent = data.success
        ? `已載入 ${models.length} 個可用模型（預設：${defaultModel}）`
        : `載入部分失敗，顯示 ${models.length} 個後備模型`;
    }
  } catch (err) {
    console.warn('loadGeminiModels failed:', err);
    if (status) status.textContent = '載入失敗，已用後備列表';
    fillSelect(select, [
      { id: 'gemini-3.5-flash-lite' },
      { id: 'gemini-3.1-flash-lite' },
      { id: 'gemini-3.5-flash' },
      { id: 'gemini-3.6-flash' },
      { id: 'gemini-3.7-flash' },
      { id: 'gemini-2.5-flash' }
    ], selectedId || 'gemini-3.5-flash-lite');
  }
}

function fillSelect(select, models, selectedId) {
  select.innerHTML = models.map(m => {
    const id = m.id || m;
    const label = m.displayName && m.displayName !== id ? `${id} — ${m.displayName}` : id;
    const sel = id === selectedId ? ' selected' : '';
    return `<option value="${id}"${sel}>${label}</option>`;
  }).join('');
}
