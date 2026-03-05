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
      const bar = buildBar(remaining, cfg.barLength);

      statusBarItem.text = `${cfg.title} ${bar} ${formatPercent(remaining)}剩余`;
      statusBarItem.tooltip = buildTooltip(url, usedPercent, remaining, payload, accountName);
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
    usedPercentPath: String(c.get('usedPercentPath', 'rate_limit.secondary_window.used_percent')).trim(),
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
    'rate_limit.secondary_window.used_percent',
    'rate_limit.primary_window.used_percent',
    'total.secondary_window.progress_percent',
    'total.primary_window.progress_percent'
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

function buildTooltip(url, usedPercent, remainingPercent, payload, accountName) {
  const lines = [
    `Usage endpoint: ${url}`,
    `Used: ${formatPercent(usedPercent)}`,
    `Remaining: ${formatPercent(remainingPercent)}`,
    '',
    'Click to refresh.'
  ];

  if (lastPayload && typeof lastPayload === 'object') {
    const planType = getByPath(payload, 'plan_type');
    if (planType) {
      lines.splice(1, 0, `Plan: ${planType}`);
    }
  }
  if (accountName) {
    lines.splice(1, 0, `Account: ${accountName}`);
  }

  return lines.join('\n');
}

module.exports = {
  activate,
  deactivate
};
