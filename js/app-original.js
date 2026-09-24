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
    'page-daily': '查看日分润',
    'page-daily-detail': '查看日分润明细',
    'page-lower-daily': '查看下级日分润',
    'page-lower-daily-detail': '查看下级日分润明细',
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
     真实系统里顶级导航决定左侧二级菜单：分润管理模块下是月分润 / 日分润 / 发票 / 机构分润；
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

  /* ---------- 申请分润弹窗：勾选与金额联动 ---------- */
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

  function recalcApply() {
    var selProfit = 0, selAmt = 0, count = 0;
    $$('.apply-check').forEach(function (cb) {
      if (!cb.checked) { return; }
      count++;
      var profit = num(cb.getAttribute('data-profit'));
      selProfit += profit;
      selAmt += profit;
    });
    $('#apply-sel-profit').textContent = selProfit.toFixed(2);
    $('#apply-count').textContent = count;
    $('#btn-apply-submit').disabled = count === 0;
  }

  var applyAll = $('#apply-check-all');
  if (applyAll) {
    applyAll.addEventListener('change', function () {
      $$('.apply-check').forEach(function (cb) { cb.checked = applyAll.checked; });
      recalcApply();
    });
  }
  $$('.apply-check').forEach(function (cb) { cb.addEventListener('change', recalcApply); });
  /* 2026-09-21：已取消自定义申请金额，申请金额强制等于分润合计 */

  var btnSubmit = $('#btn-apply-submit');
  if (btnSubmit) {
    btnSubmit.addEventListener('click', function () {
      toast('提交成功，请等待上级机构审核');
      var mask = this.closest('.mask');
      if (mask) { mask.classList.remove('show'); }
    });
  }

  /* ---------- 批量审核：页面勾选 → 弹窗按勾选数据展示 ---------- */
  var AUDIT_TBODY = $('#audit-tbody');
  var AUDIT_SEL_PROFIT = $('#audit-sel-profit');
  var AUDIT_SEL_AMT = $('#audit-sel-amt');
  var AUDIT_COUNT = $('#audit-count');

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
  }

  function renderAuditRows(rows) {
    if (!AUDIT_TBODY) { return; }
    AUDIT_TBODY.innerHTML = rows.map(function (cb) {
      var month = cb.getAttribute('data-month');
      var org = cb.getAttribute('data-org');
      var due = cb.getAttribute('data-due');
      var apply = cb.getAttribute('data-apply');
      var tax = cb.getAttribute('data-tax');
      var real = cb.getAttribute('data-real');
      return '<tr>' +
        '<td><input type="checkbox" class="audit-check" checked data-profit="' + apply + '" data-real="' + real + '" /></td>' +
        '<td>' + month + '</td><td>' + org + '</td>' +
        '<td class="num">' + due + '</td><td class="num">' + apply + '</td><td>--</td>' +
        '<td class="num"><input class="input sm tax-input" type="text" value="' + tax + '" readonly /> %</td>' +
        '<td class="num real-amt">' + real + '</td>' +
        '</tr>';
    }).join('');
    $$('.audit-check').forEach(function (cb) { cb.addEventListener('change', recalcAudit); });
    recalcAudit();
  }

  /* 查看下级月分润：勾选框同步「全选」状态 */
  var lmCheckAll = $('#lm-check-all');
  function syncLmCheckAll() {
    if (!lmCheckAll) { return; }
    var all = $$('.lm-check');
    var checked = all.filter(function (x) { return x.checked; }).length;
    lmCheckAll.checked = all.length > 0 && checked === all.length;
    lmCheckAll.indeterminate = checked > 0 && checked < all.length;
  }
  if (lmCheckAll) {
    lmCheckAll.addEventListener('change', function () {
      $$('.lm-check').forEach(function (cb) { cb.checked = lmCheckAll.checked; });
    });
  }
  $$('.lm-check').forEach(function (cb) { cb.addEventListener('change', syncLmCheckAll); });

  /* 点击「批量审核」：未勾选先提示，勾选后弹窗只展示被勾选的数据 */
  var btnBatchAudit = $('#btn-batch-audit');
  if (btnBatchAudit) {
    btnBatchAudit.addEventListener('click', function () {
      var rows = $$('.lm-check').filter(function (cb) { return cb.checked; });
      if (!rows.length) { toast('请先勾选需要批量审核的数据'); return; }
      renderAuditRows(rows);
      var m = document.getElementById('modal-batch-audit');
      if (m) { m.classList.add('show'); }
    });
  }

  /* 弹窗内「全选」联动，并刷新合计 */
  var auditAll = $('#audit-check-all');
  if (auditAll) {
    auditAll.addEventListener('change', function () {
      $$('.audit-check').forEach(function (cb) { cb.checked = auditAll.checked; });
      recalcAudit();
    });
  }

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
  function setMonthExtraView(allow) {
    MONTH_EXTRA_BEFORE_COLS.forEach(function (el) { el.classList.toggle('hide', !allow); });
    MONTH_EXTRA_AMOUNT_COLS.forEach(function (el) { el.classList.toggle('hide', !allow); });
    MONTH_EXTRA_BUTTONS.forEach(function (el) { el.classList.toggle('hide', !allow); });
    if (MONTH_EXTRA_STATUS) {
      MONTH_EXTRA_STATUS.textContent = allow ? '允许' : '不允许（默认）';
      MONTH_EXTRA_STATUS.className = allow ? 'tag tag-green' : 'tag tag-orange';
    }
  }
  $$('[data-toggle-month-extra]').forEach(function (radio) {
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
  var MONTH_HISTORY_APPLY_ENTRY = $('#month-history-apply-entry');   /* 查看月分润 · 提示条（文案 + 入口） */
  var MONTH_HISTORY_APPLY_AMOUNT = $('#month-history-apply-amount'); /* 查看月分润 · 提示条内的金额 */
  var historyRemain = 10000; /* 演示初始值（> 0） */
  var HISTORY_REMAIN_INPUT = $('#history-remain-input');     /* 配置页 · 可自由编辑的演示金额输入框 */
  var HISTORY_REMAIN_STATUS = $('#history-remain-status');   /* 配置页 · 当前生效结论回显 */
  function fmtAmount(v) {
    return v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  }
  /* 生效的可申请金额：申请开关为「开」时取输入框金额；为「关」时一律按 0 处理 */
  function effectiveHistoryRemain() { return applyOn ? historyRemain : 0; }
  function renderHistoryApplyEntry() {
    var remain = effectiveHistoryRemain();
    var canApply = remain > 0; /* 唯一判定条件：生效的可申请金额是否大于 0 */
    /* 查看月分润：提示文案与「申请历史分润」入口同处一个容器，一并显隐 */
    if (MONTH_HISTORY_APPLY_ENTRY) {
      MONTH_HISTORY_APPLY_ENTRY.style.display = canApply ? 'flex' : 'none';
    }
    if (MONTH_HISTORY_APPLY_AMOUNT) { MONTH_HISTORY_APPLY_AMOUNT.textContent = fmtAmount(remain); }
    /* 机构分润跳转提示页：入口按钮与其说明文案一并显隐 */
    if (HISTORY_APPLY_ENTRY) { HISTORY_APPLY_ENTRY.classList.toggle('hide', !canApply); }
    if (HISTORY_APPLY_TIP) { HISTORY_APPLY_TIP.classList.toggle('hide', !canApply); }
    /* 配置页回显当前结论，避免「填了金额却看不到」时被当成故障 */
    if (HISTORY_REMAIN_STATUS) {
      if (!applyOn) {
        HISTORY_REMAIN_STATUS.textContent = '当前生效金额：0.00 元 ← 被上方「允许下级申请分润」= 关 拦截，按 0 处理；改为「开」即按填入金额展示';
        HISTORY_REMAIN_STATUS.style.color = '#fa8c16';
      } else {
        HISTORY_REMAIN_STATUS.textContent = canApply
          ? '当前生效金额：' + fmtAmount(remain) + ' 元 → 提示文案与入口展示'
          : '当前生效金额：0.00 元 → 提示文案与入口隐藏';
        HISTORY_REMAIN_STATUS.style.color = canApply ? '#1677ff' : '#86909c';
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
     一级机构、下级机构-查看下级月分润 →「下级机构分润审核功能升级」
     下级机构-查看月分润 →「下级机构分润申请、审核功能升级」 */
  var GUIDE_AUDIT = {
    title: '下级机构分润审核功能升级',
    img: 'images/guide-submonth-apply-audit.png',
    lines: [
      '在【查看月分润页面】可查看下级机构月分润，可查看下级分润申请并进行审核/批量审核；审核过的数据点击"查看"可以查看申请、审核详情。'
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
