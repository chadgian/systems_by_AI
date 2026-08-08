from pathlib import Path

p=Path('torn-trade-analyzer.user.js')
s=p.read_text()
assert '// @version      0.1.11' in s
assert "const VERSION = '0.1.11';" in s
s=s.replace('// @version      0.1.11','// @version      0.1.12',1)
s=s.replace("const VERSION = '0.1.11';","const VERSION = '0.1.12';",1)
s=s.replace('Fast Torn trade analytics with authoritative player trades, market-value cash allocation, cached FIFO calculations, item details, and progressive loading. Data stays on-device.','Fast Torn trade analytics with minimizable background sync, authoritative player trades, market-value allocation, cached FIFO, item details, and progressive loading. Data stays on-device.',1)

old="""      #tta-fab .dot{width:9px;height:9px;flex:0 0 9px;border-radius:50%;background:var(--tta-green);box-shadow:0 0 14px var(--tta-green)}"""
new="""      #tta-fab .dot{width:9px;height:9px;flex:0 0 9px;border-radius:50%;background:var(--tta-green);box-shadow:0 0 14px var(--tta-green)}
      #tta-fab.syncing{border-color:#ff9aa8;background:linear-gradient(135deg,#5d2931,#7b333e);color:#ffe9ec;box-shadow:0 12px 35px #0009,0 0 18px #ff859655}
      #tta-fab .tta-fabspinner{width:14px;height:14px;flex:0 0 14px;border:2px solid #ffccd244;border-top-color:#ffb0ba;border-right-color:#ffb0ba;border-radius:50%;animation:tta-spin .78s linear infinite}"""
assert old in s
s=s.replace(old,new,1)

old="""      .tta-loadingactions{display:flex;justify-content:center;margin-top:5px}"""
new="""      .tta-loadingactions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:5px}"""
assert old in s
s=s.replace(old,new,1)

anchor="""  function mount() {
    injectCss();"""
insert="""  function updateFabState() {
    const fab=document.getElementById('tta-fab');if(!fab)return;
    const syncing=!!state.syncing;
    fab.classList.toggle('syncing',syncing);
    fab.setAttribute('aria-label',syncing?'Trade Analytics syncing':'Trade Analytics');
    fab.title=syncing?'Trade history sync is running · tap to reopen':'Open Trade Analytics';
    fab.innerHTML=syncing?'<span class=\"tta-fabspinner\" aria-hidden=\"true\"></span><span>Syncing…</span>':'<span class=\"dot\"></span><span>Trade Analytics</span>';
    fab.style.display=state.open?'none':'inline-flex';
    requestAnimationFrame(()=>applyFabPosition(fab));
  }

  function mount() {
    injectCss();"""
assert anchor in s
s=s.replace(anchor,insert,1)

old="""    if (!document.getElementById('tta-root')) {
      const root = document.createElement('div'); root.id = 'tta-root'; document.body.appendChild(root);
    }
    render();"""
new="""    if (!document.getElementById('tta-root')) {
      const root = document.createElement('div'); root.id = 'tta-root'; document.body.appendChild(root);
    }
    updateFabState();
    render();"""
assert old in s
s=s.replace(old,new,1)

old="""    const fab=document.getElementById('tta-fab');if(fab)fab.style.display=state.open?'none':'inline-flex';
    if(!state.open){root.classList.remove('show');root.setAttribute('aria-hidden','true');return;}"""
new="""    updateFabState();
    if(!state.open){root.classList.remove('show');root.setAttribute('aria-hidden','true');return;}"""
assert old in s
s=s.replace(old,new,1)

old="""  function loadingHtml() {
    const b=state.busy||{};
    return `<div id=\"tta-loading\" class=\"tta-loading ${b.active?'show':''}\" role=\"status\" aria-live=\"polite\" aria-hidden=\"${b.active?'false':'true'}\"><div class=\"tta-loadingcard\"><div class=\"tta-loadicon\"><span class=\"tta-spinner xl\"></span></div><div id=\"tta-loading-title\" class=\"tta-loadingtitle\">${esc(b.title||'Working…')}</div><div id=\"tta-loading-detail\" class=\"tta-loadingdetail\">${esc(b.detail||'Preparing your data…')}</div><div class=\"tta-loadingbar\"><span></span></div><div class=\"tta-loadingactions\"><button id=\"tta-loading-stop\" class=\"tta-btn danger\" data-act=\"cancelSync\" ${b.cancellable?'':'hidden'}>Stop sync</button></div><div class=\"tta-loadinghint\">The analyzer stays on this device. You can stop a history scan safely.</div></div></div>`;
  }"""
new="""  function loadingHtml() {
    const b=state.busy||{};
    return `<div id=\"tta-loading\" class=\"tta-loading ${b.active?'show':''}\" role=\"status\" aria-live=\"polite\" aria-hidden=\"${b.active?'false':'true'}\"><div class=\"tta-loadingcard\"><div class=\"tta-loadicon\"><span class=\"tta-spinner xl\"></span></div><div id=\"tta-loading-title\" class=\"tta-loadingtitle\">${esc(b.title||'Working…')}</div><div id=\"tta-loading-detail\" class=\"tta-loadingdetail\">${esc(b.detail||'Preparing your data…')}</div><div class=\"tta-loadingbar\"><span></span></div><div class=\"tta-loadingactions\"><button id=\"tta-loading-minimize\" class=\"tta-btn secondary\" data-act=\"minimizeSync\" ${state.syncing?'':'hidden'}>— Minimize</button><button id=\"tta-loading-stop\" class=\"tta-btn danger\" data-act=\"cancelSync\" ${b.cancellable?'':'hidden'}>Stop sync</button></div><div class=\"tta-loadinghint\">Minimize to keep using Torn while the sync continues. You can reopen progress from the floating button at any time.</div></div></div>`;
  }"""
assert old in s
s=s.replace(old,new,1)

old="""    const title=document.getElementById('tta-loading-title'),detail=document.getElementById('tta-loading-detail'),stop=document.getElementById('tta-loading-stop');
    if(title)title.textContent=b.title||'Working…';if(detail)detail.textContent=b.detail||'Preparing your data…';if(stop)stop.hidden=!b.cancellable;"""
new="""    const title=document.getElementById('tta-loading-title'),detail=document.getElementById('tta-loading-detail'),stop=document.getElementById('tta-loading-stop'),minimize=document.getElementById('tta-loading-minimize');
    if(title)title.textContent=b.title||'Working…';if(detail)detail.textContent=b.detail||'Preparing your data…';if(stop)stop.hidden=!b.cancellable;if(minimize)minimize.hidden=!state.syncing;"""
assert old in s
s=s.replace(old,new,1)

old="""      if(act==='close'){state.open=false;setBusy(false);render();}
      else if(act==='back'){state.view='dashboard';state.search='';render();}"""
new="""      if(act==='close'){state.open=false;if(!state.syncing)setBusy(false);render();}
      else if(act==='minimizeSync'){state.open=false;render();}
      else if(act==='back'){state.view='dashboard';state.search='';render();}"""
assert old in s
s=s.replace(old,new,1)

old="""    state.syncing=true;state.syncCancel=false;setSyncProgress(`Preparing historical scan for ${periodText}…`);setBusy(true,'Syncing trade history',state.syncProgress,true);"""
new="""    state.syncing=true;state.syncCancel=false;updateFabState();setSyncProgress(`Preparing historical scan for ${periodText}…`);setBusy(true,'Syncing trade history',state.syncProgress,true);"""
assert old in s
s=s.replace(old,new,1)

old="""    finally{state.syncing=false;setBusy(false);render();}"""
new="""    finally{state.syncing=false;updateFabState();setBusy(false);render();}"""
assert old in s
s=s.replace(old,new,1)

p.write_text(s)
