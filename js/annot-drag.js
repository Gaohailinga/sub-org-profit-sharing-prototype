/* ============================================================
   评审标注拖拽模块
   - 所有 .annot 元素可拖动，位置按 data-annot-id 存入 localStorage
   - 刷新页面自动恢复
   - 双击单个标注重置，右下角按钮重置全部
   - 默认按方案顺序展开排列，不重叠
============================================================ */
(function () {
  'use strict';

  const STORAGE_KEY = 'annot_positions_lower_profit_v1';
  const CARD_WIDTH = 316;
  const CARD_GAP_X = 16;
  const CARD_GAP_Y = 16;
  const LAYER_PADDING_X = 0;

  function loadAll() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (_) {
      return {};
    }
  }

  function saveAll(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {
      /* 忽略写入失败 */
    }
  }

  function saveOne(id, top, left) {
    const data = loadAll();
    data[id] = { top: top, left: left };
    saveAll(data);
  }

  function clearAll() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {
      /* 忽略 */
    }
  }

  function allAnnots() {
    return document.querySelectorAll('.annot');
  }

  /* ---------- 记忆已保存的位置 ---------- */
  function savedPosition(id) {
    return loadAll()[id];
  }

  /* ---------- 按方案顺序自动展开布局（默认单列不重叠） ---------- */
  function layoutLayer(layer) {
    const cards = Array.prototype.slice.call(layer.querySelectorAll('.annot'));
    if (!cards.length) return;

    /* 先重置未保存的卡片到左上角，以获取真实高度 */
    cards.forEach((el) => {
      if (savedPosition(el.dataset.annotId)) return;
      el.style.position = 'absolute';
      el.style.top = '0px';
      el.style.left = '0px';
      el.style.width = CARD_WIDTH + 'px';
    });

    let currentTop = 0;

    cards.forEach((el) => {
      /* 若用户已拖拽保存过位置，则不再参与自动布局 */
      if (savedPosition(el.dataset.annotId)) return;

      el.dataset.defaultTop = currentTop + 'px';
      el.dataset.defaultLeft = '0px';
      el.style.top = currentTop + 'px';
      el.style.left = '0px';

      const h = el.getBoundingClientRect().height;
      currentTop = currentTop + h + CARD_GAP_Y;
    });

    layer.style.minHeight = (currentTop || 0) + 'px';
  }

  function layoutAll() {
    document.querySelectorAll('.annot-layer').forEach((layer) => {
      /* 只布局可见层；隐藏层在页面切换时单独触发 */
      if (layer.offsetParent === null) return;
      layoutLayer(layer);
    });
  }

  /* 暴露给页面切换脚本 */
  window.layoutAnnotLayer = layoutLayer;
  window.layoutAllAnnotLayers = layoutAll;

  /* ---------- 恢复历史位置 ---------- */
  function restorePositions() {
    const data = loadAll();
    allAnnots().forEach((el) => {
      const pos = data[el.dataset.annotId];
      if (!pos) return;
      el.dataset.defaultTop = el.style.top || '';
      el.dataset.defaultLeft = el.style.left || '';
      if (pos.top !== undefined) el.style.top = pos.top;
      if (pos.left !== undefined) el.style.left = pos.left;
      el.style.position = 'absolute';
      el.style.width = CARD_WIDTH + 'px';
    });
  }

  /* ---------- 拖拽 ---------- */
  let dragEl = null;
  let startX = 0;
  let startY = 0;
  let originTop = 0;
  let originLeft = 0;
  let moved = false;

  function point(e) {
    if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }

  function onStart(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const el = e.target.closest('.annot');
    if (!el) return;

    e.preventDefault();

    const parent = el.offsetParent || document.body;
    const pr = parent.getBoundingClientRect();
    const er = el.getBoundingClientRect();

    /* 以当前视觉位置为原点，避免与 CSS 锚点冲突 */
    originTop = er.top - pr.top;
    originLeft = er.left - pr.left;
    el.style.top = originTop + 'px';
    el.style.left = originLeft + 'px';

    const p = point(e);
    startX = p.x;
    startY = p.y;
    moved = false;
    dragEl = el;
    el.classList.add('dragging');

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
  }

  function onMove(e) {
    if (!dragEl) return;
    e.preventDefault();

    const p = point(e);
    const dx = p.x - startX;
    const dy = p.y - startY;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) moved = true;

    dragEl.style.top = originTop + dy + 'px';
    dragEl.style.left = originLeft + dx + 'px';
  }

  function onEnd() {
    if (dragEl) {
      dragEl.classList.remove('dragging');
      if (moved && dragEl.dataset.annotId) {
        saveOne(dragEl.dataset.annotId, dragEl.style.top, dragEl.style.left);
      }
      dragEl = null;
      moved = false;
    }
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    document.removeEventListener('touchcancel', onEnd);
  }

  /* ---------- 双击重置单个 ---------- */
  function onDblClick(e) {
    const el = e.target.closest('.annot');
    if (!el || !el.dataset.annotId) return;

    const data = loadAll();
    delete data[el.dataset.annotId];
    saveAll(data);

    const layer = el.closest('.annot-layer');
    if (layer) {
      layoutLayer(layer);
    } else {
      el.style.top = el.dataset.defaultTop || '';
      el.style.left = el.dataset.defaultLeft || '';
    }
    toast('已重置该标注位置');
  }

  /* ---------- 轻提示 ---------- */
  function toast(msg) {
    let box = document.getElementById('drag-toast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'drag-toast';
      box.style.cssText =
        'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
        'background:rgba(20,24,40,0.9);color:#fff;font-size:13px;padding:10px 20px;' +
        'border-radius:8px;z-index:9999;pointer-events:none;transition:opacity .3s;';
      document.body.appendChild(box);
    }
    box.textContent = msg;
    box.style.opacity = '1';
    clearTimeout(box._timer);
    box._timer = setTimeout(() => {
      box.style.opacity = '0';
    }, 1600);
  }

  /* ---------- 右下角重置按钮 ---------- */
  function createResetButton() {
    if (document.getElementById('reset-annot-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'reset-annot-btn';
    btn.textContent = '重置标注位置';
    btn.title = '双击单个标注也可单独重置';
    btn.style.cssText =
      'position:fixed;right:20px;bottom:20px;z-index:9999;cursor:pointer;' +
      'padding:8px 16px;border-radius:18px;font-size:12px;color:#fff;' +
      'background:#1677ff;border:none;box-shadow:0 4px 12px rgba(22,119,255,.35);';

    btn.addEventListener('click', () => {
      clearAll();
      document.querySelectorAll('.annot-layer').forEach((layer) => {
        layoutLayer(layer);
      });
      toast('所有标注已恢复默认位置');
    });

    document.body.appendChild(btn);
  }

  /* ---------- 启动 ---------- */
  restorePositions();
  layoutAll();
  createResetButton();

  /* 窗口大小变化时重新计算未拖拽卡片的布局 */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      document.querySelectorAll('.annot-layer').forEach((layer) => {
        layoutLayer(layer);
      });
    }, 150);
  });

  document.addEventListener('mousedown', onStart);
  document.addEventListener('touchstart', onStart, { passive: false });
  document.addEventListener('dblclick', onDblClick);
})();
