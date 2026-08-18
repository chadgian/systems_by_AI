from pathlib import Path
p=Path('torn-trade-analyzer.user.js')
s=p.read_text()
assert '// @version      0.1.18' in s
assert "const VERSION = '0.1.18';" in s
s=s.replace('// @version      0.1.18','// @version      0.1.19',1)
s=s.replace("const VERSION = '0.1.18';","const VERSION = '0.1.19';",1)
s=s.replace('Fast Torn trade analytics with acquisition-date profit attribution, a FIFO ledger, sortable/filterable history, safe incremental sync, and cached analytics. Data stays on-device.',
            'Fast Torn trade analytics with interactive exact-value profit charts, acquisition-date attribution, a FIFO ledger, incremental sync, and cached analytics. Data stays on-device.',1)

css_old="""      .tta-chartcard{background:linear-gradient(180deg,#151f2a,#10171f);border:1px solid var(--tta-line);border-radius:16px;padding:13px 11px 11px;margin-bottom:14px;overflow:hidden}.tta-charthead{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}.tta-charthead h3{margin:0;color:var(--tta-text);font-size:13px;line-height:1.3}.tta-charthead small{color:var(--tta-muted)!important;font-size:10px}.tta-seg{display:flex;align-items:center;justify-content:center;background:#090e14;border:1px solid var(--tta-line);border-radius:10px;padding:2px}.tta-seg button{display:inline-flex;align-items:center;justify-content:center;min-height:30px;border:0;background:transparent;color:var(--tta-muted)!important;font-size:10px;font-weight:800;padding:6px 8px;border-radius:7px}.tta-seg button.active{background:var(--tta-soft);color:var(--tta-text)!important}.tta-svg{width:100%;height:160px;display:block;overflow:visible}.tta-axis{fill:#d6e1eb!important;color:#d6e1eb!important;font-size:10px;font-weight:650;paint-order:stroke;stroke:#10171f;stroke-width:1.5px;stroke-linejoin:round}.tta-zero{stroke:#7c91a4;stroke-width:1.25}.tta-bar-pos{fill:var(--tta-green)}.tta-bar-neg{fill:var(--tta-red)}.tta-grid{stroke:#344657;stroke-width:1}.tta-empty{min-height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;color:var(--tta-muted);font-size:12px;line-height:1.5;padding:18px}"""
css_new="""      .tta-chartcard{background:linear-gradient(180deg,#151f2a,#10171f);border:1px solid var(--tta-line);border-radius:16px;padding:13px 11px 11px;margin-bottom:14px;overflow:hidden}.tta-charthead{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}.tta-charthead h3{margin:0;color:var(--tta-text);font-size:13px;line-height:1.3}.tta-charthead small{color:var(--tta-muted)!important;font-size:10px}.tta-seg{display:flex;align-items:center;justify-content:center;background:#090e14;border:1px solid var(--tta-line);border-radius:10px;padding:2px}.tta-seg button{display:inline-flex;align-items:center;justify-content:center;min-height:30px;border:0;background:transparent;color:var(--tta-muted)!important;font-size:10px;font-weight:800;padding:6px 8px;border-radius:7px}.tta-seg button.active{background:var(--tta-soft);color:var(--tta-text)!important}.tta-chartinteractive{position:relative;touch-action:manipulation}.tta-svg{width:100%;height:160px;display:block;overflow:visible}.tta-axis{fill:#d6e1eb!important;color:#d6e1eb!important;font-size:10px;font-weight:650;paint-order:stroke;stroke:#10171f;stroke-width:1.5px;stroke-linejoin:round}.tta-zero{stroke:#7c91a4;stroke-width:1.25}.tta-bar-pos{fill:var(--tta-green)}.tta-bar-neg{fill:var(--tta-red)}.tta-profitbar{cursor:pointer;outline:none;transition:opacity .12s ease,filter .12s ease}.tta-profitbar:hover,.tta-profitbar:focus,.tta-profitbar.active{opacity:.78;filter:brightness(1.18)}.tta-charttooltip{position:absolute;z-index:5;display:none;pointer-events:none;min-width:116px;max-width:190px;padding:8px 10px;border:1px solid #4a6073;border-radius:10px;background:#091119f2;color:var(--tta-text);box-shadow:0 8px 24px #0009;text-align:center;transform:translate(-50%,-100%);font-variant-numeric:tabular-nums}.tta-charttooltip.show{display:block}.tta-charttooltip strong{display:block;font-size:13px;font-weight:900;line-height:1.2}.tta-charttooltip small{display:block;margin-top:3px;color:var(--tta-muted);font-size:9px;line-height:1.3}.tta-charttooltip.pos strong{color:var(--tta-green)}.tta-charttooltip.neg strong{color:var(--tta-red)}.tta-grid{stroke:#344657;stroke-width:1}.tta-empty{min-height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;color:var(--tta-muted);font-size:12px;line-height:1.5;padding:18px}"""
assert css_old in s
s=s.replace(css_old,css_new,1)

old="""  function chartSvg(series, h=160) {
    if (!series.length) return '<div class=\"tta-empty\">No realized sales profit in this period yet.</div>';
    const w=360, padL=52,padR=8,padT=10,padB=25, innerW=w-padL-padR,innerH=h-padT-padB;
    let min=Math.min(0,...series.map(x=>x.v)),max=Math.max(0,...series.map(x=>x.v)); if(max===min){max+=1;min-=1}
    const y=v=>padT+(max-v)/(max-min)*innerH; const zero=y(0); const gap=innerW/series.length; const bw=Math.max(3,Math.min(22,gap*.62));
    const grid=[0,.25,.5,.75,1].map(p=>{const yy=padT+p*innerH;const val=max-p*(max-min);return `<line class=\"tta-grid\" x1=\"${padL}\" y1=\"${yy}\" x2=\"${w-padR}\" y2=\"${yy}\"/><text class=\"tta-axis\" x=\"3\" y=\"${yy+3}\">${esc(money(val,true))}</text>`}).join('');
    const bars=series.map((p,i)=>{const cx=padL+gap*i+gap/2;const yy=y(p.v);const top=Math.min(yy,zero);const bh=Math.max(1,Math.abs(zero-yy));return `<rect class=\"${p.v>=0?'tta-bar-pos':'tta-bar-neg'}\" x=\"${cx-bw/2}\" y=\"${top}\" width=\"${bw}\" height=\"${bh}\" rx=\"2\"><title>${dateStr(p.t)}: ${money(p.v)}</title></rect>`}).join('');
    const labels=series.map((p,i)=>{if(series.length>10 && i%Math.ceil(series.length/6)!==0 && i!==series.length-1)return''; const d=new Date(p.t*1000);const lab=state.granularity==='month'?d.toLocaleDateString(undefined,{month:'short'}):d.toLocaleDateString(undefined,{month:'short',day:'numeric'});const x=padL+gap*i+gap/2;return `<text class=\"tta-axis\" text-anchor=\"middle\" x=\"${x}\" y=\"${h-6}\">${esc(lab)}</text>`}).join('');
    return `<svg class=\"tta-svg\" viewBox=\"0 0 ${w} ${h}\" preserveAspectRatio=\"xMidYMid meet\" role=\"img\" aria-label=\"Profit chart\">${grid}<line class=\"tta-zero\" x1=\"${padL}\" y1=\"${zero}\" x2=\"${w-padR}\" y2=\"${zero}\"/>${bars}${labels}</svg>`;
  }"""
new="""  function chartBucketLabel(ts) {
    const d=new Date((Number(ts)||0)*1000);
    if(state.granularity==='month')return d.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    if(state.granularity==='week')return `Week of ${dateStr(ts)}`;
    return dateStr(ts);
  }
  function hideChartTooltip(wrap,force=false) {
    if(!wrap)return;const tip=wrap.querySelector('.tta-charttooltip');if(!tip)return;
    if(!force&&tip.dataset.pinned==='1')return;tip.classList.remove('show','pos','neg');tip.dataset.pinned='0';wrap.querySelectorAll('.tta-profitbar.active').forEach(x=>x.classList.remove('active'));
  }
  function showChartTooltip(bar,pinned=false) {
    const wrap=bar?.closest?.('.tta-chartinteractive'),tip=wrap?.querySelector('.tta-charttooltip');if(!wrap||!tip)return;
    wrap.querySelectorAll('.tta-profitbar.active').forEach(x=>x.classList.remove('active'));bar.classList.add('active');
    const value=Number(bar.dataset.profit)||0,ts=Number(bar.dataset.time)||0;
    tip.innerHTML=`<strong>${esc(money(value))}</strong><small>${esc(chartBucketLabel(ts))} · acquisition date</small>`;
    tip.classList.remove('pos','neg');tip.classList.add(value>=0?'pos':'neg','show');tip.dataset.pinned=pinned?'1':'0';
    const wr=wrap.getBoundingClientRect(),br=bar.getBoundingClientRect();
    requestAnimationFrame(()=>{const tw=tip.offsetWidth||120,th=tip.offsetHeight||48;let left=br.left-wr.left+br.width/2;left=Math.max(tw/2+4,Math.min(wr.width-tw/2-4,left));let top=br.top-wr.top-6;if(top<th+4)top=br.bottom-wr.top+th+6;tip.style.left=`${left}px`;tip.style.top=`${top}px`;});
  }

  function chartSvg(series, h=160) {
    if (!series.length) return '<div class=\"tta-empty\">No realized sales profit in this period yet.</div>';
    const w=360, padL=52,padR=8,padT=10,padB=25, innerW=w-padL-padR,innerH=h-padT-padB;
    let min=Math.min(0,...series.map(x=>x.v)),max=Math.max(0,...series.map(x=>x.v)); if(max===min){max+=1;min-=1}
    const y=v=>padT+(max-v)/(max-min)*innerH; const zero=y(0); const gap=innerW/series.length; const bw=Math.max(5,Math.min(22,gap*.62));
    const grid=[0,.25,.5,.75,1].map(p=>{const yy=padT+p*innerH;const val=max-p*(max-min);return `<line class=\"tta-grid\" x1=\"${padL}\" y1=\"${yy}\" x2=\"${w-padR}\" y2=\"${yy}\"/><text class=\"tta-axis\" x=\"3\" y=\"${yy+3}\">${esc(money(val,true))}</text>`}).join('');
    const bars=series.map((p,i)=>{const cx=padL+gap*i+gap/2;const yy=y(p.v);const top=Math.min(yy,zero);const bh=Math.max(2,Math.abs(zero-yy));const label=`${chartBucketLabel(p.t)}: ${money(p.v)}`;return `<rect class=\"tta-profitbar ${p.v>=0?'tta-bar-pos':'tta-bar-neg'}\" data-profit=\"${Number(p.v)||0}\" data-time=\"${Number(p.t)||0}\" tabindex=\"0\" role=\"button\" aria-label=\"${esc(label)}\" x=\"${cx-bw/2}\" y=\"${top}\" width=\"${bw}\" height=\"${bh}\" rx=\"2\"><title>${esc(label)}</title></rect>`}).join('');
    const labels=series.map((p,i)=>{if(series.length>10 && i%Math.ceil(series.length/6)!==0 && i!==series.length-1)return''; const d=new Date(p.t*1000);const lab=state.granularity==='month'?d.toLocaleDateString(undefined,{month:'short'}):d.toLocaleDateString(undefined,{month:'short',day:'numeric'});const x=padL+gap*i+gap/2;return `<text class=\"tta-axis\" text-anchor=\"middle\" x=\"${x}\" y=\"${h-6}\">${esc(lab)}</text>`}).join('');
    return `<div class=\"tta-chartinteractive\"><svg class=\"tta-svg\" viewBox=\"0 0 ${w} ${h}\" preserveAspectRatio=\"xMidYMid meet\" role=\"img\" aria-label=\"Interactive profit chart; hover or tap a bar for exact profit\">${grid}<line class=\"tta-zero\" x1=\"${padL}\" y1=\"${zero}\" x2=\"${w-padR}\" y2=\"${zero}\"/>${bars}${labels}</svg><div class=\"tta-charttooltip\" role=\"status\" aria-live=\"polite\" data-pinned=\"0\"></div></div>`;
  }"""
assert old in s
s=s.replace(old,new,1)

anchor="""    root.addEventListener('input',e=>{
      const target=e.target;"""
insert="""    root.addEventListener('pointerover',e=>{const bar=e.target?.closest?.('.tta-profitbar');if(bar&&root.contains(bar))showChartTooltip(bar,false);});
    root.addEventListener('pointerout',e=>{const bar=e.target?.closest?.('.tta-profitbar');if(bar&&root.contains(bar))hideChartTooltip(bar.closest('.tta-chartinteractive'));});
    root.addEventListener('focusin',e=>{const bar=e.target?.closest?.('.tta-profitbar');if(bar&&root.contains(bar))showChartTooltip(bar,false);});
    root.addEventListener('focusout',e=>{const bar=e.target?.closest?.('.tta-profitbar');if(bar&&root.contains(bar))hideChartTooltip(bar.closest('.tta-chartinteractive'));});
    root.addEventListener('click',e=>{
      const bar=e.target?.closest?.('.tta-profitbar');
      if(bar&&root.contains(bar)){e.stopPropagation();const wrap=bar.closest('.tta-chartinteractive'),tip=wrap?.querySelector('.tta-charttooltip'),same=bar.classList.contains('active')&&tip?.dataset.pinned==='1';if(same)hideChartTooltip(wrap,true);else showChartTooltip(bar,true);return;}
      root.querySelectorAll('.tta-chartinteractive').forEach(w=>hideChartTooltip(w,true));
    });

    root.addEventListener('input',e=>{
      const target=e.target;"""
assert anchor in s
s=s.replace(anchor,insert,1)

assert '// @version      0.1.19' in s
assert 'tta-charttooltip' in s
assert 'data-profit=' in s
assert "showChartTooltip(bar,true)" in s
p.write_text(s)
