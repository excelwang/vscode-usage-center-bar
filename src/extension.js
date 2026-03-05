const vscode = require('vscode');

let statusBarItem;
let pollTimer;
let inflight;
let lastPayload;

function activate(context) {
  createStatusBarItem();

  context.subscriptions.push(
    vscode.commands.registerCommand('usageCenterBar.refresh', async () => {
      await refreshUsage(true);
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
  if (statusBarItem) {
    statusBarItem.dispose();
    statusBarItem = undefined;
  }
}

function recreateStatusBarItem(context) {
  if (statusBarItem) {
    statusBarItem.dispose();
  }
  createStatusBarItem();
  if (statusBarItem) {
    context.subscriptions.push(statusBarItem);
  }
}

function createStatusBarItem() {
  const cfg = getConfig();
  const alignment = cfg.alignment === 'right'
    ? vscode.StatusBarAlignment.Right
    : vscode.StatusBarAlignment.Left;

  statusBarItem = vscode.window.createStatusBarItem(alignment, cfg.priority);
  statusBarItem.name = 'Usage Center Bar';
  statusBarItem.command = 'usageCenterBar.refresh';
  statusBarItem.text = `$(sync~spin) ${cfg.title} ...`;
  statusBarItem.tooltip = 'Fetching usage...';
  statusBarItem.show();
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
  if (!statusBarItem) {
    return;
  }
  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    const cfg = getConfig();

    try {
      statusBarItem.text = `$(sync~spin) ${cfg.title} ...`;
      const url = joinUrl(cfg.baseUrl, cfg.endpoint);
      const payload = await fetchUsage(url, cfg.apiKey, cfg.requestTimeoutMs);
      lastPayload = payload;
      const accountName = await resolveAccountName(cfg, payload);

      const usedPercent = resolveUsedPercent(payload, cfg.usedPercentPath);
      const clampedUsed = clamp(usedPercent, 0, 100);
      const remaining = clamp(100 - clampedUsed, 0, 100);
      const { weekUsed, fiveHourUsed } = resolveWeekAndFiveHourUsed(payload);
      const weekRemaining = Number.isFinite(weekUsed) ? clamp(100 - weekUsed, 0, 100) : NaN;
      const fiveHourRemaining = Number.isFinite(fiveHourUsed) ? clamp(100 - fiveHourUsed, 0, 100) : NaN;
      const usageMultiplier = resolveUsageMultiplier(payload);

      statusBarItem.text = buildStatusText(cfg.title, usageMultiplier, weekRemaining, fiveHourRemaining, cfg.barLength);
      statusBarItem.tooltip = buildTooltip(
        url,
        usedPercent,
        remaining,
        payload,
        accountName,
        weekUsed,
        fiveHourUsed,
        usageMultiplier
      );
      statusBarItem.backgroundColor = undefined;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      statusBarItem.text = `$(warning) ${cfg.title} --`;
      statusBarItem.tooltip = `Usage fetch failed\n\n${message}`;
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');

      if (showNotificationOnError) {
        void vscode.window.showWarningMessage(`Usage Center Bar: ${message}`);
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
    baseUrl: String(c.get('baseUrl', 'http://127.0.0.1:8317')).trim(),
    endpoint: String(c.get('endpoint', '/api/codex/usage')).trim(),
    apiKey: String(c.get('apiKey', '')).trim(),
    pollIntervalSec: Number(c.get('pollIntervalSec', 60)),
    requestTimeoutMs: Number(c.get('requestTimeoutMs', 15000)),
    usedPercentPath: String(c.get('usedPercentPath', 'rate_limit.primary_window.used_percent')).trim(),
    accountNamePath: String(c.get('accountNamePath', '')).trim(),
    accountSummaryEndpoint: String(c.get('accountSummaryEndpoint', '/v0/management/codex-usage-summary')).trim(),
    managementKey: String(c.get('managementKey', '')).trim(),
    barLength: Number(c.get('barLength', 10)),
    title: String(c.get('title', 'Usage')).trim() || 'Usage',
    alignment: String(c.get('alignment', 'left')).trim().toLowerCase(),
    priority: Number(c.get('priority', -1000))
  };
}

function joinUrl(baseUrl, endpoint) {
  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  const path = String(endpoint || '').trim();
  if (!base) {
    throw new Error('usageCenterBar.baseUrl is empty');
  }
  if (!path) {
    throw new Error('usageCenterBar.endpoint is empty');
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
  return fetchJSON(url, headers, timeoutMs, 'usage');
}

async function fetchAccountSummary(url, managementKey, timeoutMs) {
  const headers = {
    Accept: 'application/json',
    'X-Management-Key': managementKey
  };
  return fetchJSON(url, headers, timeoutMs, 'account summary');
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
      throw new Error(`${purpose} response is not valid JSON`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveAccountName(cfg, usagePayload) {
  const fromPayload = resolveAccountNameFromPayload(usagePayload, cfg.accountNamePath);
  if (fromPayload) {
    return fromPayload;
  }

  const managementKey = String(cfg.managementKey || '').trim();
  const summaryEndpoint = String(cfg.accountSummaryEndpoint || '').trim();
  if (!managementKey || !summaryEndpoint) {
    return '';
  }

  try {
    const summaryURL = joinUrl(cfg.baseUrl, summaryEndpoint);
    const summary = await fetchAccountSummary(summaryURL, managementKey, cfg.requestTimeoutMs);
    return resolveAccountNameFromSummary(summary);
  } catch (_err) {
    return '';
  }
}

function resolveAccountNameFromPayload(payload, configuredPath) {
  const candidates = [];
  if (configuredPath) {
    candidates.push(configuredPath);
  }
  candidates.push('account_name', 'email', 'user.email', 'account.email');
  return firstNonEmptyString(payload, candidates);
}

function resolveAccountNameFromSummary(summary) {
  if (!summary || typeof summary !== 'object') {
    return '';
  }

  const selectedID = String(getByPath(summary, 'selected_auth_id') || '').trim();
  const authFiles = getByPath(summary, 'auth_files');
  if (!Array.isArray(authFiles) || authFiles.length === 0) {
    return '';
  }

  if (selectedID) {
    for (const item of authFiles) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const authID = String(item.auth_id || '').trim();
      if (authID !== selectedID) {
        continue;
      }
      const name = firstNonEmptyString(item, ['email', 'account_name', 'file_name']);
      if (name) {
        return name;
      }
    }
  }

  for (const item of authFiles) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const name = firstNonEmptyString(item, ['email', 'account_name', 'file_name']);
    if (name) {
      return name;
    }
  }
  return '';
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

  throw new Error('cannot locate used_percent in usage payload');
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

function buildBar(remainingPercent, barLength) {
  const len = clamp(Math.round(Number(barLength) || 10), 5, 30);
  const filled = Math.round((remainingPercent / 100) * len);
  return `${'█'.repeat(filled)}${'░'.repeat(len - filled)}`;
}

function buildStatusText(title, usageMultiplier, weekRemaining, fiveHourRemaining, barLength) {
  const weekLabel = buildWindowBadge('周', weekRemaining, barLength);
  const fiveHourLabel = buildWindowBadge('5h', fiveHourRemaining, barLength);
  const multiplierLabel = formatUsageMultiplierLabel(usageMultiplier);
  if (multiplierLabel) {
    return `${multiplierLabel} ${title} ${weekLabel} ${fiveHourLabel}`;
  }
  return `${title} ${weekLabel} ${fiveHourLabel}`;
}

function buildWindowBadge(label, remainingPercent, barLength) {
  if (!Number.isFinite(remainingPercent)) {
    return `${label} N/A`;
  }
  const bar = buildBar(remainingPercent, barLength);
  return `${label}${bar}${formatPercent(remainingPercent)}`;
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

function buildTooltip(url, usedPercent, remainingPercent, payload, accountName, weekUsed, fiveHourUsed, usageMultiplier) {
  const weekRemaining = Number.isFinite(weekUsed) ? clamp(100 - weekUsed, 0, 100) : NaN;
  const fiveHourRemaining = Number.isFinite(fiveHourUsed) ? clamp(100 - fiveHourUsed, 0, 100) : NaN;
  const lines = [
    `Usage endpoint: ${url}`,
    `周: ${formatWindowPercent(weekUsed, weekRemaining)}`,
    `5h: ${formatWindowPercent(fiveHourUsed, fiveHourRemaining)}`,
    `Fallback Used: ${formatPercent(usedPercent)}`,
    `Fallback Remaining: ${formatPercent(remainingPercent)}`,
  ];
  const multiplierLabel = formatUsageMultiplierLabel(usageMultiplier);
  if (multiplierLabel) {
    lines.push(`Total capacity: ${multiplierLabel} (Plus baseline)`);
  }

  const planType = valueToString(getByPath(payload, 'plan_type'));
  if (planType) {
    lines.push(`Plan: ${planType}`);
  }

  const resolvedAccount = valueToString(accountName);
  if (resolvedAccount) {
    lines.push(`Account: ${resolvedAccount}`);
  }

  const email = firstNonEmptyString(payload, ['email', 'user.email', 'account.email']);
  if (email && email !== resolvedAccount) {
    lines.push(`Email: ${email}`);
  }

  const accountId = valueToString(getByPath(payload, 'account_id'));
  if (accountId) {
    lines.push(`Account ID: ${accountId}`);
  }
  const userId = valueToString(getByPath(payload, 'user_id'));
  if (userId) {
    lines.push(`User ID: ${userId}`);
  }

  appendWindowLines(lines, 'Rate limit', getByPath(payload, 'rate_limit'));
  appendWindowLines(lines, 'Total', getByPath(payload, 'total'));
  appendWindowLines(lines, 'Code review', getByPath(payload, 'code_review_rate_limit'));

  const credits = summarizeKV(
    getByPath(payload, 'credits'),
    ['total', 'used', 'remaining', 'balance', 'granted', 'limit', 'expires_at', 'reset_at']
  );
  if (credits) {
    lines.push(`Credits: ${credits}`);
  }

  const promo = summarizeKV(
    getByPath(payload, 'promo'),
    ['name', 'status', 'total', 'used', 'remaining', 'expires_at']
  );
  if (promo) {
    lines.push(`Promo: ${promo}`);
  }

  const additional = getByPath(payload, 'additional_rate_limits');
  if (Array.isArray(additional)) {
    lines.push(`Additional limits: ${additional.length}`);
    const preview = additional.slice(0, 3);
    for (const item of preview) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const name = firstNonEmptyString(item, ['name', 'id', 'type']) || 'unnamed';
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
      lines.push(`- ... +${additional.length - preview.length} more`);
    }
  }

  lines.push('', 'Click to refresh.');
  return lines.join('\n');
}

function formatWindowPercent(used, remaining) {
  if (!Number.isFinite(used) || !Number.isFinite(remaining)) {
    return 'N/A';
  }
  return `used ${formatPercent(used)}, remaining ${formatPercent(remaining)}`;
}

function resolveUsageMultiplier(payload) {
  const candidates = [
    'total_usage_multiplier',
    'meta.total_usage_multiplier'
  ];
  for (const path of candidates) {
    const value = Number(getByPath(payload, path));
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return NaN;
}

function formatUsageMultiplierLabel(multiplier) {
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    return '';
  }
  const rounded = Math.round(multiplier * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}x` : `${rounded.toFixed(1)}x`;
}

function appendWindowLines(lines, title, obj) {
  if (!obj || typeof obj !== 'object') {
    return;
  }

  const primary = summarizeWindow(getByPath(obj, 'primary_window'));
  if (primary) {
    lines.push(`${title} primary: ${primary}`);
  }

  const secondary = summarizeWindow(getByPath(obj, 'secondary_window'));
  if (secondary) {
    lines.push(`${title} secondary: ${secondary}`);
  }

  if (!primary && !secondary) {
    const direct = summarizeWindow(obj);
    if (direct) {
      lines.push(`${title}: ${direct}`);
    }
  }
}

function summarizeWindow(obj) {
  if (!obj || typeof obj !== 'object') {
    return '';
  }

  const parts = [];
  const usedPercent = Number(getByPath(obj, 'used_percent'));
  if (Number.isFinite(usedPercent)) {
    parts.push(`used ${formatPercent(usedPercent)}`);
  }

  for (const key of ['used', 'limit', 'remaining']) {
    const value = valueToString(getByPath(obj, key));
    if (value) {
      parts.push(`${key}=${value}`);
    }
  }

  const resetAt = valueToString(getByPath(obj, 'reset_at')) || valueToString(getByPath(obj, 'resets_at'));
  if (resetAt) {
    parts.push(`reset_at=${resetAt}`);
  }
  const resetIn = valueToString(getByPath(obj, 'reset_in_seconds')) || valueToString(getByPath(obj, 'reset_seconds'));
  if (resetIn) {
    parts.push(`reset_in=${resetIn}s`);
  }

  return parts.join(', ');
}

function summarizeKV(obj, keys) {
  if (!obj || typeof obj !== 'object') {
    return '';
  }

  const parts = [];
  for (const key of keys) {
    const value = valueToString(getByPath(obj, key));
    if (value) {
      parts.push(`${key}=${value}`);
    }
  }
  return parts.join(', ');
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
