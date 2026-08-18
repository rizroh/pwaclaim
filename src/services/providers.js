/**
 * LLM / vision provider registry
 * Add a provider here instead of scattering UI + services.
 */

import { analyzeReceipt as geminiOne } from './gemini.js';
import { analyzeReceiptWithGrok } from './grok.js';
import { analyzeReceiptOpenRouter } from './openrouter.js';
import { runAnalyzeMultiple } from './analyze-multiple.js';

/** Migrate old openrouter keys → aggregator keys once */
export function migrateAggregatorKeys() {
  if (!localStorage.getItem('user_aggregator_api_key') && localStorage.getItem('user_openrouter_api_key')) {
    localStorage.setItem('user_aggregator_api_key', localStorage.getItem('user_openrouter_api_key'));
  }
  if (!localStorage.getItem('aggregator_model') && localStorage.getItem('openrouter_model')) {
    localStorage.setItem('aggregator_model', localStorage.getItem('openrouter_model'));
  }
  if (!localStorage.getItem('aggregator_base_url') && localStorage.getItem('openrouter_base_url')) {
    localStorage.setItem('aggregator_base_url', localStorage.getItem('openrouter_base_url'));
  }
}

export const PROVIDERS = {
  gemini: {
    id: 'gemini',
    label: 'Gemini AI 分析',
    emoji: '✨',
    btnClass: 'bg-indigo-600 hover:bg-indigo-700',
    keyStorageKey: 'user_gemini_api_key',
    requiresUserKey: false, // server may have GEMINI_API_KEY
    async analyzeMultiple(images, onProgress) {
      const userKey = localStorage.getItem('user_gemini_api_key') || '';
      const model = localStorage.getItem('gemini_model') || 'gemini-3.5-flash-lite';
      return runAnalyzeMultiple(
        images,
        (img) => geminiOne(img, userKey, model),
        { onProgress, label: 'Gemini', gapMs: 1000 }
      );
    }
  },
  grok: {
    id: 'grok',
    label: 'Grok Vision 分析',
    emoji: '🚀',
    btnClass: 'bg-black hover:bg-slate-800',
    keyStorageKey: 'user_xai_api_key',
    requiresUserKey: false,
    async analyzeMultiple(images, onProgress) {
      const model = localStorage.getItem('grok_vision_model') || 'grok-2-vision-latest';
      return runAnalyzeMultiple(
        images,
        (img) => analyzeReceiptWithGrok(img, model),
        { onProgress, label: 'Grok', gapMs: 800 }
      );
    }
  },
  aggregator: {
    id: 'aggregator',
    label: 'LLM Aggregator 分析',
    emoji: '🌐',
    btnClass: 'bg-violet-700 hover:bg-violet-800',
    keyStorageKey: 'user_aggregator_api_key',
    requiresUserKey: true,
    async analyzeMultiple(images, onProgress) {
      return runAnalyzeMultiple(
        images,
        (img) => analyzeReceiptOpenRouter(img),
        { onProgress, label: 'Aggregator', gapMs: 800 }
      );
    }
  }
};

export function listProviders() {
  return Object.values(PROVIDERS);
}

export function getProvider(id) {
  return PROVIDERS[id] || null;
}
