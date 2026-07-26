/**
 * Settings View
 */

import { showToast } from './toast.js';

export function renderSettings(container) {
  const userKey = localStorage.getItem('user_gemini_api_key') || '';
  const model = localStorage.getItem('gemini_model') || 'gemini-3.5-flash-lite';

  container.innerHTML = `
    <h2 class="font-semibold text-lg mb-5">設定</h2>

    <div class="space-y-4">
      <!-- Gemini Key -->
      <div class="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm">
        <label class="block text-sm font-medium mb-2">你的 Gemini API Key（可選）</label>
        <p class="text-xs text-slate-500 mb-3">輸入後會優先使用你嘅 Key，資料只存在本機。</p>
        <input id="gemini-key" type="password" value="${userKey}" placeholder="AIza..." 
          class="w-full border border-slate-200 focus:border-primary-500 rounded-xl px-3 py-2.5 text-sm outline-none transition mb-3">
        
        <label class="block text-xs font-medium text-slate-500 mb-1.5">模型</label>
        <select id="gemini-model" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none">
          <option value="gemini-3.5-flash-lite" ${model === 'gemini-3.5-flash-lite' ? 'selected' : ''}>gemini-3.5-flash-lite（推薦・額度最高）</option>
          <option value="gemini-3.5-flash" ${model === 'gemini-3.5-flash' ? 'selected' : ''}>gemini-3.5-flash</option>
          <option value="gemini-3.6-flash" ${model === 'gemini-3.6-flash' ? 'selected' : ''}>gemini-3.6-flash</option>
          <option value="gemini-2.5-flash" ${model === 'gemini-2.5-flash' ? 'selected' : ''}>gemini-2.5-flash</option>
          <option value="gemini-2.5-flash-lite" ${model === 'gemini-2.5-flash-lite' ? 'selected' : ''}>gemini-2.5-flash-lite</option>
        </select>
        
        <button id="btn-save-key" class="mt-3 w-full bg-primary-800 text-white py-2.5 rounded-xl text-sm font-medium active:scale-[0.98] transition">
          儲存設定
        </button>
      </div>

      <!-- Info -->
      <div class="bg-slate-100 rounded-3xl p-4 text-xs text-slate-600 space-y-1.5">
        <p>• 所有開支數據同相片都只存在你部手機</p>
        <p>• Gemini 只會暫時收到收據圖片做分析</p>
        <p>• Grok 登入用嚟身份驗證（可選）</p>
        <p>• 而家預設用 <b>gemini-3.5-flash-lite</b>（你帳戶額度最高）</p>
      </div>

      <button id="btn-clear" class="w-full border border-red-200 text-red-600 py-3 rounded-2xl text-sm font-medium hover:bg-red-50 active:scale-[0.98] transition">
        清除所有本地數據
      </button>
    </div>
  `;

  document.getElementById('btn-save-key')?.addEventListener('click', () => {
    const key = document.getElementById('gemini-key').value.trim();
    const m = document.getElementById('gemini-model').value;
    if (key) localStorage.setItem('user_gemini_api_key', key);
    else localStorage.removeItem('user_gemini_api_key');
    localStorage.setItem('gemini_model', m);
    showToast('設定已儲存', 'success');
  });

  document.getElementById('btn-clear')?.addEventListener('click', () => {
    if (!confirm('確定要清除所有開支同設定？此操作無法復原。')) return;
    localStorage.clear();
    showToast('已清除所有數據', 'success');
    setTimeout(() => location.reload(), 800);
  });
}
