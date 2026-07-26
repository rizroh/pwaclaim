/**
 * Settings View – Gemini + xAI / Grok
 */

import { showToast } from './toast.js';

export function renderSettings(container) {
  const geminiKey = localStorage.getItem('user_gemini_api_key') || '';
  const xaiKey = localStorage.getItem('user_xai_api_key') || '';
  const geminiModel = localStorage.getItem('gemini_model') || 'gemini-2.5-flash';
  const grokModel = localStorage.getItem('grok_vision_model') || 'grok-2-vision-latest';

  container.innerHTML = `
    <h2 class="font-semibold text-lg mb-5">設定</h2>

    <div class="space-y-4">
      <!-- Gemini -->
      <div class="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm">
        <label class="block text-sm font-medium mb-1">Gemini API Key（可選）</label>
        <p class="text-xs text-slate-500 mb-3">優先使用你嘅 Key，只存在本機。</p>
        <input id="gemini-key" type="password" value="${geminiKey}" placeholder="AIza..." 
          class="w-full border border-slate-200 focus:border-primary-500 rounded-xl px-3 py-2.5 text-sm outline-none transition mb-3">
        
        <label class="block text-xs font-medium text-slate-500 mb-1.5">Gemini 模型</label>
        <select id="gemini-model" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none mb-3">
          <option value="gemini-2.5-flash" ${geminiModel === 'gemini-2.5-flash' ? 'selected' : ''}>gemini-2.5-flash（推薦）</option>
          <option value="gemini-2.5-flash-lite" ${geminiModel === 'gemini-2.5-flash-lite' ? 'selected' : ''}>gemini-2.5-flash-lite</option>
          <option value="gemini-2.0-flash" ${geminiModel === 'gemini-2.0-flash' ? 'selected' : ''}>gemini-2.0-flash</option>
          <option value="gemini-1.5-flash" ${geminiModel === 'gemini-1.5-flash' ? 'selected' : ''}>gemini-1.5-flash</option>
          <option value="gemini-3.5-flash-lite" ${geminiModel === 'gemini-3.5-flash-lite' ? 'selected' : ''}>gemini-3.5-flash-lite</option>
          <option value="gemini-3.5-flash" ${geminiModel === 'gemini-3.5-flash' ? 'selected' : ''}>gemini-3.5-flash</option>
          <option value="gemini-3.6-flash" ${geminiModel === 'gemini-3.6-flash' ? 'selected' : ''}>gemini-3.6-flash</option>
        </select>
      </div>

      <!-- xAI / Grok -->
      <div class="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm">
        <label class="block text-sm font-medium mb-1">xAI API Key（Grok Vision，可選）</label>
        <p class="text-xs text-slate-500 mb-3">用於 Grok 收據分析。去 <a href="https://console.x.ai" target="_blank" class="text-primary-700 underline">console.x.ai</a> 申請。</p>
        <input id="xai-key" type="password" value="${xaiKey}" placeholder="xai-..." 
          class="w-full border border-slate-200 focus:border-primary-500 rounded-xl px-3 py-2.5 text-sm outline-none transition mb-3">
        
        <label class="block text-xs font-medium text-slate-500 mb-1.5">Grok Vision 模型</label>
        <select id="grok-model" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none">
          <option value="grok-2-vision-latest" ${grokModel === 'grok-2-vision-latest' ? 'selected' : ''}>grok-2-vision-latest（推薦）</option>
          <option value="grok-2-vision" ${grokModel === 'grok-2-vision' ? 'selected' : ''}>grok-2-vision</option>
          <option value="grok-4.5" ${grokModel === 'grok-4.5' ? 'selected' : ''}>grok-4.5</option>
          <option value="grok-4-fast-non-reasoning" ${grokModel === 'grok-4-fast-non-reasoning' ? 'selected' : ''}>grok-4-fast-non-reasoning</option>
        </select>
      </div>

      <button id="btn-save-key" class="w-full bg-primary-800 text-white py-3 rounded-2xl text-sm font-medium active:scale-[0.98] transition">
        儲存所有設定
      </button>

      <!-- Info -->
      <div class="bg-slate-100 rounded-3xl p-4 text-xs text-slate-600 space-y-1.5">
        <p>• 所有開支數據同相片都只存在你部手機</p>
        <p>• Gemini / Grok 只會暫時收到收據圖片做分析</p>
        <p>• Grok OAuth 登入用嚟顯示身份（可選）</p>
        <p>• 系統亦可喺 Vercel 設定 <code>GEMINI_API_KEY</code> 同 <code>XAI_API_KEY</code></p>
      </div>

      <button id="btn-clear" class="w-full border border-red-200 text-red-600 py-3 rounded-2xl text-sm font-medium hover:bg-red-50 active:scale-[0.98] transition">
        清除所有本地數據
      </button>
    </div>
  `;

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
