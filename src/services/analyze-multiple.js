export async function runAnalyzeMultiple(images, analyzeOne, { onProgress, label = 'AI', gapMs = 800 } = {}) {
  const list = Array.isArray(images) ? images : [];
  if (!list.length) throw new Error('沒有圖片');

  const statuses = list.map((_, index) => ({ index, state: 'pending' }));
  const notify = (cur) => {
    if (onProgress) onProgress(cur, list.length, { statuses: statuses.map((s) => ({ ...s })) });
  };

  const results = [];
  const successIndices = [];
  let failCount = 0;

  for (let i = 0; i < list.length; i++) {
    statuses[i].state = 'running';
    notify(i + 1);
    try {
      const data = await analyzeOne(list[i]);
      statuses[i].state = 'ok';
      results.push(data || {});
      successIndices.push(i);
    } catch (err) {
      statuses[i].state = 'fail';
      statuses[i].message = err.message || String(err);
      failCount += 1;
    }
    notify(i + 1);
    if (i < list.length - 1 && gapMs) await new Promise((r) => setTimeout(r, gapMs));
  }

  if (!results.length) {
    throw new Error(label + ' 全部失敗：' + (statuses[0]?.message || ''));
  }

  const amounts = results.map((r) => Number(r.amount)).filter((n) => Number.isFinite(n) && n > 0);
  const amount = amounts.length ? amounts.reduce((a, b) => a + b, 0) : 0;
  const first = results[0] || {};
  const notes = results.map((r, i) => r.notes ? `#${i + 1} ${r.notes}` : '').filter(Boolean).join('\n');

  return {
    date: first.date || '',
    amount,
    vendor: first.vendor || '',
    category: first.category || 'Other',
    notes,
    successCount: results.length,
    failCount,
    successIndices,
    results
  };
}
