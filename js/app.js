/* ===== 分润系统原型交互脚本 =====
   覆盖：多标签页、左侧菜单、弹窗、Toast、申请金额联动、税点联动、配置校验、标注拖拽
*/
(function () {
  'use strict';

  var PAGE_TITLE = {
    'page-month': '查看月分润',
    'page-month-detail': '查看月分润明细',
    'page-lower-month': '查看下级月分润',
    'page-lower-month-detail': '查看下级月分润明细',
    'page-org-config': '下级机构管理',
    'page-migrate': '下级申请管理',
    'page-history': '申请记录',
    'page-sub-history': '下级申请记录',
    'page-guide-spec': '新功能提示（3 类文案）',
    'page-history-apply-original': '原申请分润页面'
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- Toast ---------- */
  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  /* ---------- 多标签页 ---------- */
  var opened = { 'page-month': true };
  function renderTabs(activeId) {
    var wrap = $('#tabs');
    var keys = Object.keys(opened);
    if (keys.indexOf(activeId) === -1) { opened[activeId] = true; }
    wrap.innerHTML = '';
    Object.keys(opened).forEach(function (id) {
      var tab = document.createElement('div');
      tab.className = 'tab' + (id === activeId ? ' active' : '');
      tab.setAttribute('data-page', id);
      tab.innerHTML = '<span>' + (PAGE_TITLE[id] || id) + '</span>';
      if (id !== 'page-month') {
        var close = document.createElement('span');
        close.className = 'tab-close';
        close.textContent = '×';
        tab.appendChild(close);
      }
      wrap.appendChild(tab);
    });
  }

  /* 用 PAGE_MENU_KEY 记录页面当前由哪个菜单项进入，避免多个菜单项同时高亮。
     （历史上「机构分润-申请分润」「机构分润-下级申请管理」曾共用迁移提示页，
     「申请分润」菜单已按业务方指示删除，现该页只由「下级申请管理」菜单进入。） */
  var PAGE_MENU_KEY = {};
  /* 页面切换钩子：由脚本末尾的新功能提示逻辑接管，用于按机构/菜单带入提示文案 */
  var onPageShown = null;

  /* ---------- 顶部导航模块切换（「分润管理」/「账号管理」） ----------
     真实系统里顶级导航决定左侧二级菜单：分润管理模块下的二级菜单与账号管理模块互不相同；
     「下级机构管理」属于账号管理模块，不在分润管理的左侧菜单里。
     本原型按同一层级呈现：切页时按页面归属自动切换顶部导航高亮与左侧二级菜单。 */
  var PAGE_MODULE_ACCOUNT = { 'page-org-config': true };
  var lastProfitPage = 'page-month';
  function moduleOfPage(id) { return PAGE_MODULE_ACCOUNT[id] ? 'account' : 'profit'; }
  function syncModule(id) {
    var mod = moduleOfPage(id);
    if (mod === 'profit') { lastProfitPage = id; }
    $$('.nav-item[data-module]').forEach(function (n) {
      n.classList.toggle('active', n.getAttribute('data-module') === mod);
    });
    $$('.menu-scope-profit').forEach(function (g) { g.style.display = (mod === 'account') ? 'none' : ''; });
    $$('.menu-scope-account').forEach(function (g) { g.style.display = (mod === 'account') ? '' : 'none'; });
  }

  function showPage(id, menuKey) {
    if (menuKey) { PAGE_MENU_KEY[id] = menuKey; }
    var key = menuKey || PAGE_MENU_KEY[id];
    $$('.page').forEach(function (p) { p.classList.toggle('active', p.id === id); });
    $$('.menu-item').forEach(function (m) {
      var mKey = m.getAttribute('data-menu-key');
      var hit = key
        ? mKey === key
        : (!mKey && m.getAttribute('data-page') === id);
      m.classList.toggle('active', !!hit);
    });
    syncModule(id);
    var wrap = $('.page-wrap');
    if (wrap) { wrap.scrollTop = 0; }
    /* 切换页面后重新计算该页标注层布局（隐藏时宽度为 0 会导致堆叠） */
    if (window.layoutAnnotLayer) {
      var layer = document.querySelector('#' + id + ' .annot-layer');
      if (layer) { window.layoutAnnotLayer(layer); }
    }
    if (onPageShown) { onPageShown(id); }
  }

  function openPage(id, menuKey) {
    if (!id) { return; }
    if (!opened[id]) { opened[id] = true; }
    showPage(id, menuKey);
    renderTabs(id);
  }

  function closePage(id) {
    if (id === 'page-month') { return; }
    delete opened[id];
    var rest = Object.keys(opened);
    var next = rest.length ? rest[rest.length - 1] : 'page-month';
    showPage(next);
    renderTabs(next);
  }

  $('#sidebarToggle').addEventListener('click', function () {
    var sb = $('#sidebar');
    sb.classList.toggle('collapsed');
    this.textContent = sb.classList.contains('collapsed') ? '三' : '三 收起';
  });

  $$('.menu-item').forEach(function (item) {
    item.addEventListener('click', function () {
      if (item.classList.contains('disabled')) { return; }
      var id = item.getAttribute('data-page');
      if (id) { openPage(id, item.getAttribute('data-menu-key')); }
    });
  });

  /* 顶部导航可切换模块：点「账号管理」进下级机构管理；点「分润管理」回到最近打开的分润页。
     模块高亮与左侧二级菜单由 syncModule 统一处理，与切页保持同步。 */
  $$('.nav-item[data-module]').forEach(function (nav) {
    nav.addEventListener('click', function () {
      if (nav.getAttribute('data-module') === 'account') { openPage('page-org-config'); }
      else { openPage(lastProfitPage || 'page-month'); }
    });
  });

  $('#tabs').addEventListener('click', function (e) {
    var tab = e.target.closest('.tab');
    if (!tab) { return; }
    var id = tab.getAttribute('data-page');
    if (e.target.classList.contains('tab-close')) { closePage(id); return; }
    openPage(id);
  });

  /* ---------- 委托：Toast / 弹窗 / 跳页 ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var toastBtn = t.closest('[data-toast]');
    if (toastBtn) { toast(toastBtn.getAttribute('data-toast')); }

    var openBtn = t.closest('[data-modal]');
    if (openBtn) {
      var m = document.getElementById(openBtn.getAttribute('data-modal'));
      if (m) { m.classList.add('show'); }
    }

    var jumpBtn = t.closest('[data-page-jump]');
    if (jumpBtn) { openPage(jumpBtn.getAttribute('data-page-jump')); }

    var closeEl = t.closest('[data-close]');
    if (closeEl) {
      var mask = closeEl.closest('.mask');
      if (mask) { mask.classList.remove('show'); }
    }

    var closeDrawer = t.closest('[data-close-drawer]');
    if (closeDrawer) {
      var drawerMask = closeDrawer.closest('.drawer-mask');
      if (drawerMask) { drawerMask.classList.remove('show'); }
    }
    if (t.classList && t.classList.contains('drawer-mask')) { t.classList.remove('show'); }
  });

  /* ---------- 申请分润弹窗：勾选与金额联动 ----------
     两种进入方式：
     ① 「查看月分润」页筛选区【申请分润】→ 批量模式：可按月份勾选多条（表头可全选）
     ② 「申请记录」页行内【申请分润】→ 单条模式：只展示该行数据，无勾选框、无表头全选，只能申请该行 */
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

  var APPLY_MODAL = $('#modal-apply');
  var APPLY_TBODY = $('#apply-tbody');
  var APPLY_BATCH_HTML = APPLY_TBODY ? APPLY_TBODY.innerHTML : '';

  function isApplySingle() { return !!(APPLY_MODAL && APPLY_MODAL.classList.contains('apply-single')); }

  function recalcApply() {
    var selProfit = 0, count = 0;
    if (isApplySingle()) {
      /* 单条模式：没有勾选框，合计即当前展示的那一条 */
      $$('#apply-tbody tr').forEach(function (tr) {
        count++;
        selProfit += num(tr.getAttribute('data-profit'));
      });
    } else {
      $$('.apply-check').forEach(function (cb) {
        if (!cb.checked) { return; }
        count++;
        selProfit += num(cb.getAttribute('data-profit'));
      });
    }
    $('#apply-sel-profit').textContent = selProfit.toFixed(2);
    $('#apply-count').textContent = count;
    $('#btn-apply-submit').disabled = count === 0;
  }

  function bindApplyChecks() {
    $$('.apply-check').forEach(function (cb) { cb.addEventListener('change', recalcApply); });
  }

  /* 批量模式：还原可按月份勾选的列表 */
  function openApplyBatch() {
    if (!APPLY_MODAL || !APPLY_TBODY) { return; }
    APPLY_MODAL.classList.remove('apply-single');
    APPLY_TBODY.innerHTML = APPLY_BATCH_HTML;
    var all = $('#apply-check-all');
    if (all) { all.checked = false; all.indeterminate = false; }
    bindApplyChecks();
    recalcApply();
  }

  /* 单条模式：只渲染被点击的那一行数据（序号 / 分润月份 / 分润合计） */
  function openApplySingle(tr) {
    if (!APPLY_MODAL || !APPLY_TBODY || !tr) { return; }
    var month = tr.getAttribute('data-apply-month') || '--';
    var profit = tr.getAttribute('data-apply-profit') || '0.00';
    APPLY_MODAL.classList.add('apply-single');
    APPLY_TBODY.innerHTML = '<tr data-profit="' + profit + '">' +
      '<td></td><td>1</td><td>' + month + '</td><td></td>' +
      '<td></td><td></td><td></td><td></td><td></td>' +
      '<td class="num">' + profit + '</td></tr>';
    var monthEl = $('#apply-single-month');
    if (monthEl) { monthEl.textContent = month; }
    recalcApply();
  }

  var applyAll = $('#apply-check-all');
  if (applyAll) {
    applyAll.addEventListener('change', function () {
      $$('.apply-check').forEach(function (cb) { cb.checked = applyAll.checked; });
      recalcApply();
    });
  }
  bindApplyChecks();
  /* 2026-09-21：已取消自定义申请金额，申请金额强制等于分润合计 */

  /* 「查看月分润」页筛选区入口 → 按数据里现成的「申请方式」分流（业务方 2026-09-30 指示）；
     「申请记录」页行内入口 → 单条模式 */
  var APPLY_MODE = 'month';  /* 演示取值：month=按月申请 → 本页「申请分润」弹窗；amount=按金额申请 → 原申请分润页面 */
  function handleApplyEntry() {
    if (APPLY_MODE === 'amount') {
      toast('申请方式为「按金额申请」，跳转原申请分润页面');
      openPage('page-history-apply-original');
      return;
    }
    openApplyBatch();
    if (APPLY_MODAL) { APPLY_MODAL.classList.add('show'); }
  }

  /* 「申请记录」页驳回行【重新申请】→ 按该条记录现成的「申请方式」分流（业务方 2026-10-08 指示）：
     ① 申请方式 = 按金额申请 → 跳转「原申请分润页面」（上线前按金额填写的旧页面，本原型以占位页标示）
     ② 申请方式 = 按月申请   → 打开本列表页内的「申请分润」弹窗（单条模式，只申请该行对应月份） */
  function handleReapply(btn) {
    var tr = btn.closest('tr');
    var way = tr ? (tr.getAttribute('data-apply-way') || '') : '';
    if (way === 'amount') {
      toast('该条申请方式为「按金额申请」，跳转原申请分润页面');
      openPage('page-history-apply-original');
      return;
    }
    if (APPLY_MODAL) { APPLY_MODAL.classList.add('show'); }
    openApplySingle(tr);
  }

  document.addEventListener('click', function (e) {
    var reapplyBtn = e.target.closest('[data-reapply]');
    if (reapplyBtn) { handleReapply(reapplyBtn); return; }
    var batchBtn = e.target.closest('[data-apply-entry]');
    if (batchBtn) { handleApplyEntry(); }
  });

  var btnSubmit = $('#btn-apply-submit');
  if (btnSubmit) {
    btnSubmit.addEventListener('click', function () {
      toast('提交成功，请等待上级机构审核');
      var mask = this.closest('.mask');
      if (mask) { mask.classList.remove('show'); }
    });
  }

  /* ---------- 审核：筛选区【审核】→ 弹窗内勾选（勾选一条即审核该条，勾选多条即一次审核多条） ---------- */
  var AUDIT_TBODY = $('#audit-tbody');
  var AUDIT_SEL_PROFIT = $('#audit-sel-profit');
  var AUDIT_SEL_AMT = $('#audit-sel-amt');
  var AUDIT_COUNT = $('#audit-count');
  var AUDIT_BTN_PASS = $('#btn-audit-pass');
  var AUDIT_BTN_REJECT = $('#btn-audit-reject');

  /* 未勾选任何数据时【通过】【驳回】置灰 */
  /* ---------- 税点白名单：财务只认可 6% / 3% 的发票税点 ---------- */
  var TAX_WHITE_LIST = [3, 6];

  function isTaxValid(v) {
    var s = String(v).trim();
    if (s === '') { return false; }
    var n = parseFloat(s);
    return !isNaN(n) && TAX_WHITE_LIST.indexOf(n) > -1;
  }

  function taxInputOf(idx) {
    return AUDIT_TBODY ? AUDIT_TBODY.querySelector('.tax-input[data-idx="' + idx + '"]') : null;
  }

  /* 税点改动：重算该行实发金额（申请分润 × (1 − 税点/100)）并同步合计与按钮态 */
  function applyTax(input) {
    var idx = input.getAttribute('data-idx');
    var valid = isTaxValid(input.value);
    input.style.borderColor = valid ? '' : '#f53f3f';
    input.title = valid ? '' : '税点仅支持财务认可的 6% / 3%';
    var cb = AUDIT_TBODY ? AUDIT_TBODY.querySelector('.audit-check[data-idx="' + idx + '"]') : null;
    if (cb && valid) {
      var real = num(cb.getAttribute('data-profit')) * (1 - num(input.value) / 100);
      cb.setAttribute('data-real', real.toFixed(3));
      var tr = input.closest('tr');
      var cell = tr ? tr.querySelector('.real-amt') : null;
      if (cell) { cell.textContent = real.toFixed(3); }
    }
    recalcAudit();
  }

  function gateAuditButtons(count) {
    /* 【通过】还要求已勾选行的税点合法；【驳回】不产生实发，不受税点影响 */
    var badTax = false;
    $$('.audit-check').forEach(function (cb) {
      if (badTax || !cb.checked) { return; }
      var inp = taxInputOf(cb.getAttribute('data-idx'));
      if (!inp || !isTaxValid(inp.value)) { badTax = true; }
    });
    if (AUDIT_BTN_PASS) { AUDIT_BTN_PASS.disabled = count === 0 || badTax; }
    if (AUDIT_BTN_REJECT) { AUDIT_BTN_REJECT.disabled = count === 0; }
  }

  function recalcAudit() {
    var count = 0;
    var profit = 0;
    var amt = 0;
    $$('.audit-check').forEach(function (cb) {
      if (!cb.checked) { return; }
      count++;
      profit += num(cb.getAttribute('data-profit'));
      amt += num(cb.getAttribute('data-real'));
    });
    if (AUDIT_COUNT) { AUDIT_COUNT.textContent = count; }
    if (AUDIT_SEL_PROFIT) { AUDIT_SEL_PROFIT.textContent = profit.toFixed(2); }
    if (AUDIT_SEL_AMT) { AUDIT_SEL_AMT.textContent = '¥' + amt.toFixed(3); }
    gateAuditButtons(count);
  }

  function bindAuditChecks() {
    $$('.audit-check').forEach(function (cb) { cb.addEventListener('change', recalcAudit); });
    $$('.tax-input').forEach(function (inp) {
      inp.addEventListener('input', function () { applyTax(inp); });
    });
    recalcAudit();
  }

  /* 按页面行数据渲染审核弹窗：默认全部不勾选，勾选动作由用户在弹窗内完成
     弹窗只装载待审核数据，审核通过/驳回后该数据即退出待审核集合，不再出现在弹窗里 */
  var auditSourceRows = [];
  function renderAuditRows(rows) {
    auditSourceRows = rows || [];
    if (!AUDIT_TBODY) { return; }
    AUDIT_TBODY.innerHTML = rows.map(function (tr, idx) {
      var month = tr.getAttribute('data-month');
      var org = tr.getAttribute('data-org');
      var due = tr.getAttribute('data-due');
      var apply = tr.getAttribute('data-apply');
      var tax = tr.getAttribute('data-tax');
      var real = tr.getAttribute('data-real');
      return '<tr>' +
        '<td><input type="checkbox" class="audit-check" data-idx="' + idx + '" data-profit="' + apply + '" data-real="' + real + '" /></td>' +
        '<td>' + month + '</td><td>' + org + '</td>' +
        '<td class="num">' + due + '</td><td class="num">' + apply + '</td><td>--</td>' +
        '<td class="num"><input class="input sm tax-input" type="text" value="' + tax + '" data-idx="' + idx + '" /> %</td>' +
        '<td class="num real-amt">' + real + '</td>' +
        '</tr>';
    }).join('');
    if (auditAll) { auditAll.checked = false; auditAll.indeterminate = false; }
    bindAuditChecks();
  }

  /* 筛选区【审核】入口：取本页表格里的待审核行渲染弹窗，勾选动作在弹窗内完成
     「查看下级月分润」与「下级申请记录」两页共用同一个入口与同一个弹窗 */
  $$('[data-audit-entry]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var scope = btn.closest('.panel') || document;
      var rows = $$('[data-audit="pending"]', scope);
      if (!rows.length) { toast('当前没有待审核的数据'); return; }
      renderAuditRows(rows);
      var m = document.getElementById('modal-audit');
      if (m) { m.classList.add('show'); }
    });
  });

  /* 弹窗内「全选」联动，并刷新合计 */
  var auditAll = $('#audit-check-all');
  if (auditAll) {
    auditAll.addEventListener('change', function () {
      $$('.audit-check').forEach(function (cb) { cb.checked = auditAll.checked; });
      recalcAudit();
    });
  }

  /* 静态弹窗（由「下级申请记录」行内【审核】进入）同样按未勾选初始化 */
  bindAuditChecks();

  /* ---------- 筛选区【审核】入口显隐：本页没有待审核数据时按钮不展示 ---------- */
  function refreshAuditEntries() {
    $$('[data-audit-entry]').forEach(function (btn) {
      var scope = btn.closest('.panel') || document;
      var pending = $$('[data-audit="pending"]', scope);
      btn.style.display = pending.length ? '' : 'none';
    });
  }

  function nowText() {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    var d = new Date();
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
      p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  /* 审核结果回写：写入审核状态、审核时间与操作列，并同步申请状态与实发金额 */
  function updateRowStatus(tr, pass) {
    var table = tr.closest('table');
    if (!table) { return; }
    var heads = $$('thead th', table).map(function (th) { return th.textContent.trim(); });
    var cells = tr.children;
    var iStatus = heads.indexOf('审核状态');
    var iTime = heads.indexOf('审核时间');
    var iOper = heads.indexOf('操作');
    var iApply = heads.indexOf('申请状态');
    var iReal = heads.indexOf('实发金额');
    if (iStatus > -1) {
      cells[iStatus].innerHTML = '<span class="tag ' + (pass ? 'tag-green' : 'tag-red') + '">' +
        (pass ? '审核通过' : '审核驳回') + '</span>';
    }
    if (iTime > -1) { cells[iTime].textContent = nowText(); }
    if (iApply > -1) {
      cells[iApply].innerHTML = '<span class="tag ' + (pass ? 'tag-green' : 'tag-red') + '">' +
        (pass ? '已完成' : '待修改') + '</span>';
    }
    if (iReal > -1 && pass) { cells[iReal].textContent = tr.getAttribute('data-real') || '--'; }
    if (iOper > -1) {
      cells[iOper].innerHTML = '<button class="btn-link" data-modal="modal-view-done">查看</button>';
    }
    tr.setAttribute('data-audit', pass ? 'passed' : 'rejected');
  }

  /* 提交审核：勾选一条即审核该条，勾选多条即一次审核多条 */
  function commitAudit(pass) {
    var picked = $$('.audit-check').filter(function (cb) { return cb.checked; });
    if (!picked.length) { return; }
    picked.forEach(function (cb) {
      var idx = parseInt(cb.getAttribute('data-idx'), 10);
      var tr = auditSourceRows[idx];
      if (!tr) { return; }
      /* 弹窗内改过的税点与按该税点算出的实发金额写回源行，供列表与查看详情使用 */
      var inp = taxInputOf(cb.getAttribute('data-idx'));
      if (inp && isTaxValid(inp.value)) { tr.setAttribute('data-tax', inp.value.trim()); }
      var real = cb.getAttribute('data-real');
      if (real) { tr.setAttribute('data-real', real); }
      updateRowStatus(tr, pass);
    });
    var m = document.getElementById('modal-audit');
    if (m) { m.classList.remove('show'); }
    auditSourceRows = [];
    if (AUDIT_TBODY) { AUDIT_TBODY.innerHTML = ''; }
    bindAuditChecks();
    refreshAuditEntries();
  }

  if (AUDIT_BTN_PASS) {
    AUDIT_BTN_PASS.addEventListener('click', function () { commitAudit(true); });
  }
  if (AUDIT_BTN_REJECT) {
    AUDIT_BTN_REJECT.addEventListener('click', function () { commitAudit(false); });
  }

  refreshAuditEntries();

  /* ---------- 下级分润发布：仅「下级分润发布设置」＝手动发布时展示入口，按月份发布 ---------- */
  var LM_TBODY = $('#lm-tbody');
  var RELEASE_ENTRIES = $$('[data-release-entry]');
  var RELEASE_TBODY = $('#release-tbody');
  var RELEASE_MONTH_TOTAL = $('#release-month-total');
  var RELEASE_AMT_TOTAL = $('#release-amt-total');
  var RELEASE_COUNT = $('#release-count');
  var RELEASE_SEL = $('#release-sel');
  var RELEASE_SEL_AMT = $('#release-sel-amt');
  var RELEASE_SUBMIT = $('#btn-release-submit');
  var RELEASE_CHECK_ALL = $('#release-check-all');

  /* 取「待发布」的行并按分润月份归并：同一月份下多个下级机构合并为一行 */
  function releaseGroups() {
    var map = {};
    if (!LM_TBODY) { return []; }
    $$('#lm-tbody tr').forEach(function (tr) {
      if ((tr.getAttribute('data-publish') || '').indexOf('待发布') < 0) { return; }
      var month = tr.getAttribute('data-month') || '';
      if (!month) { return; }
      if (!map[month]) { map[month] = { month: month, orgs: [], amt: 0 }; }
      var org = tr.getAttribute('data-org') || '';
      if (org && map[month].orgs.indexOf(org) < 0) { map[month].orgs.push(org); }
      map[month].amt += parseFloat(tr.getAttribute('data-due') || '0') || 0;
    });
    return Object.keys(map).sort().map(function (k) { return map[k]; });
  }

  function releaseChecked() {
    if (!RELEASE_TBODY) { return []; }
    return Array.prototype.filter.call(RELEASE_TBODY.querySelectorAll('.release-check'), function (cb) { return cb.checked; });
  }

  /* 勾选状态联动：已选月份数、已选发布金额、【发布】按钮置灰 */
  function renderReleaseSel() {
    var picked = releaseChecked();
    var amt = 0;
    picked.forEach(function (cb) { amt += parseFloat(cb.getAttribute('data-amt') || '0') || 0; });
    if (RELEASE_COUNT) { RELEASE_COUNT.textContent = releaseGroups().length; }
    if (RELEASE_SEL) { RELEASE_SEL.textContent = picked.length; }
    if (RELEASE_SEL_AMT) { RELEASE_SEL_AMT.textContent = amt.toFixed(2); }
    if (RELEASE_SUBMIT) { RELEASE_SUBMIT.disabled = picked.length === 0; }
    if (RELEASE_CHECK_ALL) {
      var all = RELEASE_TBODY ? RELEASE_TBODY.querySelectorAll('.release-check') : [];
      RELEASE_CHECK_ALL.checked = all.length > 0 && picked.length === all.length;
    }
  }

  function renderReleaseRows() {
    if (!RELEASE_TBODY) { return; }
    var groups = releaseGroups();
    var amtTotal = 0;
    groups.forEach(function (g) { amtTotal += g.amt; });
    RELEASE_TBODY.innerHTML = groups.map(function (g, idx) {
      return '<tr>' +
        '<td><input type="checkbox" class="release-check" data-idx="' + idx + '" data-month="' + g.month +
        '" data-amt="' + g.amt.toFixed(2) + '" /></td>' +
        '<td>' + g.month + '</td>' +
        '<td>' + g.orgs.join('、') + '</td>' +
        '<td class="num">' + g.amt.toFixed(2) + '</td>' +
        '<td><span class="tag tag-gray">待发布</span></td>' +
        '</tr>';
    }).join('');
    if (RELEASE_MONTH_TOTAL) { RELEASE_MONTH_TOTAL.textContent = groups.length; }
    if (RELEASE_AMT_TOTAL) { RELEASE_AMT_TOTAL.textContent = amtTotal.toFixed(2); }
    if (RELEASE_CHECK_ALL) { RELEASE_CHECK_ALL.checked = false; }
    RELEASE_TBODY.querySelectorAll('.release-check').forEach(function (cb) {
      cb.addEventListener('change', renderReleaseSel);
    });
    renderReleaseSel();
  }

  /* 入口显隐：「下级分润发布设置」＝手动发布时才展示【数据发布】 */
  function setPushMode(manual) {
    RELEASE_ENTRIES.forEach(function (el) { el.classList.toggle('hide', !manual); });
    $$('[data-toggle-push-mode]').forEach(function (r) { r.checked = (r.value === 'manual') === manual; });
  }

  RELEASE_ENTRIES.forEach(function (el) {
    el.addEventListener('click', function () { renderReleaseRows(); });
  });
  if (RELEASE_CHECK_ALL) {
    RELEASE_CHECK_ALL.addEventListener('change', function () {
      var on = this.checked;
      if (RELEASE_TBODY) {
        RELEASE_TBODY.querySelectorAll('.release-check').forEach(function (cb) { cb.checked = on; });
      }
      renderReleaseSel();
    });
  }
  if (RELEASE_SUBMIT) {
    RELEASE_SUBMIT.addEventListener('click', function () {
      var months = releaseChecked().map(function (cb) { return cb.getAttribute('data-month'); });
      if (!months.length) { return; }
      if (LM_TBODY) {
        $$('#lm-tbody tr').forEach(function (tr) {
          if (months.indexOf(tr.getAttribute('data-month')) < 0) { return; }
          if ((tr.getAttribute('data-publish') || '').indexOf('待发布') < 0) { return; }
          tr.setAttribute('data-publish', '已手动发布');
          var tag = tr.querySelector('td:nth-child(15) .tag');
          if (tag) { tag.className = 'tag tag-green'; tag.textContent = '已手动发布'; }
        });
      }
      var m = document.getElementById('modal-release');
      if (m) { m.classList.remove('show'); }
      toast('已数据发布：' + months.join('、') + '，该月份下全部下级机构的分润数据已可见');
      renderReleaseRows();
    });
  }
  $$('[data-toggle-push-mode]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (!this.checked) { return; }
      setPushMode(this.value === 'manual');
    });
  });
  setPushMode(false);

  /* 查看详情弹窗：按所在行的申请与审核数据展示 */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-modal="modal-view-done"]');
    if (!btn) { return; }
    var tr = btn.closest('tr');
    if (!tr) { return; }
    var table = tr.closest('table');
    var heads = table ? $$('thead th', table).map(function (th) { return th.textContent.trim(); }) : [];
    var cell = function (name) {
      var i = heads.indexOf(name);
      return i > -1 ? tr.children[i].textContent.trim() : '';
    };
    var put = function (id, val) {
      var el = document.getElementById(id);
      if (el && val !== undefined && val !== null && val !== '') { el.textContent = val; }
    };
    put('vd-apply-date', cell('申请时间') || cell('申请日期') || '--');
    put('vd-apply-amt', tr.getAttribute('data-apply'));
    put('vd-apply-remark', '--');
    put('vd-audit-remark', cell('审核状态') || '--');
    put('vd-tax', (tr.getAttribute('data-tax') || '--') + '%');
    put('vd-real', tr.getAttribute('data-real') || '--');
  });

  /* ---------- 配置页：权限联动 / 比例校验 ---------- */
  $$('[data-toggle-block]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (!this.checked) { return; }
      var name = this.getAttribute('name');
      var val = this.value;
      /* 支持多目标：data-toggle-block="idA,idB" */
      this.getAttribute('data-toggle-block').split(',').forEach(function (id) {
        var block = document.getElementById(id.trim());
        if (!block) { return; }
        /* 按区块自身的 data-mode 匹配当前选项：统一收取 → block-unified；分别收取 → block-split */
        if (name === 'extraMode') {
          block.classList.toggle('hide', block.getAttribute('data-mode') !== val);
        }
        if (name === 'shareRight') {
          block.style.display = radio.value === 'off' ? 'none' : '';
        }
      });
    });
  });

  /* ---------- 配置页：允许下级申请分润 → 联动下级机构申请入口 ---------- */

  /* ---------- 下级月分润页：是否允许下级机构查看额外收取下级分润数据 → 合并到列表列显隐（2026-09-17 会议新增） ---------- */
  var MONTH_EXTRA_STATUS = $('#month-extra-status');
  var MONTH_EXTRA_BEFORE_COLS = $$('.month-extra-col-before');
  var MONTH_EXTRA_AMOUNT_COLS = $$('.month-extra-col-amount');
  var MONTH_EXTRA_BUTTONS = $$('.btn-toggle-detail');
  /* 导出文件预览（原型演示）：导出时是否多带一个「支付及相关增值业务额外收取分润」Sheet，
     与上面同一个配置项联动 —— 允许则带、不允许则不带 */
  var EXPORT_SHEET_TAB = $('#export-sheet-extra');
  var EXPORT_SHEET_CARD = $('#export-sheet-card');
  var EXPORT_TIP_ALLOW = $('#export-tip-allow');
  var EXPORT_TIP_DENY = $('#export-tip-deny');
  var EXPORT_DEMO_RADIOS = $$('[data-export-demo-extra]');
  function setMonthExtraView(allow) {
    MONTH_EXTRA_BEFORE_COLS.forEach(function (el) { el.classList.toggle('hide', !allow); });
    MONTH_EXTRA_AMOUNT_COLS.forEach(function (el) { el.classList.toggle('hide', !allow); });
    MONTH_EXTRA_BUTTONS.forEach(function (el) { el.classList.toggle('hide', !allow); });
    if (EXPORT_SHEET_TAB) { EXPORT_SHEET_TAB.classList.toggle('hide', !allow); }
    if (EXPORT_SHEET_CARD) { EXPORT_SHEET_CARD.classList.toggle('hide', !allow); }
    if (EXPORT_TIP_ALLOW) { EXPORT_TIP_ALLOW.classList.toggle('hide', !allow); }
    if (EXPORT_TIP_DENY) { EXPORT_TIP_DENY.classList.toggle('hide', allow); }
    if (MONTH_EXTRA_STATUS) {
      MONTH_EXTRA_STATUS.textContent = allow ? '允许' : '不允许（默认）';
      MONTH_EXTRA_STATUS.className = allow ? 'tag tag-green' : 'tag tag-orange';
    }
    /* 配置页单选框与导出预览弹窗内的演示单选框始终同步为同一状态 */
    $$('[data-toggle-month-extra]').forEach(function (r) { r.checked = (r.value === 'yes') === allow; });
    EXPORT_DEMO_RADIOS.forEach(function (r) { r.checked = (r.value === 'yes') === allow; });
  }
  $$('[data-toggle-month-extra]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (!this.checked) { return; }
      setMonthExtraView(this.value === 'yes');
    });
  });
  /* 导出预览弹窗内可直接切换权限状态（原型演示用，与配置页同一开关，仅影响展示） */
  EXPORT_DEMO_RADIOS.forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (!this.checked) { return; }
      setMonthExtraView(this.value === 'yes');
    });
  });
  /* 演示初始状态：不允许（与配置页默认值一致） */
  setMonthExtraView(false);

  /* ---------- 查看月分润（下级机构）：月份行「查看额外收取分润」打开右侧抽屉 ---------- */
  var DRAWER_MASK = $('#month-extra-drawer-mask');
  var DRAWER_TITLE = $('#month-extra-drawer-title');
  var DRAWER_BODY = $('#month-extra-drawer-body');
  /* .btn-toggle-detail = 查看月分润（下级机构）→ 受「是否允许下级机构查看额外收取下级分润数据」开关控制
     注：查看下级月分润（上级机构）页不提供额外收取明细入口，故无 .btn-extra-detail */
  $$('.btn-toggle-detail').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetId = btn.getAttribute('data-detail-target');
      var source = $('#' + targetId);
      var row = btn.closest('tr');
      var month = btn.getAttribute('data-detail-month') || (row ? row.cells[1].textContent : '');
      if (DRAWER_TITLE) { DRAWER_TITLE.textContent = (month ? month + ' ' : '') + '我的额外被收取分润'; }
      if (DRAWER_BODY) {
        DRAWER_BODY.innerHTML = '';
        if (source) {
          var table = source.querySelector('table');
          if (table) { DRAWER_BODY.appendChild(table.cloneNode(true)); }
        }
      }
      if (DRAWER_MASK) { DRAWER_MASK.classList.add('show'); }
    });
  });

  var APPLY_ENTRIES = $$('[data-allow-apply]');
  var DENY_ENTRIES = $$('[data-deny-apply]');
  function setApplyPermission(on) {
    APPLY_ENTRIES.forEach(function (el) { el.classList.toggle('hide', !on); });
    DENY_ENTRIES.forEach(function (el) { el.classList.toggle('hide', on); });
  }
  /* 演示初始状态：已开启（PRD「分润相关配置」字段 2 的系统默认值即为「开」，配置页默认也选「开」）
     注意：历史分润提示文案与入口以本开关 = 开为前置条件，若这里默认「关」，
     则配置页把金额改成大于 0 也不会有任何变化（金额会被按 0 处理），故与 PRD 默认值保持一致。 */
  var applyOn = true;
  setApplyPermission(applyOn);

  $$('[data-toggle-apply]').forEach(function (radio) {
    radio.checked = (radio.value === 'on') === applyOn;
    radio.addEventListener('change', function () {
      if (!this.checked) { return; }
      applyOn = this.value === 'on';
      setApplyPermission(applyOn);
      /* 申请开关同时控制历史分润提示文案与入口：关闭时一并隐藏 */
      renderHistoryApplyEntry();
    });
  });

  /* 「申请方式」演示开关（非产品配置项）：只切换「查看月分润」筛选区【申请分润】的去向。
     申请方式本身不是配置项，也不是可切换开关，它是点击入口时对「数据里现成取值」的判断。 */
  $$('[data-toggle-apply-mode]').forEach(function (radio) {
    radio.checked = (radio.value === APPLY_MODE);
    radio.addEventListener('change', function () {
      if (!this.checked) { return; }
      APPLY_MODE = this.value;
    });
  });

  $$('.rate-input').forEach(function (inp) {
    inp.addEventListener('input', function () {
      this.value = this.value.replace(/[^\d]/g, '');
      if (this.value !== '' && num(this.value) > 100) { this.value = '100'; }
      this.style.borderColor = '';
    });
  });

  /* ---------- 历史分润：可申请金额 > 0 才展示提示文案与入口 ----------
     规则一（业务方确认 2026-09-22）：「您有 X 元可按金额申请的历史分润金额。」这句提示文案
     与「申请历史分润」入口，仅在可申请金额 > 0 时展示；可申请金额 = 0 时两者一并隐藏。
     规则二（业务方确认 2026-09-22）：「允许下级申请分润」开关是本规则的前置条件——开关关闭时
     下级看不到任何申请入口，故可申请金额按 0 处理，提示文案与入口一并隐藏。
     演示取值由「下级机构管理」配置页的「（演示开关）可申请的历史分润金额」控制。 */
  var HISTORY_APPLY_ENTRY = $('#history-apply-entry');               /* 机构分润跳转提示页 · 入口 */
  var HISTORY_APPLY_TIP = $('#history-apply-tip');                   /* 机构分润跳转提示页 · 入口说明 */
  var MONTH_HISTORY_APPLY_ENTRY = $('#month-history-apply-entry');   /* 查看月分润 · 提示条（文案 + 按钮） */
  var MONTH_HISTORY_APPLY_BTN = $('#month-history-apply-btn');       /* 查看月分润 · 提示条内「申请历史分润」按钮 */
  var MONTH_HISTORY_APPLY_AMOUNT = $('#month-history-apply-amount'); /* 查看月分润 · 提示条内的金额 */
  var historyRemain = 10000; /* 演示初始值（> 0） */
  var HISTORY_REMAIN_INPUT = $('#history-remain-input');     /* 配置页 · 可自由编辑的演示金额输入框 */
  var HISTORY_REMAIN_STATUS = $('#history-remain-status');   /* 配置页 · 当前生效结论回显 */
  function fmtAmount(v) {
    return v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  }
  /* 生效的可申请金额：申请开关为「开」时取输入框金额；为「关」时文案仍展示但按钮隐藏 */
  function effectiveHistoryRemain() { return historyRemain; }
  function renderHistoryApplyEntry() {
    var remain = effectiveHistoryRemain();
    var canShow = remain > 0; /* 文案展示条件：金额 > 0 */
    var canApply = applyOn && canShow; /* 按钮展示条件：开关开 且 金额 > 0 */
    /* 查看月分润：提示文案始终展示（金额 > 0 时），按钮仅在开关开时展示 */
    if (MONTH_HISTORY_APPLY_ENTRY) {
      MONTH_HISTORY_APPLY_ENTRY.style.display = canShow ? 'flex' : 'none';
    }
    if (MONTH_HISTORY_APPLY_BTN) {
      MONTH_HISTORY_APPLY_BTN.style.display = canApply ? 'inline-block' : 'none';
    }
    if (MONTH_HISTORY_APPLY_AMOUNT) { MONTH_HISTORY_APPLY_AMOUNT.textContent = fmtAmount(remain); }
    /* 机构分润跳转提示页：入口按钮与其说明文案一并显隐 */
    if (HISTORY_APPLY_ENTRY) { HISTORY_APPLY_ENTRY.classList.toggle('hide', !canApply); }
    if (HISTORY_APPLY_TIP) { HISTORY_APPLY_TIP.classList.toggle('hide', !canApply); }
    /* 配置页回显当前结论 */
    if (HISTORY_REMAIN_STATUS) {
      if (!applyOn) {
        HISTORY_REMAIN_STATUS.textContent = '当前生效金额：' + fmtAmount(remain) + ' 元 → 开关关闭时仅展示文案，按钮隐藏';
        HISTORY_REMAIN_STATUS.style.color = '#fa8c16';
      } else {
        HISTORY_REMAIN_STATUS.textContent = canShow
          ? '当前生效金额：' + fmtAmount(remain) + ' 元 → 文案与按钮均展示'
          : '当前生效金额：0.00 元 → 文案与入口均隐藏';
        HISTORY_REMAIN_STATUS.style.color = canShow ? '#1677ff' : '#86909c';
      }
    }
  }
  renderHistoryApplyEntry();
  /* 演示金额输入框：金额 = 0 隐藏、> 0 展示，边填边生效 */
  if (HISTORY_REMAIN_INPUT) {
    HISTORY_REMAIN_INPUT.addEventListener('input', function () {
      /* 只允许数字与一个小数点 */
      var raw = this.value.replace(/[^\d.]/g, '');
      var dot = raw.indexOf('.');
      if (dot > -1) { raw = raw.slice(0, dot + 1) + raw.slice(dot + 1).replace(/\./g, ''); }
      if (raw !== this.value) { this.value = raw; }
      historyRemain = (raw === '' || raw === '.') ? 0 : (parseFloat(raw) || 0);
      renderHistoryApplyEntry();
    });
  }

  var btnSave = $('#btn-save-config');
  if (btnSave) {
    btnSave.addEventListener('click', function () {
      var bad = null;
      var modeEl = document.querySelector('input[name="extraMode"]:checked');
      var mode = modeEl ? modeEl.value : 'unified';
      $$('.rate-input').forEach(function (inp) {
        /* 只校验当前可见形态下的比例输入框：统一收取 1 个 / 分别收取 5 个 */
        var block = inp.closest('[data-mode]');
        if (block && block.classList.contains('hide')) { return; }
        var v = inp.value.trim();
        if (v === '' || num(v) > 100) { inp.style.borderColor = '#f53f3f'; bad = bad || inp; }
      });
      if (bad) {
        toast(mode === 'split' ? '「分别收取」下 5 个比例均为必填，且仅允许 0-100 整数' : '「统一收取」比例必填，且仅允许 0-100 整数');
        return;
      }
      toast('保存成功');
    });
  }

  /* ---------- 下级数据调整弹窗：文件上传三态演示 ---------- */
  var btnPick = $('#btn-pick-file');
  if (btnPick) {
    var stage = 0;
    btnPick.addEventListener('click', function () {
      var chip = $('#file-chip-wrap');
      var err = $('#file-err');
      stage = (stage + 1) % 3;
      chip.classList.add('hide');
      err.classList.add('hide');
      if (stage === 1) { chip.classList.remove('hide'); }
      if (stage === 2) { err.classList.remove('hide'); }
    });
  }
  var fileDel = $('#file-del');
  if (fileDel) {
    fileDel.addEventListener('click', function () {
      $('#file-chip-wrap').classList.add('hide');
      toast('已删除文件');
    });
  }

  /* ---------- 新功能提示：按机构 / 菜单带入不同文案 ----------
     上级机构 · 查看下级月分润 →「下级机构分润审核功能升级」
     下级机构 · 查看月分润 →「下级机构分润申请、审核功能升级」 */
  var GUIDE_AUDIT = {
    title: '下级机构分润审核功能升级',
    img: 'images/guide-submonth-apply-audit.png',
    lines: [
      '在【查看月分润页面】可查看下级机构月分润，可查看下级分润申请并进行审核；审核过的数据点击"查看"可以查看申请、审核详情。'
    ]
  };
  var GUIDE_APPLY = {
    title: '下级机构分润申请、审核功能升级',
    lines: [
      '1、支持下级机构按月申请分润，在【查看月分润页面】点击申请/批量申请分润',
      '2、进入分润申请页面，选择要申请的分润，提交申请',
      '3、在【查看月分润页面】可查看分润申请、审核申请'
    ]
  };
  var CURRENT_ORG_LEVEL = 'nonLevel1';
  var GUIDE_BY_PAGE = {
    'page-month': GUIDE_APPLY,
    'page-month-detail': GUIDE_APPLY,
    'page-lower-month': GUIDE_AUDIT,
    'page-lower-month-detail': GUIDE_AUDIT
  };

  var guide = $('#modal-guide');
  var guideTitle = $('#guide-title');
  var guideBody = $('#guide-body');
  var guideNever = $('#guide-never');
  var guideOk = $('#guide-ok');
  var guideShown = false;

  function renderGuide(pageId) {
    var cfg = GUIDE_BY_PAGE[pageId];
    if (!cfg || !guide) { return; }
    guideTitle.textContent = cfg.title;
    var html = cfg.lines.map(function (line) {
      return '<div>' + line + '</div>';
    }).join('');
    if (cfg.img) { html += '<div class="guide-figure"><img src="' + cfg.img + '" alt="新功能提示指引图" /></div>'; }
    html += '<div style="margin-top:10px;color:#86909c;font-size:12px">点击【我知道了】下次进入分润模块继续提示；点击【不再提示】后不再提示。</div>';
    guideBody.innerHTML = html;
    if (!guideShown) {
      guideShown = true;
      setTimeout(function () { guide.classList.add('show'); }, 400);
    }
  }

  if (guideNever) {
    guideNever.addEventListener('click', function () {
      guide.classList.remove('show');
      toast('已设置，后续进入分润模块不再提示');
    });
  }
  if (guideOk) {
    guideOk.addEventListener('click', function () { toast('已关闭，下次进入分润模块继续提示'); });
  }

  onPageShown = renderGuide;
  renderGuide('page-month');

  })();
