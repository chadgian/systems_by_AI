from pathlib import Path

p=Path('torn-trade-analyzer.user.js')
s=p.read_text()
assert '// @version      0.1.8' in s
assert "const VERSION = '0.1.8';" in s

s=s.replace('// @version      0.1.8','// @version      0.1.9',1)
s=s.replace("const VERSION = '0.1.8';","const VERSION = '0.1.9';",1)
s=s.replace('Fast, period-aware Torn trade analytics with cached FIFO calculations, responsive search/sort/pins, and progressive loading. Data stays on-device.','Fast, period-aware Torn trade analytics with cached FIFO calculations, hide/pin/search/sort controls, and progressive loading. Data stays on-device.',1)

old="    pinnedIds: load('pinnedIds', []),\n    itemSearch: load('itemSearch', ''),"
new="    pinnedIds: load('pinnedIds', []),\n    hiddenIds: load('hiddenIds', []),\n    itemSearch: load('itemSearch', ''),"
assert old in s
s=s.replace(old,new,1)

old="    const pinned=new Set((state.pinnedIds||[]).map(Number));\n    const idx=ensureTxIndex();\n    const rows=effectiveTracked()\n      .filter(item=>!q || item.name.toLowerCase().includes(q) || String(item.id).includes(q))"
new="    const pinned=new Set((state.pinnedIds||[]).map(Number));\n    const hidden=new Set((state.hiddenIds||[]).map(Number));\n    const idx=ensureTxIndex();\n    const rows=effectiveTracked()\n      .filter(item=>!hidden.has(Number(item.id)) && (!q || item.name.toLowerCase().includes(q) || String(item.id).includes(q)))"
assert old in s
s=s.replace(old,new,1)

old="<div class=\"tta-profitbox\"><button class=\"tta-pin ${pinned?'active':''}\" data-act=\"togglePin\" data-id=\"${item.id}\" aria-pressed=\"${pinned?'true':'false'}\" aria-label=\"${pinned?'Unpin':'Pin'} ${esc(item.name)}\" title=\"${pinned?'Unpin item':'Pin item to top'}\">${pinned?'📌':'☆'}</button><div class=\"tta-profit ${s.profit>=0?'pos':'neg'}\">"
new="<div class=\"tta-profitbox\"><div class=\"tta-cardactions\"><button class=\"tta-pin ${pinned?'active':''}\" data-act=\"togglePin\" data-id=\"${item.id}\" aria-pressed=\"${pinned?'true':'false'}\" aria-label=\"${pinned?'Unpin':'Pin'} ${esc(item.name)}\" title=\"${pinned?'Unpin item':'Pin item to top'}\">${pinned?'📌':'☆'}</button><button class=\"tta-hideitem\" data-act=\"hideItem\" data-id=\"${item.id}\" aria-label=\"Hide ${esc(item.name)}\" title=\"Hide item\">🙈</button></div><div class=\"tta-profit ${s.profit>=0?'pos':'neg'}\">"
assert old in s
s=s.replace(old,new,1)

css_anchor=".tta-pin.active{background:#2a2513;border-color:#71632e;color:var(--tta-yellow)!important}.tta-listmeta"
css_new=".tta-pin.active{background:#2a2513;border-color:#71632e;color:var(--tta-yellow)!important}.tta-cardactions{display:flex;justify-content:flex-end;gap:5px;margin-bottom:4px}.tta-cardactions .tta-pin{margin:0}.tta-hideitem{display:grid;place-items:center;width:31px;height:31px;min-width:31px;min-height:31px;padding:0;border:1px solid var(--tta-line);border-radius:9px;background:#15151b;color:var(--tta-muted)!important;font-size:14px;line-height:1}.tta-hideitem:active{background:#2b1e23;border-color:#76505b}.tta-hiddenlist{display:grid;gap:7px;margin-top:7px}.tta-hiddenrow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;background:var(--tta-card);border:1px solid var(--tta-line);border-radius:10px;padding:8px 9px}.tta-hiddenrow span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--tta-text);font-size:11px}.tta-hiddenrow .tta-btn{min-height:32px;padding:6px 9px}.tta-listmeta"
assert css_anchor in s
s=s.replace(css_anchor,css_new,1)

old="    const masked=state.apiKey?'••••••••••••••••':'';\n    return `${header('Settings','Storage, API access & reset',true)}"
new="    const masked=state.apiKey?'••••••••••••••••':'';\n    const hiddenIds=[...new Set((state.hiddenIds||[]).map(Number).filter(x=>x>0))];\n    const hiddenItems=hiddenIds.map(catalogItem).sort((a,b)=>a.name.localeCompare(b.name)||a.id-b.id);\n    const hiddenHtml=hiddenItems.length?`<div class=\"tta-hiddenlist\">${hiddenItems.map(x=>`<div class=\"tta-hiddenrow\"><span>${esc(x.name)} <small>#${x.id}</small></span><button class=\"tta-btn secondary\" data-act=\"restoreItem\" data-id=\"${x.id}\">Restore</button></div>`).join('')}</div><div class=\"tta-settings-actions\"><button class=\"tta-btn secondary\" data-act=\"restoreAllItems\">Restore all hidden items</button></div>`:'<div class=\"tta-banner\">No hidden items.</div>';\n    return `${header('Settings','Storage, API access & reset',true)}"
assert old in s
s=s.replace(old,new,1)

old="<label>Local data</label><div class=\"tta-banner\">${qty(state.transactions.length)} normalized transaction entries · ${qty(state.catalog.length)} Torn items cached. Raw Torn logs are not retained.${state.sync.diagnostics?`<br>Last scan: ${qty(state.sync.diagnostics.rawRows||0)} raw logs · ${qty(state.sync.diagnostics.pages||0)} pages · ${qty(state.sync.diagnostics.logTypes||0)} candidate log types.${state.sync.diagnostics.periodFrom?`<br>Period scanned: ${esc(dateStr(state.sync.diagnostics.periodFrom))} – ${esc(dateStr(Math.min(state.sync.diagnostics.periodTo||nowSec(),nowSec())))}`:'<br>Period scanned: all available history.'}`:''}</div><div class=\"tta-settings-actions\">"
new="<label>Local data</label><div class=\"tta-banner\">${qty(state.transactions.length)} normalized transaction entries · ${qty(state.catalog.length)} Torn items cached. Raw Torn logs are not retained.${state.sync.diagnostics?`<br>Last scan: ${qty(state.sync.diagnostics.rawRows||0)} raw logs · ${qty(state.sync.diagnostics.pages||0)} pages · ${qty(state.sync.diagnostics.logTypes||0)} candidate log types.${state.sync.diagnostics.periodFrom?`<br>Period scanned: ${esc(dateStr(state.sync.diagnostics.periodFrom))} – ${esc(dateStr(Math.min(state.sync.diagnostics.periodTo||nowSec(),nowSec())))}`:'<br>Period scanned: all available history.'}`:''}</div><label>Hidden items · ${qty(hiddenItems.length)}</label>${hiddenHtml}<div class=\"tta-settings-actions\">"
assert old in s
s=s.replace(old,new,1)

old="      else if(act==='togglePin'){\n        const id=Number(el.dataset.id),pins=new Set((state.pinnedIds||[]).map(Number));if(pins.has(id))pins.delete(id);else pins.add(id);state.pinnedIds=[...pins];save('pinnedIds',state.pinnedIds);renderItemList();\n      }\n      else if(act==='cycleSort')"
new="      else if(act==='togglePin'){\n        const id=Number(el.dataset.id),pins=new Set((state.pinnedIds||[]).map(Number));if(pins.has(id))pins.delete(id);else pins.add(id);state.pinnedIds=[...pins];save('pinnedIds',state.pinnedIds);renderItemList();\n      }\n      else if(act==='hideItem'){\n        const id=Number(el.dataset.id),hidden=new Set((state.hiddenIds||[]).map(Number));hidden.add(id);state.hiddenIds=[...hidden];save('hiddenIds',state.hiddenIds);if(Number(state.expanded)===id)state.expanded=null;renderItemList();toast(`${catalogItem(id).name} hidden. Restore it from Settings.`);\n      }\n      else if(act==='restoreItem'){\n        const id=Number(el.dataset.id);state.hiddenIds=(state.hiddenIds||[]).map(Number).filter(x=>x!==id);save('hiddenIds',state.hiddenIds);render();toast(`${catalogItem(id).name} restored.`);\n      }\n      else if(act==='restoreAllItems'){\n        state.hiddenIds=[];save('hiddenIds',[]);render();toast('All hidden items restored.');\n      }\n      else if(act==='cycleSort')"
assert old in s
s=s.replace(old,new,1)

old="        ['tracked','transactions','sync','pinnedIds','itemSearch','sortMode'].forEach(k=>localStorage.removeItem(NS+k));state.tracked=[];state.transactions=[];state.pinnedIds=[];state.itemSearch='';state.sortMode='recent';"
new="        ['tracked','transactions','sync','pinnedIds','hiddenIds','itemSearch','sortMode'].forEach(k=>localStorage.removeItem(NS+k));state.tracked=[];state.transactions=[];state.pinnedIds=[];state.hiddenIds=[];state.itemSearch='';state.sortMode='recent';"
assert old in s
s=s.replace(old,new,1)

p.write_text(s)
