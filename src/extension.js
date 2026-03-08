const vscode = require('vscode');

let statusBarItems = [];
let pollTimer;
let inflight;
let lastPayload;
const AVAILABLE_SEGMENT = '█';
const UNAVAILABLE_SEGMENT = '░';
const RECOVERY_SEGMENT = '▓';
const GAP_SEGMENT = ' ';
const DEFAULT_BASE_URL = 'http://127.0.0.1:8317';
const DEFAULT_ENDPOINT = '/api/codex/usage';

const LOCALE = detectLocale();
const I18N = {
  zh: {
    statusBarName: '用量状态栏',
    defaultTitle: '用量',
    loading: '加载中...',
    fetchingTooltip: '正在获取用量...',
    fetchFailedTitle: '获取用量失败',
    warningPrefix: '用量状态栏',
    errBaseUrlEmpty: 'usageCenterBar.baseUrl 为空',
    errEndpointEmpty: 'usageCenterBar.endpoint 为空',
    purposeUsage: '用量',
    errInvalidJSON: '{purpose} 响应不是有效 JSON',
    errMissingUsedPercent: '在用量响应中找不到 used_percent',
    labelWeek: '周',
    labelFiveHour: '5小时',
    na: '无',
    tooltipUsageEndpoint: '用量接口：{url}',
    tooltipTotalCapacity: '总容量：{value}（Plus 基线）',
    tooltipPlan: '计划：{value}',
    tooltipAccount: '账号：{value}',
    tooltipEmail: '邮箱：{value}',
    sectionRateLimit: '限额',
    sectionTotal: '汇总',
    sectionCodeReview: '代码评审',
    sectionCredits: '积分：{value}',
    sectionPromo: '活动：{value}',
    sectionAdditionalLimits: '附加限额：{count}',
    unnamed: '未命名',
    moreCount: '- ... 另外 {count} 项',
    clickRefresh: '点击状态栏可查看认证文件详情。',
    windowPercent: '已用 {used}，剩余 {remaining}',
    windowLine: '{title} {window}：{detail}',
    window5h: '5h窗口',
    windowWeek: '周窗口',
    windowUnknown: '窗口',
    windowDirect: '{title}：{detail}',
    metricRemainingPercent: '剩余 {value}',
    fieldUsed: '已用',
    fieldLimit: '上限',
    fieldRemaining: '剩余',
    resetWait: '重置等待',
    listSep: '，',
    detailsTitle: '认证文件用量详情',
    detailsNoData: '当前没有可展示的认证文件用量信息',
    detailsSectionAvailable: '可用认证文件',
    detailsSectionWeekExhausted: '周用量已耗尽',
    detailsSectionHardError: '硬错误',
    detailsPriorityGroup: '优先级 {value}',
    weekResetWait: '周重置等待',
    fiveHourResetWait: '5h重置等待',
    detailsUnknownAccount: '未知账号',
    detailsUnknownPlan: '未知计划',
    detailsError: '错误：{value}',
    recoveryShortPrefix: '恢',
    recoveryTooltipLine: '{window}渐进恢复：下次 {next}，明显 {significant}，全部 {full}',
    combinedRecoveryLine: '综合恢复：当前 {current}，明显 {significant}，全部 {full}',
    combinedRecoveryGateLine: '5h额外限制：锁定 {value}，下次 {wait}',
    combinedQuickPickLabel: '综合恢复',
    combinedQuickPickDesc: '当前 {current} | 明显 {significant} | 全部 {full}',
    combinedQuickPickDetail: '{bar}{gate}',
    combinedQuickPickGate: ' | 5h额外限制 {value}，{wait}后解除',
    recoveryQuickPickLabel: '{window} 渐进恢复',
    recoveryQuickPickDesc: '下次 {next} | 明显 {significant} | 全部 {full}',
    recoveryQuickPickDetail: '可恢复 {locked} / 总容量 {total}',
    detailsItemDescription: '{fiveHourLabel} {fiveHour} | {weekLabel} {week}',
    detailsItemDetail: '{fileName} · {plan}'
  },
  en: {
    statusBarName: 'Usage Center Bar',
    defaultTitle: 'Usage',
    loading: 'Loading...',
    fetchingTooltip: 'Fetching usage...',
    fetchFailedTitle: 'Usage fetch failed',
    warningPrefix: 'Usage Center Bar',
    errBaseUrlEmpty: 'usageCenterBar.baseUrl is empty',
    errEndpointEmpty: 'usageCenterBar.endpoint is empty',
    purposeUsage: 'usage',
    errInvalidJSON: '{purpose} response is not valid JSON',
    errMissingUsedPercent: 'cannot locate used_percent in usage payload',
    labelWeek: 'Wk',
    labelFiveHour: '5h',
    na: 'N/A',
    tooltipUsageEndpoint: 'Usage endpoint: {url}',
    tooltipTotalCapacity: 'Total capacity: {value} (Plus baseline)',
    tooltipPlan: 'Plan: {value}',
    tooltipAccount: 'Account: {value}',
    tooltipEmail: 'Email: {value}',
    sectionRateLimit: 'Rate limit',
    sectionTotal: 'Total',
    sectionCodeReview: 'Code review',
    sectionCredits: 'Credits: {value}',
    sectionPromo: 'Promo: {value}',
    sectionAdditionalLimits: 'Additional limits: {count}',
    unnamed: 'unnamed',
    moreCount: '- ... +{count} more',
    clickRefresh: 'Click status bar to view auth file details.',
    windowPercent: 'used {used}, remaining {remaining}',
    windowLine: '{title} {window}: {detail}',
    window5h: '5h window',
    windowWeek: 'weekly window',
    windowUnknown: 'window',
    windowDirect: '{title}: {detail}',
    metricRemainingPercent: 'remaining {value}',
    fieldUsed: 'used',
    fieldLimit: 'limit',
    fieldRemaining: 'remaining',
    resetWait: 'reset wait',
    listSep: ', ',
    detailsTitle: 'Auth file usage details',
    detailsNoData: 'No auth file usage details available',
    detailsSectionAvailable: 'Available auth files',
    detailsSectionWeekExhausted: 'Weekly quota exhausted',
    detailsSectionHardError: 'Hard errors',
    detailsPriorityGroup: 'Priority {value}',
    weekResetWait: 'Weekly reset wait',
    fiveHourResetWait: '5h reset wait',
    detailsUnknownAccount: 'Unknown account',
    detailsUnknownPlan: 'Unknown plan',
    detailsError: 'Error: {value}',
    recoveryShortPrefix: 'Rec',
    recoveryTooltipLine: '{window} recovery: next {next}, significant {significant}, full {full}',
    combinedRecoveryLine: 'Combined recovery: now {current}, significant {significant}, full {full}',
    combinedRecoveryGateLine: 'Extra 5h gate: blocked {value}, next {wait}',
    combinedQuickPickLabel: 'Combined recovery',
    combinedQuickPickDesc: 'now {current} | significant {significant} | full {full}',
    combinedQuickPickDetail: '{bar}{gate}',
    combinedQuickPickGate: ' | 5h gate {value}, clears in {wait}',
    recoveryQuickPickLabel: '{window} recovery',
    recoveryQuickPickDesc: 'next {next} | significant {significant} | full {full}',
    recoveryQuickPickDetail: 'recoverable {locked} / total {total}',
    detailsItemDescription: '{fiveHourLabel} {fiveHour} | {weekLabel} {week}',
    detailsItemDetail: '{fileName} · {plan}'
  }
};

function tr(key, vars) {
  const table = I18N[LOCALE] || I18N.en;
  const template = table[key] || I18N.en[key] || key;
  if (!vars || typeof vars !== 'object') {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, name) => {
    const value = vars[name];
    return value === undefined || value === null ? '' : String(value);
  });
}

function detectLocale() {
  const candidates = [];
  candidates.push(String(vscode.env.language || ''));
  try {
    const raw = process.env.VSCODE_NLS_CONFIG;
    if (raw) {
      const parsed = JSON.parse(raw);
      candidates.push(String(parsed.locale || ''));
    }
  } catch (_e) {
    // ignore
  }
  try {
    candidates.push(String(Intl.DateTimeFormat().resolvedOptions().locale || ''));
  } catch (_e) {
    // ignore
  }

  for (const candidate of candidates) {
    const normalized = String(candidate || '').toLowerCase();
    if (normalized.startsWith('zh')) {
      return 'zh';
    }
  }
  return 'en';
}

function localizedTitle(rawTitle) {
  const s = String(rawTitle || '').trim();
  if (!s) {
    return tr('defaultTitle');
  }
  if (LOCALE === 'zh' && /^usage$/i.test(s)) {
    return tr('defaultTitle');
  }
  return s;
}

function activate(context) {
  createStatusBarItem();

  context.subscriptions.push(
    vscode.commands.registerCommand('usageCenterBar.refresh', async () => {
      await refreshUsage(true);
    }),
    vscode.commands.registerCommand('usageCenterBar.showDetails', async () => {
      await showAuthFileUsageDetails();
    }),
    vscode.commands.registerCommand('usageCenterBar.openSettings', async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:huajin-local.usage-center-bar');
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('usageCenterBar')) {
        return;
      }
      recreateStatusBarItem(context);
      schedulePolling();
      void refreshUsage(true);
    })
  );

  schedulePolling();
  void refreshUsage(false);
}

function deactivate() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
  disposeStatusBarItems();
}

function recreateStatusBarItem(_context) {
  disposeStatusBarItems();
  createStatusBarItem();
}

function disposeStatusBarItems() {
  for (const item of statusBarItems) {
    try {
      item.dispose();
    } catch (_e) {
      // ignore
    }
  }
  statusBarItems = [];
}

function ensureStatusBarItems(count) {
  const cfg = getConfig();
  while (statusBarItems.length < count) {
    const idx = statusBarItems.length;
    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, cfg.priority - idx);
    item.name = tr('statusBarName');
    item.command = 'usageCenterBar.showDetails';
    statusBarItems.push(item);
  }
  while (statusBarItems.length > count) {
    const item = statusBarItems.pop();
    if (item) {
      item.dispose();
    }
  }
}

function setStatusBarParts(parts, tooltip, warningBackground) {
  const list = Array.isArray(parts) && parts.length ? parts : [{ text: '--' }];
  ensureStatusBarItems(list.length);
  for (let i = 0; i < statusBarItems.length; i += 1) {
    const item = statusBarItems[i];
    const part = list[i] || { text: '' };
    item.text = part.text || '';
    item.tooltip = tooltip;
    item.color = part.color;
    item.backgroundColor = warningBackground && i === 0 ? warningBackground : undefined;
    item.show();
  }
}

function createStatusBarItem() {
  const cfg = getConfig();
  setStatusBarParts([{ text: `$(sync~spin) ${cfg.title} ${tr('loading')}` }], tr('fetchingTooltip'));
}

function schedulePolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }

  const cfg = getConfig();
  const intervalMs = Math.max(10, Number(cfg.pollIntervalSec) || 60) * 1000;
  pollTimer = setInterval(() => {
    void refreshUsage(false);
  }, intervalMs);
}

async function refreshUsage(showNotificationOnError) {
  if (!statusBarItems.length) {
    createStatusBarItem();
  }
  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    const cfg = getConfig();

    try {
      setStatusBarParts([{ text: `$(sync~spin) ${cfg.title} ${tr('loading')}` }], tr('fetchingTooltip'));
      const url = joinUrl(cfg.baseUrl, cfg.endpoint);
      const payload = await fetchUsage(url, cfg.apiKey, cfg.requestTimeoutMs);
      lastPayload = payload;
      const accountName = resolveAccountNameFromPayload(payload, cfg.accountNamePath);

      const statusBarSummary = resolveStatusBarSummary(payload);
      const { weekRemaining, fiveHourRemaining, usageMultiplier, barPayload } = statusBarSummary;

      const tooltip = buildTooltip(
        url,
        payload,
        accountName,
        usageMultiplier
      );
      setStatusBarParts(buildStatusBarParts(cfg.title, usageMultiplier, weekRemaining, fiveHourRemaining, cfg.barLength, barPayload), tooltip);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatusBarParts(
        [{ text: `$(warning) ${cfg.title} --` }],
        `${tr('fetchFailedTitle')}\n\n${message}`,
        new vscode.ThemeColor('statusBarItem.warningBackground')
      );

      if (showNotificationOnError) {
        void vscode.window.showWarningMessage(`${tr('warningPrefix')}: ${message}`);
      }
    }
  })();

  try {
    await inflight;
  } finally {
    inflight = undefined;
  }
}

function getConfig() {
  const c = vscode.workspace.getConfiguration('usageCenterBar');
  return {
    baseUrl: String(c.get('baseUrl', DEFAULT_BASE_URL)).trim(),
    endpoint: String(c.get('endpoint', DEFAULT_ENDPOINT)).trim(),
    apiKey: String(c.get('apiKey', '')).trim(),
    pollIntervalSec: Number(c.get('pollIntervalSec', 60)),
    requestTimeoutMs: Number(c.get('requestTimeoutMs', 15000)),
    usedPercentPath: String(c.get('usedPercentPath', 'rate_limit.primary_window.used_percent')).trim(),
    accountNamePath: String(c.get('accountNamePath', '')).trim(),
    barLength: Number(c.get('barLength', 10)),
    title: localizedTitle(c.get('title', tr('defaultTitle'))),
    priority: Number(c.get('priority', -1000))
  };
}

function joinUrl(baseUrl, endpoint) {
  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  const path = String(endpoint || '').trim();
  if (!base) {
    throw new Error(tr('errBaseUrlEmpty'));
  }
  if (!path) {
    throw new Error(tr('errEndpointEmpty'));
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

async function fetchUsage(url, apiKey, timeoutMs) {
  const headers = {
    Accept: 'application/json'
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return fetchJSON(url, headers, timeoutMs, tr('purposeUsage'));
}

async function fetchJSON(url, headers, timeoutMs, purpose) {
  if (typeof fetch !== 'function') {
    throw new Error('fetch API is unavailable in this VS Code runtime');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 15000));

  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal
    });

    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${truncate(text, 240)}`);
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (_e) {
      throw new Error(tr('errInvalidJSON', { purpose }));
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function resolveAccountNameFromPayload(payload, configuredPath) {
  const candidates = [];
  if (configuredPath) {
    candidates.push(configuredPath);
  }
  candidates.push(
    'account_name',
    'account.name',
    'user.name',
    'user.username',
    'email',
    'user.email',
    'account.email'
  );
  return firstNonEmptyString(payload, candidates);
}

function firstNonEmptyString(obj, paths) {
  for (const path of paths) {
    const value = getByPath(obj, path);
    if (typeof value === 'string') {
      const s = value.trim();
      if (s) {
        return s;
      }
    }
  }
  return '';
}

function resolveUsedPercent(payload, configuredPath) {
  const candidates = [];
  if (configuredPath) {
    candidates.push(configuredPath);
  }
  candidates.push(
    'rate_limit.primary_window.used_percent',
    'rate_limit.secondary_window.used_percent',
    'total.primary_window.progress_percent',
    'total.secondary_window.progress_percent',
    'total.primary_window.used_percent',
    'total.secondary_window.used_percent'
  );

  for (const path of candidates) {
    const value = getByPath(payload, path);
    const num = Number(value);
    if (Number.isFinite(num)) {
      return num;
    }
  }

  throw new Error(tr('errMissingUsedPercent'));
}

function resolveWeekAndFiveHourUsed(payload) {
  const primary = readRateLimitWindow(payload, 'primary');
  const secondary = readRateLimitWindow(payload, 'secondary');

  let weekUsed = NaN;
  let fiveHourUsed = NaN;

  if (Number.isFinite(primary.limitWindowSeconds) && Number.isFinite(secondary.limitWindowSeconds)) {
    if (primary.limitWindowSeconds <= secondary.limitWindowSeconds) {
      fiveHourUsed = primary.usedPercent;
      weekUsed = secondary.usedPercent;
    } else {
      fiveHourUsed = secondary.usedPercent;
      weekUsed = primary.usedPercent;
    }
  }

  if (!Number.isFinite(fiveHourUsed)) {
    if (isLikelyFiveHourWindow(primary.limitWindowSeconds)) {
      fiveHourUsed = primary.usedPercent;
    } else if (isLikelyFiveHourWindow(secondary.limitWindowSeconds)) {
      fiveHourUsed = secondary.usedPercent;
    }
  }

  if (!Number.isFinite(weekUsed)) {
    if (isLikelyWeekWindow(primary.limitWindowSeconds)) {
      weekUsed = primary.usedPercent;
    } else if (isLikelyWeekWindow(secondary.limitWindowSeconds)) {
      weekUsed = secondary.usedPercent;
    }
  }

  if (!Number.isFinite(weekUsed)) {
    weekUsed = Number.isFinite(secondary.usedPercent) ? secondary.usedPercent : primary.usedPercent;
  }
  if (!Number.isFinite(fiveHourUsed)) {
    fiveHourUsed = Number.isFinite(primary.usedPercent) ? primary.usedPercent : secondary.usedPercent;
  }

  return {
    weekUsed: normalizePercent(weekUsed),
    fiveHourUsed: normalizePercent(fiveHourUsed)
  };
}

function resolveStatusBarSummary(payload) {
  const { weekUsed, fiveHourUsed } = resolveWeekAndFiveHourUsed(payload);
  const fallback = {
    weekRemaining: Number.isFinite(weekUsed) ? clamp(100 - weekUsed, 0, 100) : NaN,
    fiveHourRemaining: Number.isFinite(fiveHourUsed) ? clamp(100 - fiveHourUsed, 0, 100) : NaN,
    usageMultiplier: resolveUsageMultiplier(payload),
    barPayload: payload
  };

  const combined = resolveCombinedRecoverySummary(payload);
  if (combined && Number.isFinite(combined.totalUnits) && combined.totalUnits >= 0) {
    return {
      weekRemaining: Number.isFinite(combined.availablePercentNow) ? clamp(combined.availablePercentNow, 0, 100) : fallback.weekRemaining,
      fiveHourRemaining: fallback.fiveHourRemaining,
      usageMultiplier: combined.totalUnits,
      barPayload: payload
    };
  }

  const items = resolveActiveAuthFilesUsage(payload);
  if (!items.length) {
    return fallback;
  }

  const eligible = items.filter((item) => !isHardFailedAuthUsage(item));
  if (!eligible.length) {
    return {
      weekRemaining: 0,
      fiveHourRemaining: 0,
      usageMultiplier: 0,
      barPayload: null
    };
  }

  const aggregated = aggregateStatusBarSummaryFromItems(eligible);
  if (!aggregated) {
    return fallback;
  }

  return {
    weekRemaining: aggregated.weekRemaining,
    fiveHourRemaining: aggregated.fiveHourRemaining,
    usageMultiplier: aggregated.usageMultiplier,
    barPayload: null
  };
}

function aggregateStatusBarSummaryFromItems(items) {
  if (!Array.isArray(items) || !items.length) {
    return null;
  }

  let totalUnits = 0;
  let weekAvailableUnits = 0;
  let fiveHourAvailableUnits = 0;
  let sawWeek = false;
  let sawFiveHour = false;

  for (const item of items) {
    const units = resolveAuthUsageItemCapacityUnits(item);
    if (!Number.isFinite(units) || units <= 0) {
      continue;
    }
    totalUnits += units;

    const weekRemaining = resolveWeekRemainingPercentForItem(item);
    if (Number.isFinite(weekRemaining)) {
      sawWeek = true;
      weekAvailableUnits += units * clamp(weekRemaining, 0, 100) / 100;
    }

    const fiveHourRemaining = resolveFiveHourRemainingPercentForItem(item);
    if (Number.isFinite(fiveHourRemaining)) {
      sawFiveHour = true;
      fiveHourAvailableUnits += units * clamp(fiveHourRemaining, 0, 100) / 100;
    }
  }

  if (!Number.isFinite(totalUnits) || totalUnits <= 0) {
    return null;
  }

  return {
    usageMultiplier: totalUnits,
    weekRemaining: sawWeek ? clamp((weekAvailableUnits / totalUnits) * 100, 0, 100) : NaN,
    fiveHourRemaining: sawFiveHour ? clamp((fiveHourAvailableUnits / totalUnits) * 100, 0, 100) : NaN
  };
}

function resolveAuthUsageItemCapacityUnits(item) {
  const candidates = [
    'usage_multiplier',
    'total_usage_multiplier',
    'capacity_units',
    'available_units',
    'week.total_units',
    'five_hour.total_units'
  ];
  for (const path of candidates) {
    const value = Number(getByPath(item, path));
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return inferPlanWeightForStatusBar(valueToString(getByPath(item, 'plan_type')));
}

function inferPlanWeightForStatusBar(planType) {
  switch (String(planType || '').trim().toLowerCase()) {
    case 'free':
      return 0.2;
    case 'pro':
      return 6.0;
    default:
      return 1.0;
  }
}

function resolveWeekRemainingPercentForItem(item) {
  if (isWeekUsageExhausted(item)) {
    return 0;
  }
  return resolveWindowRemainingPercent(getByPath(item, 'week'));
}

function resolveFiveHourRemainingPercentForItem(item) {
  if (isWeekUsageExhausted(item) || isFiveHourUsageExhausted(item)) {
    return 0;
  }

  let window = getByPath(item, 'five_hour');
  if ((!window || typeof window !== 'object') && String(getByPath(item, 'plan_type')).trim().toLowerCase() === 'free') {
    window = getByPath(item, 'week');
  }
  return resolveWindowRemainingPercent(window);
}

function resolveWindowRemainingPercent(window) {
  if (!window || typeof window !== 'object') {
    return NaN;
  }

  const usedPercent = numberFromAny(getByPath(window, 'used_percent'));
  if (Number.isFinite(usedPercent)) {
    return clamp(100 - usedPercent, 0, 100);
  }

  const remaining = numberFromAny(getByPath(window, 'remaining'));
  const limit = numberFromAny(getByPath(window, 'limit'));
  if (Number.isFinite(remaining) && Number.isFinite(limit) && limit > 0) {
    return clamp((remaining / limit) * 100, 0, 100);
  }

  return NaN;
}

function isFiveHourUsageExhausted(item) {
  const fiveHour = getByPath(item, 'five_hour');
  if (!fiveHour || typeof fiveHour !== 'object') {
    return false;
  }

  const usedPercent = numberFromAny(getByPath(fiveHour, 'used_percent'));
  if (Number.isFinite(usedPercent) && usedPercent >= 99.9) {
    return true;
  }

  const remaining = numberFromAny(getByPath(fiveHour, 'remaining'));
  return Number.isFinite(remaining) && remaining <= 0;
}

function isHardFailedAuthUsage(item) {
  return hasAuthFailureSignal(item);
}

function readRateLimitWindow(payload, windowKind) {
  const usedCandidates = windowKind === 'primary'
    ? [
      'rate_limit.primary_window.used_percent',
      'total.primary_window.progress_percent',
      'total.primary_window.used_percent'
    ]
    : [
      'rate_limit.secondary_window.used_percent',
      'total.secondary_window.progress_percent',
      'total.secondary_window.used_percent'
    ];
  const secondsCandidates = windowKind === 'primary'
    ? [
      'rate_limit.primary_window.limit_window_seconds',
      'total.primary_window.limit_window_seconds'
    ]
    : [
      'rate_limit.secondary_window.limit_window_seconds',
      'total.secondary_window.limit_window_seconds'
    ];

  return {
    usedPercent: normalizePercent(readFirstFinite(payload, usedCandidates)),
    limitWindowSeconds: readFirstFinite(payload, secondsCandidates)
  };
}

function readFirstFinite(payload, paths) {
  for (const path of paths) {
    const value = Number(getByPath(payload, path));
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return NaN;
}

function normalizePercent(value) {
  if (!Number.isFinite(value)) {
    return NaN;
  }
  return clamp(value, 0, 100);
}

function isLikelyFiveHourWindow(seconds) {
  return Number.isFinite(seconds) && seconds >= 2 * 3600 && seconds <= 12 * 3600;
}

function isLikelyWeekWindow(seconds) {
  return Number.isFinite(seconds) && seconds >= 5 * 24 * 3600 && seconds <= 10 * 24 * 3600;
}

function getByPath(obj, path) {
  const parts = String(path || '').split('.').map((x) => x.trim()).filter(Boolean);
  let cursor = obj;
  for (const part of parts) {
    if (cursor && typeof cursor === 'object' && Object.prototype.hasOwnProperty.call(cursor, part)) {
      cursor = cursor[part];
    } else {
      return undefined;
    }
  }
  return cursor;
}

function buildStatusBarParts(title, usageMultiplier, weekRemaining, fiveHourRemaining, barLength, payload) {
  return [{ text: buildStatusText(title, usageMultiplier, weekRemaining, fiveHourRemaining, barLength, payload) || '--' }];
}

function buildStatusText(title, usageMultiplier, weekRemaining, fiveHourRemaining, barLength, payload) {
  const mergedBar = buildMergedBar(weekRemaining, fiveHourRemaining, barLength, payload);
  const multiplierLabel = formatUsageMultiplierBadge(usageMultiplier);
  const resolvedTitle = localizedTitle(title);
  const showTitle = resolvedTitle && resolvedTitle !== tr('defaultTitle');
  if (multiplierLabel) {
    return showTitle ? `${multiplierLabel} ${resolvedTitle} ${mergedBar}` : `${multiplierLabel} ${mergedBar}`;
  }
  return showTitle ? `${resolvedTitle} ${mergedBar}` : mergedBar;
}

function buildMergedBar(weekRemaining, fiveHourRemaining, barLength, payload) {
  const baseLen = clamp(Math.round(Number(barLength) || 10), 8, 18);
  const len = clamp(Math.round(baseLen * 2.4), 18, 36);
  const combined = resolveCombinedRecoverySummary(payload);
  if (combined) {
    const bar = buildCombinedRecoveryBar(combined, len);
    if (bar) {
      return bar;
    }
  }
  if (!Number.isFinite(weekRemaining)) {
    return tr('na');
  }
  const currentAvailable = resolveCurrentAvailablePercent(payload, weekRemaining, fiveHourRemaining);
  return buildStaticWeekBar(currentAvailable, len);
}

function buildCombinedRecoveryBar(combined, len) {
  const cells = buildCombinedRecoveryCells(combined, len);
  if (!cells.length) {
    return '';
  }
  return cells.map((cell) => {
    if (cell === 'current') {
      return AVAILABLE_SEGMENT;
    }
    if (cell === 'recovery') {
      return RECOVERY_SEGMENT;
    }
    return GAP_SEGMENT;
  }).join('').replace(/\s+$/u, '');
}

function buildCombinedRecoveryCells(combined, len) {
  if (!combined || typeof combined !== 'object') {
    return [];
  }
  const totalUnits = Number(combined.totalUnits);
  const totalSlots = clamp(Math.round(Number(len) || 18), 18, 36);
  if (!Number.isFinite(totalUnits) || totalUnits <= 0 || totalSlots <= 0) {
    return [];
  }

  const cells = new Array(totalSlots).fill('gap');
  const currentUnits = clamp(Number(combined.availableUnitsNow) || 0, 0, totalUnits);
  const currentSlots = clamp(Math.round((currentUnits / totalUnits) * totalSlots), 0, totalSlots);
  for (let i = 0; i < currentSlots; i += 1) {
    cells[i] = 'current';
  }

  const events = Array.isArray(combined.events) ? combined.events : [];
  if (!events.length || currentSlots >= totalSlots) {
    return cells;
  }

  const horizon = Math.max(1, Number(combined.fullWaitSeconds) || 0, ...events.map((event) => Number(event.waitSeconds) || 0));
  const startBase = currentSlots > 0 ? Math.min(totalSlots - 1, currentSlots + 1) : 0;
  const timeSlots = Math.max(1, totalSlots - startBase);

  for (const event of events) {
    const releaseUnits = Math.max(0, Number(event.releaseUnits) || 0);
    if (!(releaseUnits > 0)) {
      continue;
    }
    const width = Math.max(1, Math.round((releaseUnits / totalUnits) * totalSlots));
    const waitSeconds = Math.max(0, Number(event.waitSeconds) || 0);
    let start = startBase + Math.round((waitSeconds / horizon) * Math.max(0, timeSlots - 1));
    if (start >= totalSlots) {
      start = totalSlots - 1;
    }
    const end = Math.min(totalSlots, start + width);
    for (let i = start; i < end; i += 1) {
      if (cells[i] === 'gap') {
        cells[i] = 'recovery';
      }
    }
  }

  return cells;
}

function allocateBarSegments(totalSlots, values) {
  const len = Math.max(1, Math.round(Number(totalSlots) || 1));
  const normalized = Array.isArray(values)
    ? values.map((value) => Math.max(0, Number(value) || 0))
    : [];
  const sum = normalized.reduce((acc, value) => acc + value, 0);
  if (!normalized.length || sum <= 0) {
    return [0, 0, 0, len];
  }

  const raw = normalized.map((value) => (value / sum) * len);
  const slots = raw.map((value) => Math.floor(value));
  let remaining = len - slots.reduce((acc, value) => acc + value, 0);
  const ranked = raw
    .map((value, idx) => ({ idx, frac: value - slots[idx], positive: normalized[idx] > 0 }))
    .filter((entry) => entry.positive)
    .sort((a, b) => b.frac - a.frac || a.idx - b.idx);
  let cursor = 0;
  while (remaining > 0 && ranked.length > 0) {
    slots[ranked[cursor % ranked.length].idx] += 1;
    cursor += 1;
    remaining -= 1;
  }
  while (remaining < 0 && ranked.length > 0) {
    const idx = ranked[ranked.length - 1 - ((-remaining - 1) % ranked.length)].idx;
    if (slots[idx] > 0) {
      slots[idx] -= 1;
      remaining += 1;
      continue;
    }
    break;
  }
  while (slots.length < 4) {
    slots.push(0);
  }
  return slots;
}

function resolveCurrentAvailablePercent(payload, weekRemaining, fiveHourRemaining) {
  const recovery = resolveRecoverySummary(payload);
  const weekWindow = normalizeRecoveryWindow(getByPath(recovery, 'week'), weekRemaining);
  if (weekWindow && Number.isFinite(weekWindow.totalUnits) && weekWindow.totalUnits > 0) {
    return clamp((weekWindow.baseAvailableUnits / weekWindow.totalUnits) * 100, 0, 100);
  }
  if (Number.isFinite(fiveHourRemaining)) {
    return clamp(Math.min(weekRemaining, fiveHourRemaining), 0, 100);
  }
  return clamp(weekRemaining, 0, 100);
}

function buildProgressiveRecoveryBar(payload, segments, weekRemaining, fiveHourRemaining) {
  const recovery = resolveRecoverySummary(payload);
  const len = Math.max(1, Math.round(Number(segments) || 1));
  const weekWindow = normalizeRecoveryWindow(getByPath(recovery, 'week'), weekRemaining);
  if (!weekWindow) {
    return buildStaticWeekBar(weekRemaining, len);
  }
  const bar = buildWeekQuotaProjectionBar(weekWindow, len);
  if (bar) {
    return bar;
  }
  return buildStaticWeekBar(weekRemaining, len);
}

function buildStaticWeekBar(weekRemaining, len) {
  if (!Number.isFinite(weekRemaining)) {
    return '';
  }
  const remainingSlots = clamp(Math.round((clamp(weekRemaining, 0, 100) / 100) * len), 0, len);
  return `${AVAILABLE_SEGMENT.repeat(remainingSlots)}${UNAVAILABLE_SEGMENT.repeat(len - remainingSlots)}`;
}

function buildWeekQuotaProjectionBar(weekWindow, len) {
  if (!weekWindow || typeof weekWindow !== 'object') {
    return '';
  }
  const totalUnits = Number(weekWindow.totalUnits);
  const baseAvailableUnits = Number(weekWindow.baseAvailableUnits);
  if (!Number.isFinite(totalUnits) || totalUnits <= 0 || !Number.isFinite(baseAvailableUnits)) {
    return '';
  }

  const chars = new Array(len).fill(UNAVAILABLE_SEGMENT);
  const clampedBaseUnits = clamp(baseAvailableUnits, 0, totalUnits);
  const baseSlots = clamp(Math.round((clampedBaseUnits / totalUnits) * len), 0, len);
  for (let i = 0; i < baseSlots; i++) {
    chars[i] = AVAILABLE_SEGMENT;
  }

  const rightSlots = len - baseSlots;
  if (rightSlots <= 0) {
    return chars.join('');
  }

  let markerOffset = 0;
  let markerSlots = rightSlots;
  // Keep a visual separator so future recovery markers never look like current availability.
  if (baseSlots > 0 && rightSlots > 0) {
    markerOffset = 1;
    markerSlots = rightSlots - 1;
    chars[baseSlots] = UNAVAILABLE_SEGMENT;
  }

  const recoveryTimeline = projectRecoveryDistribution(weekWindow, markerSlots);
  if (!recoveryTimeline.length) {
    return chars.join('');
  }

  for (let i = 0; i < markerSlots; i++) {
    if (recoveryTimeline[i]) {
      chars[baseSlots + markerOffset + i] = RECOVERY_SEGMENT;
    }
  }
  return chars.join('');
}

function projectRecoveryDistribution(weekWindow, rightSlots) {
  const rightLen = Math.max(0, Number(rightSlots) || 0);
  if (rightLen <= 0 || !weekWindow || typeof weekWindow !== 'object') {
    return [];
  }
  const events = Array.isArray(weekWindow.events) ? weekWindow.events : [];
  if (!events.length) {
    return [];
  }

  const horizonSeconds = 7 * 24 * 3600;
  const normalized = events
    .map((event, idx) => ({
      idx,
      waitSeconds: clamp(Number(event.waitSeconds) || 0, 0, horizonSeconds),
      releaseUnits: Math.max(0, Number(event.releaseUnits) || 0)
    }))
    .filter((event) => event.releaseUnits > 0)
    .sort((a, b) => a.waitSeconds - b.waitSeconds);
  if (!normalized.length) {
    return [];
  }

  const out = new Array(rightLen).fill(false);
  for (const item of normalized) {
    const anchor = clamp(Math.floor((item.waitSeconds / horizonSeconds) * rightLen), 0, rightLen - 1);
    out[anchor] = true;
  }
  return out;
}

function normalizeRecoveryEvents(eventsRaw) {
  if (!Array.isArray(eventsRaw)) {
    return [];
  }
  const list = eventsRaw
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      waitSeconds: Math.max(0, Number(getByPath(item, 'wait_seconds')) || 0),
      releaseUnits: Math.max(0, Number(getByPath(item, 'release_units')) || 0)
    }))
    .filter((item) => item.releaseUnits > 0);
  list.sort((a, b) => a.waitSeconds - b.waitSeconds);
  return list;
}

function normalizeRecoveryWindow(window, fallbackRemainingPercent) {
  if (!window || typeof window !== 'object') {
    return null;
  }

  const totalUnitsRaw = Number(getByPath(window, 'total_units'));
  const totalUnits = Number.isFinite(totalUnitsRaw) && totalUnitsRaw > 0 ? totalUnitsRaw : 100;

  let lockedUnits = Number(getByPath(window, 'locked_units'));
  if (!Number.isFinite(lockedUnits)) {
    const usedPercent = Number(getByPath(window, 'used_percent'));
    if (Number.isFinite(usedPercent)) {
      lockedUnits = totalUnits * clamp(usedPercent, 0, 100) / 100;
    } else if (Number.isFinite(fallbackRemainingPercent)) {
      lockedUnits = totalUnits * (100 - clamp(fallbackRemainingPercent, 0, 100)) / 100;
    } else {
      lockedUnits = 0;
    }
  }
  lockedUnits = clamp(lockedUnits, 0, totalUnits);

  let baseAvailableUnits = clamp(totalUnits - lockedUnits, 0, totalUnits);
  if (baseAvailableUnits <= 0 && Number.isFinite(fallbackRemainingPercent) && fallbackRemainingPercent > 0) {
    baseAvailableUnits = totalUnits * clamp(fallbackRemainingPercent, 0, 100) / 100;
  }

  let events = normalizeRecoveryEvents(getByPath(window, 'events'));
  if (!events.length) {
    const waitSeconds = Number(getByPath(window, 'next_wait_seconds'));
    const fallbackReleaseUnits = lockedUnits > 0 ? lockedUnits : 0;
    const nextReleaseUnits = Number(getByPath(window, 'next_release_units'));
    const releaseUnits = Number.isFinite(nextReleaseUnits) && nextReleaseUnits > 0
      ? nextReleaseUnits
      : fallbackReleaseUnits;
    if (Number.isFinite(waitSeconds) && waitSeconds > 0 && releaseUnits > 0) {
      events = [{ waitSeconds, releaseUnits }];
    }
  }

  return {
    totalUnits,
    baseAvailableUnits,
    events
  };
}

function renderProgressBar(remainingPercent, segments, fillChar) {
  const len = Math.max(1, Math.round(Number(segments) || 1));
  const filled = Math.round((clamp(Number(remainingPercent) || 0, 0, 100) / 100) * len);
  return `${String(fillChar || '█').repeat(filled)}${'░'.repeat(len - filled)}`;
}

function buildDetailsWindowBar(window) {
  if (!window || typeof window !== 'object') {
    return tr('na');
  }
  const used = Number(getByPath(window, 'used_percent'));
  if (!Number.isFinite(used)) {
    return tr('na');
  }
  const remaining = clamp(100 - used, 0, 100);
  const bar = renderProgressBar(remaining, 8, '█');
  return bar;
}

function formatPercent(v) {
  const fixed = Math.round(v * 10) / 10;
  return Number.isInteger(fixed) ? `${fixed}%` : `${fixed.toFixed(1)}%`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function truncate(text, max) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) {
    return s;
  }
  return `${s.slice(0, max)}...`;
}

function buildTooltip(url, payload, accountName, usageMultiplier) {
  const lines = [
    tr('tooltipUsageEndpoint', { url }),
  ];
  const multiplierLabel = formatUsageMultiplierLabel(usageMultiplier);
  if (multiplierLabel) {
    lines.push(tr('tooltipTotalCapacity', { value: multiplierLabel }));
  }

  const planType = valueToString(getByPath(payload, 'plan_type'));
  if (planType) {
    lines.push(tr('tooltipPlan', { value: planType }));
  }

  const resolvedAccount = valueToString(accountName)
    || firstNonEmptyString(payload, ['account_name', 'account.name', 'user.name', 'user.username']);
  if (resolvedAccount) {
    lines.push(tr('tooltipAccount', { value: resolvedAccount }));
  }

  const email = firstNonEmptyString(payload, ['email', 'user.email', 'account.email']);
  if (email && email !== resolvedAccount) {
    lines.push(tr('tooltipEmail', { value: email }));
  }

  appendWindowLines(lines, tr('sectionRateLimit'), getByPath(payload, 'rate_limit'));
  appendWindowLines(lines, tr('sectionTotal'), getByPath(payload, 'total'));
  appendWindowLines(lines, tr('sectionCodeReview'), getByPath(payload, 'code_review_rate_limit'));

  const credits = summarizeKV(
    getByPath(payload, 'credits'),
    ['total', 'used', 'remaining', 'balance', 'granted', 'limit', 'expires_at', 'reset_at']
  );
  if (credits) {
    lines.push(tr('sectionCredits', { value: credits }));
  }

  const promo = summarizeKV(
    getByPath(payload, 'promo'),
    ['name', 'status', 'total', 'used', 'remaining', 'expires_at']
  );
  if (promo) {
    lines.push(tr('sectionPromo', { value: promo }));
  }

  for (const line of summarizeRecoveryTooltipLines(payload)) {
    lines.push(line);
  }

  const additional = getByPath(payload, 'additional_rate_limits');
  if (Array.isArray(additional)) {
    lines.push(tr('sectionAdditionalLimits', { count: additional.length }));
    const preview = additional.slice(0, 3);
    for (const item of preview) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const name = firstNonEmptyString(item, ['name', 'id', 'type']) || tr('unnamed');
      const detail = summarizeWindow(item.secondary_window)
        || summarizeWindow(item.primary_window)
        || summarizeKV(item, ['limit', 'used', 'remaining', 'reset_at']);
      if (detail) {
        lines.push(`- ${name}: ${detail}`);
      } else {
        lines.push(`- ${name}`);
      }
    }
    if (additional.length > preview.length) {
      lines.push(tr('moreCount', { count: additional.length - preview.length }));
    }
  }

  lines.push('', tr('clickRefresh'));
  return lines.join('\n');
}

async function showAuthFileUsageDetails() {
  await refreshUsage(false);
  const items = resolveActiveAuthFilesUsage(lastPayload);
  const grouped = groupAuthFileUsageItems(items);
  const recoveryItems = buildRecoveryQuickPickItems(lastPayload);
  const hasAvailable = grouped.availableGroups.some((group) => Array.isArray(group.items) && group.items.length > 0);
  if (!hasAvailable && !grouped.exhausted.length && !grouped.hardFailed.length && !recoveryItems.length) {
    await vscode.window.showInformationMessage(tr('detailsNoData'));
    return;
  }

  const mapAuthUsageItem = (item) => {
    const account = valueToString(item.account) || tr('detailsUnknownAccount');
    const plan = valueToString(item.plan_type) || tr('detailsUnknownPlan');
    const forceZeroRemaining = isWeekUsageExhausted(item);
    const displayFiveHourWindow = forceZeroRemaining ? { used_percent: 100 } : item.five_hour;
    const displayWeekWindow = forceZeroRemaining ? { used_percent: 100 } : item.week;
    const fiveHourBar = buildDetailsWindowBar(displayFiveHourWindow);
    const weekBar = buildDetailsWindowBar(displayWeekWindow);
    const weekResetWait = resolveWeekResetWaitText(item);
    const fiveHourResetWait = resolveFiveHourResetWaitText(item);
    const errorSummary = valueToString(item.error_summary) || valueToString(item.error);
    const usageDesc = tr('detailsItemDescription', {
      fiveHourLabel: tr('labelFiveHour'),
      fiveHour: fiveHourBar,
      weekLabel: tr('labelWeek'),
      week: weekBar
    });
    const usageWithIdentity = `${plan} · ${usageDesc}`;
    const description = errorSummary
      ? `${usageWithIdentity} | ${tr('detailsError', { value: truncate(errorSummary, 90) })}`
      : usageWithIdentity;
    const waitDetail = `${tr('weekResetWait')} ${weekResetWait} | ${tr('fiveHourResetWait')} ${fiveHourResetWait}`;
    return {
      label: account,
      description,
      detail: waitDetail
    };
  };

  const quickPickItems = [...recoveryItems];
  const sectionCount = Number(hasAvailable) + Number(grouped.exhausted.length > 0) + Number(grouped.hardFailed.length > 0);

  if (hasAvailable) {
    if (sectionCount > 1) {
      quickPickItems.push({
        label: tr('detailsSectionAvailable'),
        kind: vscode.QuickPickItemKind.Separator
      });
    }
    const showPrioritySeparators = grouped.availableGroups.length > 0;
    for (const group of grouped.availableGroups) {
      if (!Array.isArray(group.items) || !group.items.length) {
        continue;
      }
      if (showPrioritySeparators) {
        quickPickItems.push({
          label: tr('detailsPriorityGroup', { value: group.priority }),
          kind: vscode.QuickPickItemKind.Separator
        });
      }
      quickPickItems.push(...group.items.map(mapAuthUsageItem));
    }
  }
  if (grouped.exhausted.length > 0) {
    quickPickItems.push({
      label: tr('detailsSectionWeekExhausted'),
      kind: vscode.QuickPickItemKind.Separator
    });
    quickPickItems.push(...grouped.exhausted.map(mapAuthUsageItem));
  }
  if (grouped.hardFailed.length > 0) {
    quickPickItems.push({
      label: tr('detailsSectionHardError'),
      kind: vscode.QuickPickItemKind.Separator
    });
    quickPickItems.push(...grouped.hardFailed.map(mapAuthUsageItem));
  }

  await vscode.window.showQuickPick(quickPickItems, {
    title: tr('detailsTitle'),
    matchOnDescription: true,
    matchOnDetail: true,
    ignoreFocusOut: true
  });
}

function resolveActiveAuthFilesUsage(payload) {
  const list = getByPath(payload, 'extensions.active_auth_files');
  if (Array.isArray(list) && list.length > 0) {
    return dedupeAuthFileUsageItems(list.filter((item) => item && typeof item === 'object'));
  }
  const fallback = buildOfficialUsageFallbackItem(payload);
  return fallback ? [fallback] : [];
}

function dedupeAuthFileUsageItems(items) {
  const byKey = new Map();
  for (const item of items) {
    const key = authFileUsageKey(item);
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, item);
      continue;
    }
    if (compareAuthUsageItems(item, current) < 0) {
      byKey.set(key, item);
    }
  }
  return Array.from(byKey.values());
}

function authFileUsageKey(item) {
  const authID = valueToString(item.auth_id);
  if (authID) {
    return `auth:${authID}`;
  }
  const fileName = valueToString(item.file_name);
  if (fileName) {
    return `file:${fileName}`;
  }
  const account = valueToString(item.account);
  const plan = valueToString(item.plan_type);
  return `account:${account}|plan:${plan}`;
}

function groupAuthFileUsageItems(items) {
  const availableBuckets = new Map();
  const exhausted = [];
  const hardFailed = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    if (isHardFailedAuthUsage(item)) {
      hardFailed.push(item);
      continue;
    }
    if (isWeekUsageExhausted(item)) {
      exhausted.push(item);
      continue;
    }
    const priority = resolveAuthUsagePriority(item);
    const bucket = availableBuckets.get(priority) || [];
    bucket.push(item);
    availableBuckets.set(priority, bucket);
  }

  const availableGroups = Array.from(availableBuckets.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([priority, groupItems]) => ({
      priority,
      items: groupItems.sort(compareLastUsedDesc)
    }));

  exhausted.sort(compareWeekResetWaitAscThenLastUsedDesc);
  hardFailed.sort(compareLastUsedDesc);

  return { availableGroups, exhausted, hardFailed };
}

function resolveAuthUsagePriority(item) {
  const value = Number(getByPath(item, 'priority'));
  if (Number.isFinite(value)) {
    return Math.trunc(value);
  }
  return 0;
}

function compareAuthUsageItems(a, b) {
  const exhaustedA = isWeekUsageExhausted(a);
  const exhaustedB = isWeekUsageExhausted(b);
  if (exhaustedA !== exhaustedB) {
    return exhaustedA ? -1 : 1;
  }

  const waitA = resolveWeekResetWaitSortKey(a);
  const waitB = resolveWeekResetWaitSortKey(b);
  if (waitA !== waitB) {
    return waitA - waitB;
  }

  return safeMillis(b.last_used_at) - safeMillis(a.last_used_at);
}

function compareLastUsedDesc(a, b) {
  return safeMillis(b.last_used_at) - safeMillis(a.last_used_at);
}

function compareWeekResetWaitAscThenLastUsedDesc(a, b) {
  const waitA = resolveWeekResetWaitSortKey(a);
  const waitB = resolveWeekResetWaitSortKey(b);
  if (waitA !== waitB) {
    return waitA - waitB;
  }
  return safeMillis(b.last_used_at) - safeMillis(a.last_used_at);
}

function resolveWeekResetWaitText(item) {
  const waitSeconds = resolveWeekResetWaitSeconds(item);
  if (Number.isFinite(waitSeconds)) {
    return formatWaitDuration(waitSeconds);
  }
  const text = resolveResetWaitDuration(getByPath(item, 'week'));
  return text || tr('na');
}

function resolveFiveHourResetWaitText(item) {
  const fiveHour = getByPath(item, 'five_hour');
  const waitSeconds = resolveWindowWaitSeconds(fiveHour);
  if (Number.isFinite(waitSeconds)) {
    return formatWaitDuration(waitSeconds);
  }
  const text = resolveResetWaitDuration(fiveHour);
  return text || tr('na');
}

function resolveWeekResetWaitSortKey(item) {
  const waitSeconds = resolveWeekResetWaitSeconds(item);
  if (!Number.isFinite(waitSeconds) || waitSeconds < 0) {
    return Number.POSITIVE_INFINITY;
  }
  return waitSeconds;
}

function resolveWeekResetWaitSeconds(item) {
  const week = getByPath(item, 'week');
  const waitSeconds = resolveWindowWaitSeconds(week);
  if (!Number.isFinite(waitSeconds)) {
    return -1;
  }
  return Math.max(0, waitSeconds);
}

function isWeekUsageExhausted(item) {
  const week = getByPath(item, 'week');
  const quotaSignal = hasQuotaExhaustedSignal(item);
  const authFailureSignal = hasAuthFailureSignal(item);
  if (!week || typeof week !== 'object') {
    return quotaSignal || authFailureSignal;
  }

  const limitReached = getByPath(week, 'limit_reached');
  if (typeof limitReached === 'boolean' && limitReached) {
    return true;
  }

  const allowed = getByPath(week, 'allowed');
  if (typeof allowed === 'boolean' && !allowed) {
    return true;
  }

  const usedPercent = numberFromAny(getByPath(week, 'used_percent'));
  if (Number.isFinite(usedPercent) && usedPercent >= 99.9) {
    return true;
  }

  const remaining = numberFromAny(getByPath(week, 'remaining'));
  if (Number.isFinite(remaining) && remaining <= 0) {
    return true;
  }

  return quotaSignal || authFailureSignal;
}

function hasQuotaExhaustedSignal(item) {
  if (!item || typeof item !== 'object') {
    return false;
  }
  const signals = [
    valueToString(getByPath(item, 'status')),
    valueToString(getByPath(item, 'error_summary')),
    valueToString(getByPath(item, 'error'))
  ]
    .join(' ')
    .toLowerCase();

  if (!signals) {
    return false;
  }
  return signals.includes('usage_limit_reached')
    || signals.includes('insufficient_quota')
    || signals.includes('rate_limit_exceeded')
    || signals.includes('limit_reached')
    || signals.includes('token quota')
    || signals.includes('exceeded your current quota')
    || signals.includes('quota has been exceeded')
    || signals.includes('usage cap')
    || signals.includes('usage limit')
    || signals.includes('billing hard limit')
    || signals.includes('credits exhausted')
    || signals.includes('daily limit reached')
    || signals.includes('weekly limit reached')
    || signals.includes('monthly limit reached')
    || signals.includes('quota exhausted')
    || signals.includes('quota exceeded')
    || signals.includes('weekly quota')
    || signals.includes('week quota')
    || signals.includes('限额已用尽')
    || signals.includes('限额用尽')
    || signals.includes('额度已用尽')
    || signals.includes('额度用尽')
    || signals.includes('配额已用尽')
    || signals.includes('周用量')
    || signals.includes('周额度')
    || signals.includes('已达到使用上限')
    || signals.includes('超出当前配额')
    || signals.includes('配额耗尽')
    || signals.includes('用量耗尽');
}

function hasAuthFailureSignal(item) {
  if (!item || typeof item !== 'object') {
    return false;
  }
  const signals = [
    valueToString(getByPath(item, 'status')),
    valueToString(getByPath(item, 'error_summary')),
    valueToString(getByPath(item, 'error'))
  ]
    .join(' ')
    .toLowerCase();

  if (!signals) {
    return false;
  }
  return signals.includes('token_invalidated')
    || signals.includes('invalid_token')
    || signals.includes('invalid access token')
    || signals.includes('expired token')
    || signals.includes('invalid_api_key')
    || signals.includes('missing api key')
    || signals.includes('unauthorized')
    || signals.includes('forbidden')
    || signals.includes('permission denied')
    || signals.includes('access denied')
    || signals.includes('authentication failed')
    || signals.includes('auth failed')
    || signals.includes('status=401')
    || signals.includes('status=403')
    || signals.includes('http 401')
    || signals.includes('http 403')
    || signals.includes('认证失败')
    || signals.includes('鉴权失败')
    || signals.includes('权限不足')
    || signals.includes('无权限')
    || signals.includes('访问被拒绝')
    || signals.includes('令牌失效')
    || signals.includes('token失效');
}

function numberFromAny(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) {
      return NaN;
    }
    const parsed = Number(text);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
    const fallback = Number.parseFloat(text.replace(/%/g, ''));
    return Number.isFinite(fallback) ? fallback : NaN;
  }
  return NaN;
}

function safeMillis(value) {
  const ms = parseTimestampToMillis(value);
  return Number.isFinite(ms) ? ms : 0;
}

function summarizeRecoveryTooltipLines(payload) {
  const lines = [];
  const combined = resolveCombinedRecoverySummary(payload);
  if (combined) {
    const combinedLine = formatCombinedRecoveryLine(combined);
    if (combinedLine) {
      lines.push(combinedLine);
    }
    const gateLine = formatCombinedGateLine(combined);
    if (gateLine) {
      lines.push(gateLine);
    }
    return lines;
  }

  const recovery = resolveRecoverySummary(payload);
  const entries = [
    { window: getByPath(recovery, 'five_hour'), label: tr('window5h') },
    { window: getByPath(recovery, 'week'), label: tr('windowWeek') }
  ];
  for (const entry of entries) {
    const line = formatRecoveryTooltipLine(entry.window, entry.label);
    if (line) {
      lines.push(line);
    }
  }
  return lines;
}

function buildRecoveryQuickPickItems(payload) {
  const combined = resolveCombinedRecoverySummary(payload);
  if (combined) {
    const item = formatCombinedRecoveryQuickPickItem(combined);
    return item ? [item] : [];
  }

  const recovery = resolveRecoverySummary(payload);
  const entries = [
    { window: getByPath(recovery, 'five_hour'), label: tr('window5h') },
    { window: getByPath(recovery, 'week'), label: tr('windowWeek') }
  ];
  const items = [];
  for (const entry of entries) {
    const item = formatRecoveryQuickPickItem(entry.window, entry.label);
    if (item) {
      items.push(item);
    }
  }
  return items;
}

function resolveRecoverySummary(payload) {
  const direct = getByPath(payload, 'extensions.recovery');
  if (direct && typeof direct === 'object') {
    return direct;
  }
  const planType = valueToString(getByPath(payload, 'plan_type')).toLowerCase();
  const normalized = normalizeUsageWindowsForDetails(getByPath(payload, 'rate_limit'), planType);
  const makeWindow = (window) => {
    if (!window) {
      return null;
    }
    const usedPercent = normalizePercent(Number(window.used_percent));
    const totalUnits = 100;
    const lockedUnits = Number.isFinite(usedPercent)
      ? clamp((usedPercent / 100) * totalUnits, 0, totalUnits)
      : 0;
    const availableUnits = clamp(totalUnits - lockedUnits, 0, totalUnits);
    const wait = resolveWindowWaitSeconds(window);
    const resetAt = Number(window.reset_at);
    const releaseUnits = lockedUnits > 0 ? lockedUnits : NaN;
    const events = Number.isFinite(wait) && wait > 0 && Number.isFinite(releaseUnits) && releaseUnits > 0
      ? [{ wait_seconds: wait, release_units: releaseUnits, available_units: totalUnits, available_percent: 100 }]
      : [];
    return {
      total_units: totalUnits,
      locked_units: lockedUnits,
      available_units_now: availableUnits,
      available_percent_now: totalUnits > 0 ? (availableUnits / totalUnits) * 100 : 0,
      used_percent: usedPercent,
      next_wait_seconds: Number.isFinite(wait) ? wait : 0,
      next_reset_at: Number.isFinite(resetAt) ? resetAt : 0,
      next_release_units: releaseUnits,
      next_available_units: Number.isFinite(releaseUnits) ? totalUnits : availableUnits,
      next_available_percent: Number.isFinite(releaseUnits) ? 100 : (totalUnits > 0 ? (availableUnits / totalUnits) * 100 : 0),
      significant_wait_seconds: Number.isFinite(wait) ? wait : 0,
      significant_reset_at: Number.isFinite(resetAt) ? resetAt : 0,
      significant_release_units: releaseUnits,
      significant_available_units: Number.isFinite(releaseUnits) ? totalUnits : availableUnits,
      significant_available_percent: Number.isFinite(releaseUnits) ? 100 : (totalUnits > 0 ? (availableUnits / totalUnits) * 100 : 0),
      full_wait_seconds: Number.isFinite(wait) ? wait : 0,
      full_reset_at: Number.isFinite(resetAt) ? resetAt : 0,
      full_release_units: releaseUnits,
      full_available_units: Number.isFinite(releaseUnits) ? totalUnits : availableUnits,
      full_available_percent: Number.isFinite(releaseUnits) ? 100 : (totalUnits > 0 ? (availableUnits / totalUnits) * 100 : 0),
      events
    };
  };
  return {
    five_hour: makeWindow(normalized.fiveHour),
    week: makeWindow(normalized.week)
  };
}

function resolveCombinedRecoverySummary(payload) {
  const direct = normalizeCombinedRecovery(getByPath(payload, 'extensions.recovery.combined'));
  if (direct) {
    return direct;
  }
  return buildCombinedRecoveryFromItems(resolveActiveAuthFilesUsage(payload));
}

function normalizeCombinedRecovery(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const totalUnits = Number(getByPath(raw, 'total_units'));
  if (!Number.isFinite(totalUnits) || totalUnits < 0) {
    return null;
  }
  const availableUnitsNow = clamp(Number(getByPath(raw, 'available_units_now')) || 0, 0, totalUnits);
  const availablePercentNow = Number.isFinite(Number(getByPath(raw, 'available_percent_now')))
    ? clamp(Number(getByPath(raw, 'available_percent_now')), 0, 100)
    : (totalUnits > 0 ? (availableUnitsNow / totalUnits) * 100 : 0);
  const fullAvailableUnits = clamp(Number(getByPath(raw, 'full_available_units')) || availableUnitsNow, availableUnitsNow, totalUnits);
  const fullAvailablePercent = Number.isFinite(Number(getByPath(raw, 'full_available_percent')))
    ? clamp(Number(getByPath(raw, 'full_available_percent')), 0, 100)
    : (totalUnits > 0 ? (fullAvailableUnits / totalUnits) * 100 : 0);
  const significantAvailableUnits = clamp(Number(getByPath(raw, 'significant_available_units')) || availableUnitsNow, availableUnitsNow, fullAvailableUnits);
  const significantAvailablePercent = Number.isFinite(Number(getByPath(raw, 'significant_available_percent')))
    ? clamp(Number(getByPath(raw, 'significant_available_percent')), 0, 100)
    : (totalUnits > 0 ? (significantAvailableUnits / totalUnits) * 100 : 0);
  const events = normalizeCombinedRecoveryEvents(getByPath(raw, 'events'), totalUnits, availableUnitsNow);
  return {
    totalUnits,
    availableUnitsNow,
    availablePercentNow,
    nextWaitSeconds: Math.max(0, Number(getByPath(raw, 'next_wait_seconds')) || 0),
    nextResetAt: Number(getByPath(raw, 'next_reset_at')) || 0,
    nextAvailableUnits: clamp(Number(getByPath(raw, 'next_available_units')) || availableUnitsNow, availableUnitsNow, totalUnits),
    nextAvailablePercent: clamp(Number(getByPath(raw, 'next_available_percent')) || availablePercentNow, 0, 100),
    significantDeltaUnits: Math.max(0, Number(getByPath(raw, 'significant_delta_units')) || 0),
    significantWaitSeconds: Math.max(0, Number(getByPath(raw, 'significant_wait_seconds')) || 0),
    significantResetAt: Number(getByPath(raw, 'significant_reset_at')) || 0,
    significantAvailableUnits,
    significantAvailablePercent,
    fullWaitSeconds: Math.max(0, Number(getByPath(raw, 'full_wait_seconds')) || 0),
    fullResetAt: Number(getByPath(raw, 'full_reset_at')) || 0,
    fullAvailableUnits,
    fullAvailablePercent,
    fiveHourBlockedUnitsNow: Math.max(0, Number(getByPath(raw, 'five_hour_blocked_units_now')) || 0),
    fiveHourBlockedPercentNow: clamp(Number(getByPath(raw, 'five_hour_blocked_percent_now')) || 0, 0, 100),
    fiveHourNextWaitSeconds: Math.max(0, Number(getByPath(raw, 'five_hour_next_wait_seconds')) || 0),
    fiveHourNextResetAt: Number(getByPath(raw, 'five_hour_next_reset_at')) || 0,
    events
  };
}

function normalizeCombinedRecoveryEvents(eventsRaw, totalUnits, availableUnitsNow) {
  if (!Array.isArray(eventsRaw)) {
    return [];
  }
  const currentAvailable = Math.max(0, Number(availableUnitsNow) || 0);
  return eventsRaw
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const delta = Math.max(0, Number(getByPath(item, 'release_units')) || 0);
      const availableUnits = Number.isFinite(Number(getByPath(item, 'available_units')))
        ? Math.max(0, Number(getByPath(item, 'available_units')))
        : currentAvailable + Math.max(0, Number(getByPath(item, 'cumulative_release_units')) || 0);
      const availablePercent = Number.isFinite(Number(getByPath(item, 'available_percent')))
        ? clamp(Number(getByPath(item, 'available_percent')), 0, 100)
        : (totalUnits > 0 ? clamp((availableUnits / totalUnits) * 100, 0, 100) : 0);
      return {
        waitSeconds: Math.max(0, Number(getByPath(item, 'wait_seconds')) || 0),
        resetAt: Number(getByPath(item, 'reset_at')) || 0,
        releaseUnits: delta,
        availableUnits,
        availablePercent
      };
    })
    .filter((item) => item.releaseUnits > 0 || item.availableUnits > currentAvailable)
    .sort((a, b) => a.waitSeconds - b.waitSeconds || a.resetAt - b.resetAt);
}

function buildCombinedRecoveryFromItems(items) {
  if (!Array.isArray(items) || !items.length) {
    return null;
  }
  const eligible = items.filter((item) => !isHardFailedAuthUsage(item));
  if (!eligible.length) {
    return {
      totalUnits: 0,
      availableUnitsNow: 0,
      availablePercentNow: 0,
      nextWaitSeconds: 0,
      nextResetAt: 0,
      nextAvailableUnits: 0,
      nextAvailablePercent: 0,
      significantDeltaUnits: 0,
      significantWaitSeconds: 0,
      significantResetAt: 0,
      significantAvailableUnits: 0,
      significantAvailablePercent: 0,
      fullWaitSeconds: 0,
      fullResetAt: 0,
      fullAvailableUnits: 0,
      fullAvailablePercent: 0,
      fiveHourBlockedUnitsNow: 0,
      fiveHourBlockedPercentNow: 0,
      fiveHourNextWaitSeconds: 0,
      fiveHourNextResetAt: 0,
      events: []
    };
  }

  let totalUnits = 0;
  let availableUnitsNow = 0;
  let fiveHourBlockedUnitsNow = 0;
  let fiveHourNextResetAt = 0;
  const releaseByReset = new Map();
  const nowSeconds = Math.floor(Date.now() / 1000);

  for (const item of eligible) {
    const units = resolveAuthUsageItemCapacityUnits(item);
    if (!Number.isFinite(units) || units <= 0) {
      continue;
    }
    totalUnits += units;

    const weekRemainingPercent = resolveWeekRemainingPercentForItem(item);
    const weekAvailableUnits = Number.isFinite(weekRemainingPercent)
      ? units * clamp(weekRemainingPercent, 0, 100) / 100
      : units;
    let weekLockedUnits = clamp(units - weekAvailableUnits, 0, units);
    const weekResetAt = resolveWindowResetEpochSeconds(getByPath(item, 'week'));

    const fiveWindow = resolveFiveHourWindowForItem(item);
    const fiveBlockedNow = weekAvailableUnits > 0 && isFiveHourUsageExhausted(item);
    const fiveResetAt = resolveWindowResetEpochSeconds(fiveWindow);

    if (!fiveBlockedNow) {
      availableUnitsNow += weekAvailableUnits;
      if (weekLockedUnits > 0 && Number.isFinite(weekResetAt) && weekResetAt > 0) {
        addReleaseUnitsAt(releaseByReset, weekResetAt, weekLockedUnits);
      }
      continue;
    }

    fiveHourBlockedUnitsNow += weekAvailableUnits;
    if (weekAvailableUnits > 0 && Number.isFinite(fiveResetAt) && fiveResetAt > 0 && (!fiveHourNextResetAt || fiveResetAt < fiveHourNextResetAt)) {
      fiveHourNextResetAt = fiveResetAt;
    }
    if (!Number.isFinite(fiveResetAt) || fiveResetAt <= 0) {
      continue;
    }

    let deltaAtUnblock = weekAvailableUnits;
    if (weekLockedUnits > 0 && Number.isFinite(weekResetAt) && weekResetAt > 0 && weekResetAt <= fiveResetAt) {
      deltaAtUnblock += weekLockedUnits;
      weekLockedUnits = 0;
    }
    if (deltaAtUnblock > 0) {
      addReleaseUnitsAt(releaseByReset, fiveResetAt, deltaAtUnblock);
    }
    if (weekLockedUnits > 0 && Number.isFinite(weekResetAt) && weekResetAt > fiveResetAt) {
      addReleaseUnitsAt(releaseByReset, weekResetAt, weekLockedUnits);
    }
  }

  if (!Number.isFinite(totalUnits) || totalUnits <= 0) {
    return null;
  }

  const combined = {
    totalUnits,
    availableUnitsNow,
    availablePercentNow: clamp((availableUnitsNow / totalUnits) * 100, 0, 100),
    nextWaitSeconds: 0,
    nextResetAt: 0,
    nextAvailableUnits: availableUnitsNow,
    nextAvailablePercent: clamp((availableUnitsNow / totalUnits) * 100, 0, 100),
    significantDeltaUnits: 0,
    significantWaitSeconds: 0,
    significantResetAt: 0,
    significantAvailableUnits: availableUnitsNow,
    significantAvailablePercent: clamp((availableUnitsNow / totalUnits) * 100, 0, 100),
    fullWaitSeconds: 0,
    fullResetAt: 0,
    fullAvailableUnits: availableUnitsNow,
    fullAvailablePercent: clamp((availableUnitsNow / totalUnits) * 100, 0, 100),
    fiveHourBlockedUnitsNow,
    fiveHourBlockedPercentNow: clamp((fiveHourBlockedUnitsNow / totalUnits) * 100, 0, 100),
    fiveHourNextWaitSeconds: fiveHourNextResetAt ? Math.max(0, fiveHourNextResetAt - nowSeconds) : 0,
    fiveHourNextResetAt,
    events: []
  };

  const sortedResets = Array.from(releaseByReset.entries()).sort((a, b) => a[0] - b[0]);
  let cumulative = 0;
  for (const [resetAt, releaseUnits] of sortedResets) {
    if (!Number.isFinite(releaseUnits) || releaseUnits <= 0) {
      continue;
    }
    cumulative += releaseUnits;
    const availableUnits = availableUnitsNow + cumulative;
    const event = {
      waitSeconds: Math.max(0, resetAt - nowSeconds),
      resetAt,
      releaseUnits,
      availableUnits,
      availablePercent: clamp((availableUnits / totalUnits) * 100, 0, 100)
    };
    combined.events.push(event);
    if (!combined.nextResetAt) {
      combined.nextWaitSeconds = event.waitSeconds;
      combined.nextResetAt = event.resetAt;
      combined.nextAvailableUnits = event.availableUnits;
      combined.nextAvailablePercent = event.availablePercent;
    }
    combined.fullWaitSeconds = event.waitSeconds;
    combined.fullResetAt = event.resetAt;
    combined.fullAvailableUnits = event.availableUnits;
    combined.fullAvailablePercent = event.availablePercent;
  }

  const maxFutureRelease = combined.fullAvailableUnits - availableUnitsNow;
  combined.significantDeltaUnits = Math.max(0, Math.min(maxFutureRelease, Math.max(1, totalUnits * 0.1)));
  if (combined.significantDeltaUnits > 0) {
    const targetAvailableUnits = availableUnitsNow + combined.significantDeltaUnits;
    for (const event of combined.events) {
      if (event.availableUnits + 1e-9 < targetAvailableUnits) {
        continue;
      }
      combined.significantWaitSeconds = event.waitSeconds;
      combined.significantResetAt = event.resetAt;
      combined.significantAvailableUnits = event.availableUnits;
      combined.significantAvailablePercent = event.availablePercent;
      break;
    }
  }
  if (!combined.significantResetAt) {
    combined.significantWaitSeconds = combined.fullWaitSeconds;
    combined.significantResetAt = combined.fullResetAt;
    combined.significantAvailableUnits = combined.fullAvailableUnits;
    combined.significantAvailablePercent = combined.fullAvailablePercent;
  }
  return combined;
}

function addReleaseUnitsAt(map, resetAt, deltaUnits) {
  const key = Math.max(0, Math.floor(Number(resetAt) || 0));
  if (!key || !Number.isFinite(deltaUnits) || deltaUnits <= 0) {
    return;
  }
  map.set(key, (map.get(key) || 0) + deltaUnits);
}

function resolveFiveHourWindowForItem(item) {
  let window = getByPath(item, 'five_hour');
  if ((!window || typeof window !== 'object') && String(getByPath(item, 'plan_type')).trim().toLowerCase() === 'free') {
    window = getByPath(item, 'week');
  }
  return window;
}

function resolveWindowResetEpochSeconds(window) {
  if (!window || typeof window !== 'object') {
    return NaN;
  }
  const resetAtMs = parseTimestampToMillis(getByPath(window, 'reset_at'));
  if (Number.isFinite(resetAtMs)) {
    return Math.round(resetAtMs / 1000);
  }
  const waitSeconds = Number(getByPath(window, 'reset_after_seconds'));
  if (Number.isFinite(waitSeconds) && waitSeconds > 0) {
    return Math.floor(Date.now() / 1000) + Math.ceil(waitSeconds);
  }
  return NaN;
}

function resolveWindowWaitSeconds(window) {
  if (!window || typeof window !== 'object') {
    return NaN;
  }
  const resetAtMs = parseTimestampToMillis(getByPath(window, 'reset_at'));
  if (Number.isFinite(resetAtMs)) {
    return Math.max(0, Math.ceil((resetAtMs - Date.now()) / 1000));
  }
  const waitSeconds = Number(getByPath(window, 'reset_after_seconds'));
  if (Number.isFinite(waitSeconds)) {
    return Math.max(0, waitSeconds);
  }
  return NaN;
}

function formatCombinedRecoveryLine(combined) {
  if (!combined || typeof combined !== 'object') {
    return '';
  }
  return tr('combinedRecoveryLine', {
    current: formatCombinedCurrentValue(combined),
    significant: formatCombinedCheckpoint(combined.significantWaitSeconds, combined.significantAvailableUnits),
    full: formatCombinedCheckpoint(combined.fullWaitSeconds, combined.fullAvailableUnits)
  });
}

function formatCombinedGateLine(combined) {
  if (!combined || typeof combined !== 'object') {
    return '';
  }
  if (!Number.isFinite(Number(combined.fiveHourBlockedUnitsNow)) || Number(combined.fiveHourBlockedUnitsNow) <= 0) {
    return '';
  }
  return tr('combinedRecoveryGateLine', {
    value: formatUsageUnits(combined.fiveHourBlockedUnitsNow),
    wait: formatWaitDuration(combined.fiveHourNextWaitSeconds)
  });
}

function formatCombinedRecoveryQuickPickItem(combined) {
  if (!combined || typeof combined !== 'object') {
    return null;
  }
  const gate = Number.isFinite(Number(combined.fiveHourBlockedUnitsNow)) && Number(combined.fiveHourBlockedUnitsNow) > 0
    ? tr('combinedQuickPickGate', {
      value: formatUsageUnits(combined.fiveHourBlockedUnitsNow),
      wait: formatWaitDuration(combined.fiveHourNextWaitSeconds)
    })
    : '';
  return {
    label: tr('combinedQuickPickLabel'),
    description: tr('combinedQuickPickDesc', {
      current: formatCombinedCurrentValue(combined),
      significant: formatCombinedCheckpoint(combined.significantWaitSeconds, combined.significantAvailableUnits),
      full: formatCombinedCheckpoint(combined.fullWaitSeconds, combined.fullAvailableUnits)
    }),
    detail: tr('combinedQuickPickDetail', {
      bar: buildCombinedRecoveryBar(combined, 24),
      gate
    })
  };
}

function formatCombinedCurrentValue(combined) {
  return `${formatUsageUnits(combined.availableUnitsNow)}/${formatUsageUnits(combined.totalUnits)}`;
}

function formatCombinedCheckpoint(waitSeconds, availableUnits) {
  return `${formatWaitDuration(waitSeconds)} → ${formatUsageUnits(availableUnits)}`;
}

function formatRecoveryTooltipLine(window, windowLabel) {
  if (!window || typeof window !== 'object') {
    return '';
  }
  return tr('recoveryTooltipLine', {
    window: windowLabel,
    next: formatRecoveryCheckpoint(window.next_wait_seconds, window.next_release_units),
    significant: formatRecoveryCheckpoint(window.significant_wait_seconds, window.significant_release_units),
    full: formatRecoveryCheckpoint(window.full_wait_seconds, window.full_release_units)
  });
}

function formatRecoveryQuickPickItem(window, windowLabel) {
  if (!window || typeof window !== 'object') {
    return null;
  }
  return {
    label: tr('recoveryQuickPickLabel', { window: windowLabel }),
    description: tr('recoveryQuickPickDesc', {
      next: formatRecoveryCheckpoint(window.next_wait_seconds, window.next_release_units),
      significant: formatRecoveryCheckpoint(window.significant_wait_seconds, window.significant_release_units),
      full: formatRecoveryCheckpoint(window.full_wait_seconds, window.full_release_units)
    }),
    detail: tr('recoveryQuickPickDetail', {
      locked: formatUsageUnits(window.locked_units),
      total: formatUsageUnits(window.total_units)
    })
  };
}

function formatRecoveryCheckpoint(waitSeconds, releaseUnits) {
  const wait = formatWaitDuration(waitSeconds);
  const units = formatUsageUnits(releaseUnits);
  return `${wait}(+${units})`;
}

function formatUsageUnits(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return tr('na');
  }
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}x` : `${rounded.toFixed(1)}x`;
}

function buildOfficialUsageFallbackItem(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const planType = valueToString(getByPath(payload, 'plan_type')).toLowerCase();
  const normalized = normalizeUsageWindowsForDetails(getByPath(payload, 'rate_limit'), planType);
  if (!normalized.fiveHour && !normalized.week) {
    return null;
  }

  const account = firstNonEmptyString(payload, [
    'account_name',
    'account.name',
    'user.name',
    'user.username',
    'email',
    'user.email',
    'account.email'
  ]);
  return {
    auth_id: valueToString(getByPath(payload, 'account_id')) || 'official-usage',
    file_name: 'official',
    account,
    plan_type: valueToString(getByPath(payload, 'plan_type')),
    status: 'ok',
    last_used_at: new Date().toISOString(),
    five_hour: normalized.fiveHour,
    week: normalized.week
  };
}

function normalizeUsageWindowsForDetails(rateLimit, planType) {
  if (!rateLimit || typeof rateLimit !== 'object') {
    return { fiveHour: null, week: null };
  }

  const primary = asWindowObject(getByPath(rateLimit, 'primary_window'));
  const secondary = asWindowObject(getByPath(rateLimit, 'secondary_window'));
  let fiveHour = null;
  let week = null;

  if (primary && secondary) {
    const pSec = Number(getByPath(primary, 'limit_window_seconds'));
    const sSec = Number(getByPath(secondary, 'limit_window_seconds'));
    if (Number.isFinite(pSec) && Number.isFinite(sSec)) {
      if (pSec <= sSec) {
        fiveHour = primary;
        week = secondary;
      } else {
        fiveHour = secondary;
        week = primary;
      }
    } else {
      fiveHour = primary;
      week = secondary;
    }
    return { fiveHour, week };
  }

  const single = primary || secondary;
  if (!single) {
    return { fiveHour: null, week: null };
  }
  const sec = Number(getByPath(single, 'limit_window_seconds'));
  if (isLikelyWeekWindow(sec)) {
    week = single;
    if (String(planType || '').toLowerCase() === 'free') {
      // Free accounts may expose only weekly window from official endpoint; mirror for 5h display compatibility.
      fiveHour = single;
    }
  } else {
    fiveHour = single;
  }
  return { fiveHour, week };
}

function asWindowObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return null;
  }
  return {
    used_percent: Number(getByPath(obj, 'used_percent')),
    limit_window_seconds: Number(getByPath(obj, 'limit_window_seconds')),
    reset_after_seconds: Number(getByPath(obj, 'reset_after_seconds')),
    reset_at: Number(getByPath(obj, 'reset_at'))
  };
}

function formatWindowPercent(used, remaining) {
  if (!Number.isFinite(used) || !Number.isFinite(remaining)) {
    return tr('na');
  }
  return tr('windowPercent', {
    used: formatPercent(used),
    remaining: formatPercent(remaining)
  });
}

function resolveUsageMultiplier(payload) {
  const candidates = [
    'total_usage_multiplier',
    'meta.total_usage_multiplier',
    'extensions.recovery.week.total_units',
    'extensions.recovery.five_hour.total_units'
  ];
  let best = NaN;
  for (const path of candidates) {
    const value = Number(getByPath(payload, path));
    if (Number.isFinite(value) && value > 0) {
      if (!Number.isFinite(best) || value > best) {
        best = value;
      }
    }
  }
  return best;
}

function formatUsageMultiplierLabel(multiplier) {
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    return '';
  }
  const rounded = Math.round(multiplier * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}x` : `${rounded.toFixed(1)}x`;
}

function formatUsageMultiplierBadge(multiplier) {
  const label = formatUsageMultiplierLabel(multiplier);
  if (!label) {
    return '';
  }
  return `Codex-${label}`;
}

function appendWindowLines(lines, title, obj) {
  if (!obj || typeof obj !== 'object') {
    return;
  }

  const primaryWindow = getByPath(obj, 'primary_window');
  const primary = summarizeWindow(primaryWindow);
  if (primary) {
    lines.push(tr('windowLine', {
      title,
      window: classifyWindowLabel(primaryWindow),
      detail: primary
    }));
  }

  const secondaryWindow = getByPath(obj, 'secondary_window');
  const secondary = summarizeWindow(secondaryWindow);
  if (secondary) {
    lines.push(tr('windowLine', {
      title,
      window: classifyWindowLabel(secondaryWindow),
      detail: secondary
    }));
  }

  if (!primary && !secondary) {
    const direct = summarizeWindow(obj);
    if (direct) {
      lines.push(tr('windowDirect', { title, detail: direct }));
    }
  }
}

function classifyWindowLabel(window) {
  const seconds = Number(getByPath(window, 'limit_window_seconds'));
  if (isLikelyFiveHourWindow(seconds)) {
    return tr('window5h');
  }
  if (isLikelyWeekWindow(seconds)) {
    return tr('windowWeek');
  }
  return tr('windowUnknown');
}

function summarizeWindow(obj) {
  if (!obj || typeof obj !== 'object') {
    return '';
  }

  const parts = [];
  const usedPercent = Number(getByPath(obj, 'used_percent'));
  if (Number.isFinite(usedPercent)) {
    const remainingPercent = clamp(100 - usedPercent, 0, 100);
    parts.push(tr('metricRemainingPercent', { value: formatPercent(remainingPercent) }));
  }

  for (const key of ['used', 'limit', 'remaining']) {
    const value = valueToString(getByPath(obj, key));
    if (value) {
      parts.push(`${displayFieldName(key)} ${value}`);
    }
  }

  const resetWait = resolveResetWaitDuration(obj);
  if (resetWait) {
    parts.push(`${tr('resetWait')} ${resetWait}`);
  }

  return parts.join(tr('listSep'));
}

function summarizeKV(obj, keys) {
  if (!obj || typeof obj !== 'object') {
    return '';
  }

  const parts = [];
  const resetWait = resolveResetWaitDuration(obj);
  let resetWaitAdded = false;
  for (const key of keys) {
    if (isResetFieldName(key)) {
      if (!resetWaitAdded && resetWait) {
        parts.push(`${tr('resetWait')} ${resetWait}`);
        resetWaitAdded = true;
      }
      continue;
    }
    const raw = getByPath(obj, key);
    const value = isTimestampFieldName(key) ? formatTimestampForDisplay(raw) : valueToString(raw);
    if (value) {
      parts.push(`${displayFieldName(key)} ${value}`);
    }
  }
  return parts.join(tr('listSep'));
}

function displayFieldName(key) {
  switch (String(key || '').toLowerCase().trim()) {
    case 'total':
      return LOCALE === 'zh' ? '总量' : 'total';
    case 'used':
      return tr('fieldUsed');
    case 'limit':
      return tr('fieldLimit');
    case 'remaining':
      return tr('fieldRemaining');
    case 'balance':
      return LOCALE === 'zh' ? '余额' : 'balance';
    case 'granted':
      return LOCALE === 'zh' ? '授权' : 'granted';
    case 'expires_at':
      return LOCALE === 'zh' ? '到期' : 'expires';
    case 'name':
      return LOCALE === 'zh' ? '名称' : 'name';
    case 'status':
      return LOCALE === 'zh' ? '状态' : 'status';
    default:
      return String(key || '').trim();
  }
}

function isTimestampFieldName(key) {
  const normalized = String(key || '').trim().toLowerCase();
  return normalized.endsWith('_at')
    || normalized.endsWith('_time')
    || normalized.endsWith('_timestamp')
    || normalized === 'timestamp';
}

function isResetFieldName(key) {
  const normalized = String(key || '').trim().toLowerCase();
  return normalized === 'reset_at'
    || normalized === 'resets_at'
    || normalized === 'reset_after_seconds'
    || normalized === 'reset_in_seconds'
    || normalized === 'reset_seconds';
}

function resolveResetWaitDuration(obj) {
  if (!obj || typeof obj !== 'object') {
    return '';
  }

  const atCandidates = [getByPath(obj, 'reset_at'), getByPath(obj, 'resets_at')];
  for (const candidate of atCandidates) {
    const ms = parseTimestampToMillis(candidate);
    if (!Number.isFinite(ms)) {
      continue;
    }
    const waitSeconds = Math.ceil((ms - Date.now()) / 1000);
    return formatWaitDuration(waitSeconds);
  }

  const secCandidates = [
    getByPath(obj, 'reset_after_seconds'),
    getByPath(obj, 'reset_in_seconds'),
    getByPath(obj, 'reset_seconds')
  ];
  for (const candidate of secCandidates) {
    const seconds = Number(candidate);
    if (Number.isFinite(seconds)) {
      return formatWaitDuration(seconds);
    }
  }

  return '';
}

function formatWaitDuration(secondsInput) {
  let seconds = Math.ceil(Number(secondsInput));
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0m';
  }

  const totalMinutes = Math.ceil(seconds / 60);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  let out = '';
  if (days > 0) {
    out += `${days}d`;
  }
  if (hours > 0 || days > 0) {
    out += `${hours}h`;
  }
  out += `${minutes}m`;
  return out;
}

function formatTimestampForDisplay(value) {
  const ms = parseTimestampToMillis(value);
  if (!Number.isFinite(ms)) {
    return valueToString(value);
  }
  const date = new Date(ms);
  if (!Number.isFinite(date.getTime())) {
    return valueToString(value);
  }

  return date.toLocaleString(undefined, { hour12: false });
}

function parseTimestampToMillis(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e11 ? Math.round(value) : Math.round(value * 1000);
  }
  if (typeof value !== 'string') {
    return NaN;
  }

  const text = value.trim();
  if (!text) {
    return NaN;
  }

  if (/^\d+(\.\d+)?$/.test(text)) {
    const parsed = Number(text);
    return Number.isFinite(parsed)
      ? (parsed > 1e11 ? Math.round(parsed) : Math.round(parsed * 1000))
      : NaN;
  }

  const parsedDate = Date.parse(text);
  return Number.isFinite(parsedDate) ? parsedDate : NaN;
}

function valueToString(v) {
  if (v === null || v === undefined) {
    return '';
  }
  if (typeof v === 'string') {
    const s = v.trim();
    return s || '';
  }
  if (typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }
  return '';
}

module.exports = {
  activate,
  deactivate
};
