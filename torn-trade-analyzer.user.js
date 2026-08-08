// ==UserScript==
// @name         Torn Trade Analyzer
// @namespace    chadgian.torn.trade.analyzer
// @version      0.1.9
// @description  Fast, period-aware Torn trade analytics with cached FIFO calculations, hide/pin/search/sort controls, and progressive loading. Data stays on-device.
// @author       chadgian + ChatGPT
// @match        https://www.torn.com/*
// @run-at       document-end
// @grant        none
// @updateURL    https://raw.githubusercontent.com/chadgian/systems_by_AI/main/torn-trade-analyzer.user.js
// @downloadURL  https://raw.githubusercontent.com/chadgian/systems_by_AI/main/torn-trade-analyzer.user.js
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '0.1.9';
  const API_KEY = '_###PDA-APIKEY###_';
  const NS = 'tta:v1:';
  const API = 'https://api.torn.com/v2';
  const REQUEST_GAP_MS = 800; // <=75 requests/minute, leaving headroom under Torn's 100/min user limit.
  const MAX_LOG_IDS_PER_REQUEST = 24;
  const CATALOG_SCHEMA_VERSION = 2;
  // Known Torn transaction log IDs. Dynamic /torn/logtypes discovery is still used.
  const KNOWN_TRANSACTION_LOGS = new Map([
    [1103, {side:'buy', source:'Item Market'}],
    [1104, {side:'sell', source:'Item Market'}],
    [1112, {side:'buy', source:'Item Market'}],
    [1113, {side:'sell', source:'Item Market'}],
    [1220, {side:'buy', source:'Bazaar'}],
    [1221, {side:'sell', source:'Bazaar'}],
    [1225, {side:'buy', source:'Bazaar'}],
    [1226, {side:'sell', source:'Bazaar'}],
    [4200, {side:'buy', source:'Torn Shop'}],
    [4201, {side:'buy', source:'Foreign Market'}],
  ]);

  const state = {
    open: false,
    view: 'dashboard',
    tracked: load('tracked', []),
    transactions: load('transactions', []),
    catalog: load('catalog', []),
    catalogVersion: load('catalogVersion', 0),
    logTypes: load('logTypes', []),
    apiKey: load('apiKey', ''),
    fabPosition: load('fabPosition', null),
    pinnedIds: load('pinnedIds', []),
    hiddenIds: load('hiddenIds', []),
    itemSearch: load('itemSearch', ''),
    sortMode: load('sortMode', 'recent'),
    sync: load('sync', { lastSync: 0, firstSyncComplete: false }),
    dateMode: load('dateMode', '30d'),
    customFrom: load('customFrom', ''),
    customTo: load('customTo', ''),
    granularity: load('granularity', 'day'),
    expanded: null,
    search: '',
    syncing: false,
    syncProgress: '',
    syncCancel: false,
    toast: '',
    busy: {active:false,title:'',detail:'',cancellable:false},
    demo: false,
  };

  function load(k, fallback) {
    try {
      const v = localStorage.getItem(NS + k);
      return v == null ? fallback : JSON.parse(v);
    } catch (_) { return fallback; }
  }
  function save(k, v) {
    try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (_) {}
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function nowSec() { return Math.floor(Date.now() / 1000); }
  function money(n, short = false) {
    n = Number(n) || 0;
    const sign = n < 0 ? '-' : '';
    const a = Math.abs(n);
    if (short) {
      if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(a >= 1e10 ? 1 : 2)}b`;
      if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}m`;
      if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(a >= 1e4 ? 1 : 2)}k`;
    }
    return `${sign}$${Math.round(a).toLocaleString()}`;
  }
  function qty(n) { return (Number(n) || 0).toLocaleString(); }
  function dateStr(ts) { return new Date(ts * 1000).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}); }
  function dayKey(ts) {
    const d = new Date(ts * 1000); d.setHours(0,0,0,0); return Math.floor(d.getTime()/1000);
  }
  function weekKey(ts) {
    const d = new Date(ts * 1000); d.setHours(0,0,0,0);
    const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return Math.floor(d.getTime()/1000);
  }
  function monthKey(ts) { const d = new Date(ts * 1000); return Math.floor(new Date(d.getFullYear(), d.getMonth(), 1).getTime()/1000); }

  function injectedApiKey() {
    return API_KEY && !API_KEY.includes('###PDA-APIKEY###') && API_KEY.length >= 16 ? API_KEY.trim() : '';
  }
  function savedApiKey() {
    const k=String(state.apiKey||'').trim();
    return k.length>=16?k:'';
  }
  function activeApiKey() { return savedApiKey() || injectedApiKey(); }
  function hasInjectedKey() { return !!injectedApiKey(); }
  function hasApiKey() { return !!activeApiKey(); }
  function keySource() { return savedApiKey()?'Saved API key':injectedApiKey()?'Torn PDA API key':'No API key'; }

  async function httpGet(url) {
    let text;
    if (typeof window.PDA_httpGet === 'function') {
      const r = await window.PDA_httpGet(url, {});
      if (r.status && r.status >= 400) throw new Error(`HTTP ${r.status}`);
      text = r.responseText;
    } else {
      const r = await fetch(url, { credentials: 'omit' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      text = await r.text();
    }
    const json = JSON.parse(text);
    if (json.error) throw new Error(`Torn API ${json.error.code}: ${json.error.error}`);
    return json;
  }

  async function apiGet(path, params = {}) {
    const key=activeApiKey();
    if (!key) throw new Error('No Torn API key is configured. Add one in Settings → API Key.');
    const u = new URL(API + path);
    u.searchParams.set('key', key);
    u.searchParams.set('comment', 'TornTradeAnalyzer');
    Object.entries(params).forEach(([k,v]) => { if (v !== '' && v != null) u.searchParams.set(k, String(v)); });
    return httpGet(u.toString());
  }

  function injectCss() {
    if (document.getElementById('tta-css')) return;
    const s = document.createElement('style');
    s.id = 'tta-css';
    s.textContent = `
      :root{--tta-bg:#0b0f14;--tta-panel:#111821;--tta-card:#151e28;--tta-soft:#1f2c39;--tta-line:#34475a;--tta-text:#f7fbff;--tta-muted:#b9c8d6;--tta-faint:#91a5b7;--tta-green:#63efb1;--tta-red:#ff7d8a;--tta-blue:#7fc1ff;--tta-yellow:#ffda73}
      #tta-root,#tta-root *,#tta-fab,#tta-fab *{box-sizing:border-box}
      #tta-root button,#tta-fab{font-family:inherit;-webkit-appearance:none;appearance:none;margin:0;line-height:1.15;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
      #tta-fab{position:fixed;right:14px;bottom:86px;z-index:2147483000;min-height:42px;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab;border:1px solid #38566a;border-radius:18px;background:linear-gradient(135deg,#1a352f,#183951);color:#fff;box-shadow:0 12px 35px #0009;padding:11px 14px;font:700 12px/1.1 system-ui;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-align:center}
      #tta-fab.dragging{cursor:grabbing;opacity:.92;transform:scale(1.02)}
      #tta-fab .dot{width:9px;height:9px;flex:0 0 9px;border-radius:50%;background:var(--tta-green);box-shadow:0 0 14px var(--tta-green)}
      #tta-root{position:fixed;inset:0;z-index:2147482999;background:#06090dcc;backdrop-filter:blur(5px);display:none;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--tta-text);font-size:14px;line-height:1.4}
      #tta-root.show{display:block}.tta-shell{position:absolute;inset:0;background:var(--tta-bg);overflow:auto;overscroll-behavior:contain;padding-bottom:max(38px,env(safe-area-inset-bottom))}.tta-header{position:sticky;top:0;z-index:4;display:flex;align-items:center;gap:9px;min-height:62px;padding:10px 12px;background:#0b0f14f2;border-bottom:1px solid var(--tta-line);backdrop-filter:blur(8px)}
      .tta-brand{display:flex;align-items:center;gap:9px;min-width:0;flex:1}.tta-mark{width:38px;height:38px;flex:0 0 38px;border-radius:11px;background:linear-gradient(145deg,#183d32,#17394f);display:grid;place-items:center;font-size:19px;line-height:1}.tta-brandcopy{min-width:0}.tta-title{color:var(--tta-text);font-size:15px;font-weight:850;letter-spacing:.15px;line-height:1.2}.tta-sub{font-size:11px;color:var(--tta-muted);margin-top:2px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .tta-iconbtn,.tta-back{display:grid;place-items:center;flex:0 0 40px;width:40px;height:40px;min-width:40px;min-height:40px;padding:0!important;border:1px solid var(--tta-line);background:var(--tta-card);color:var(--tta-text)!important;border-radius:11px;text-align:center;font-size:19px;font-weight:700;line-height:1}.tta-iconbtn:active,.tta-back:active{transform:scale(.96);background:var(--tta-soft)}.tta-back{font-size:26px}
      .tta-content{width:100%;padding:14px;max-width:760px;margin:0 auto}.tta-period{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:11px}.tta-period>div{min-width:0}.tta-period strong{display:block;color:var(--tta-text);font-size:14px;line-height:1.25}.tta-period small{color:var(--tta-muted);font-size:10px}
      .tta-chips{display:flex;gap:7px;overflow:auto;padding:1px 1px 4px;scrollbar-width:none}.tta-chips::-webkit-scrollbar{display:none}.tta-chip{display:inline-flex;align-items:center;justify-content:center;min-height:34px;white-space:nowrap;border:1px solid var(--tta-line);background:var(--tta-card);color:var(--tta-muted)!important;border-radius:999px;padding:7px 11px;font-size:11px;font-weight:750}.tta-chip.active{color:#052016!important;background:var(--tta-green);border-color:var(--tta-green)}
      .tta-summary{display:grid;grid-template-columns:1.45fr 1fr 1fr;gap:8px;margin:12px 0}.tta-stat{background:linear-gradient(180deg,var(--tta-card),#111821);border:1px solid var(--tta-line);border-radius:14px;padding:11px;min-width:0;text-align:center}.tta-stat label{display:block;font-size:9px;color:var(--tta-muted);text-transform:uppercase;letter-spacing:.75px;line-height:1.3}.tta-stat b{display:block;margin-top:5px;color:var(--tta-text);font-size:15px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tta-stat.main b{font-size:20px}.pos{color:var(--tta-green)!important}.neg{color:var(--tta-red)!important}
      .tta-chartcard{background:linear-gradient(180deg,#151f2a,#10171f);border:1px solid var(--tta-line);border-radius:16px;padding:13px 11px 11px;margin-bottom:14px;overflow:hidden}.tta-charthead{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}.tta-charthead h3{margin:0;color:var(--tta-text);font-size:13px;line-height:1.3}.tta-charthead small{color:var(--tta-muted)!important;font-size:10px}.tta-seg{display:flex;align-items:center;justify-content:center;background:#090e14;border:1px solid var(--tta-line);border-radius:10px;padding:2px}.tta-seg button{display:inline-flex;align-items:center;justify-content:center;min-height:30px;border:0;background:transparent;color:var(--tta-muted)!important;font-size:10px;font-weight:800;padding:6px 8px;border-radius:7px}.tta-seg button.active{background:var(--tta-soft);color:var(--tta-text)!important}.tta-svg{width:100%;height:160px;display:block;overflow:visible}.tta-axis{fill:#d6e1eb!important;color:#d6e1eb!important;font-size:10px;font-weight:650;paint-order:stroke;stroke:#10171f;stroke-width:1.5px;stroke-linejoin:round}.tta-zero{stroke:#7c91a4;stroke-width:1.25}.tta-bar-pos{fill:var(--tta-green)}.tta-bar-neg{fill:var(--tta-red)}.tta-grid{stroke:#344657;stroke-width:1}.tta-empty{min-height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;color:var(--tta-muted);font-size:12px;line-height:1.5;padding:18px}
      .tta-sectionhead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 1px 10px}.tta-sectionhead h3{color:var(--tta-text);font-size:14px;margin:0;line-height:1.3}.tta-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:38px;border:1px solid transparent;border-radius:10px;padding:8px 12px;font-size:11px;font-weight:850;text-align:center;background:var(--tta-green);color:#052016!important;white-space:nowrap}.tta-btn:active{transform:scale(.98)}.tta-btn.secondary{background:var(--tta-card);border-color:var(--tta-line);color:var(--tta-text)!important}.tta-btn.danger{background:#35181e;color:#ffc3c9!important;border-color:#71313d}.tta-btn:disabled{opacity:.55;transform:none}
      .tta-item{background:var(--tta-card);border:1px solid var(--tta-line);border-radius:15px;margin-bottom:10px;overflow:hidden}.tta-itemtop{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:11px;align-items:center;min-height:70px;padding:10px 11px;cursor:pointer}.tta-thumbwrap{position:relative;width:48px;height:48px;display:grid;place-items:center;align-self:center;justify-self:center;background:#0b1219;border:1px solid #2e4152;border-radius:12px;overflow:hidden}.tta-thumb{display:block;width:40px;height:40px;max-width:40px;max-height:40px;object-fit:contain;object-position:center;padding:0;margin:0;background:transparent;border:0}.tta-thumbfallback{display:none;position:absolute;inset:0;place-items:center;color:var(--tta-faint);font-size:20px}.tta-itemcopy{min-width:0;align-self:center}.tta-itemname{color:var(--tta-text);font-weight:850;font-size:13px;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tta-source{font-size:10px;color:var(--tta-muted);margin-top:4px;line-height:1.35;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.tta-profitbox{min-width:72px;text-align:right;align-self:center}.tta-profit{font-size:13px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1.25}.tta-chevron{font-size:10px;color:var(--tta-muted);margin-top:4px;line-height:1.2}.tta-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--tta-line);border-top:1px solid var(--tta-line)}.tta-metric{background:#111922;padding:9px 7px;text-align:center;min-width:0}.tta-metric small{display:block;color:var(--tta-muted);font-size:9px;text-transform:uppercase;letter-spacing:.55px;line-height:1.3}.tta-metric b{display:block;margin-top:3px;color:var(--tta-text);font-size:12px;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis}.tta-accordion{display:none;padding:12px;border-top:1px solid var(--tta-line);background:#0f161e}.tta-item.expanded .tta-accordion{display:block}.tta-minirow{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:11px}.tta-ministat{background:#151f2a;border:1px solid var(--tta-line);border-radius:10px;padding:9px 6px;text-align:center;min-width:0}.tta-ministat small{display:block;font-size:9px;color:var(--tta-muted);line-height:1.25}.tta-ministat b{display:block;margin-top:3px;color:var(--tta-text);font-size:11px;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis}.tta-note{font-size:10px;color:var(--tta-muted);margin-top:9px;line-height:1.5}.tta-linkrow{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:11px}
      .tta-listtools{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;margin:8px 0 4px}.tta-history-search{width:100%;min-height:42px;border-radius:11px;border:1px solid var(--tta-line);background:var(--tta-card);color:var(--tta-text)!important;padding:10px 12px;font-size:12px;outline:none}.tta-history-search::placeholder{color:var(--tta-faint)}.tta-history-search:focus{border-color:var(--tta-blue);box-shadow:0 0 0 2px #7fc1ff22}.tta-sortbtn{min-width:118px}.tta-pin{display:grid;place-items:center;width:31px;height:31px;min-width:31px;min-height:31px;margin:0 0 4px auto;padding:0;border:1px solid var(--tta-line);border-radius:9px;background:#0d151d;color:var(--tta-muted)!important;font-size:15px;line-height:1}.tta-pin.active{background:#2a2513;border-color:#71632e;color:var(--tta-yellow)!important}.tta-cardactions{display:flex;justify-content:flex-end;gap:5px;margin-bottom:4px}.tta-cardactions .tta-pin{margin:0}.tta-hideitem{display:grid;place-items:center;width:31px;height:31px;min-width:31px;min-height:31px;padding:0;border:1px solid var(--tta-line);border-radius:9px;background:#15151b;color:var(--tta-muted)!important;font-size:14px;line-height:1}.tta-hideitem:active{background:#2b1e23;border-color:#76505b}.tta-hiddenlist{display:grid;gap:7px;margin-top:7px}.tta-hiddenrow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;background:var(--tta-card);border:1px solid var(--tta-line);border-radius:10px;padding:8px 9px}.tta-hiddenrow span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--tta-text);font-size:11px}.tta-hiddenrow .tta-btn{min-height:32px;padding:6px 9px}.tta-listmeta{font-size:10px;color:var(--tta-muted);text-align:center;margin:0 0 10px}
      @media(max-width:460px){.tta-listtools{grid-template-columns:1fr}.tta-sortbtn{width:100%}}
      .tta-search{position:sticky;top:62px;z-index:3;background:var(--tta-bg);padding:4px 0 11px}.tta-search input{width:100%;min-height:44px;border-radius:12px;border:1px solid var(--tta-line);background:var(--tta-card);color:var(--tta-text)!important;font-size:13px;padding:11px 13px;outline:none}.tta-search input::placeholder{color:#91a5b7;opacity:1}.tta-search input:focus{border-color:var(--tta-blue);box-shadow:0 0 0 2px #7fc1ff22}.tta-result{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:11px;background:var(--tta-card);border:1px solid var(--tta-line);border-radius:13px;padding:9px 10px;margin-bottom:8px;min-height:68px}.tta-resultcopy{min-width:0}.tta-result small{display:block;margin-top:3px;color:var(--tta-muted);font-size:10px;line-height:1.3}.tta-catalogmeta{display:flex;align-items:center;justify-content:center;text-align:center;color:var(--tta-muted);font-size:10px;margin:3px 0 10px}
      .tta-banner{background:#152330;border:1px solid #36556d;border-radius:13px;padding:11px 12px;margin-bottom:11px;font-size:10px;line-height:1.5;color:#d0dce7}.tta-banner strong{color:#fff}.tta-sync{display:inline-flex;align-items:center;justify-content:center;gap:8px}.tta-spinner{width:13px;height:13px;border:2px solid #ffffff44;border-top-color:#fff;border-radius:50%;animation:tta-spin .8s linear infinite}@keyframes tta-spin{to{transform:rotate(360deg)}}
      .tta-keycard{background:#111a23;border:1px solid var(--tta-line);border-radius:14px;padding:12px;margin:12px 0}.tta-keyhead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.tta-keyhead strong{font-size:13px;color:var(--tta-text)}.tta-keystatus{font-size:9px;font-weight:800;color:var(--tta-green);background:#18352b;border:1px solid #2c5b49;border-radius:999px;padding:4px 7px}.tta-keyinputrow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center}.tta-keyinputrow input{width:100%;min-height:42px;background:var(--tta-card);border:1px solid var(--tta-line);color:var(--tta-text)!important;border-radius:10px;padding:10px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.5px}.tta-keynote{font-size:10px;line-height:1.5;color:var(--tta-muted);margin-top:8px}
      .tta-settings label{display:block;font-size:10px;color:var(--tta-muted);margin:14px 0 5px}.tta-settings-actions{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:12px}.tta-tos{font-size:10px;line-height:1.6;color:#d0dce7;background:#101820;border:1px solid var(--tta-line);border-radius:12px;padding:11px}.tta-tos strong{color:#fff}.tta-toast{position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483002;background:#22313e;color:#fff;border:1px solid #536a7e;border-radius:999px;padding:9px 13px;font-size:11px;box-shadow:0 10px 30px #0008;max-width:88vw;text-align:center;line-height:1.35}
      .tta-demo{color:var(--tta-yellow);font-size:9px;font-weight:850;margin-left:6px}.tta-customdates{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:9px 0}.tta-customdates input{width:100%;min-height:40px;background:var(--tta-card);border:1px solid var(--tta-line);color:var(--tta-text)!important;border-radius:9px;padding:8px;font-size:11px;color-scheme:dark}
      @media(max-width:460px){.tta-content{padding:12px}.tta-summary{grid-template-columns:1fr 1fr}.tta-stat.main{grid-column:1/-1}.tta-sectionhead{align-items:stretch}.tta-sectionhead h3{display:flex;align-items:center;min-height:38px}.tta-itemtop{grid-template-columns:46px minmax(0,1fr) auto}.tta-thumbwrap{width:46px;height:46px}.tta-thumb{width:38px;height:38px}.tta-charthead{align-items:flex-start}.tta-seg{flex:0 0 auto}}
      @media(max-width:360px){.tta-header{padding-left:9px;padding-right:9px;gap:7px}.tta-mark{width:34px;height:34px;flex-basis:34px}.tta-iconbtn,.tta-back{width:38px;height:38px;min-width:38px;min-height:38px;flex-basis:38px}.tta-title{font-size:14px}.tta-sub{font-size:10px}.tta-content{padding:10px}.tta-itemtop{grid-template-columns:42px minmax(0,1fr);gap:9px}.tta-thumbwrap{width:42px;height:42px;grid-row:1/2}.tta-thumb{width:35px;height:35px}.tta-profitbox{grid-column:2;display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;text-align:left}.tta-profit,.tta-chevron{text-align:left;margin:0}.tta-minirow{grid-template-columns:1fr 1fr}.tta-ministat:last-child{grid-column:1/-1}.tta-sectionhead{flex-direction:column}.tta-sectionhead .tta-btn{width:100%}.tta-period{align-items:flex-start}.tta-period .tta-btn{flex:0 0 auto}.tta-charthead{flex-direction:column}.tta-seg{width:100%}.tta-seg button{flex:1}.tta-result{grid-template-columns:42px minmax(0,1fr)}.tta-result .tta-btn{grid-column:1/-1;width:100%}.tta-customdates{grid-template-columns:1fr}.tta-keyinputrow{grid-template-columns:1fr}.tta-keyinputrow .tta-btn{width:100%}}
      .tta-item{content-visibility:auto;contain-intrinsic-size:118px;transition:border-color .14s ease,transform .14s ease}.tta-item.expanded{content-visibility:visible}.tta-itemtop:active{background:#1a2530}.tta-btn,.tta-chip,.tta-iconbtn,.tta-back,.tta-pin{transition:transform .12s ease,background .12s ease,border-color .12s ease,opacity .12s ease}
      .tta-periodhint{display:block;margin-top:3px;color:var(--tta-faint);font-size:9px;line-height:1.35}.tta-status-banner{display:flex;align-items:flex-start;gap:8px}.tta-status-dot{width:7px;height:7px;flex:0 0 7px;border-radius:50%;background:var(--tta-blue);margin-top:4px;box-shadow:0 0 10px #7fc1ff66}
      .tta-searchwrap{position:relative;min-width:0}.tta-searchglyph{position:absolute;left:11px;top:50%;transform:translateY(-50%);z-index:1;color:var(--tta-faint);font-size:15px;pointer-events:none}.tta-searchwrap .tta-history-search{padding-left:34px;padding-right:39px}.tta-clearsearch{position:absolute;right:5px;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:31px;height:31px;min-width:31px;min-height:31px;border:0;border-radius:8px;background:transparent;color:var(--tta-muted)!important;font-size:18px;padding:0}.tta-clearsearch[hidden]{display:none}.tta-sortbtn{min-width:126px}
      .tta-liststage{min-height:80px}.tta-listmeta strong{color:var(--tta-text)}
      .tta-loading{position:fixed;inset:0;z-index:2147483001;display:none;place-items:center;background:#05080bd9;padding:20px;pointer-events:auto}.tta-loading.show{display:grid}.tta-loadingcard{width:min(420px,94vw);background:#111a23;border:1px solid #3b5266;border-radius:18px;padding:18px;box-shadow:0 22px 70px #000b;text-align:center}.tta-loadicon{width:52px;height:52px;margin:0 auto 12px;border-radius:16px;background:#172632;border:1px solid #345269;display:grid;place-items:center}.tta-spinner.xl{width:24px;height:24px;border-width:3px}.tta-loadingtitle{font-size:15px;font-weight:900;color:var(--tta-text);line-height:1.3}.tta-loadingdetail{min-height:34px;margin-top:7px;color:var(--tta-muted);font-size:11px;line-height:1.5}.tta-loadingbar{height:4px;margin:13px 0 12px;overflow:hidden;border-radius:999px;background:#091018}.tta-loadingbar span{display:block;width:38%;height:100%;border-radius:inherit;background:var(--tta-green);animation:tta-load-slide 1.25s ease-in-out infinite}@keyframes tta-load-slide{0%{transform:translateX(-120%)}50%{transform:translateX(165%)}100%{transform:translateX(310%)}}.tta-loadingactions{display:flex;justify-content:center;margin-top:5px}.tta-loadinghint{margin-top:9px;color:var(--tta-faint);font-size:9px;line-height:1.4}
      .tta-openloader{position:absolute;inset:0;display:grid;place-items:center;background:var(--tta-bg);color:var(--tta-muted);text-align:center;padding:24px}.tta-openloader>div{display:flex;flex-direction:column;align-items:center;gap:11px}.tta-openloader strong{color:var(--tta-text);font-size:14px}.tta-openloader small{font-size:10px;color:var(--tta-faint)}
      .tta-toast{opacity:0;visibility:hidden;pointer-events:none;transition:opacity .16s ease,transform .16s ease,visibility .16s}.tta-toast.show{opacity:1;visibility:visible;transform:translate(-50%,-4px)}
      #tta-root[aria-busy="true"] .tta-shell{overflow:hidden}
      @media(prefers-reduced-motion:reduce){.tta-loadingbar span,.tta-spinner{animation-duration:2.2s}.tta-item,.tta-btn,.tta-chip,.tta-iconbtn,.tta-back,.tta-pin,.tta-toast{transition:none}}
    `;
    document.head.appendChild(s);
  }

  function clampFabPosition(left,top,fab) {
    const pad=8,w=fab.offsetWidth||132,h=fab.offsetHeight||42;
    return {left:Math.max(pad,Math.min(left,window.innerWidth-w-pad)),top:Math.max(pad,Math.min(top,window.innerHeight-h-pad))};
  }
  function applyFabPosition(fab) {
    if(!fab)return;
    if(state.fabPosition && Number.isFinite(state.fabPosition.left) && Number.isFinite(state.fabPosition.top)){
      const p=clampFabPosition(state.fabPosition.left,state.fabPosition.top,fab);
      fab.style.left=`${p.left}px`;fab.style.top=`${p.top}px`;fab.style.right='auto';fab.style.bottom='auto';
      state.fabPosition=p;save('fabPosition',p);
    }
  }
  function bindFabDrag(fab) {
    if(!fab || fab.dataset.dragBound==='1')return;
    fab.dataset.dragBound='1';
    let startX=0,startY=0,startLeft=0,startTop=0,moved=false,pointerId=null;
    fab.addEventListener('pointerdown',e=>{
      if(e.button!=null && e.button!==0)return;
      pointerId=e.pointerId;moved=false;startX=e.clientX;startY=e.clientY;
      const r=fab.getBoundingClientRect();startLeft=r.left;startTop=r.top;
      try{fab.setPointerCapture(pointerId);}catch(_){ }
    });
    fab.addEventListener('pointermove',e=>{
      if(pointerId==null||e.pointerId!==pointerId)return;
      const dx=e.clientX-startX,dy=e.clientY-startY;if(!moved&&Math.hypot(dx,dy)<5)return;
      moved=true;fab.classList.add('dragging');e.preventDefault();
      const p=clampFabPosition(startLeft+dx,startTop+dy,fab);
      fab.style.left=`${p.left}px`;fab.style.top=`${p.top}px`;fab.style.right='auto';fab.style.bottom='auto';
    });
    const finish=e=>{
      if(pointerId==null||e.pointerId!==pointerId)return;
      try{fab.releasePointerCapture(pointerId);}catch(_){ }
      pointerId=null;fab.classList.remove('dragging');
      if(moved){const r=fab.getBoundingClientRect();state.fabPosition=clampFabPosition(r.left,r.top,fab);save('fabPosition',state.fabPosition);fab.dataset.suppressClick='1';setTimeout(()=>fab.dataset.suppressClick='0',250);}
    };
    fab.addEventListener('pointerup',finish);fab.addEventListener('pointercancel',finish);
    fab.addEventListener('click',e=>{if(fab.dataset.suppressClick==='1'){e.preventDefault();e.stopPropagation();return;}openAnalyzer();});
    window.addEventListener('resize',()=>applyFabPosition(fab),{passive:true});
  }
  function mount() {
    injectCss();
    if (!document.getElementById('tta-fab')) {
      const fab = document.createElement('button'); fab.id = 'tta-fab';
      fab.innerHTML = '<span class="dot"></span><span>Trade Analytics</span>';
      document.body.appendChild(fab);bindFabDrag(fab);requestAnimationFrame(()=>applyFabPosition(fab));
    } else { const fab=document.getElementById('tta-fab');bindFabDrag(fab);applyFabPosition(fab); }
    if (!document.getElementById('tta-root')) {
      const root = document.createElement('div'); root.id = 'tta-root'; document.body.appendChild(root);
    }
    render();
  }

  let demoTxCache=null;
  const perfCache={
    txRef:null,byItem:new Map(),lastById:new Map(),itemIds:[],fifo:new Map(),summaries:new Map(),series:new Map(),overall:new Map(),
    catalogRef:null,catalogMap:new Map(),trackedTxRef:null,trackedCatalogRef:null,tracked:[],searchTimer:null,legacySearchTimer:null
  };

  function resetAnalyticsCache() {
    perfCache.txRef=null;perfCache.byItem=new Map();perfCache.lastById=new Map();perfCache.itemIds=[];
    perfCache.fifo.clear();perfCache.summaries.clear();perfCache.series.clear();perfCache.overall.clear();
    perfCache.trackedTxRef=null;perfCache.trackedCatalogRef=null;perfCache.tracked=[];
  }

  function effectiveTransactions() {
    if (state.transactions.length || !state.demo) return state.transactions;
    if(!demoTxCache)demoTxCache=demoTransactions();
    return demoTxCache;
  }

  function ensureTxIndex() {
    const tx=effectiveTransactions();
    if(perfCache.txRef===tx)return perfCache;
    const byItem=new Map(),lastById=new Map();
    for(const t of tx){
      const id=Number(t?.itemId);if(!(id>0))continue;
      if(!byItem.has(id))byItem.set(id,[]);
      byItem.get(id).push(t);
      const ts=Number(t?.timestamp)||0;if(ts>(lastById.get(id)||0))lastById.set(id,ts);
    }
    for(const rows of byItem.values())rows.sort((a,b)=>a.timestamp-b.timestamp||String(a.id).localeCompare(String(b.id)));
    perfCache.txRef=tx;perfCache.byItem=byItem;perfCache.lastById=lastById;perfCache.itemIds=[...byItem.keys()];
    perfCache.fifo.clear();perfCache.summaries.clear();perfCache.series.clear();perfCache.overall.clear();
    perfCache.trackedTxRef=null;perfCache.trackedCatalogRef=null;perfCache.tracked=[];
    return perfCache;
  }

  function getCatalogMap() {
    if(perfCache.catalogRef===state.catalog)return perfCache.catalogMap;
    perfCache.catalogRef=state.catalog;
    perfCache.catalogMap=new Map((state.catalog||[]).map(x=>[Number(x.id),x]));
    perfCache.trackedCatalogRef=null;
    return perfCache.catalogMap;
  }

  function catalogItem(id) {
    id=Number(id);
    const found=getCatalogMap().get(id);
    return found || {id,name:`Item #${id}`,type:'Item',image:`https://www.torn.com/images/items/${id}/large.png`,marketPrice:0};
  }

  function effectiveTracked() {
    const idx=ensureTxIndex();
    if(!idx.itemIds.length&&state.demo)return demoTracked();
    if(perfCache.trackedTxRef===idx.txRef&&perfCache.trackedCatalogRef===state.catalog)return perfCache.tracked;
    perfCache.tracked=idx.itemIds.map(catalogItem).sort((a,b)=>a.name.localeCompare(b.name)||a.id-b.id);
    perfCache.trackedTxRef=idx.txRef;perfCache.trackedCatalogRef=state.catalog;
    return perfCache.tracked;
  }

  function periodCacheKey() {
    const r=dateRange();
    return `${state.dateMode}|${state.customFrom}|${state.customTo}|${Math.floor(r.from/60)}|${Math.floor(r.to/60)}`;
  }

  const SORT_OPTIONS=[
    {id:'recent',label:'Recent'},
    {id:'profit',label:'Profit'},
    {id:'acquired',label:'Acquired'},
    {id:'sold',label:'Sold'},
    {id:'name',label:'Name'}
  ];
  function sortLabel(){return SORT_OPTIONS.find(x=>x.id===state.sortMode)?.label||'Recent';}
  function historyItemRows() {
    const q=String(state.itemSearch||'').trim().toLowerCase();
    const pinned=new Set((state.pinnedIds||[]).map(Number));
    const hidden=new Set((state.hiddenIds||[]).map(Number));
    const idx=ensureTxIndex();
    const rows=effectiveTracked()
      .filter(item=>!hidden.has(Number(item.id)) && (!q || item.name.toLowerCase().includes(q) || String(item.id).includes(q)))
      .map(item=>({item,summary:summaryFor(item.id),lastActivity:idx.lastById.get(Number(item.id))||0,pinned:pinned.has(Number(item.id))}))
      .filter(row=>row.summary.events.length>0);
    rows.sort((a,b)=>{
      if(a.pinned!==b.pinned)return a.pinned?-1:1;
      let d=0;
      if(state.sortMode==='profit')d=b.summary.profit-a.summary.profit;
      else if(state.sortMode==='acquired')d=b.summary.bought-a.summary.bought;
      else if(state.sortMode==='sold')d=b.summary.sold-a.summary.sold;
      else if(state.sortMode==='name')d=a.item.name.localeCompare(b.item.name);
      else d=b.lastActivity-a.lastActivity;
      return d || a.item.name.localeCompare(b.item.name) || a.item.id-b.item.id;
    });
    return rows;
  }

  function subtractCalendarMonth(date) {
    const d=new Date(date);
    const day=d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth()-1);
    const maxDay=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
    d.setDate(Math.min(day,maxDay));
    return d;
  }

  function selectedPeriodBounds(nowDate=new Date()) {
    const nowMs=nowDate.getTime();
    let from=0,to=Math.floor(nowMs/1000)+60;
    if(state.dateMode==='7d') from=Math.floor((nowMs-7*86400*1000)/1000);
    else if(state.dateMode==='30d') from=Math.floor((nowMs-30*86400*1000)/1000);
    else if(state.dateMode==='month') from=Math.floor(subtractCalendarMonth(nowDate).getTime()/1000);
    else if(state.dateMode==='custom') {
      if(state.customFrom) from=Math.floor(new Date(state.customFrom+'T00:00:00').getTime()/1000);
      if(state.customTo) to=Math.min(to,Math.floor(new Date(state.customTo+'T23:59:59').getTime()/1000));
    }
    if(!Number.isFinite(from)||from<0)from=0;
    if(!Number.isFinite(to))to=Math.floor(nowMs/1000)+60;
    return {from:Math.floor(from),to:Math.floor(to)};
  }

  function dateRange() {
    const allTx=effectiveTransactions();
    const bounds=selectedPeriodBounds();
    let from=bounds.from,to=bounds.to;
    if(state.dateMode==='all'&&allTx.length){from=Infinity;for(const x of allTx){const ts=Number(x?.timestamp);if(Number.isFinite(ts)&&ts<from)from=ts;}if(!Number.isFinite(from))from=0;}
    return {from,to};
  }

  function fifoAnalytics(itemId) {
    const id=Number(itemId),idx=ensureTxIndex();
    if(perfCache.fifo.has(id))return perfCache.fifo.get(id);
    const tx=idx.byItem.get(id)||[];
    const lots=[];let lotHead=0;const events=[];
    for(const t of tx){
      if(t.side==='buy'){
        if(t.qty>0&&t.total>=0)lots.push({qty:t.qty,unit:t.qty?t.total/t.qty:0});
        events.push({...t,realizedProfit:0,matchedQty:0,unmatchedQty:0});
      }else if(t.side==='sell'){
        let remain=t.qty,basis=0,matched=0;
        while(remain>0&&lotHead<lots.length){
          const lot=lots[lotHead],take=Math.min(remain,lot.qty);
          basis+=take*lot.unit;matched+=take;remain-=take;lot.qty-=take;
          if(lot.qty<=1e-9)lotHead++;
        }
        const net=t.netTotal??t.total;
        const matchedRevenue=t.qty>0?net*(matched/t.qty):0;
        events.push({...t,costBasis:basis,realizedProfit:matchedRevenue-basis,matchedQty:matched,unmatchedQty:remain});
      }
    }
    let remainingQty=0,remainingCost=0;
    for(let i=lotHead;i<lots.length;i++){remainingQty+=lots[i].qty;remainingCost+=lots[i].qty*lots[i].unit;}
    const result={events,remainingQty,remainingCost};perfCache.fifo.set(id,result);return result;
  }

  function summaryFor(itemId) {
    const id=Number(itemId),key=`${periodCacheKey()}|${id}`;
    if(perfCache.summaries.has(key))return perfCache.summaries.get(key);
    const {from,to}=dateRange(),a=fifoAnalytics(id),events=[];let bought=0,sold=0,buySpend=0,sellRevenue=0,profit=0,unmatched=0;const sources=new Set();
    for(const x of a.events){
      if(x.timestamp<from||x.timestamp>to)continue;
      events.push(x);
      if(x.side==='buy'){bought+=x.qty;buySpend+=x.total;if(x.source)sources.add(x.source);}
      else if(x.side==='sell'){sold+=x.qty;sellRevenue+=(x.netTotal??x.total);profit+=(x.realizedProfit||0);unmatched+=(x.unmatchedQty||0);}
    }
    const result={bought,sold,buySpend,sellRevenue,profit,sources:[...sources],unmatched,events,remainingQty:a.remainingQty,remainingCost:a.remainingCost};
    perfCache.summaries.set(key,result);return result;
  }

  function overall() {
    const key=periodCacheKey();if(perfCache.overall.has(key))return perfCache.overall.get(key);
    let profit=0,bought=0,sold=0,unmatched=0;
    for(const id of ensureTxIndex().itemIds){const x=summaryFor(id);profit+=x.profit;bought+=x.bought;sold+=x.sold;unmatched+=x.unmatched;}
    const result={profit,bought,sold,unmatched};perfCache.overall.set(key,result);return result;
  }

  function profitSeries(itemId=null) {
    const cacheKey=`${periodCacheKey()}|${state.granularity}|${itemId==null?'all':Number(itemId)}`;
    if(perfCache.series.has(cacheKey))return perfCache.series.get(cacheKey);
    const {from,to}=dateRange(),m=new Map(),ids=itemId!=null?[Number(itemId)]:ensureTxIndex().itemIds;
    const keyFn=state.granularity==='week'?weekKey:state.granularity==='month'?monthKey:dayKey;
    for(const id of ids){
      for(const x of fifoAnalytics(id).events){
        if(x.side!=='sell'||x.timestamp<from||x.timestamp>to)continue;
        const k=keyFn(x.timestamp);m.set(k,(m.get(k)||0)+(x.realizedProfit||0));
      }
    }
    const result=[...m.entries()].sort((a,b)=>a[0]-b[0]).map(([t,v])=>({t,v}));perfCache.series.set(cacheKey,result);return result;
  }

  function chartSvg(series, h=160) {
    if (!series.length) return '<div class="tta-empty">No realized sales profit in this period yet.</div>';
    const w=360, padL=52,padR=8,padT=10,padB=25, innerW=w-padL-padR,innerH=h-padT-padB;
    let min=Math.min(0,...series.map(x=>x.v)),max=Math.max(0,...series.map(x=>x.v)); if(max===min){max+=1;min-=1}
    const y=v=>padT+(max-v)/(max-min)*innerH; const zero=y(0); const gap=innerW/series.length; const bw=Math.max(3,Math.min(22,gap*.62));
    const grid=[0,.25,.5,.75,1].map(p=>{const yy=padT+p*innerH;const val=max-p*(max-min);return `<line class="tta-grid" x1="${padL}" y1="${yy}" x2="${w-padR}" y2="${yy}"/><text class="tta-axis" x="3" y="${yy+3}">${esc(money(val,true))}</text>`}).join('');
    const bars=series.map((p,i)=>{const cx=padL+gap*i+gap/2;const yy=y(p.v);const top=Math.min(yy,zero);const bh=Math.max(1,Math.abs(zero-yy));return `<rect class="${p.v>=0?'tta-bar-pos':'tta-bar-neg'}" x="${cx-bw/2}" y="${top}" width="${bw}" height="${bh}" rx="2"><title>${dateStr(p.t)}: ${money(p.v)}</title></rect>`}).join('');
    const labels=series.map((p,i)=>{if(series.length>10 && i%Math.ceil(series.length/6)!==0 && i!==series.length-1)return''; const d=new Date(p.t*1000);const lab=state.granularity==='month'?d.toLocaleDateString(undefined,{month:'short'}):d.toLocaleDateString(undefined,{month:'short',day:'numeric'});const x=padL+gap*i+gap/2;return `<text class="tta-axis" text-anchor="middle" x="${x}" y="${h-6}">${esc(lab)}</text>`}).join('');
    return `<svg class="tta-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Profit chart">${grid}<line class="tta-zero" x1="${padL}" y1="${zero}" x2="${w-padR}" y2="${zero}"/>${bars}${labels}</svg>`;
  }

  function itemIcon(item) {
    const fallback = '<span class="tta-thumbfallback" style="display:grid">◇</span>';
    if (!item || !item.image) return `<div class="tta-thumbwrap">${fallback}</div>`;
    return `<div class="tta-thumbwrap"><img class="tta-thumb" src="${esc(item.image)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="tta-thumbfallback">◇</span></div>`;
  }

  function header(title, sub, back=false) {
    return `<div class="tta-header">${back?'<button class="tta-back" data-act="back" aria-label="Back" title="Back">‹</button>':''}<div class="tta-brand"><div class="tta-mark" aria-hidden="true">📈</div><div class="tta-brandcopy"><div class="tta-title">${esc(title)}${state.demo?'<span class="tta-demo">DEMO</span>':''}</div><div class="tta-sub">${esc(sub)}</div></div></div>${!back?'<button class="tta-iconbtn" data-act="settings" aria-label="Settings" title="Settings">⚙</button>':''}<button class="tta-iconbtn" data-act="close" aria-label="Close trade analyzer" title="Close">×</button></div>`;
  }


  function pinnedCountFor(items) {
    const pins=new Set((state.pinnedIds||[]).map(Number));let n=0;for(const x of items)if(pins.has(Number(x.id)))n++;return n;
  }

  function itemListMetaText(rows,allItems) {
    return `${qty(rows.length)} in this period · ${qty(allItems.length)} discovered total · ${qty(pinnedCountFor(allItems))} pinned`;
  }

  function itemListHtml(rows,allItems) {
    if(rows.length)return rows.map(r=>itemCard(r.item,r.summary)).join('');
    if(state.itemSearch)return `<div class="tta-empty">No items match “${esc(state.itemSearch)}” in this period.</div>`;
    return `<div class="tta-empty">${allItems.length?'No item activity exists in the selected period. Try a longer period or Sync to backfill it.':'No item history has been discovered yet. Press Sync to scan your Torn logs.'}</div>`;
  }

  function renderItemList() {
    if(state.view!=='dashboard')return;
    const list=document.getElementById('tta-item-list');if(!list)return;
    const shell=document.querySelector('#tta-root .tta-shell'),scroll=shell?.scrollTop||0;
    const rows=historyItemRows(),allItems=effectiveTracked();
    list.innerHTML=itemListHtml(rows,allItems);
    const meta=document.getElementById('tta-list-meta');if(meta)meta.textContent=itemListMetaText(rows,allItems);
    const count=document.getElementById('tta-item-count');if(count)count.textContent=qty(rows.length);
    const sort=document.getElementById('tta-sort-btn');if(sort)sort.textContent=`⇅ ${sortLabel()}`;
    const clear=document.querySelector('[data-act="clearItemSearch"]');if(clear)clear.hidden=!state.itemSearch;
    if(shell)shell.scrollTop=scroll;
  }

  function dashboardHtml() {
    const s=overall(),rows=historyItemRows(),allItems=effectiveTracked(),range=dateRange();
    const requested=selectedPeriodBounds();
    const coverageFrom=Number(state.sync?.coverageFrom);
    const needsBackfill=hasApiKey()&&state.sync?.firstSyncComplete&&requested.from>0&&(!Number.isFinite(coverageFrom)||coverageFrom>requested.from);
    const periodLabel=state.dateMode==='all'?'All available history':`${dateStr(range.from)} – ${dateStr(Math.min(range.to,nowSec()))}`;
    const lastSync=state.sync?.lastSync?`Last sync ${new Date(state.sync.lastSync*1000).toLocaleString()}`:'Not synced yet';
    return `${header('Trade Analyzer', `v${VERSION} · optimized FIFO analytics`)}<div class="tta-content">
      ${!hasApiKey()?`<div class="tta-banner"><strong>Preview mode.</strong> Add your Torn API key in <strong>Settings → API Key</strong> (or use Torn PDA's injected key) to load your real history. The key and analyzed data stay on this device.</div>`:''}
      ${hasApiKey()&&!state.sync?.autoDiscoveryComplete?`<div class="tta-banner"><strong>History discovery:</strong> Run Sync once to discover recognizable acquisitions and sales for your selected period.</div>`:''}
      ${needsBackfill?`<div class="tta-banner"><strong>More history needed:</strong> This period starts ${esc(dateStr(requested.from))}, earlier than the local cache. Press <strong>Sync</strong> to backfill it.</div>`:''}
      <div class="tta-period"><div><small>Date period</small><strong>${esc(periodLabel)}</strong><span class="tta-periodhint">${esc(lastSync)} · ${qty(state.transactions.length)} cached rows</span></div><button class="tta-btn secondary" data-act="sync" ${state.syncing?'disabled':''}>${state.syncing?'<span class="tta-sync"><span class="tta-spinner"></span>Syncing</span>':'↻ Sync history'}</button></div>
      ${state.syncProgress?`<div class="tta-banner tta-status-banner"><span class="tta-status-dot"></span><span id="tta-sync-progress-text">${esc(state.syncProgress)}</span></div>`:''}
      <div class="tta-chips">${[['7d','7 days'],['30d','30 days'],['month','1 month'],['all','All'],['custom','Custom']].map(([k,l])=>`<button class="tta-chip ${state.dateMode===k?'active':''}" data-date="${k}">${l}</button>`).join('')}</div>
      ${state.dateMode==='custom'?`<div class="tta-customdates"><input type="date" data-custom="from" value="${esc(state.customFrom)}"><input type="date" data-custom="to" value="${esc(state.customTo)}"></div>`:''}
      <div class="tta-summary"><div class="tta-stat main"><label>Realized profit</label><b class="${s.profit>=0?'pos':'neg'}">${money(s.profit)}</b></div><div class="tta-stat"><label>Acquired</label><b>${qty(s.bought)}</b></div><div class="tta-stat"><label>Sold</label><b>${qty(s.sold)}</b></div></div>
      <div class="tta-chartcard"><div class="tta-charthead"><h3>Profit earned</h3><div class="tta-seg">${['day','week','month'].map(g=>`<button class="${state.granularity===g?'active':''}" data-gran="${g}">${g[0].toUpperCase()+g.slice(1)}</button>`).join('')}</div></div>${chartSvg(profitSeries())}</div>
      <div class="tta-sectionhead"><h3>Items in selected period · <span id="tta-item-count">${qty(rows.length)}</span></h3></div>
      <div class="tta-listtools"><div class="tta-searchwrap"><span class="tta-searchglyph">⌕</span><input id="tta-history-search" class="tta-history-search" placeholder="Search item name or ID…" value="${esc(state.itemSearch||'')}" autocomplete="off" aria-label="Search discovered items"><button class="tta-clearsearch" data-act="clearItemSearch" aria-label="Clear search" ${state.itemSearch?'':'hidden'}>×</button></div><button id="tta-sort-btn" class="tta-btn secondary tta-sortbtn" data-act="cycleSort" title="Tap to change sorting">⇅ ${esc(sortLabel())}</button></div>
      <div id="tta-list-meta" class="tta-listmeta">${esc(itemListMetaText(rows,allItems))}</div>
      <div id="tta-item-list" class="tta-liststage">${itemListHtml(rows,allItems)}</div>
    </div>`;
  }

  function itemCard(item,precomputed=null) {
    const s=precomputed||summaryFor(item.id),exp=Number(state.expanded)===Number(item.id);
    const pinned=(state.pinnedIds||[]).map(Number).includes(Number(item.id));
    const src=s.sources.length?s.sources.slice(0,3).join(' · '):'No acquisitions in selected period';
    let details='';
    if(exp){
      const series=profitSeries(item.id),avgBuy=s.bought?s.buySpend/s.bought:0,avgSell=s.sold?s.sellRevenue/s.sold:0;
      const freeQty=s.events.filter(x=>x.side==='buy'&&x.free).reduce((n,x)=>n+x.qty,0);
      details=`<div class="tta-minirow"><div class="tta-ministat"><small>Avg cost</small><b>${money(avgBuy,true)}</b></div><div class="tta-ministat"><small>Avg sell</small><b>${money(avgSell,true)}</b></div><div class="tta-ministat"><small>Inventory</small><b>${qty(s.remainingQty)}</b></div></div><div class="tta-charthead"><h3>${esc(item.name)} profit</h3><small>${s.events.length} events</small></div>${chartSvg(series,92)}<div class="tta-note">Profit uses FIFO: each sale is matched against your oldest recorded acquisitions. ${s.unmatched?`⚠ ${qty(s.unmatched)} sold item(s) have no earlier recorded acquisition cost, so those units are excluded from realized profit.`:'All sold units in this period have recorded cost basis.'}${freeQty?` · ${qty(freeQty)} free-acquired item(s) use a $0 cost basis.`:''}</div>`;
    }
    return `<div class="tta-item ${exp?'expanded':''}" data-item="${item.id}"><div class="tta-itemtop" data-act="toggleItem" data-id="${item.id}" role="button" tabindex="0" aria-expanded="${exp?'true':'false'}">${itemIcon(item)}<div class="tta-itemcopy"><div class="tta-itemname">${esc(item.name)}</div><div class="tta-source">${esc(src)}</div></div><div class="tta-profitbox"><div class="tta-cardactions"><button class="tta-pin ${pinned?'active':''}" data-act="togglePin" data-id="${item.id}" aria-pressed="${pinned?'true':'false'}" aria-label="${pinned?'Unpin':'Pin'} ${esc(item.name)}" title="${pinned?'Unpin item':'Pin item to top'}">${pinned?'📌':'☆'}</button><button class="tta-hideitem" data-act="hideItem" data-id="${item.id}" aria-label="Hide ${esc(item.name)}" title="Hide item">🙈</button></div><div class="tta-profit ${s.profit>=0?'pos':'neg'}">${money(s.profit,true)}</div><div class="tta-chevron">${exp?'▲ details':'▼ details'}</div></div></div><div class="tta-metrics"><div class="tta-metric"><small>Acquired</small><b>${qty(s.bought)}</b></div><div class="tta-metric"><small>Sold</small><b>${qty(s.sold)}</b></div><div class="tta-metric"><small>Profit</small><b class="${s.profit>=0?'pos':'neg'}">${money(s.profit,true)}</b></div></div><div class="tta-accordion">${details}</div></div>`;
  }

  function addItemHtml() {
    const q=state.search.trim().toLowerCase();
    const available=(state.catalog||[]).filter(x=>!state.tracked.some(t=>Number(t.id)===Number(x.id)));
    const results=available.filter(x=>!q || x.name.toLowerCase().includes(q) || String(x.id)===q);
    return `${header('Add item','Search the complete Torn item catalog',true)}<div class="tta-content"><div class="tta-search"><input id="tta-search" placeholder="Search item name or ID…" value="${esc(state.search)}" autocomplete="off" aria-label="Search Torn items"></div>${!hasApiKey()?'<div class="tta-banner"><strong>Catalog preview:</strong> sample search results are available below. Add an API key in Settings to load the complete current Torn item catalog.</div>':`<div class="tta-catalogmeta"><strong>${qty(results.length)}</strong>&nbsp;matching · ${qty(state.catalog.length)} total Torn items loaded</div>`}${results.length?results.map(x=>`<div class="tta-result">${itemIcon(x)}<div class="tta-resultcopy"><div class="tta-itemname">${esc(x.name)}</div><small>#${x.id} · ${esc(x.type||'Item')}</small></div><button class="tta-btn" data-act="confirmAdd" data-id="${x.id}">Add</button></div>`).join(''):'<div class="tta-empty">No matching items.</div>'}</div>`;
  }


  function settingsHtml() {
    const when=state.sync.lastSync?new Date(state.sync.lastSync*1000).toLocaleString():'Never';
    const status=keySource();
    const masked=state.apiKey?'••••••••••••••••':'';
    const hiddenIds=[...new Set((state.hiddenIds||[]).map(Number).filter(x=>x>0))];
    const hiddenItems=hiddenIds.map(catalogItem).sort((a,b)=>a.name.localeCompare(b.name)||a.id-b.id);
    const hiddenHtml=hiddenItems.length?`<div class="tta-hiddenlist">${hiddenItems.map(x=>`<div class="tta-hiddenrow"><span>${esc(x.name)} <small>#${x.id}</small></span><button class="tta-btn secondary" data-act="restoreItem" data-id="${x.id}">Restore</button></div>`).join('')}</div><div class="tta-settings-actions"><button class="tta-btn secondary" data-act="restoreAllItems">Restore all hidden items</button></div>`:'<div class="tta-banner">No hidden items.</div>';
    return `${header('Settings','Storage, API access & reset',true)}<div class="tta-content tta-settings">
      <div class="tta-keycard"><div class="tta-keyhead"><strong>API Key</strong><span class="tta-keystatus">${esc(status)}</span></div><div class="tta-keyinputrow"><input id="tta-api-key" type="password" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Paste your Torn API key" value="${esc(masked)}" data-placeholder-key="${state.apiKey?'1':'0'}"><button class="tta-btn" data-act="saveApiKey">Save & test</button></div><div class="tta-keynote">Stored only in this device's local storage and sent only to Torn's official API. It is never uploaded to GitHub or sent to us. Use a custom key with <strong>User → Log</strong>; for free-item history, do not restrict away categories such as Crime success, City finds, Mission rewards, Seasonal gift, and similar reward logs.</div>${state.apiKey?'<div class="tta-settings-actions"><button class="tta-btn danger" data-act="clearApiKey">Clear saved API key</button></div>':''}</div>
      <div class="tta-tos"><strong>Privacy / Torn API use</strong><br>Data storage: only locally on this device.<br>Data sharing: nobody.<br>Purpose: personal statistical analysis of automatically discovered item acquisitions and sales.<br>Key storage: locally only / not shared.<br>Required access: public Torn item/log-type endpoints plus <strong>User → Log</strong>. Torn PDA's injected key remains supported as a fallback.</div><label>Last successful sync</label><div class="tta-banner">${esc(when)}${state.sync.firstSyncComplete?' · Historical backfill completed':''}</div><label>Local data</label><div class="tta-banner">${qty(state.transactions.length)} normalized transaction entries · ${qty(state.catalog.length)} Torn items cached. Raw Torn logs are not retained.${state.sync.diagnostics?`<br>Last scan: ${qty(state.sync.diagnostics.rawRows||0)} raw logs · ${qty(state.sync.diagnostics.pages||0)} pages · ${qty(state.sync.diagnostics.logTypes||0)} candidate log types.${state.sync.diagnostics.periodFrom?`<br>Period scanned: ${esc(dateStr(state.sync.diagnostics.periodFrom))} – ${esc(dateStr(Math.min(state.sync.diagnostics.periodTo||nowSec(),nowSec())))}`:'<br>Period scanned: all available history.'}`:''}</div><label>Hidden items · ${qty(hiddenItems.length)}</label>${hiddenHtml}<div class="tta-settings-actions"><button class="tta-btn secondary" data-act="refreshCatalog">Refresh Torn item catalog</button><button class="tta-btn danger" data-act="resetData">Reset analyzer data</button></div></div>`;
  }


  function loadingHtml() {
    const b=state.busy||{};
    return `<div id="tta-loading" class="tta-loading ${b.active?'show':''}" role="status" aria-live="polite" aria-hidden="${b.active?'false':'true'}"><div class="tta-loadingcard"><div class="tta-loadicon"><span class="tta-spinner xl"></span></div><div id="tta-loading-title" class="tta-loadingtitle">${esc(b.title||'Working…')}</div><div id="tta-loading-detail" class="tta-loadingdetail">${esc(b.detail||'Preparing your data…')}</div><div class="tta-loadingbar"><span></span></div><div class="tta-loadingactions"><button id="tta-loading-stop" class="tta-btn danger" data-act="cancelSync" ${b.cancellable?'':'hidden'}>Stop sync</button></div><div class="tta-loadinghint">The analyzer stays on this device. You can stop a history scan safely.</div></div></div>`;
  }

  function updateBusyDom() {
    const root=document.getElementById('tta-root'),el=document.getElementById('tta-loading'),b=state.busy||{};
    if(root)root.setAttribute('aria-busy',b.active?'true':'false');if(!el)return;
    el.classList.toggle('show',!!b.active);el.setAttribute('aria-hidden',b.active?'false':'true');
    const title=document.getElementById('tta-loading-title'),detail=document.getElementById('tta-loading-detail'),stop=document.getElementById('tta-loading-stop');
    if(title)title.textContent=b.title||'Working…';if(detail)detail.textContent=b.detail||'Preparing your data…';if(stop)stop.hidden=!b.cancellable;
  }

  function setBusy(active,title='',detail='',cancellable=false) {
    state.busy={active:!!active,title,detail,cancellable:!!cancellable};updateBusyDom();
  }
  function setBusyDetail(detail) {state.busy={...(state.busy||{}),detail};updateBusyDom();}
  function nextPaint(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}
  async function withBusy(title,detail,fn,{cancellable=false}={}) {setBusy(true,title,detail,cancellable);await nextPaint();try{return await fn();}finally{setBusy(false);}}

  function setSyncProgress(msg) {
    state.syncProgress=String(msg||'');
    const text=document.getElementById('tta-sync-progress-text');if(text)text.textContent=state.syncProgress;
    if(state.syncing)setBusyDetail(state.syncProgress);
  }

  async function openAnalyzer() {
    state.open=true;
    const fab=document.getElementById('tta-fab');if(fab)fab.style.display='none';
    const root=document.getElementById('tta-root');if(!root)return;
    root.classList.add('show');root.setAttribute('aria-hidden','false');
    if(root.querySelector('.tta-shell')&&root.dataset.view===state.view)return;
    root.innerHTML='<div class="tta-openloader"><div><span class="tta-spinner xl"></span><strong>Opening Trade Analyzer</strong><small>Preparing cached history and analytics…</small></div></div>';
    await nextPaint();render({preserveScroll:false});
  }

  function render(options={}) {
    const root=document.getElementById('tta-root');if(!root)return;
    const previousView=root.dataset.view||'',previousShell=root.querySelector('.tta-shell');
    const preserveScroll=options.preserveScroll??(previousView===state.view),previousScroll=preserveScroll&&previousShell?previousShell.scrollTop:0;
    const fab=document.getElementById('tta-fab');if(fab)fab.style.display=state.open?'none':'inline-flex';
    if(!state.open){root.classList.remove('show');root.setAttribute('aria-hidden','true');return;}
    root.classList.add('show');root.setAttribute('aria-hidden','false');
    const wasDemo=state.demo;state.demo=!hasApiKey()&&!state.transactions.length;if(wasDemo!==state.demo)resetAnalyticsCache();
    if(state.demo&&!state.catalog.length)state.catalog=demoCatalog();
    root.innerHTML=`<div class="tta-shell">${state.view==='add'?addItemHtml():state.view==='settings'?settingsHtml():dashboardHtml()}</div>${loadingHtml()}<div id="tta-toast" class="tta-toast ${state.toast?'show':''}">${esc(state.toast||'')}</div>`;
    root.dataset.view=state.view;root.setAttribute('aria-busy',state.busy?.active?'true':'false');bind();
    if(preserveScroll){const shell=root.querySelector('.tta-shell');if(shell)shell.scrollTop=previousScroll;}
  }

  let toastTimer=null;
  function toast(msg) {
    state.toast=String(msg||'');const el=document.getElementById('tta-toast');
    if(el){el.textContent=state.toast;el.classList.add('show');}
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>{if(state.toast===msg){state.toast='';const n=document.getElementById('tta-toast');if(n)n.classList.remove('show');}},2400);
  }

  function bind() {
    const root=document.getElementById('tta-root');if(!root||root.dataset.delegated==='1')return;root.dataset.delegated='1';
    root.addEventListener('click',async e=>{
      const dateEl=e.target.closest('[data-date]');
      if(dateEl&&root.contains(dateEl)){state.dateMode=dateEl.dataset.date;save('dateMode',state.dateMode);state.expanded=null;await withBusy('Updating period','Recalculating cached analytics for the selected dates…',async()=>render());return;}
      const granEl=e.target.closest('[data-gran]');
      if(granEl&&root.contains(granEl)){state.granularity=granEl.dataset.gran;save('granularity',state.granularity);await withBusy('Updating chart','Grouping realized profit by the selected interval…',async()=>render());return;}
      const el=e.target.closest('[data-act]');if(!el||!root.contains(el))return;e.stopPropagation();const act=el.dataset.act;
      if(act==='close'){state.open=false;setBusy(false);render();}
      else if(act==='back'){state.view='dashboard';state.search='';render();}
      else if(act==='settings'){state.view='settings';render();}
      else if(act==='addItem'){state.view='add';await withBusy('Loading catalog','Preparing the Torn item catalog…',async()=>{await ensureCatalog();render();});setTimeout(()=>document.getElementById('tta-search')?.focus(),30);}
      else if(act==='toggleItem'){state.expanded=Number(state.expanded)===Number(el.dataset.id)?null:Number(el.dataset.id);renderItemList();}
      else if(act==='togglePin'){
        const id=Number(el.dataset.id),pins=new Set((state.pinnedIds||[]).map(Number));if(pins.has(id))pins.delete(id);else pins.add(id);state.pinnedIds=[...pins];save('pinnedIds',state.pinnedIds);renderItemList();
      }
      else if(act==='hideItem'){
        const id=Number(el.dataset.id),hidden=new Set((state.hiddenIds||[]).map(Number));hidden.add(id);state.hiddenIds=[...hidden];save('hiddenIds',state.hiddenIds);if(Number(state.expanded)===id)state.expanded=null;renderItemList();toast(`${catalogItem(id).name} hidden. Restore it from Settings.`);
      }
      else if(act==='restoreItem'){
        const id=Number(el.dataset.id);state.hiddenIds=(state.hiddenIds||[]).map(Number).filter(x=>x!==id);save('hiddenIds',state.hiddenIds);render();toast(`${catalogItem(id).name} restored.`);
      }
      else if(act==='restoreAllItems'){
        state.hiddenIds=[];save('hiddenIds',[]);render();toast('All hidden items restored.');
      }
      else if(act==='cycleSort'){const i=Math.max(0,SORT_OPTIONS.findIndex(x=>x.id===state.sortMode));state.sortMode=SORT_OPTIONS[(i+1)%SORT_OPTIONS.length].id;save('sortMode',state.sortMode);renderItemList();}
      else if(act==='clearItemSearch'){state.itemSearch='';save('itemSearch','');const input=document.getElementById('tta-history-search');if(input){input.value='';input.focus();}renderItemList();}
      else if(act==='confirmAdd'){addTracked(Number(el.dataset.id));}
      else if(act==='removeItem'){removeTracked(Number(el.dataset.id));}
      else if(act==='sync'){syncAll();}
      else if(act==='cancelSync'){state.syncCancel=true;setSyncProgress('Stopping after the current API request…');}
      else if(act==='saveApiKey'){
        const input=document.getElementById('tta-api-key');let key=String(input?.value||'').trim();if(input?.dataset.placeholderKey==='1'&&/^•+$/.test(key))key=String(state.apiKey||'').trim();
        if(key.length<16){toast('Enter a valid Torn API key first.');return;}state.apiKey=key;save('apiKey',key);state.demo=false;render();
        try{
          let info=null;await withBusy('Checking API key','Verifying access and refreshing the item catalog…',async()=>{info=await inspectActiveKey();await apiGet('/user/log',{limit:1});state.catalog=[];state.catalogVersion=0;save('catalog',[]);save('catalogVersion',0);await ensureCatalog(true);});
          toast(`API key confirmed (${info?.type||'access level '+(info?.level||'?')}).`);state.view='dashboard';render();await syncAll();
        }catch(err){if(/Incorrect Key|incorrect format/i.test(String(err.message||err))){state.apiKey='';save('apiKey','');}setBusy(false);render();toast(`API key test failed: ${err.message}`);}
      }
      else if(act==='clearApiKey'){state.apiKey='';save('apiKey','');state.demo=!hasApiKey();resetAnalyticsCache();render();toast(injectedApiKey()?'Saved key cleared. Torn PDA key will be used.':'Saved API key cleared.');}
      else if(act==='refreshCatalog'){
        await withBusy('Refreshing catalog','Downloading the latest Torn item catalog…',async()=>{state.catalog=[];state.catalogVersion=0;save('catalog',[]);save('catalogVersion',0);await ensureCatalog(true);});render();toast(`Item catalog refreshed · ${qty(state.catalog.length)} items.`);
      }
      else if(act==='resetData'&&confirm('Reset all Torn Trade Analyzer discovered item history and local transaction data?')){
        ['tracked','transactions','sync','pinnedIds','hiddenIds','itemSearch','sortMode'].forEach(k=>localStorage.removeItem(NS+k));state.tracked=[];state.transactions=[];state.pinnedIds=[];state.hiddenIds=[];state.itemSearch='';state.sortMode='recent';state.sync={lastSync:0,firstSyncComplete:false};state.expanded=null;resetAnalyticsCache();render();toast('Analyzer data reset.');
      }
    });

    root.addEventListener('input',e=>{
      const target=e.target;
      if(target.id==='tta-history-search'){
        state.itemSearch=target.value;save('itemSearch',state.itemSearch);clearTimeout(perfCache.searchTimer);perfCache.searchTimer=setTimeout(()=>renderItemList(),120);
      }else if(target.id==='tta-search'){
        state.search=target.value;clearTimeout(perfCache.legacySearchTimer);perfCache.legacySearchTimer=setTimeout(()=>{render();const n=document.getElementById('tta-search');if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length);}},140);
      }
    });

    root.addEventListener('change',async e=>{
      const target=e.target;if(!target.dataset.custom)return;if(target.dataset.custom==='from')state.customFrom=target.value;else state.customTo=target.value;save('customFrom',state.customFrom);save('customTo',state.customTo);state.expanded=null;
      await withBusy('Updating custom period','Applying the selected dates to cached analytics…',async()=>render());
    });

    root.addEventListener('focusin',e=>{const target=e.target;if(target.id==='tta-api-key'&&target.dataset.placeholderKey==='1'){target.value='';target.dataset.placeholderKey='0';}});
  }

  async function ensureCatalog(force=false) {
    if(state.demo&&!hasApiKey())return;
    const cacheCurrent=state.catalog.length&&state.catalogVersion===CATALOG_SCHEMA_VERSION;if(cacheCurrent&&!force)return;
    if(!hasApiKey()){state.catalog=demoCatalog();return;}
    try{
      if(state.busy?.active)setBusyDetail('Loading the complete Torn item catalog…');
      const data=await apiGet('/torn/items');
      state.catalog=(data.items||[]).filter(x=>x&&Number(x.id)>0&&x.name).map(x=>({id:Number(x.id),name:String(x.name),image:x.image||'',type:x.type||'',marketPrice:x.value?.market_price||0})).sort((a,b)=>a.name.localeCompare(b.name)||a.id-b.id);
      state.catalogVersion=CATALOG_SCHEMA_VERSION;save('catalog',state.catalog);save('catalogVersion',state.catalogVersion);perfCache.catalogRef=null;
    }catch(e){toast(e.message);}
  }

  function addTracked(id) {
    const x=state.catalog.find(i=>Number(i.id)===Number(id)); if(!x)return;
    if(!state.tracked.some(i=>Number(i.id)===Number(id))){state.tracked.push(x);save('tracked',state.tracked);}
    state.view='dashboard';state.search='';state.demo=false;render();toast(`${x.name} added. Sync to analyze its history.`);
  }
  function removeTracked(id) {
    const x=state.tracked.find(i=>Number(i.id)===Number(id));
    state.tracked=state.tracked.filter(i=>Number(i.id)!==Number(id));
    state.transactions=state.transactions.filter(t=>Number(t.itemId)!==Number(id));
    save('tracked',state.tracked);save('transactions',state.transactions);state.expanded=null;render();toast(`${x?.name||'Item'} removed.`);
  }

  async function ensureLogTypes(force=false) {
    if (state.logTypes.length && !force) return state.logTypes;
    const data=await apiGet('/torn/logtypes');
    state.logTypes=data.logtypes||[];save('logTypes',state.logTypes);return state.logTypes;
  }

  function relevantLogTypes(all) {
  const paidContext=/(item market|bazaar|abroad|foreign|travel|shop|auction|market)/i;
  const paidAction=/\b(buy|bought|purchase|purchased|sell|sold|sale|listed|listing|win|won)\b/i;
  const itemMovement=/(item|plushie|flower|drug|weapon|armor|armour|temporary).*(buy|bought|purchase|purchased|sell|sold|sale|receive|received|gain|gained|find|found|reward|loot|won|win)|(buy|bought|purchase|purchased|sell|sold|sale|receive|received|gain|gained|find|found|reward|loot|won|win).*(item|plushie|flower|drug|weapon|armor|armour|temporary)/i;
  const freeContext=/(crime success|organized crime success|city find|mission reward|seasonal gift|christmas town|easter egg hunt|halloween basket|job special|company special|event reward|competition reward|reward|loot|items? incoming|item.*received|item.*gained|item.*found)/i;
  const byId=new Map();
  (all||[]).forEach(x=>{
    const id=Number(x?.id),title=String(x?.title||'');
    if(id && ((paidContext.test(title) && paidAction.test(title)) || itemMovement.test(title) || freeContext.test(title) || KNOWN_TRANSACTION_LOGS.has(id))) byId.set(id,{...x,id});
  });
  KNOWN_TRANSACTION_LOGS.forEach((meta,id)=>{if(!byId.has(id))byId.set(id,{id,title:`${meta.source} ${meta.side}`});});
  return [...byId.values()].sort((a,b)=>a.id-b.id);
}

  function classify(title) {
    title=String(title||'').toLowerCase();
    if(/\b(sell|sold|sale)\b/.test(title)) return 'sell';
    if(/\b(buy|bought|purchase|win)\b/.test(title)) return 'buy';
    return null;
  }
  function sourceFrom(title) {
    const s=String(title||'').toLowerCase();
    if(s.includes('item market'))return'Item Market'; if(s.includes('bazaar'))return'Bazaar'; if(s.includes('abroad')||s.includes('travel'))return'Foreign Market'; if(s.includes('auction'))return'Auction House'; if(s.includes('city find'))return'City Find'; if(s.includes('crime'))return'Crime Reward'; if(s.includes('mission'))return'Mission Reward'; if(s.includes('seasonal')||s.includes('christmas')||s.includes('easter')||s.includes('halloween'))return'Seasonal Reward'; if(s.includes('job')||s.includes('company special'))return'Job / Company Reward'; if(s.includes('shop'))return'Torn Shop'; return title||'Other';
  }
  function isFreeAcquisition(title,data) {
    const s=String(title||'').toLowerCase();
    if(/crime success|organized crime success|city find|mission reward|seasonal gift|christmas town|easter egg hunt|halloween basket|job special|company special|event reward|competition reward|items? incoming|item.*received|item.*gained/.test(s)) return true;
    return !!(data?.item_gained||data?.items_gained||data?.item_received||data?.items_received||data?.reward_item||data?.reward_items||data?.loot_item||data?.loot_items);
  }

  function normalizeItems(data) {
  data=data||{};
  const out=[];
  const push=(id,q=1)=>{id=Number(id);q=Number(q)||1;if(id>0&&q>0)out.push({id,qty:q});};
  const itemKeys=new Set(['items','item','items_bought','items_sold','item_bought','item_sold','items_gained','item_gained','items_received','item_received','reward_items','reward_item','loot_items','loot_item','found_items','found_item']);
  const visit=(v,defaultQty=1,depth=0)=>{
    if(v==null||depth>8)return;
    if(typeof v==='number' || (typeof v==='string' && /^\d+$/.test(v))){push(v,defaultQty);return;}
    if(Array.isArray(v)){v.forEach(z=>visit(z,defaultQty,depth+1));return;}
    if(typeof v!=='object')return;
    const id=v.id??v.item_id??v.itemId;
    const hasQty=('qty'in v)||('quantity'in v)||('amount'in v)||('count'in v);
    if(id!=null && (hasQty || (depth>0 && Object.keys(v).length<10))){
      const q=v.qty??v.quantity??v.amount??v.count??defaultQty;
      push(id,q); return;
    }
    Object.entries(v).forEach(([k,val])=>{
      const lk=String(k).toLowerCase();
      if(/^\d+$/.test(k)){
        if(typeof val==='number') push(k,val);
        else if(Array.isArray(val)) push(k,val[0]??defaultQty);
        else if(val && typeof val==='object') push(k,val.qty??val.quantity??val.amount??val.count??defaultQty);
      } else if(itemKeys.has(lk)) visit(val,v.quantity??v.qty??v.amount??v.count??defaultQty,depth+1);
      else if(val && typeof val==='object' && depth<2 && /item|reward|loot|gain|receive|find|found/.test(lk)) visit(val,defaultQty,depth+1);
    });
  };
  const q=data.quantity??data.qty??data.amount??data.count??1;
  visit(data,q,0);
  const merged=new Map();out.forEach(x=>merged.set(x.id,(merged.get(x.id)||0)+x.qty));return [...merged].map(([id,qty])=>({id,qty}));
}

  function cashTotal(data, qtyValue) {
    const totalKeys=['cost_total','total_cost','total','price_total','money','amount_paid','proceeds','revenue','sale_total','total_value'];
    for(const k of totalKeys){const v=Number(data?.[k]);if(Number.isFinite(v)&&v>0)return v;}
    const eachKeys=['cost_each','price_each','unit_price','price','cost','value_each'];
    for(const k of eachKeys){const v=Number(data?.[k]);if(Number.isFinite(v)&&v>0)return v*Math.max(1,qtyValue||1);}
    return 0;
  }
  function fees(data) {
    return ['fee','fees','tax','market_fee','listing_fee'].reduce((s,k)=>s+(Number(data?.[k])||0),0);
  }

  function parseLogEntry(entry) {
    const logTypeId=Number(entry.details?.id)||0;
    const known=KNOWN_TRANSACTION_LOGS.get(logTypeId);
    const title=entry.details?.title||'';
    const payload={...(entry.params||{}),...(entry.data||{})};
    const monetaryContext=!!known||/(item market|bazaar|abroad|foreign market|torn shop|auction)/i.test(title);
    const free=isFreeAcquisition(title,payload)&&!monetaryContext;
    const side=known?.side||classify(title)||(free?'buy':null); if(!side)return[];
    const items=normalizeItems(payload); if(!items.length)return[];
    const totalAll=free?0:cashTotal(payload,items.reduce((s,x)=>s+x.qty,0)); const fee=side==='sell'?fees(payload):0;
    const totalQty=items.reduce((s,x)=>s+x.qty,0)||1;
    return items.map(it=>{
      const ratio=it.qty/totalQty; const total=totalAll*ratio; const feeShare=fee*ratio;
      return {id:`${entry.id}:${it.id}`,logId:logTypeId,timestamp:entry.timestamp,itemId:it.id,side,qty:it.qty,total,fee:feeShare,netTotal:side==='sell'?Math.max(0,total-feeShare):total,source:known?.source||sourceFrom(title),title,free};
    });
  }

  function nextLogPageParams(data,currentParams) {
  const next=data?._metadata?.links?.next;
  if(!next)return null;
  try {
    const u=new URL(next,API+'/user/log');
    const params={...currentParams};
    for(const [k,v] of u.searchParams.entries()){
      if(k==='key'||k==='comment')continue;
      params[k]=v;
    }
    return params;
  } catch(_) { return null; }
}

  async function inspectActiveKey() {
    const raw=await apiGet('/key/info');
    const info=raw?.info||{};
    const access=info?.access||{};
    const logAccess=access?.log||{};
    const userSelections=Array.isArray(info?.selections?.user)?info.selections.user:[];
    return {
      type:String(access?.type||''),
      level:Number(access?.level)||0,
      hasUserLog:userSelections.includes('log') || Number(access?.level)>=4,
      customLogPermissions:!!logAccess?.custom_permissions,
      availableLogGroups:Array.isArray(logAccess?.available)?logAccess.available.length:0,
      userId:Number(info?.user?.id)||0
    };
  }

  async function probeUserLogs() {
    const data=await apiGet('/user/log',{limit:100});
    return {data,rows:Array.isArray(data?.log)?data.log:[]};
  }

  function rawLogKey(r) {
    return String(r?.id??`${r?.timestamp||0}:${r?.details?.id||0}:${JSON.stringify(r?.data||r?.params||{})}`);
  }

  async function scanLogWindow(baseParams,period,label,found,diagnostics) {
    let cursorTo=period.to;
    let page=0;
    let previousSignature='';
    const seenRaw=new Set();
    while(!state.syncCancel){
      const params={...baseParams,limit:100,to:cursorTo};
      if(period.from>0)params.from=period.from;
      page++;diagnostics.pages++;
      setSyncProgress(`${label} · page ${page} · back to ${dateStr(Math.max(period.from,Math.min(cursorTo,nowSec())))} · ${qty(found.size)} item rows`);
      const data=await apiGet('/user/log',params);
      const rows=Array.isArray(data?.log)?data.log:[];
      if(!rows.length)break;
      const signature=rows.map(rawLogKey).join('|');
      const unseen=rows.filter(r=>{const k=rawLogKey(r);if(seenRaw.has(k))return false;seenRaw.add(k);return true;});
      diagnostics.rawRows+=unseen.length;
      unseen.forEach(r=>{
        const ts=Number(r?.timestamp)||0;
        if(ts<period.from||ts>period.to)return;
        const parsed=parseLogEntry(r);
        diagnostics.parsedRows+=parsed.length;
        parsed.forEach(t=>{found.set(t.id,t);diagnostics.matchedRows++;});
      });
      const timestamps=rows.map(r=>Number(r?.timestamp)).filter(Number.isFinite);
      if(!timestamps.length)break;
      const oldest=Math.min(...timestamps);
      diagnostics.oldestTimestamp=diagnostics.oldestTimestamp?Math.min(diagnostics.oldestTimestamp,oldest):oldest;
      if(period.from>0&&oldest<=period.from)break;
      let nextTo=oldest;
      if(signature===previousSignature)nextTo=oldest-1;
      if(!Number.isFinite(nextTo)||(nextTo>=cursorTo&&signature===previousSignature))break;
      if(period.from>0&&nextTo<period.from)break;
      previousSignature=signature;
      cursorTo=nextTo;
      await sleep(REQUEST_GAP_MS);
    }
  }

  async function fetchFilteredHistory(logIds,period) {
    const found=new Map();
    const diagnostics={rawRows:0,parsedRows:0,matchedRows:0,batches:Math.ceil(logIds.length/MAX_LOG_IDS_PER_REQUEST),logTypes:logIds.length,pages:0,oldestTimestamp:0,mode:'filtered',periodFrom:period.from,periodTo:period.to};
    for(let b=0;b<logIds.length;b+=MAX_LOG_IDS_PER_REQUEST){
      if(state.syncCancel)break;
      const ids=logIds.slice(b,b+MAX_LOG_IDS_PER_REQUEST);
      await scanLogWindow({log:ids.join(',')},period,`Historical scan ${Math.floor(b/MAX_LOG_IDS_PER_REQUEST)+1}/${diagnostics.batches}`,found,diagnostics);
      if(!state.syncCancel)await sleep(REQUEST_GAP_MS);
    }
    return {transactions:[...found.values()],diagnostics};
  }

  async function fetchUnfilteredHistory(period) {
    const found=new Map();
    const diagnostics={rawRows:0,parsedRows:0,matchedRows:0,batches:1,logTypes:0,pages:0,oldestTimestamp:0,mode:'unfiltered-fallback',periodFrom:period.from,periodTo:period.to};
    await scanLogWindow({},period,'Compatibility history scan',found,diagnostics);
    return {transactions:[...found.values()],diagnostics};
  }

  async function syncAll() {
    if(state.syncing)return;
    if(!hasApiKey()){state.demo=true;toast('Add a Torn API key in Settings → API Key to sync real history.');return;}
    const period=selectedPeriodBounds();
    const periodText=period.from>0?`${dateStr(period.from)} – ${dateStr(Math.min(period.to,nowSec()))}`:'all available history';
    state.syncing=true;state.syncCancel=false;setSyncProgress(`Preparing historical scan for ${periodText}…`);setBusy(true,'Syncing trade history',state.syncProgress,true);
    const syncBtn=document.querySelector('#tta-root [data-act="sync"]');if(syncBtn){syncBtn.disabled=true;syncBtn.innerHTML='<span class="tta-sync"><span class="tta-spinner"></span>Syncing</span>';}
    await nextPaint();
    try{
      await ensureCatalog();
      setBusyDetail('Verifying API access and log types…');
      const keyInfo=await inspectActiveKey();const probe=await probeUserLogs();const types=relevantLogTypes(await ensureLogTypes(true));
      if(!types.length)throw new Error('No relevant Torn transaction or free-acquisition log types were detected.');
      setSyncProgress(`Scanning the complete selected period: ${periodText}…`);
      let scan=await fetchFilteredHistory(types.map(x=>x.id),period);
      if(scan.diagnostics.rawRows===0){setSyncProgress('Filtered period scan returned no raw rows. Trying compatibility scan for the same dates…');scan=await fetchUnfilteredHistory(period);}
      scan.diagnostics.keyType=keyInfo.type;scan.diagnostics.keyLevel=keyInfo.level;scan.diagnostics.keySource=keySource();scan.diagnostics.customLogPermissions=keyInfo.customLogPermissions;scan.diagnostics.probeRows=probe.rows.length;
      const fresh=scan.transactions,outside=state.transactions.filter(t=>Number(t.timestamp)<period.from||Number(t.timestamp)>period.to),merged=new Map(outside.map(x=>[x.id,x]));fresh.forEach(x=>merged.set(x.id,x));
      state.transactions=[...merged.values()].sort((a,b)=>a.timestamp-b.timestamp);save('transactions',state.transactions);resetAnalyticsCache();
      state.sync.lastSync=nowSec();state.sync.firstSyncComplete=!state.syncCancel;state.sync.autoDiscoveryComplete=!state.syncCancel;
      if(!state.syncCancel){const oldCoverage=Number(state.sync.coverageFrom);state.sync.coverageFrom=Number.isFinite(oldCoverage)?Math.min(oldCoverage,period.from):period.from;state.sync.coverageTo=Math.max(Number(state.sync.coverageTo)||0,Math.min(period.to,nowSec()));}
      state.sync.diagnostics=scan.diagnostics;save('sync',state.sync);
      const mode=scan.diagnostics.mode==='unfiltered-fallback'?'compatibility scan':'filtered scan';
      if(state.syncCancel)setSyncProgress(`Sync stopped · ${qty(scan.diagnostics.rawRows)} raw logs scanned · ${qty(fresh.length)} item rows collected.`);
      else if(!fresh.length)setSyncProgress(`${mode} completed for ${periodText} · ${qty(scan.diagnostics.rawRows)} raw logs scanned · no recognizable item acquisitions or sales found.`);
      else setSyncProgress(`Historical sync complete for ${periodText} · ${qty(fresh.length)} item rows · ${qty(scan.diagnostics.rawRows)} raw logs across ${qty(scan.diagnostics.pages)} pages.`);
    }catch(e){setSyncProgress(`Sync error: ${e.message}`);}
    finally{state.syncing=false;setBusy(false);render();}
  }

  function demoCatalog(){return[
    {id:206,name:'Xanax',type:'Drug',image:'https://www.torn.com/images/items/206/large.png'},
    {id:258,name:'Jaguar Plushie',type:'Plushie',image:'https://www.torn.com/images/items/258/large.png'},
    {id:266,name:'Monkey Plushie',type:'Plushie',image:'https://www.torn.com/images/items/266/large.png'},
    {id:274,name:'Panda Plushie',type:'Plushie',image:'https://www.torn.com/images/items/274/large.png'},
    {id:260,name:'Wolverine Plushie',type:'Plushie',image:'https://www.torn.com/images/items/260/large.png'}
  ];}
  function demoTracked(){return demoCatalog().slice(0,3);}
  function demoTransactions(){
    const base=nowSec()-28*86400, a=[]; let id=1; const add=(d,item,side,q,total,source)=>a.push({id:`demo${id++}`,timestamp:base+d*86400+36000,itemId:item,side,qty:q,total,netTotal:total,fee:0,source,title:source});
    add(0,206,'buy',30,22800000,'Foreign Market'); add(4,206,'buy',20,15600000,'Item Market'); add(6,206,'sell',18,15300000,'Item Market'); add(10,206,'sell',12,10320000,'Bazaar'); add(17,206,'sell',10,8700000,'Item Market'); add(25,206,'sell',5,4350000,'Item Market');
    add(1,258,'buy',300,3300000,'Foreign Market'); add(8,258,'sell',120,1920000,'Item Market'); add(14,258,'sell',100,1650000,'Bazaar'); add(23,258,'sell',55,935000,'Item Market');
    add(2,266,'buy',220,1980000,'Foreign Market'); add(9,266,'sell',80,1120000,'Item Market'); add(16,266,'sell',90,1305000,'Item Market'); add(26,266,'sell',40,600000,'Bazaar');
    return a;
  }

  // Keep the UI alive through Torn's SPA navigation and delayed DOM swaps.
  const boot=()=>{if(document.body)mount();else setTimeout(boot,250)}; boot();
  setInterval(()=>{if(!document.getElementById('tta-fab')||!document.getElementById('tta-root'))mount();},5000);
})();
