// ==UserScript==
// @name         Torn Trade Analyzer
// @namespace    chadgian.torn.trade.analyzer
// @version      0.1.0
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

  const VERSION = '0.1.0';
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
      :root{--tta-bg:#0b0f14;--tta-panel:#111821;--tta-card:#151e28;--tta-soft:#1c2733;--tta-line:#253342;--tta-text:#f3f7fb;--tta-muted:#8fa2b5;--tta-green:#54e3a2;--tta-red:#ff6b79;--tta-blue:#66b4ff;--tta-yellow:#ffd166;}
      #tta-fab{position:fixed;right:14px;bottom:86px;z-index:2147483000;border:0;border-radius:18px;background:linear-gradient(135deg,#1a2f2c,#17334d);color:#fff;box-shadow:0 12px 35px #0009;padding:11px 14px;font:700 12px/1.1 system-ui;display:flex;align-items:center;gap:8px;touch-action:manipulation}
      #tta-fab .dot{width:9px;height:9px;border-radius:50%;background:var(--tta-green);box-shadow:0 0 14px var(--tta-green)}
      #tta-root{position:fixed;inset:0;z-index:2147482999;background:#06090db8;backdrop-filter:blur(5px);display:none;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--tta-text)}
      #tta-root.show{display:block}.tta-shell{position:absolute;inset:0;background:var(--tta-bg);overflow:auto;padding-bottom:38px}.tta-header{position:sticky;top:0;z-index:4;display:flex;align-items:center;gap:10px;padding:13px 14px;background:#0b0f14ee;border-bottom:1px solid var(--tta-line);backdrop-filter:blur(8px)}
      .tta-brand{display:flex;align-items:center;gap:9px;min-width:0;flex:1}.tta-mark{width:34px;height:34px;border-radius:11px;background:linear-gradient(145deg,#18372e,#16344a);display:grid;place-items:center;font-size:18px}.tta-title{font-size:15px;font-weight:800;letter-spacing:.15px}.tta-sub{font-size:10px;color:var(--tta-muted);margin-top:1px}.tta-iconbtn{border:1px solid var(--tta-line);background:var(--tta-card);color:var(--tta-text);border-radius:10px;width:35px;height:35px;font-size:16px}
      .tta-content{padding:13px;max-width:760px;margin:0 auto}.tta-period{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:11px}.tta-period strong{font-size:14px}.tta-period small{color:var(--tta-muted)}
      .tta-chips{display:flex;gap:6px;overflow:auto;padding-bottom:3px}.tta-chip{white-space:nowrap;border:1px solid var(--tta-line);background:var(--tta-card);color:var(--tta-muted);border-radius:999px;padding:7px 10px;font-size:11px;font-weight:700}.tta-chip.active{color:#06130f;background:var(--tta-green);border-color:var(--tta-green)}
      .tta-summary{display:grid;grid-template-columns:1.45fr 1fr 1fr;gap:8px;margin:12px 0}.tta-stat{background:linear-gradient(180deg,var(--tta-card),#111821);border:1px solid var(--tta-line);border-radius:14px;padding:11px;min-width:0}.tta-stat label{font-size:9px;color:var(--tta-muted);text-transform:uppercase;letter-spacing:.8px}.tta-stat b{display:block;margin-top:4px;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tta-stat.main b{font-size:20px}.pos{color:var(--tta-green)!important}.neg{color:var(--tta-red)!important}
      .tta-chartcard{background:linear-gradient(180deg,#131c26,#10171f);border:1px solid var(--tta-line);border-radius:16px;padding:12px;margin-bottom:13px}.tta-charthead{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.tta-charthead h3{margin:0;font-size:13px}.tta-seg{display:flex;background:#0b1016;border:1px solid var(--tta-line);border-radius:9px;padding:2px}.tta-seg button{border:0;background:transparent;color:var(--tta-muted);font-size:9px;font-weight:800;padding:5px 7px;border-radius:6px}.tta-seg button.active{background:var(--tta-soft);color:var(--tta-text)}.tta-svg{width:100%;height:160px;display:block}.tta-axis{fill:#7d91a6;font-size:8px}.tta-zero{stroke:#334353;stroke-width:1}.tta-bar-pos{fill:#54e3a2}.tta-bar-neg{fill:#ff6b79}.tta-grid{stroke:#1d2934;stroke-width:1}.tta-empty{height:150px;display:grid;place-items:center;text-align:center;color:var(--tta-muted);font-size:12px}
      .tta-sectionhead{display:flex;align-items:center;justify-content:space-between;margin:8px 1px 9px}.tta-sectionhead h3{font-size:14px;margin:0}.tta-btn{border:0;border-radius:10px;padding:8px 11px;font-size:11px;font-weight:800;background:var(--tta-green);color:#06130f}.tta-btn.secondary{background:var(--tta-card);border:1px solid var(--tta-line);color:var(--tta-text)}.tta-btn.danger{background:#30171c;color:#ffadb5;border:1px solid #5a252f}.tta-btn:disabled{opacity:.55}
      .tta-item{background:var(--tta-card);border:1px solid var(--tta-line);border-radius:15px;margin-bottom:9px;overflow:hidden}.tta-itemtop{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px}.tta-thumb{width:42px;height:42px;object-fit:contain;background:#0d131a;border-radius:11px;padding:4px}.tta-itemname{font-weight:800;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tta-source{font-size:10px;color:var(--tta-muted);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tta-profit{text-align:right;font-size:13px;font-weight:900}.tta-chevron{font-size:10px;color:var(--tta-muted);margin-top:3px}.tta-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--tta-line);border-top:1px solid var(--tta-line)}.tta-metric{background:#111922;padding:8px 10px}.tta-metric small{display:block;color:var(--tta-muted);font-size:8px;text-transform:uppercase;letter-spacing:.6px}.tta-metric b{font-size:12px}.tta-accordion{display:none;padding:12px;border-top:1px solid var(--tta-line);background:#0f161e}.tta-item.expanded .tta-accordion{display:block}.tta-minirow{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:10px}.tta-ministat{background:#141e28;border:1px solid var(--tta-line);border-radius:10px;padding:8px}.tta-ministat small{display:block;font-size:8px;color:var(--tta-muted)}.tta-ministat b{font-size:11px}.tta-spark{height:92px;width:100%;display:block;background:#0c1218;border-radius:10px;margin-top:7px}.tta-note{font-size:9px;color:var(--tta-muted);margin-top:8px;line-height:1.35}.tta-linkrow{display:flex;gap:7px;justify-content:flex-end;margin-top:9px}
      .tta-back{border:0;background:transparent;color:var(--tta-text);font-size:21px;padding:5px}.tta-search{position:sticky;top:61px;z-index:3;background:var(--tta-bg);padding:5px 0 10px}.tta-search input{width:100%;box-sizing:border-box;border-radius:12px;border:1px solid var(--tta-line);background:var(--tta-card);color:var(--tta-text);font-size:13px;padding:11px 12px;outline:none}.tta-result{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:10px;background:var(--tta-card);border:1px solid var(--tta-line);border-radius:13px;padding:10px;margin-bottom:7px}.tta-result small{color:var(--tta-muted)}
      .tta-banner{background:#14202b;border:1px solid #274055;border-radius:13px;padding:10px 11px;margin-bottom:11px;font-size:10px;line-height:1.45;color:#b9cada}.tta-banner strong{color:#fff}.tta-sync{display:flex;align-items:center;gap:8px}.tta-spinner{width:12px;height:12px;border:2px solid #ffffff33;border-top-color:#fff;border-radius:50%;animation:tta-spin .8s linear infinite}@keyframes tta-spin{to{transform:rotate(360deg)}}
      .tta-settings label{display:block;font-size:10px;color:var(--tta-muted);margin:14px 0 5px}.tta-settings input{width:100%;box-sizing:border-box;background:var(--tta-card);border:1px solid var(--tta-line);color:var(--tta-text);border-radius:10px;padding:10px}.tta-tos{font-size:10px;line-height:1.55;color:#b4c4d4;background:#101820;border:1px solid var(--tta-line);border-radius:12px;padding:10px}.tta-toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483002;background:#1e2a35;color:#fff;border:1px solid #415467;border-radius:999px;padding:8px 12px;font-size:11px;box-shadow:0 10px 30px #0008;max-width:88vw;text-align:center}
      .tta-demo{color:var(--tta-yellow);font-size:9px;font-weight:800;margin-left:5px}.tta-customdates{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:9px 0}.tta-customdates input{width:100%;box-sizing:border-box;background:var(--tta-card);border:1px solid var(--tta-line);color:var(--tta-text);border-radius:9px;padding:8px;font-size:11px;color-scheme:dark}
      @media(max-width:380px){.tta-summary{grid-template-columns:1fr 1fr}.tta-stat.main{grid-column:1/-1}.tta-itemtop{grid-template-columns:36px minmax(0,1fr) auto}.tta-thumb{width:36px;height:36px}.tta-content{padding:10px}}
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
    const w=620, padL=42,padR=10,padT=10,padB=23, innerW=w-padL-padR,innerH=h-padT-padB;
    let min=Math.min(0,...series.map(x=>x.v)),max=Math.max(0,...series.map(x=>x.v)); if(max===min){max+=1;min-=1}
    const y=v=>padT+(max-v)/(max-min)*innerH; const zero=y(0); const gap=innerW/series.length; const bw=Math.max(3,Math.min(22,gap*.62));
    const grid=[0,.25,.5,.75,1].map(p=>{const yy=padT+p*innerH;const val=max-p*(max-min);return `<line class="tta-grid" x1="${padL}" y1="${yy}" x2="${w-padR}" y2="${yy}"/><text class="tta-axis" x="3" y="${yy+3}">${esc(money(val,true))}</text>`}).join('');
    const bars=series.map((p,i)=>{const cx=padL+gap*i+gap/2;const yy=y(p.v);const top=Math.min(yy,zero);const bh=Math.max(1,Math.abs(zero-yy));return `<rect class="${p.v>=0?'tta-bar-pos':'tta-bar-neg'}" x="${cx-bw/2}" y="${top}" width="${bw}" height="${bh}" rx="2"><title>${dateStr(p.t)}: ${money(p.v)}</title></rect>`}).join('');
    const labels=series.map((p,i)=>{if(series.length>10 && i%Math.ceil(series.length/6)!==0 && i!==series.length-1)return''; const d=new Date(p.t*1000);const lab=state.granularity==='month'?d.toLocaleDateString(undefined,{month:'short'}):d.toLocaleDateString(undefined,{month:'short',day:'numeric'});const x=padL+gap*i+gap/2;return `<text class="tta-axis" text-anchor="middle" x="${x}" y="${h-6}">${esc(lab)}</text>`}).join('');
    return `<svg class="tta-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${grid}<line class="tta-zero" x1="${padL}" y1="${zero}" x2="${w-padR}" y2="${zero}"/>${bars}${labels}</svg>`;
  }

  function header(title, sub, back=false) {
    return `<div class="tta-header">${back?'<button class="tta-back" data-act="back">‹</button>':''}<div class="tta-brand"><div class="tta-mark">📈</div><div><div class="tta-title">${esc(title)}${state.demo?'<span class="tta-demo">DEMO</span>':''}</div><div class="tta-sub">${esc(sub)}</div></div></div>${!back?'<button class="tta-iconbtn" data-act="settings">⚙</button>':''}<button class="tta-iconbtn" data-act="close">×</button></div>`;
  }

  function dashboardHtml() {
    const s=overall(), tracked=effectiveTracked(), range=dateRange();
    const periodLabel = state.dateMode==='all'?'All available history':`${dateStr(range.from)} – ${dateStr(Math.min(range.to,nowSec()))}`;
    return `${header('Trade Analyzer', `v${VERSION} · FIFO realized profit`)}<div class="tta-content">
      ${!hasInjectedKey()?`<div class="tta-banner"><strong>Preview mode.</strong> Torn PDA has not injected a Log-capable key into this copy, so sample transactions are shown. When installed in Torn PDA, assign this userscript a custom API key that includes <strong>User → Log</strong>; the key and analyzed data stay on your device.</div>`:''}
      <div class="tta-period"><div><small>Date period</small><br><strong>${esc(periodLabel)}</strong></div><button class="tta-btn secondary" data-act="sync" ${state.syncing?'disabled':''}>${state.syncing?'<span class="tta-sync"><span class="tta-spinner"></span>Syncing</span>':'↻ Sync'}</button></div>
      ${state.syncProgress?`<div class="tta-banner">${esc(state.syncProgress)} ${state.syncing?'<button class="tta-btn danger" data-act="cancelSync" style="float:right;padding:5px 8px">Stop</button>':''}</div>`:''}
      <div class="tta-chips">${[['7d','7 days'],['30d','30 days'],['month','This month'],['all','All'],['custom','Custom']].map(([k,l])=>`<button class="tta-chip ${state.dateMode===k?'active':''}" data-date="${k}">${l}</button>`).join('')}</div>
      ${state.dateMode==='custom'?`<div class="tta-customdates"><input type="date" data-custom="from" value="${esc(state.customFrom)}"><input type="date" data-custom="to" value="${esc(state.customTo)}"></div>`:''}
      <div class="tta-summary"><div class="tta-stat main"><label>Realized profit</label><b class="${s.profit>=0?'pos':'neg'}">${money(s.profit)}</b></div><div class="tta-stat"><label>Bought</label><b>${qty(s.bought)}</b></div><div class="tta-stat"><label>Sold</label><b>${qty(s.sold)}</b></div></div>
      <div class="tta-chartcard"><div class="tta-charthead"><h3>Profit earned</h3><div class="tta-seg">${['day','week','month'].map(g=>`<button class="${state.granularity===g?'active':''}" data-gran="${g}">${g[0].toUpperCase()+g.slice(1)}</button>`).join('')}</div></div>${chartSvg(profitSeries())}</div>
      <div class="tta-sectionhead"><h3>Tracked items · ${tracked.length}</h3><button class="tta-btn" data-act="addItem">＋ Add item</button></div>
      ${tracked.length?tracked.map(itemCard).join(''):`<div class="tta-empty">No tracked items yet.<br><button class="tta-btn" data-act="addItem" style="margin-top:10px">Add your first item</button></div>`}
    </div>`;
  }

  function itemCard(item) {
    const s=summaryFor(item.id), exp=Number(state.expanded)===Number(item.id), series=profitSeries(item.id);
    const src=s.sources.length?s.sources.slice(0,3).join(' · '):'No purchases in selected period';
    const avgBuy=s.bought?s.buySpend/s.bought:0, avgSell=s.sold?s.sellRevenue/s.sold:0;
    return `<div class="tta-item ${exp?'expanded':''}" data-item="${item.id}"><div class="tta-itemtop" data-act="toggleItem" data-id="${item.id}"><img class="tta-thumb" src="${esc(item.image||'')}" onerror="this.style.visibility='hidden'"><div><div class="tta-itemname">${esc(item.name)}</div><div class="tta-source">${esc(src)}</div></div><div><div class="tta-profit ${s.profit>=0?'pos':'neg'}">${money(s.profit,true)}</div><div class="tta-chevron">${exp?'▲ details':'▼ details'}</div></div></div><div class="tta-metrics"><div class="tta-metric"><small>Bought</small><b>${qty(s.bought)}</b></div><div class="tta-metric"><small>Sold</small><b>${qty(s.sold)}</b></div><div class="tta-metric"><small>Profit</small><b class="${s.profit>=0?'pos':'neg'}">${money(s.profit,true)}</b></div></div><div class="tta-accordion"><div class="tta-minirow"><div class="tta-ministat"><small>Avg buy</small><b>${money(avgBuy,true)}</b></div><div class="tta-ministat"><small>Avg sell</small><b>${money(avgSell,true)}</b></div><div class="tta-ministat"><small>Inventory</small><b>${qty(s.remainingQty)}</b></div></div><div class="tta-charthead"><h3>${esc(item.name)} profit</h3><small style="color:var(--tta-muted)">${s.events.length} events</small></div>${chartSvg(series,92)}<div class="tta-note">Profit uses FIFO: each sale is matched against your oldest recorded purchases. ${s.unmatched?`⚠ ${qty(s.unmatched)} sold item(s) have no earlier recorded purchase cost, so those units are excluded from realized profit.`:'All sold units in this period have recorded cost basis.'}</div>${!state.demo?`<div class="tta-linkrow"><button class="tta-btn danger" data-act="removeItem" data-id="${item.id}">Remove</button></div>`:''}</div></div>`;
  }

  function addItemHtml() {
    const q=state.search.trim().toLowerCase();
    const results=(state.catalog||[]).filter(x=>!state.tracked.some(t=>Number(t.id)===Number(x.id)) && (!q || x.name.toLowerCase().includes(q) || String(x.id)===q)).slice(0,60);
    return `${header('Add item','Search Torn item catalog',true)}<div class="tta-content"><div class="tta-search"><input id="tta-search" placeholder="Search item name or ID…" value="${esc(state.search)}" autocomplete="off"></div>${!hasInjectedKey()?'<div class="tta-banner"><strong>Catalog preview:</strong> sample search results are available below. With the Torn PDA key attached, the full current Torn item catalog loads from the API.</div>':''}${results.length?results.map(x=>`<div class="tta-result"><img class="tta-thumb" src="${esc(x.image||'')}" onerror="this.style.visibility='hidden'"><div><div class="tta-itemname">${esc(x.name)}</div><small>#${x.id} · ${esc(x.type||'Item')}</small></div><button class="tta-btn" data-act="confirmAdd" data-id="${x.id}">Add</button></div>`).join(''):'<div class="tta-empty">No matching items.</div>'}</div>`;
  }

  function settingsHtml() {
    const when=state.sync.lastSync?new Date(state.sync.lastSync*1000).toLocaleString():'Never';
    return `${header('Settings','Storage, API access & reset',true)}<div class="tta-content tta-settings"><div class="tta-tos"><strong>Privacy / Torn API use</strong><br>Storage: only locally in this browser/Torn PDA WebView.<br>Sharing: nobody; the script sends data only to Torn's official API.<br>Purpose: personal statistical analysis of selected item purchases and sales.<br>Key: supplied by Torn PDA at runtime; never uploaded to GitHub or another server.<br>Required access: public Torn item/log-type endpoints plus <strong>User → Log</strong> (currently a Full/custom-key selection).</div><label>Last successful sync</label><div class="tta-banner">${esc(when)}${state.sync.firstSyncComplete?' · Historical backfill completed':''}</div><label>Local transaction records</label><div class="tta-banner">${qty(state.transactions.length)} normalized item transaction entries. Raw Torn logs are not retained.</div><button class="tta-btn secondary" data-act="refreshCatalog">Refresh Torn item catalog</button> <button class="tta-btn danger" data-act="resetData">Reset analyzer data</button></div>`;
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
