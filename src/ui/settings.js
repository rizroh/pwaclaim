/**
 * Settings – dynamic models, export/import, keys
 */

import { showToast } from './toast.js';
import { exportAllData, importAllData, clearAllData, loadExpenses, IMPORT_LIMITS } from '../services/storage.js';
import { API_HEADERS } from '../services/api-headers.js';
import { state, setState } from '../state.js';
import { AGGREGATOR_PRESETS, listAggregatorPresets, getAggregatorPreset, matchPresetByBaseUrl } from '../services/aggregator-presets.js';

export function renderSettings(container) {
  const geminiKey = localStorage.getItem('user_gemini_api_key') || '';
  const xaiKey = localStorage.getItem('user_xai_api_key') || '';
  const geminiModel = localStorage.getItem('gemini_model') || 'gemini-3.5-flash-lite';
  const grokModel = localStorage.getItem('grok_vision_model') || 'grok-2-vision-latest';
  const orKey = localStorage.getItem('user_aggregator_api_key') || localStorage.getItem('user_openrouter_api_key') || '';
  const orModel = localStorage.getItem('aggregator_model') || localStorage.getItem('openrouter_model') || 'google/gemini-2.0-flash-001';
  const orBase = localStorage.getItem('aggregator_base_url') || localStorage.getItem('openrouter_base_url') || 'https://openrouter.ai/api/v1';
  const orPreset = localStorage.getItem('aggregator_preset') || matchPresetByBaseUrl(orBase);
  const presetOpts = listAggregatorPresets().map(p =>
    `<option value="${p.id}" ${p.id === orPreset ? 'selected' : ''}>${p.label}</option>`
  ).join('');

  container.innerHTML = `
    <h2 class="font-semibold text-lg mb-5">設定</h2>
    <div class="space-y-4">
      <div class="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm">
        <label class="block text-sm font-medium mb-1">Gemini API Key（可選）</label>
        <p class="text-xs text-slate-500 mb-3">優先使用你嘅 Key。</p>
        <input id="gemini-key" type="password" value="${geminiKey}" placeholder="AIza..."
          class="w-full border border-slate-200 focus:border-primary-500 rounded-xl px-3 py-2.5 text-sm outline-none transition mb-3">
        <div class="flex items-center justify-between mb-1.5">
          <label class="block text-xs font-medium text-slate-500">Gemini 模型（動態）</label>
          <button type="button" id="btn-refresh-models" class="text-[11px] text-primary-700 font-medium">重新整理列表</button>
        </div>
        <select id="gemini-model" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none">
          <option value="${geminiModel}">${geminiModel}</option>
        </select>
        <p id="models-status" class="text-[10px] text-slate-400 mt-1.5">載入模型中…</p>
      </div>

      <div class="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm">
        <label class="block text-sm font-medium mb-1">xAI API Key（Grok Vision）</label>
        <input id="xai-key" type="password" value="${xaiKey}" placeholder="xai-..."
          class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none transition mb-3">
        <label class="block text-xs font-medium text-slate-500 mb-1.5">Grok 模型</label>
        <select id="grok-model" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none">
          <option value="grok-2-vision-latest" ${grokModel === 'grok-2-vision-latest' ? 'selected' : ''}>grok-2-vision-latest</option>
          <option value="grok-2-vision" ${grokModel === 'grok-2-vision' ? 'selected' : ''}>grok-2-vision</option>
          <option value="grok-4.5" ${grokModel === 'grok-4.5' ? 'selected' : ''}>grok-4.5</option>
        </select>
      </div>

      <!-- LLM Aggregator -->
      <div class="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm">
        <label class="block text-sm font-medium mb-1">LLM Aggregator</label>
        <p class="text-xs text-slate-500 mb-3">OpenRouter / Together / Fireworks 或自訂 OpenAI-compatible 端點。分析收據請揀 <b>Vision</b> 模型。</p>

        <label class="block text-xs font-medium text-slate-500 mb-1.5">供應商 Preset</label>
        <select id="or-preset" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none mb-3">
          ${presetOpts}
        </select>

        <label class="block text-xs font-medium text-slate-500 mb-1.5">API Key</label>
        <input id="or-key" type="password" value="${orKey}" placeholder="API Key"
          class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none transition mb-3">

        <label class="block text-xs font-medium text-slate-500 mb-1.5">Base URL</label>
        <input id="or-base" type="url" value="${orBase}" placeholder="https://openrouter.ai/api/v1"
          class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none transition mb-3">

        <div class="flex items-center justify-between mb-1.5">
          <label class="block text-xs font-medium text-slate-500">模型（動態列表）</label>
          <button type="button" id="btn-refresh-agg-models" class="text-[11px] text-primary-700 font-medium">重新整理列表</button>
        </div>
        <select id="or-model" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none mb-1">
          <option value="${orModel}">${orModel}</option>
        </select>
        <p id="agg-models-status" class="text-[10px] text-slate-400 mt-1">填 Key 後撳「重新整理」載入模型；Vision 模型會排前面。</p>
      </div>

      <button id="btn-save-key" class="w-full bg-primary-800 text-white py-3 rounded-2xl text-sm font-medium">儲存設定</button>

      <!-- Export / Import -->
      <div class="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm space-y-2">
        <p class="text-sm font-medium">資料備份</p>
        <p class="text-xs text-slate-500 mb-2">匯出 JSON 備份；換機可匯入還原（含相片）。</p>
        <div class="grid grid-cols-2 gap-2">
          <button id="btn-export" class="py-2.5 rounded-xl border border-slate-200 text-sm font-medium hover:bg-slate-50">匯出</button>
          <label class="py-2.5 rounded-xl border border-slate-200 text-sm font-medium hover:bg-slate-50 text-center cursor-pointer">
            匯入
            <input type="file" id="import-file" accept="application/json,.json" class="hidden">
          </label>
        </div>
      </div>

      <div class="bg-slate-100 rounded-3xl p-4 text-xs text-slate-600 space-y-1.5">
        <p>• 資料存在本機 IndexedDB</p>
        <p>• 建議模型：gemini-3.5-flash-lite</p>
      </div>

      <button id="btn-clear" class="w-full border border-red-200 text-red-600 py-3 rounded-2xl text-sm font-medium">清除所有本地數據</button>
    </div>
  `;

  loadGeminiModels(geminiKey, geminiModel);
  loadAggregatorModels(orKey, orBase, orModel);

  document.getElementById('btn-refresh-models')?.addEventListener('click', () => {
    loadGeminiModels(document.getElementById('gemini-key')?.value.trim() || '', document.getElementById('gemini-model')?.value);
  });

  document.getElementById('or-preset')?.addEventListener('change', () => {
    const id = document.getElementById('or-preset').value;
    const preset = getAggregatorPreset(id);
    const baseEl = document.getElementById('or-base');
    const keyEl = document.getElementById('or-key');
    if (baseEl && preset.baseUrl) baseEl.value = preset.baseUrl;
    if (baseEl) baseEl.readOnly = true;
    if (keyEl && preset.keyPlaceholder) keyEl.placeholder = preset.keyPlaceholder;
    if (preset.defaultModel) {
      const sel = document.getElementById('or-model');
      if (sel && ![...sel.options].some(o => o.value === preset.defaultModel)) {
        const opt = document.createElement('option');
        opt.value = preset.defaultModel;
        opt.textContent = preset.defaultModel + ' (default)';
        sel.insertBefore(opt, sel.firstChild);
        sel.value = preset.defaultModel;
      } else if (sel) sel.value = preset.defaultModel;
    }
  });
  // lock base url for non-custom
  const initPreset = document.getElementById('or-preset')?.value || 'openrouter';
  const baseEl0 = document.getElementById('or-base');
  if (baseEl0) baseEl0.readOnly = true;

  document.getElementById('btn-refresh-agg-models')?.addEventListener('click', () => {
    loadAggregatorModels(
      document.getElementById('or-key')?.value.trim() || '',
      document.getElementById('or-base')?.value.trim() || '',
      document.getElementById('or-model')?.value
    );
  });

  document.getElementById('btn-save-key')?.addEventListener('click', () => {
    const gKey = document.getElementById('gemini-key').value.trim();
    const xKey = document.getElementById('xai-key').value.trim();
    if (gKey) localStorage.setItem('user_gemini_api_key', gKey);
    else localStorage.removeItem('user_gemini_api_key');
    if (xKey) localStorage.setItem('user_xai_api_key', xKey);
    else localStorage.removeItem('user_xai_api_key');
    localStorage.setItem('gemini_model', document.getElementById('gemini-model').value);
    localStorage.setItem('grok_vision_model', document.getElementById('grok-model').value);

    const orKeyVal = document.getElementById('or-key')?.value.trim() || '';
    const orPresetVal = document.getElementById('or-preset')?.value || 'openrouter';
    const preset = getAggregatorPreset(orPresetVal);
    const orBaseVal = (document.getElementById('or-base')?.value.trim() || preset.baseUrl || 'https://openrouter.ai/api/v1');
    const orModelVal = document.getElementById('or-model')?.value.trim() || preset.defaultModel || 'google/gemini-2.0-flash-001';
    localStorage.setItem('aggregator_preset', orPresetVal);
    if (orKeyVal) {
      localStorage.setItem('user_aggregator_api_key', orKeyVal);
      localStorage.setItem('user_openrouter_api_key', orKeyVal); // legacy alias
    } else {
      localStorage.removeItem('user_aggregator_api_key');
      localStorage.removeItem('user_openrouter_api_key');
    }
    localStorage.setItem('aggregator_base_url', orBaseVal);
    localStorage.setItem('aggregator_model', orModelVal);
    localStorage.setItem('openrouter_base_url', orBaseVal);
    localStorage.setItem('openrouter_model', orModelVal);

    showToast('設定已儲存', 'success');
  });

  document.getElementById('btn-export')?.addEventListener('click', async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `expense-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast(`已匯出 ${data.expenses.length} 筆`, 'success');
    } catch (e) {
      showToast('匯出失敗: ' + e.message, 'error');
    }
  });

  document.getElementById('import-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > IMPORT_LIMITS.maxBytes) {
        throw new Error('檔案太大（上限 15MB）');
      }
      const text = await file.text();
      const n = await importAllData(text, { byteLength: file.size });
      state.expenses = await loadExpenses();
      setState({ expenses: state.expenses });
      showToast(`已匯入 ${n} 筆開支`, 'success');
    } catch (err) {
      showToast('匯入失敗: ' + err.message, 'error');
    }
    e.target.value = '';
  });

  document.getElementById('btn-clear')?.addEventListener('click', async () => {
    if (!confirm('確定清除所有開支同設定？')) return;
    await clearAllData();
    localStorage.clear();
    state.expenses = [];
    showToast('已清除', 'success');
    setTimeout(() => location.reload(), 600);
  });
}

async function loadGeminiModels(userKey, selectedId) {
  const select = document.getElementById('gemini-model');
  const status = document.getElementById('models-status');
  if (!select) return;
  try {
    const res = await fetch('/api/models', {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify({ userApiKey: userKey || '' })
    });
    const data = await res.json().catch(() => ({}));
    const models = Array.isArray(data.models) ? data.models : [];
    const defaultModel = data.defaultModel || 'gemini-3.5-flash-lite';
    const current = selectedId || defaultModel;
    if (!models.length) {
      select.innerHTML = ['gemini-3.5-flash-lite','gemini-3.5-flash','gemini-2.5-flash']
        .map(id => `<option value="${id}" ${id===current?'selected':''}>${id}</option>`).join('');
      if (status) status.textContent = '使用後備列表';
      return;
    }
    select.innerHTML = models.map(m => {
      const id = m.id;
      return `<option value="${id}" ${id===current?'selected':''}>${id}</option>`;
    }).join('');
    if (!models.some(m => m.id === current)) {
      select.value = defaultModel;
    }
    if (status) status.textContent = `已載入 ${models.length} 個模型`;
  } catch {
    if (status) status.textContent = '載入失敗，用後備列表';
  }
}


async function loadAggregatorModels(userKey, baseUrl, selectedId) {
  const status = document.getElementById('agg-models-status');
  const select = document.getElementById('or-model');
  if (!select) return;

  if (!userKey) {
    if (status) status.textContent = '請先填 Aggregator API Key，再重新整理列表';
    return;
  }
  if (status) status.textContent = '載入模型中…';

  try {
    const res = await fetch('/api/openai-compatible', {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify({
        action: 'list-models',
        userApiKey: userKey,
        baseUrl: baseUrl || 'https://openrouter.ai/api/v1'
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);

    const models = data.models || [];
    const vision = data.visionModels || models.filter(m => m.isVision);
    select.innerHTML = '';

    const addGroup = (label, list) => {
      if (!list.length) return;
      const og = document.createElement('optgroup');
      og.label = label;
      list.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.isVision ? `👁 ${m.id}` : m.id;
        og.appendChild(opt);
      });
      select.appendChild(og);
    };

    addGroup('Vision 模型（建議）', vision);
    addGroup('其他模型', models.filter(m => !m.isVision));

    if (selectedId && [...select.options].some(o => o.value === selectedId)) {
      select.value = selectedId;
    } else if (vision[0]) {
      select.value = vision[0].id;
    }

    if (status) {
      status.textContent = `已載入 ${models.length} 個模型（Vision ${vision.length}）`;
    }
  } catch (err) {
    if (status) status.textContent = '載入失敗：' + err.message + '（仍可手動用而家選項）';
    // keep existing option
    if (selectedId && ![...select.options].some(o => o.value === selectedId)) {
      const opt = document.createElement('option');
      opt.value = selectedId;
      opt.textContent = selectedId;
      select.appendChild(opt);
      select.value = selectedId;
    }
  }
}
