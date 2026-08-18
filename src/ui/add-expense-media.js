import { state } from '../state.js';
import { showToast } from './toast.js';
import { compressImage } from '../utils.js';

export const MAX_IMAGES = 10;
let cameraStream = null;
let useFront = false;

export function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
  const modal = document.getElementById('camera-modal');
  if (modal) modal.classList.add('hidden');
}

export async function startCamera() {
  stopCamera();
  const modal = document.getElementById('camera-modal');
  const video = document.getElementById('camera-video');
  if (!modal || !video) return;
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: useFront ? 'user' : { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    });
    video.srcObject = cameraStream;
    modal.classList.remove('hidden');
  } catch (err) {
    showToast('無法開啟相機：' + err.message, 'error');
  }
}

export async function switchCamera() {
  useFront = !useFront;
  await startCamera();
}

export async function capturePhoto() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  const flash = document.getElementById('camera-flash');
  if (!video || !canvas || !video.videoWidth) {
    showToast('相機尚未就緒', 'warning');
    return;
  }
  if (state.currentImages.length >= MAX_IMAGES) {
    showToast(`最多 ${MAX_IMAGES} 張相片`, 'error');
    return;
  }
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  if (flash) {
    flash.classList.remove('hidden');
    setTimeout(() => flash.classList.add('hidden'), 120);
  }
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  try {
    state.currentImages.push(await compressImage(dataUrl));
    renderPreviews();
    showToast('已影相', 'success');
  } catch (e) {
    showToast('壓縮失敗：' + e.message, 'error');
  }
}

export async function handleFiles(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  const remaining = MAX_IMAGES - state.currentImages.length;
  if (remaining <= 0) {
    showToast(`最多 ${MAX_IMAGES} 張相片`, 'error');
    return;
  }
  for (const file of files.slice(0, remaining)) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const dataUrl = await readFile(file);
      state.currentImages.push(await compressImage(dataUrl));
    } catch (err) {
      showToast('讀取失敗：' + err.message, 'error');
    }
  }
  e.target.value = '';
  renderPreviews();
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}

export function renderPreviews() {
  const el = document.getElementById('previews');
  if (!el) return;
  el.innerHTML = '';
  state.currentImages.forEach((src, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'relative w-[72px] h-[72px] rounded-xl overflow-hidden border border-slate-200';
    const img = document.createElement('img');
    img.src = src;
    img.className = 'w-full h-full object-cover';
    img.alt = 'receipt ' + (i + 1);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs';
    btn.textContent = '×';
    btn.addEventListener('click', () => {
      state.currentImages.splice(i, 1);
      renderPreviews();
    });
    wrap.appendChild(img);
    wrap.appendChild(btn);
    el.appendChild(wrap);
  });
  const has = state.currentImages.length > 0;
  document.querySelectorAll('[data-analyze-btn]').forEach((b) => {
    b.classList.toggle('hidden', !has);
    b.classList.toggle('flex', has);
  });
  const note = document.getElementById('ocr-note');
  if (note) note.classList.toggle('hidden', !has);
}
