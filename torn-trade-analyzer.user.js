// ==UserScript==
// @name         Torn Trade Analyzer
// @namespace    chadgian.torn.trade.analyzer
// @version      0.1.1
// @description  Track selected Torn items, backfill buy/sell logs, calculate FIFO realized profit, and chart profit by day/week/month. Data stays on-device.
// @author       chadgian + ChatGPT
// @match        https://www.torn.com/*
// @run-at       document-end
// @grant        none
// @updateURL    https://raw.githubusercontent.com/chadgian/systems_by_AI/main/torn-trade-analyzer.user.js
// @downloadURL  https://raw.githubusercontent.com/chadgian/systems_by_AI/main/torn-trade-analyzer.user.js
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '0.1.1';
  const API_KEY = '_###PDA-APIKEY###_';
  const NS = 'tta:v1:';
  const API = 'https://api.torn.com/v2';
  const REQUEST_GAP_MS = 800; // <=75 requests/minute, leaving headroom under Torn's 100/min user limit.
  const MAX_LOG_IDS_PER_REQUEST = 24;

  const state = {
    open: false,
    view: 'dashboard',
    tracked: load('tracked', []),
    transactions: load('transactions', []),
    catalog: load('catalog', []),
    logTypes: load('logTypes', []),
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

  function hasInjectedKey() {
    return API_KEY && !API_KEY.includes('###PDA-APIKEY###') && API_KEY.length >= 16;
  }

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
    if (!hasInjectedKey()) throw new Error('No Torn PDA API key is attached to this userscript.');
    const u = new URL(API + path);
    u.searchParams.set('key', API_KEY);
    u.searchParams.set('comment', 'TornTradeAnalyzer');
    Object.entries(params).forEach(([k,v]) => { if (v !== '' && v != null) u.searchParams.set(k, String(v)); });
    return httpGet(u.toString());
  }

  function injectCss() {
    if (document.getElementById('tta-css')) return;
    const s = document.createElement('style');
    s.id = 'tta-css';
    s.textContent = `
      :root{--tta-bg:#0b0f14;--tta-panel:#111821;--tta-card:#151e28;--tta-soft:#1f2c39;--tta-line:#34475a;--tta-text:#f7fbff;--tta-muted:#b9c8d6;--tta-faint:#91a5b7;--tta-green:#63efb1;--tta-red:#ff7d8a;--tta-blue:#7fc1ff;--tta-yellow:#ffda73;}
      #tta-root,#tta-root *,#tta-fab,#tta-fab *{box-sizing:border-box}
      #tta-root button,#tta-fab{font-family:inherit;-webkit-appearance:none;appearance:none;margin:0;line-height:1.15;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
      #tta-fab{position:fixed;right:14px;bottom:86px;z-index:2147483000;min-height:42px;border:1px solid #38566a;border-radius:18px;background:linear-gradient(135deg,#1a352f,#183951);color:#fff;box-shadow:0 12px 35px #0009;padding:11px 14px;font:700 12px/1.1 system-ui;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-align:center}
      #tta-fab .dot{width:9px;height:9px;flex:0 0 9px;border-radius:50%;background:var(--tta-green);box-shadow:0 0 14px var(--tta-green)}
      #tta-root{position:fixed;inset:0;z-index:2147482999;background:#06090dcc;backdrop-filter:blur(5px);display:none;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--tta-text);font-size:14px;line-height:1.4}
      #tta-root.show{display:block}.tta-shell{position:absolute;inset:0;background:var(--tta-bg);overflow:auto;overscroll-behavior:contain;padding-bottom:max(38px,env(safe-area-inset-bottom))}.tta-header{position:sticky;top:0;z-index:4;display:flex;align-items:center;gap:9px;min-height:62px;padding:10px 12px;background:#0b0f14f2;border-bottom:1px solid var(--tta-line);backdrop-filter:blur(8px)}
      .tta-brand{display:flex;align-items:center;gap:9px;min-width:0;flex:1}.tta-mark{width:38px;height:38px;flex:0 0 38px;border-radius:11px;background:linear-gradient(145deg,#183d32,#17394f);display:grid;place-items:center;font-size:19px;line-height:1}.tta-brandcopy{min-width:0}.tta-title{color:var(--tta-text);font-size:15px;font-weight:850;letter-spacing:.15px;line-height:1.2}.tta-sub{font-size:11px;color:var(--tta-muted);margin-top:2px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tta-iconbtn,.tta-back{display:grid;place-items:center;flex:0 0 40px;width:40px;height:40px;min-width:40px;min-height:40px;padding:0!important;border:1px solid var(--tta-line);background:var(--tta-card);color:var(--tta-text)!important;border-radius:11px;text-align:center;font-size:19px;font-weight:700;line-height:1}.tta-iconbtn:active,.tta-back:active{transform:scale(.96);background:var(--tta-soft)}.tta-back{font-size:26px}
      .tta-content{width:100%;padding:14px;max-width:760px;margin:0 auto}.tta-period{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:11px}.tta-period>div{min-width:0}.tta-period strong{display:block;color:var(--tta-text);font-size:14px;line-height:1.25}.tta-period small{color:var(--tta-muted);font-size:10px}
      .tta-chips{display:flex;gap:7px;overflow:auto;padding:1px 1px 4px;scrollbar-width:none}.tta-chips::-webkit-scrollbar{display:none}.tta-chip{display:inline-flex;align-items:center;justify-content:center;min-height:34px;white-space:nowrap;border:1px solid var(--tta-line);background:var(--tta-card);color:var(--tta-muted)!important;border-radius:999px;padding:7px 11px;font-size:11px;font-weight:750}.tta-chip.active{color:#052016!important;background:var(--tta-green);border-color:var(--tta-green)}
      .tta-summary{display:grid;grid-template-columns:1.45fr 1fr 1fr;gap:8px;margin:12px 0}.tta-stat{background:linear-gradient(180deg,var(--tta-card),#111821);border:1px solid var(--tta-line);border-radius:14px;padding:11px;min-width:0;text-align:center}.tta-stat label{display:block;font-size:9px;color:var(--tta-muted);text-transform:uppercase;letter-spacing:.75px;line-height:1.3}.tta-stat b{display:block;margin-top:5px;color:var(--tta-text);font-size:15px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tta-stat.main b{font-size:20px}.pos{color:var(--tta-green)!important}.neg{color:var(--tta-red)!important}
      .tta-chartcard{background:linear-gradient(180deg,#151f2a,#10171f);border:1px solid var(--tta-line);border-radius:16px;padding:13px 11px 11px;margin-bottom:14px;overflow:hidden}.tta-charthead{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}.tta-charthead h3{margin:0;color:var(--tta-text);font-size:13px;line-height:1.3}.tta-charthead small{color:var(--tta-muted)!important;font-size:10px}.tta-seg{display:flex;align-items:center;justify-content:center;background:#090e14;border:1px solid var(--tta-line);border-radius:10px;padding:2px}.tta-seg button{display:inline-flex;align-items:center;justify-content:center;min-height:30px;border:0;background:transparent;color:var(--tta-muted)!important;font-size:10px;font-weight:800;padding:6px 8px;border-radius:7px}.tta-seg button.active{background:var(--tta-soft);color:var(--tta-text)!important}.tta-svg{width:100%;height:160px;display:block;overflow:visible}.tta-axis{fill:#d6e1eb!important;color:#d6e1eb!important;font-size:10px;font-weight:650;paint-order:stroke;stroke:#10171f;stroke-width:1.5px;stroke-linejoin:round}.tta-zero{stroke:#7c91a4;stroke-width:1.25}.tta-bar-pos{fill:var(--tta-green)}.tta-bar-neg{fill:var(--tta-red)}.tta-grid{stroke:#344657;stroke-width:1}.tta-empty{min-height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;color:var(--tta-muted);font-size:12px;line-height:1.5;padding:18px}
      .tta-sectionhead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 1px 10px}.tta-sectionhead h3{color:var(--tta-text);font-size:14px;margin:0;line-height:1.3}.tta-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:38px;border:1px solid transparent;border-radius:10px;padding:8px 12px;font-size:11px;font-weight:850;text-align:center;background:var(--tta-green);color:#052016!important;white-space:nowrap}.tta-btn:active{transform:scale(.98)}.tta-btn.secondary{background:var(--tta-card);border-color:var(--tta-line);color:var(--tta-text)!important}.tta-btn.danger{background:#35181e;color:#ffc3c9!important;border-color:#71313d}.tta-btn:disabled{opacity:.55;transform:none}
      .tta-item{background:var(--tta-card);border:1px solid var(--tta-line);border-radius:15px;margin-bottom:10px;overflow:hidden}.tta-itemtop{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:11px;align-items:center;min-height:70px;padding:10px 11px;cursor:pointer}.tta-thumbwrap{position:relative;width:48px;height:48px;display:grid;place-items:center;align-self:center;justify-self:center;background:#0b1219;border:1px solid #2e4152;border-radius:12px;overflow:hidden}.tta-thumb{display:block;width:40px;height:40px;max-width:40px;max-height:40px;object-fit:contain;object-position:center;padding:0;margin:0;background:transparent;border:0}.tta-thumbfallback{display:none;position:absolute;inset:0;place-items:center;color:var(--tta-faint);font-size:20px}.tta-itemcopy{min-width:0;align-self:center}.tta-itemname{color:var(--tta-text);font-weight:850;font-size:13px;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tta-source{font-size:10px;color:var(--tta-muted);margin-top:4px;line-height:1.35;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.tta-profitbox{min-width:72px;text-align:right;align-self:center}.tta-profit{text-align:right;font-size:13px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1.25}.tta-chevron{font-size:10px;color:var(--tta-muted);margin-top:4px;line-height:1.2}.tta-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--tta-line);border-top:1px solid var(--tta-line)}.tta-metric{background:#111922;padding:9px 7px;text-align:center;min-width:0}.tta-metric small{display:block;color:var(--tta-muted);font-size:9px;text-transform:uppercase;letter-spacing:.55px;line-height:1.3}.tta-metric b{display:block;margin-top:3px;color:var(--tta-text);font-size:12px;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis}.tta-accordion{display:none;padding:12px;border-top:1px solid var(--tta-line);background:#0f161e}.tta-item.expanded .tta-accordion{display:block}.tta-minirow{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:11px}.tta-ministat{background:#151f2a;border:1px solid var(--tta-line);border-radius:10px;padding:9px 6px;text-align:center;min-width:0}.tta-ministat small{display:block;font-size:9px;color:var(--tta-muted);line-height:1.25}.tta-ministat b{display:block;margin-top:3px;color:var(--tta-text);font-size:11px;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis}.tta-spark{height:92px;width:100%;display:block;background:#0c1218;border-radius:10px;margin-top:7px}.tta-note{font-size:10px;color:var(--tta-muted);margin-top:9px;line-height:1.5}.tta-linkrow{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:11px}
      .tta-search{position:sticky;top:62px;z-index:3;background:var(--tta-bg);padding:4px 0 11px}.tta-search input{width:100%;min-height:44px;border-radius:12px;border:1px solid var(--tta-line);background:var(--tta-card);color:var(--tta-text)!important;font-size:13px;padding:11px 13px;outline:none}.tta-search input::placeholder{color:#91a5b7;opacity:1}.tta-search input:focus{border-color:var(--tta-blue);box-shadow:0 0 0 2px #7fc1ff22}.tta-result{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:11px;background:var(--tta-card);border:1px solid var(--tta-line);border-radius:13px;padding:9px 10px;margin-bottom:8px;min-height:68px}.tta-resultcopy{min-width:0}.tta-result small{display:block;margin-top:3px;color:var(--tta-muted);font-size:10px;line-height:1.3}
      .tta-banner{background:#152330;border:1px solid #36556d;border-radius:13px;padding:11px 12px;margin-bottom:11px;font-size:10px;line-height:1.5;color:#d0dce7}.tta-banner strong{color:#fff}.tta-sync{display:inline-flex;align-items:center;justify-content:center;gap:8px}.tta-spinner{width:13px;height:13px;border:2px solid #ffffff44;border-top-color:#fff;border-radius:50%;animation:tta-spin .8s linear infinite}@keyframes tta-spin{to{transform:rotate(360deg)}}
      .tta-settings label{display:block;font-size:10px;color:var(--tta-muted);margin:14px 0 5px}.tta-settings input{width:100%;background:var(--tta-card);border:1px solid var(--tta-line);color:var(--tta-text)!important;border-radius:10px;padding:10px}.tta-settings-actions{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:12px}.tta-tos{font-size:10px;line-height:1.6;color:#d0dce7;background:#101820;border:1px solid var(--tta-line);border-radius:12px;padding:11px}.tta-tos strong{color:#fff}.tta-toast{position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483002;background:#22313e;color:#fff;border:1px solid #536a7e;border-radius:999px;padding:9px 13px;font-size:11px;box-shadow:0 10px 30px #0008;max-width:88vw;text-align:center;line-height:1.35}
      .tta-demo{color:var(--tta-yellow);font-size:9px;font-weight:850;margin-left:6px}.tta-customdates{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:9px 0}.tta-customdates input{width:100%;min-height:40px;background:var(--tta-card);border:1px solid var(--tta-line);color:var(--tta-text)!important;border-radius:9px;padding:8px;font-size:11px;color-scheme:dark}
      @media(max-width:460px){.tta-content{padding:12px}.tta-summary{grid-template-columns:1fr 1fr}.tta-stat.main{grid-column:1/-1}.tta-sectionhead{align-items:stretch}.tta-sectionhead h3{display:flex;align-items:center;min-height:38px}.tta-itemtop{grid-template-columns:46px minmax(0,1fr) auto}.tta-thumbwrap{width:46px;height:46px}.tta-thumb{width:38px;height:38px}.tta-charthead{align-items:flex-start}.tta-seg{flex:0 0 auto}}
      @media(max-width:360px){.tta-header{padding-left:9px;padding-right:9px;gap:7px}.tta-mark{width:34px;height:34px;flex-basis:34px}.tta-iconbtn,.tta-back{width:38px;height:38px;min-width:38px;min-height:38px;flex-basis:38px}.tta-title{font-size:14px}.tta-sub{font-size:10px}.tta-content{padding:10px}.tta-itemtop{grid-template-columns:42px minmax(0,1fr);gap:9px}.tta-thumbwrap{width:42px;height:42px;grid-row:1/2}.tta-thumb{width:35px;height:35px}.tta-profitbox{grid-column:2;display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;text-align:left}.tta-profit,.tta-chevron{text-align:left;margin:0}.tta-minirow{grid-template-columns:1fr 1fr}.tta-ministat:last-child{grid-column:1/-1}.tta-sectionhead{flex-direction:column}.tta-sectionhead .tta-btn{width:100%}.tta-period{align-items:flex-start}.tta-period .tta-btn{flex:0 0 auto}.tta-charthead{flex-direction:column}.tta-seg{width:100%}.tta-seg button{flex:1}.tta-result{grid-template-columns:42px minmax(0,1fr)}.tta-result .tta-btn{grid-column:1/-1;width:100%}.tta-customdates{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function mount() {
    injectCss();
    if (!document.getElementById('tta-fab')) {
      const fab = document.createElement('button'); fab.id = 'tta-fab';
      fab.innerHTML = '<span class="dot"></span><span>Trade Analytics</span>';
      fab.onclick = () => { state.open = true; render(); };
      document.body.appendChild(fab);
    }
    if (!document.getElementById('tta-root')) {
      const root = document.createElement('div'); root.id = 'tta-root'; document.body.appendChild(root);
    }
    render();
  }

  function effectiveTransactions() {
    if (state.transactions.length || !state.demo) return state.transactions;
    return demoTransactions();
  }
  function effectiveTracked() {
    if (state.tracked.length || !state.demo) return state.tracked;
    return demoTracked();
  }

  function dateRange() {
    const allTx = effectiveTransactions(); const now = new Date(); let from = 0, to = Math.floor(Date.now()/1000) + 86400;
    if (state.dateMode === '7d') from = nowSec() - 7*86400;
    else if (state.dateMode === '30d') from = nowSec() - 30*86400;
    else if (state.dateMode === 'month') from = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime()/1000);
    else if (state.dateMode === 'custom') {
      if (state.customFrom) from = Math.floor(new Date(state.customFrom + 'T00:00:00').getTime()/1000);
      if (state.customTo) to = Math.floor(new Date(state.customTo + 'T23:59:59').getTime()/1000);
    } else if (state.dateMode === 'all' && allTx.length) from = Math.min(...allTx.map(x => x.timestamp));
    return {from, to};
  }

  function fifoAnalytics(itemId) {
    const tx = effectiveTransactions().filter(x => Number(x.itemId) === Number(itemId)).sort((a,b)=>a.timestamp-b.timestamp || String(a.id).localeCompare(String(b.id)));
    const lots = []; const events = [];
    for (const t of tx) {
      if (t.side === 'buy') {
        if (t.qty > 0 && t.total >= 0) lots.push({qty:t.qty, unit:t.qty ? t.total/t.qty : 0});
        events.push({...t, realizedProfit:0, matchedQty:0, unmatchedQty:0});
      } else if (t.side === 'sell') {
        let remain = t.qty, basis = 0, matched = 0;
        while (remain > 0 && lots.length) {
          const lot = lots[0]; const take = Math.min(remain, lot.qty);
          basis += take * lot.unit; matched += take; remain -= take; lot.qty -= take;
          if (lot.qty <= 1e-9) lots.shift();
        }
        const net = t.netTotal ?? t.total;
        const matchedRevenue = t.qty > 0 ? net * (matched / t.qty) : 0;
        events.push({...t, costBasis:basis, realizedProfit:matchedRevenue - basis, matchedQty:matched, unmatchedQty:remain});
      }
    }
    return {events, remainingQty: lots.reduce((a,l)=>a+l.qty,0), remainingCost: lots.reduce((a,l)=>a+l.qty*l.unit,0)};
  }

  function summaryFor(itemId) {
    const {from,to} = dateRange(); const a = fifoAnalytics(itemId);
    const e = a.events.filter(x => x.timestamp >= from && x.timestamp <= to);
    const buys = e.filter(x=>x.side==='buy'); const sells=e.filter(x=>x.side==='sell');
    const sources = [...new Set(buys.map(x=>x.source).filter(Boolean))];
    return {
      bought: buys.reduce((s,x)=>s+x.qty,0), sold:sells.reduce((s,x)=>s+x.qty,0),
      buySpend:buys.reduce((s,x)=>s+x.total,0), sellRevenue:sells.reduce((s,x)=>s+(x.netTotal??x.total),0),
      profit:sells.reduce((s,x)=>s+(x.realizedProfit||0),0), sources,
      unmatched:sells.reduce((s,x)=>s+(x.unmatchedQty||0),0), events:e,
      remainingQty:a.remainingQty, remainingCost:a.remainingCost
    };
  }

  function overall() {
    const tracked = effectiveTracked(); const rows=tracked.map(i=>summaryFor(i.id));
    return {profit:rows.reduce((s,x)=>s+x.profit,0), bought:rows.reduce((s,x)=>s+x.bought,0), sold:rows.reduce((s,x)=>s+x.sold,0), unmatched:rows.reduce((s,x)=>s+x.unmatched,0)};
  }

  function profitSeries(itemId = null) {
    const {from,to}=dateRange(); const events=[];
    const ids = itemId != null ? [itemId] : effectiveTracked().map(x=>x.id);
    ids.forEach(id => fifoAnalytics(id).events.filter(x=>x.side==='sell'&&x.timestamp>=from&&x.timestamp<=to).forEach(x=>events.push(x)));
    const keyFn=state.granularity==='week'?weekKey:state.granularity==='month'?monthKey:dayKey;
    const m=new Map(); events.forEach(e=>{const k=keyFn(e.timestamp);m.set(k,(m.get(k)||0)+(e.realizedProfit||0));});
    return [...m.entries()].sort((a,b)=>a[0]-b[0]).map(([t,v])=>({t,v}));
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

  function dashboardHtml() {
    const s=overall(), tracked=effectiveTracked(), range=dateRange();
    const periodLabel = state.dateMode==='all'?'All available history':`${dateStr(range.from)} – ${dateStr(Math.min(range.to,nowSec()))}`;
    return `${header('Trade Analyzer', `v${VERSION} · FIFO realized profit`)}<div class="tta-content">
      ${!hasInjectedKey()?`<div class="tta-banner"><strong>Preview mode.</strong> Torn PDA has not injected a Log-capable key into this copy, so sample transactions are shown. When installed in Torn PDA, assign this userscript a custom API key that includes <strong>User → Log</strong>; the key and analyzed data stay on your device.</div>`:''}
      <div class="tta-period"><div><small>Date period</small><br><strong>${esc(periodLabel)}</strong></div><button class="tta-btn secondary" data-act="sync" ${state.syncing?'disabled':''}>${state.syncing?'<span class="tta-sync"><span class="tta-spinner"></span>Syncing</span>':'↻ Sync'}</button></div>
      ${state.syncProgress?`<div class="tta-banner">${esc(state.syncProgress)} ${state.syncing?'<button class="tta-btn danger" data-act="cancelSync" style="min-height:30px;padding:5px 9px;margin-left:8px;vertical-align:middle">Stop</button>':''}</div>`:''}
      <div class="tta-chips">${[['7d','7 days'],['30d','30 days'],['month','This month'],['all','All'],['custom','Custom']].map(([k,l])=>`<button class="tta-chip ${state.dateMode===k?'active':''}" data-date="${k}">${l}</button>`).join('')}</div>
      ${state.dateMode==='custom'?`<div class="tta-customdates"><input type="date" data-custom="from" value="${esc(state.customFrom)}"><input type="date" data-custom="to" value="${esc(state.customTo)}"></div>`:''}
      <div class="tta-summary"><div class="tta-stat main"><label>Realized profit</label><b class="${s.profit>=0?'pos':'neg'}">${money(s.profit)}</b></div><div class="tta-stat"><label>Bought</label><b>${qty(s.bought)}</b></div><div class="tta-stat"><label>Sold</label><b>${qty(s.sold)}</b></div></div>
      <div class="tta-chartcard"><div class="tta-charthead"><h3>Profit earned</h3><div class="tta-seg">${['day','week','month'].map(g=>`<button class="${state.granularity===g?'active':''}" data-gran="${g}">${g[0].toUpperCase()+g.slice(1)}</button>`).join('')}</div></div>${chartSvg(profitSeries())}</div>
      <div class="tta-sectionhead"><h3>Tracked items · ${tracked.length}</h3><button class="tta-btn" data-act="addItem">＋ Add item</button></div>
      ${tracked.length?tracked.map(itemCard).join(''):`<div class="tta-empty">No tracked items yet.<br><button class="tta-btn" data-act="addItem">Add your first item</button></div>`}
    </div>`;
  }

  function itemCard(item) {
    const s=summaryFor(item.id), exp=Number(state.expanded)===Number(item.id), series=profitSeries(item.id);
    const src=s.sources.length?s.sources.slice(0,3).join(' · '):'No purchases in selected period';
    const avgBuy=s.bought?s.buySpend/s.bought:0, avgSell=s.sold?s.sellRevenue/s.sold:0;
    return `<div class="tta-item ${exp?'expanded':''}" data-item="${item.id}"><div class="tta-itemtop" data-act="toggleItem" data-id="${item.id}" role="button" tabindex="0" aria-expanded="${exp?'true':'false'}">${itemIcon(item)}<div class="tta-itemcopy"><div class="tta-itemname">${esc(item.name)}</div><div class="tta-source">${esc(src)}</div></div><div class="tta-profitbox"><div class="tta-profit ${s.profit>=0?'pos':'neg'}">${money(s.profit,true)}</div><div class="tta-chevron">${exp?'▲ details':'▼ details'}</div></div></div><div class="tta-metrics"><div class="tta-metric"><small>Bought</small><b>${qty(s.bought)}</b></div><div class="tta-metric"><small>Sold</small><b>${qty(s.sold)}</b></div><div class="tta-metric"><small>Profit</small><b class="${s.profit>=0?'pos':'neg'}">${money(s.profit,true)}</b></div></div><div class="tta-accordion"><div class="tta-minirow"><div class="tta-ministat"><small>Avg buy</small><b>${money(avgBuy,true)}</b></div><div class="tta-ministat"><small>Avg sell</small><b>${money(avgSell,true)}</b></div><div class="tta-ministat"><small>Inventory</small><b>${qty(s.remainingQty)}</b></div></div><div class="tta-charthead"><h3>${esc(item.name)} profit</h3><small>${s.events.length} events</small></div>${chartSvg(series,92)}<div class="tta-note">Profit uses FIFO: each sale is matched against your oldest recorded purchases. ${s.unmatched?`⚠ ${qty(s.unmatched)} sold item(s) have no earlier recorded purchase cost, so those units are excluded from realized profit.`:'All sold units in this period have recorded cost basis.'}</div>${!state.demo?`<div class="tta-linkrow"><button class="tta-btn danger" data-act="removeItem" data-id="${item.id}">Remove</button></div>`:''}</div></div>`;
  }

  function addItemHtml() {
    const q=state.search.trim().toLowerCase();
    const results=(state.catalog||[]).filter(x=>!state.tracked.some(t=>Number(t.id)===Number(x.id)) && (!q || x.name.toLowerCase().includes(q) || String(x.id)===q)).slice(0,60);
    return `${header('Add item','Search Torn item catalog',true)}<div class="tta-content"><div class="tta-search"><input id="tta-search" placeholder="Search item name or ID…" value="${esc(state.search)}" autocomplete="off" aria-label="Search Torn items"></div>${!hasInjectedKey()?'<div class="tta-banner"><strong>Catalog preview:</strong> sample search results are available below. With the Torn PDA key attached, the full current Torn item catalog loads from the API.</div>':''}${results.length?results.map(x=>`<div class="tta-result">${itemIcon(x)}<div class="tta-resultcopy"><div class="tta-itemname">${esc(x.name)}</div><small>#${x.id} · ${esc(x.type||'Item')}</small></div><button class="tta-btn" data-act="confirmAdd" data-id="${x.id}">Add</button></div>`).join(''):'<div class="tta-empty">No matching items.</div>'}</div>`;
  }

  function settingsHtml() {
    const when=state.sync.lastSync?new Date(state.sync.lastSync*1000).toLocaleString():'Never';
    return `${header('Settings','Storage, API access & reset',true)}<div class="tta-content tta-settings"><div class="tta-tos"><strong>Privacy / Torn API use</strong><br>Storage: only locally in this browser/Torn PDA WebView.<br>Sharing: nobody; the script sends data only to Torn's official API.<br>Purpose: personal statistical analysis of selected item purchases and sales.<br>Key: supplied by Torn PDA at runtime; never uploaded to GitHub or another server.<br>Required access: public Torn item/log-type endpoints plus <strong>User → Log</strong> (currently a Full/custom-key selection).</div><label>Last successful sync</label><div class="tta-banner">${esc(when)}${state.sync.firstSyncComplete?' · Historical backfill completed':''}</div><label>Local transaction records</label><div class="tta-banner">${qty(state.transactions.length)} normalized item transaction entries. Raw Torn logs are not retained.</div><div class="tta-settings-actions"><button class="tta-btn secondary" data-act="refreshCatalog">Refresh Torn item catalog</button><button class="tta-btn danger" data-act="resetData">Reset analyzer data</button></div></div>`;
  }

  function render() {
    const root=document.getElementById('tta-root'); if(!root)return;
    if(!state.open){root.classList.remove('show');return;} root.classList.add('show');
    if (!hasInjectedKey() && !state.tracked.length && !state.transactions.length) state.demo=true; else state.demo=false;
    if (state.demo && !state.catalog.length) state.catalog=demoCatalog();
    root.innerHTML=`<div class="tta-shell">${state.view==='add'?addItemHtml():state.view==='settings'?settingsHtml():dashboardHtml()}</div>${state.toast?`<div class="tta-toast">${esc(state.toast)}</div>`:''}`;
    bind();
  }

  function toast(msg) { state.toast=msg; render(); setTimeout(()=>{ if(state.toast===msg){state.toast='';render();}},2400); }
  function bind() {
    const root=document.getElementById('tta-root'); if(!root)return;
    root.querySelectorAll('[data-act]').forEach(el=>el.addEventListener('click', async e=>{
      e.stopPropagation(); const act=el.dataset.act;
      if(act==='close'){state.open=false;render();}
      else if(act==='back'){state.view='dashboard';state.search='';render();}
      else if(act==='settings'){state.view='settings';render();}
      else if(act==='addItem'){state.view='add';await ensureCatalog();render();setTimeout(()=>document.getElementById('tta-search')?.focus(),30);}
      else if(act==='toggleItem'){state.expanded=Number(state.expanded)===Number(el.dataset.id)?null:Number(el.dataset.id);render();}
      else if(act==='confirmAdd'){addTracked(Number(el.dataset.id));}
      else if(act==='removeItem'){removeTracked(Number(el.dataset.id));}
      else if(act==='sync'){syncAll();}
      else if(act==='cancelSync'){state.syncCancel=true;state.syncProgress='Stopping after the current API request…';render();}
      else if(act==='refreshCatalog'){state.catalog=[];save('catalog',[]);await ensureCatalog(true);toast('Item catalog refreshed.');}
      else if(act==='resetData'){if(confirm('Reset all Torn Trade Analyzer tracked items and local transaction data?')){['tracked','transactions','sync'].forEach(k=>localStorage.removeItem(NS+k));state.tracked=[];state.transactions=[];state.sync={lastSync:0,firstSyncComplete:false};state.expanded=null;toast('Analyzer data reset.');}}
    }));
    root.querySelectorAll('[data-date]').forEach(el=>el.addEventListener('click',()=>{state.dateMode=el.dataset.date;save('dateMode',state.dateMode);render();}));
    root.querySelectorAll('[data-gran]').forEach(el=>el.addEventListener('click',()=>{state.granularity=el.dataset.gran;save('granularity',state.granularity);render();}));
    root.querySelectorAll('[data-custom]').forEach(el=>el.addEventListener('change',()=>{if(el.dataset.custom==='from')state.customFrom=el.value;else state.customTo=el.value;save('customFrom',state.customFrom);save('customTo',state.customTo);render();}));
    const si=document.getElementById('tta-search'); if(si) si.addEventListener('input',()=>{state.search=si.value; render(); const n=document.getElementById('tta-search');if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length);}});
  }

  async function ensureCatalog(force=false) {
    if (state.demo) return;
    if (state.catalog.length && !force) return;
    if (!hasInjectedKey()) { state.catalog=demoCatalog(); return; }
    try {
      state.syncProgress='Loading current Torn item catalog…';render();
      const data=await apiGet('/torn/items');
      state.catalog=(data.items||[]).filter(x=>x && x.id && x.name).map(x=>({id:x.id,name:x.name,image:x.image,type:x.type||'',marketPrice:x.value?.market_price||0}));
      save('catalog',state.catalog); state.syncProgress='';
    } catch(e) { state.syncProgress=''; toast(e.message); }
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

  async function ensureLogTypes() {
    if (state.logTypes.length) return state.logTypes;
    const data=await apiGet('/torn/logtypes');
    state.logTypes=data.logtypes||[];save('logTypes',state.logTypes);return state.logTypes;
  }

  function relevantLogTypes(all) {
    const context=/(item market|bazaar|abroad|travel.*(item|goods)|shop|auction)/i;
    const action=/\b(buy|bought|purchase|sell|sold|sale|win)\b/i;
    return all.filter(x=>context.test(x.title||'') && action.test(x.title||''));
  }
  function classify(title) {
    title=String(title||'').toLowerCase();
    if(/\b(sell|sold|sale)\b/.test(title)) return 'sell';
    if(/\b(buy|bought|purchase|win)\b/.test(title)) return 'buy';
    return null;
  }
  function sourceFrom(title) {
    const s=String(title||'').toLowerCase();
    if(s.includes('item market'))return'Item Market'; if(s.includes('bazaar'))return'Bazaar'; if(s.includes('abroad')||s.includes('travel'))return'Foreign Market'; if(s.includes('auction'))return'Auction House'; if(s.includes('shop'))return'Torn Shop'; return title||'Other';
  }

  function normalizeItems(data) {
    const out=[];
    const push=(id,q=1)=>{id=Number(id);q=Number(q)||1;if(id>0&&q>0)out.push({id,qty:q});};
    const visit=v=>{
      if(v==null)return;
      if(Array.isArray(v)){v.forEach(z=>visit(z));return;}
      if(typeof v==='object'){
        if(('id'in v||'item_id'in v) && ('qty'in v||'quantity'in v||'amount'in v)){push(v.id??v.item_id,v.qty??v.quantity??v.amount);return;}
        if('id'in v && Object.keys(v).length<8){push(v.id,v.qty??v.quantity??1);return;}
        Object.entries(v).forEach(([k,val])=>{
          if(/^\d+$/.test(k) && (Array.isArray(val)||typeof val==='number')) push(k,Array.isArray(val)?val[0]:val);
          else if(k==='items'||k==='item'||k==='items_bought'||k==='items_sold'||k==='item_bought'||k==='item_sold') visit(val);
        });
      }
    };
    visit(data.items);visit(data.item);visit(data.items_bought);visit(data.items_sold);visit(data.item_bought);visit(data.item_sold);
    if(!out.length && (data.item_id||data.itemid)) push(data.item_id??data.itemid,data.quantity??data.qty??data.amount??1);
    const merged=new Map();out.forEach(x=>merged.set(x.id,(merged.get(x.id)||0)+x.qty));return [...merged].map(([id,qty])=>({id,qty}));
  }

  function cashTotal(data, qtyValue) {
    const totalKeys=['cost_total','total_cost','total','price_total','money','amount_paid','proceeds','revenue','sale_total'];
    for(const k of totalKeys){const v=Number(data?.[k]);if(Number.isFinite(v)&&v>0)return v;}
    const eachKeys=['cost_each','price_each','unit_price','price','cost'];
    for(const k of eachKeys){const v=Number(data?.[k]);if(Number.isFinite(v)&&v>0)return v*Math.max(1,qtyValue||1);}
    return 0;
  }
  function fees(data) {
    return ['fee','fees','tax','market_fee','listing_fee'].reduce((s,k)=>s+(Number(data?.[k])||0),0);
  }

  function parseLogEntry(entry) {
    const title=entry.details?.title||''; const side=classify(title); if(!side)return[];
    const items=normalizeItems(entry.data||{}); if(!items.length)return[];
    const totalAll=cashTotal(entry.data||{},items.reduce((s,x)=>s+x.qty,0)); const fee=side==='sell'?fees(entry.data||{}):0;
    const totalQty=items.reduce((s,x)=>s+x.qty,0)||1;
    return items.filter(it=>state.tracked.some(t=>Number(t.id)===Number(it.id))).map(it=>{
      const ratio=it.qty/totalQty; const total=totalAll*ratio; const feeShare=fee*ratio;
      return {id:`${entry.id}:${it.id}`,logId:entry.details?.id||0,timestamp:entry.timestamp,itemId:it.id,side,qty:it.qty,total,fee:feeShare,netTotal:side==='sell'?Math.max(0,total-feeShare):total,source:sourceFrom(title),title};
    });
  }

  async function fetchHistory(logIds) {
    const found=new Map();
    for(let b=0;b<logIds.length;b+=MAX_LOG_IDS_PER_REQUEST){
      if(state.syncCancel)break;
      const ids=logIds.slice(b,b+MAX_LOG_IDS_PER_REQUEST); let cursor=nowSec()+60, page=0;
      while(!state.syncCancel){
        page++; state.syncProgress=`Historical scan ${Math.floor(b/MAX_LOG_IDS_PER_REQUEST)+1}/${Math.ceil(logIds.length/MAX_LOG_IDS_PER_REQUEST)} · page ${page} · ${qty(found.size)} matching transaction rows found`;render();
        const data=await apiGet('/user/log',{log:ids.join(','),limit:100,to:cursor});
        const rows=data.log||[]; if(!rows.length)break;
        rows.forEach(r=>parseLogEntry(r).forEach(t=>found.set(t.id,t)));
        const oldest=Math.min(...rows.map(r=>Number(r.timestamp)||cursor));
        if(rows.length<100||!Number.isFinite(oldest)||oldest<=1)break;
        cursor=oldest-1; await sleep(REQUEST_GAP_MS);
      }
      await sleep(REQUEST_GAP_MS);
    }
    return [...found.values()];
  }

  async function syncAll() {
    if(state.syncing)return;
    if(!state.tracked.length){toast('Add at least one item first.');return;}
    if(!hasInjectedKey()){state.demo=true;toast('Preview mode: attach a Torn PDA custom key with User → Log to sync real history.');render();return;}
    state.syncing=true;state.syncCancel=false;state.syncProgress='Checking Torn log types…';render();
    try {
      await ensureCatalog(); const types=relevantLogTypes(await ensureLogTypes());
      if(!types.length) throw new Error('No relevant Torn buy/sell log types were detected.');
      const fresh=await fetchHistory(types.map(x=>x.id));
      const merged=new Map(state.transactions.map(x=>[x.id,x])); fresh.forEach(x=>merged.set(x.id,x));
      state.transactions=[...merged.values()].filter(t=>state.tracked.some(i=>Number(i.id)===Number(t.itemId))).sort((a,b)=>a.timestamp-b.timestamp);
      save('transactions',state.transactions); state.sync.lastSync=nowSec(); state.sync.firstSyncComplete=!state.syncCancel;save('sync',state.sync);
      state.syncProgress=state.syncCancel?`Sync stopped. ${qty(fresh.length)} matching rows collected this run.`:`Historical sync complete · ${qty(state.transactions.length)} tracked transaction rows stored locally.`;
    } catch(e) {
      state.syncProgress=`Sync error: ${e.message}`;
    } finally {state.syncing=false;render();}
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
