#!/usr/bin/env python3
"""Generates docs/design/V1/index.html from src/styles/tokens.css. Run from the repo root."""
import os, html as H
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
SCR = os.path.dirname(os.path.abspath(__file__))
TOKENS = open(os.path.join(ROOT, 'src/styles/tokens.css')).read()

# ---------------------------------------------------------------- CSS
UI_CSS = r"""
/* ===== components, built only from tokens ===== */
.ui{font-family:var(--font-sans);color:var(--text);font-size:var(--fs-body);line-height:var(--lh-body);-webkit-font-smoothing:antialiased;text-align:left}
.ui *,.ui *::before,.ui *::after{box-sizing:border-box}
.ui p{margin:0}
.ui a{color:inherit;text-decoration:none}
.ui a.a,.ui .status a{color:var(--accent)}
.num,.ui .mv,.ui td,.ui .stat-v,.ui .out-n,.ui .disp{font-variant-numeric:tabular-nums}
.i{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;flex:none;display:block}
.i.sm{width:16px;height:16px}
.i.lg{width:28px;height:28px}

/* buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--space-2);height:var(--control-h);min-width:var(--target-min);padding:0 var(--space-5);border-radius:var(--radius-md);font:var(--fw-semibold) var(--fs-body)/1 var(--font-sans);border:0;cursor:pointer;white-space:nowrap;text-decoration:none;transition:background-color var(--dur-fast) var(--ease-out),color var(--dur-fast) var(--ease-out)}
.btn-primary{background:var(--accent);color:var(--on-accent)}
.btn-primary:hover,.btn-primary.is-hover{background:var(--accent-hover)}
.btn-primary:active,.btn-primary.is-pressed{background:var(--accent-pressed)}
.btn-secondary{background:var(--fill);color:var(--text)}
.btn-secondary:hover,.btn-secondary.is-hover{background:var(--fill-hover)}
.btn-danger{background:var(--fill);color:var(--danger)}
.btn-danger:hover,.btn-danger.is-hover{background:var(--fill-hover)}
.btn-danger-solid{background:var(--danger);color:var(--on-danger)}
.btn-text{background:transparent;color:var(--accent);padding:0 var(--space-3)}
.btn-text:hover,.btn-text.is-hover{background:var(--accent-soft)}
.btn.is-disabled{background:var(--fill);color:var(--muted);cursor:not-allowed}
.btn-text.is-disabled{background:transparent}
.btn-block{width:100%}
.ui :focus-visible,.ui .is-focus{outline:var(--focus-ring);outline-offset:var(--focus-offset)}
.spin{animation:spin 900ms linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.icon-btn{width:var(--target-min);height:var(--target-min);border-radius:var(--radius-md);display:inline-flex;align-items:center;justify-content:center;color:var(--text);background:transparent;border:0;flex:none}
.icon-btn:hover,.icon-btn.is-hover{background:var(--fill)}
.icon-btn.muted{color:var(--muted)}

/* fields */
.field{display:flex;flex-direction:column;gap:6px;min-width:0}
.field>label,.field>.lbl{font-size:var(--fs-caption);line-height:var(--lh-caption);font-weight:var(--fw-semibold);color:var(--text)}
.input{height:var(--control-h);border-radius:var(--radius-md);background:var(--surface);border:1px solid var(--input-border);padding:0 14px;font:var(--fs-body)/1 var(--font-sans);color:var(--text);display:flex;align-items:center;gap:var(--space-2);min-width:0}
.input .v{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.input .show{margin-right:-10px;height:40px;padding:0 10px;font-size:var(--fs-caption);font-weight:var(--fw-semibold);color:var(--accent);display:flex;align-items:center;border-radius:var(--radius-sm)}
.input.is-hover{border-color:var(--muted)}
.input.is-focus{border-color:var(--focus);box-shadow:0 0 0 1px var(--focus);outline:0}
.input.is-error{border-color:var(--danger);box-shadow:0 0 0 1px var(--danger)}
.input.is-disabled{background:var(--fill);border-color:var(--border);color:var(--muted)}
.caret{width:1.5px;height:20px;background:var(--text);display:inline-block}
.help{font-size:var(--fs-caption);line-height:var(--lh-caption);color:var(--muted)}
.err{font-size:var(--fs-caption);line-height:var(--lh-caption);color:var(--danger);display:flex;gap:6px;align-items:flex-start}
.err .i{margin-top:1px}

/* segmented control */
.seg{display:inline-flex;background:var(--track);border-radius:var(--radius-md);padding:3px;height:var(--control-h);gap:2px}
.seg>span{flex:1;min-width:72px;padding:0 var(--space-4);display:flex;align-items:center;justify-content:center;border-radius:9px;font-size:var(--fs-body);font-weight:var(--fw-medium);color:var(--muted);white-space:nowrap}
.seg>span.on{background:var(--raised);color:var(--text);font-weight:var(--fw-semibold);box-shadow:inset 0 0 0 1px var(--input-border)}
.seg.block{display:flex;width:100%}

/* checkbox */
.check{display:inline-flex;align-items:center;gap:10px;min-height:var(--target-min);font-size:var(--fs-body);color:var(--text);white-space:nowrap}
.check .box{width:20px;height:20px;border-radius:6px;border:2px solid var(--input-border);display:flex;align-items:center;justify-content:center;flex:none}
.check.on .box{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.check .box .i{width:14px;height:14px;stroke-width:2.5}

/* change-type labels (the only pills, P18 P24) */
.label{display:inline-flex;align-items:center;justify-content:center;height:24px;padding:0 10px;border-radius:var(--radius-full);font-size:var(--fs-caption);font-weight:var(--fw-medium);line-height:1;white-space:nowrap}
.label-feature{background:var(--accent-soft);color:var(--accent)}
.label-fix{background:var(--positive-soft);color:var(--positive)}
.label-tech{background:var(--fill);color:var(--muted)}

/* surfaces */
.card{background:var(--surface);border-radius:var(--radius-lg);padding:var(--space-4)}
.group{background:var(--surface);border-radius:var(--radius-lg);overflow:hidden}
.row{display:flex;align-items:center;gap:var(--space-3);min-height:var(--row-h);padding:0 var(--space-4);font-size:var(--fs-body);position:relative}
.row+.row::before{content:"";position:absolute;top:0;left:var(--space-4);right:0;border-top:1px solid var(--border)}
.row .k{flex:1 0 auto}
.row .v{flex:0 1 auto;color:var(--muted);text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row .chev{color:var(--muted)}
.row.link:hover,.row.is-hover{background:var(--surface-hover)}
.row.stack{flex-direction:column;align-items:stretch;gap:var(--space-2);padding-top:var(--space-3);padding-bottom:var(--space-3)}
.ui .group-t{font-size:var(--fs-body);font-weight:var(--fw-semibold);margin:var(--space-5) 0 var(--space-2);color:var(--text)}

/* ride card */
.ride{background:var(--surface);border-radius:var(--radius-lg);padding:14px var(--space-4) var(--space-4);margin-bottom:10px;display:block;color:inherit;text-decoration:none}
.ride.is-hover{background:var(--surface-hover)}
.ride-h{display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-3)}
.thumb{width:44px;height:44px;border-radius:var(--radius-md);background:var(--fill);flex:none;display:flex;align-items:center;justify-content:center}
.thumb svg{display:block;width:30px;height:30px}
.route{fill:none;stroke:var(--accent);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.ride-h .nm{flex:1;min-width:0}
.ride-h .nm b{display:block;font-size:var(--fs-body-lg);line-height:var(--lh-body-lg);font-weight:var(--fw-semibold);letter-spacing:-.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ride-h .nm span{display:block;font-size:var(--fs-caption);line-height:var(--lh-caption);color:var(--muted)}
.mgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--space-3) var(--space-2)}
.mv{font-size:var(--fs-body-lg);line-height:var(--lh-body-lg);font-weight:var(--fw-semibold);letter-spacing:-.01em;white-space:nowrap}
.u{font-size:var(--fs-caption);font-weight:var(--fw-medium);color:var(--muted);margin-left:3px;letter-spacing:0}
.mv.none{color:var(--muted);font-weight:var(--fw-medium)}
.ml{font-size:var(--fs-caption);line-height:var(--lh-caption);color:var(--muted)}
.c-dist{color:var(--m-dist)}.c-time{color:var(--m-time)}.c-speed{color:var(--m-speed)}.c-power{color:var(--m-power)}.c-hr{color:var(--m-hr)}.c-elev{color:var(--m-elev)}
.grp-h{display:flex;justify-content:space-between;align-items:baseline;gap:var(--space-3);padding:var(--space-4) 2px 10px}
.grp-h b{font-size:var(--fs-body);font-weight:var(--fw-semibold)}
.grp-h span{font-size:var(--fs-caption);color:var(--muted);font-variant-numeric:tabular-nums;text-align:right}

/* stat tiles and outcomes */
.stat{background:var(--surface);border-radius:var(--radius-lg);padding:14px var(--space-4)}
.stat-l{font-size:var(--fs-caption);line-height:var(--lh-caption);color:var(--muted)}
.stat-v{font-size:var(--fs-heading);line-height:var(--lh-heading);font-weight:var(--fw-semibold);letter-spacing:var(--tracking-heading);margin-top:2px;white-space:nowrap}
.stat-v .u{font-size:var(--fs-body)}
.out-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.out{background:var(--surface);border-radius:var(--radius-lg);padding:14px var(--space-4);min-height:92px;display:flex;flex-direction:column;justify-content:space-between}
.out-t{font-size:var(--fs-caption);line-height:var(--lh-caption);color:var(--muted)}
.out-n{font-size:var(--fs-stat);line-height:var(--lh-stat);font-weight:var(--fw-semibold);letter-spacing:var(--tracking-display)}
.out.hl{background:color-mix(in srgb,var(--accent) 12%,var(--surface))}
.out.hl .out-t{color:var(--text);font-weight:var(--fw-semibold)}
.disp{font-size:var(--fs-display);line-height:var(--lh-display);font-weight:var(--fw-semibold);letter-spacing:var(--tracking-display)}
.disp .u{font-size:var(--fs-title);font-weight:var(--fw-medium)}

/* table (desktop) */
.tbl{background:var(--surface);border-radius:var(--radius-lg);overflow:hidden}
.tbl table{width:100%;border-collapse:collapse;font-size:var(--fs-body)}
.tbl th{font-size:var(--fs-caption);line-height:var(--lh-caption);font-weight:var(--fw-semibold);color:var(--muted);text-align:right;padding:12px 8px 10px;border-bottom:1px solid var(--border);white-space:nowrap;vertical-align:bottom}
.tbl th .u{display:block;margin:0;font-weight:var(--fw-regular)}
.tbl th.l,.tbl td.l{text-align:left}
.tbl th:first-child,.tbl td:first-child{padding-left:var(--space-4)}
.tbl th:last-child,.tbl td:last-child{padding-right:var(--space-4)}
.tbl td{padding:0 8px;height:var(--table-row-h);text-align:right;border-bottom:1px solid var(--border);white-space:nowrap}
.tbl td.nm{font-weight:var(--fw-semibold);color:var(--text)}
.tbl td.dt,.tbl td.dash{color:var(--muted)}
.tbl tr.wk td{height:36px;background:var(--fill);font-size:var(--fs-caption);color:var(--muted);font-weight:var(--fw-semibold)}
.tbl tr.wk td b{color:var(--text);font-weight:var(--fw-semibold)}
.tbl tbody tr:not(.wk):hover td,.tbl tr.is-hover td{background:var(--surface-hover)}
.tbl tr.is-focus{outline:var(--focus-ring);outline-offset:-2px}
.tbl tr:last-child td{border-bottom:0}
.tbl td.fn{max-width:190px;overflow:hidden;text-overflow:ellipsis}
/* sortable headers (D-PO6): the whole header cell is a 44 px button; aria-sort on the th */
.tbl th.sort{padding:4px 2px 4px}
.tbl th.sort:first-child{padding-left:var(--space-2)}
.tbl th.sort:last-child{padding-right:var(--space-2)}
.tbl .sb{display:inline-flex;align-items:flex-end;justify-content:flex-end;gap:2px;width:100%;min-height:var(--target-min);padding:4px 6px 6px;border:0;background:transparent;border-radius:var(--radius-sm);font:inherit;color:inherit;text-align:right;cursor:pointer}
.tbl th.l .sb{justify-content:flex-start;text-align:left}
.tbl .sb .lt{display:flex;flex-direction:column}
.tbl .sb .lt{align-items:inherit}
.tbl th:not(.l) .sb .lt{align-items:flex-end}
.tbl .sb .hl,.tbl th .sb .u{display:inline-flex;align-items:center;gap:2px}
.tbl .sb .ar{width:14px;height:14px;visibility:hidden}
.tbl .sb:hover,.tbl .sb.is-hover{background:var(--fill)}
.tbl .sb:hover .ar,.tbl .sb.is-hover .ar{visibility:visible;color:var(--muted)}
.tbl th[aria-sort] .sb .ar{visibility:visible;color:inherit}
.tbl th[aria-sort] .sb .lt>span:first-child{color:var(--text)}
.tbl th[aria-sort] .sb{font-weight:var(--fw-semibold)}
.tbl th .sb .u{margin:0;font-weight:var(--fw-regular);color:var(--muted)}
/* filter bar above the desktop table */
.filters{display:flex;align-items:flex-end;gap:var(--space-3);margin-bottom:var(--space-4)}
.filters .field{flex:none}
.filters .check{margin-left:var(--space-1)}
.filters .sp{flex:1}
.input.select{justify-content:space-between;cursor:pointer}
.input.select .i{color:var(--muted)}
.input .lead-ic{color:var(--muted);margin-left:-2px}
.result{display:flex;align-items:baseline;justify-content:space-between;gap:var(--space-3);margin:0 2px var(--space-3)}

/* app shell */
.topbar{display:flex;align-items:center;height:var(--topbar-h);gap:var(--space-1);padding:0 var(--space-1)}
.topbar .ttl{font-size:var(--fs-title);line-height:var(--lh-title);font-weight:var(--fw-semibold);letter-spacing:var(--tracking-tight);flex:1;min-width:0;padding-left:var(--space-1)}
.wordmark{font-size:var(--fs-body-lg);font-weight:var(--fw-semibold);letter-spacing:var(--tracking-tight);color:var(--text)}
.side{width:var(--sidebar-w);flex:none;padding:var(--space-5) var(--space-3);display:flex;flex-direction:column;gap:2px}
.side .wordmark{padding:var(--space-2) var(--space-3) var(--space-6)}
.nav{display:flex;align-items:center;height:var(--target-min);padding:0 var(--space-3);border-radius:var(--radius-md);font-size:var(--fs-body);color:var(--text);gap:var(--space-3);text-decoration:none}
.nav .i{color:var(--muted)}
.nav:hover,.nav.is-hover{background:var(--fill)}
.nav.on{background:var(--accent-soft);font-weight:var(--fw-semibold)}
.nav.on .i{color:var(--accent)}
.side .ver{margin-top:auto;font-size:var(--fs-caption);color:var(--muted);padding:0 var(--space-3);font-variant-numeric:tabular-nums}
.drawer{position:absolute;top:0;bottom:0;left:0;width:min(var(--drawer-w),85%);background:var(--raised);box-shadow:var(--shadow-float);border-radius:0 var(--radius-xl) var(--radius-xl) 0;padding:var(--space-4) var(--space-3);display:flex;flex-direction:column;gap:2px;z-index:3}
.drawer .wordmark{padding:var(--space-3) var(--space-3) var(--space-5)}
.drawer .ver{margin-top:auto;font-size:var(--fs-caption);color:var(--muted);padding:0 var(--space-3) var(--space-4)}
.scrim{position:absolute;inset:0;background:var(--overlay);z-index:2}

/* bottom status card (P12) */
.status{position:absolute;left:var(--space-3);right:var(--space-3);bottom:var(--space-4);background:var(--raised);border-radius:var(--radius-lg);box-shadow:var(--shadow-float);display:flex;align-items:center;gap:var(--space-2);padding:6px 6px 6px var(--space-4);min-height:56px;z-index:1}
.status.static{position:relative;left:auto;right:auto;bottom:auto}
.status .dot{width:8px;height:8px;border-radius:50%;background:var(--accent);flex:none}
.status .msg{flex:1;min-width:0;font-size:var(--fs-body);line-height:var(--lh-body)}
.status .msg a{color:var(--accent);font-weight:var(--fw-semibold);text-decoration:none;white-space:nowrap}
.status.error .ic{color:var(--danger)}
.status .act{height:var(--target-min);padding:0 var(--space-2);text-decoration:none;border-radius:var(--radius-md);display:flex;align-items:center;font-weight:var(--fw-semibold);color:var(--accent);white-space:nowrap}
/* desktop: the status card sits at the bottom of the side menu, as wide as the menu (D-PO2); it no longer floats, so no shadow */
.side .status.in-side{position:relative;left:auto;right:auto;bottom:auto;width:auto;box-shadow:none;display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"ic msg x" ". act x";align-items:start;gap:0 10px;padding:12px 2px 4px 14px;margin-top:auto}
.side .status.in-side .dot{grid-area:ic;margin-top:7px}
.side .status.in-side .ic{grid-area:ic;margin-top:1px}
.side .status.in-side .msg{grid-area:msg}
.side .status.in-side .act{grid-area:act;justify-self:start;margin-left:calc(-1 * var(--space-2))}
.side .status.in-side .icon-btn{grid-area:x;margin-top:-10px}
.side .status.in-side.error{grid-template-areas:"ic msg" ". act";grid-template-columns:auto minmax(0,1fr);padding-right:var(--space-3)}
.side .status.in-side+.ver{margin-top:var(--space-3)}

/* notices, progress, skeleton, drop zone */
.notice{display:flex;gap:10px;align-items:flex-start;border-radius:var(--radius-md);padding:var(--space-3) 14px;font-size:var(--fs-body)}
.notice.danger{background:var(--danger-soft);color:var(--text)}
.notice.danger .i{color:var(--danger);margin-top:1px}
.progress{height:8px;border-radius:4px;background:var(--track);overflow:hidden}
.progress i{display:block;height:100%;background:var(--accent);border-radius:4px}
.sk{background:var(--fill);border-radius:var(--radius-sm);animation:pulse 1.6s var(--ease-in-out) infinite}
@keyframes pulse{50%{opacity:.55}}
.drop{background:var(--surface);border-radius:var(--radius-lg);padding:var(--space-8) var(--space-5);display:flex;flex-direction:column;align-items:center;text-align:center;gap:var(--space-3)}
.drop.over{background:var(--accent-soft);box-shadow:inset 0 0 0 2px var(--accent)}
.tile-ic{width:56px;height:56px;border-radius:var(--radius-lg);background:var(--fill);display:flex;align-items:center;justify-content:center;color:var(--accent)}
.drop.over .tile-ic{background:var(--surface)}
.h-screen{font-size:var(--fs-heading);line-height:var(--lh-heading);font-weight:var(--fw-semibold);letter-spacing:var(--tracking-heading);margin:0}
.h-card{font-size:var(--fs-title);line-height:var(--lh-title);font-weight:var(--fw-semibold);letter-spacing:var(--tracking-tight);margin:0}
.cap{font-size:var(--fs-caption);line-height:var(--lh-caption);color:var(--muted)}
.lead{font-size:var(--fs-body);line-height:var(--lh-body);color:var(--text)}
.a{color:var(--accent);font-weight:var(--fw-semibold);text-decoration:none}
.stack{display:flex;flex-direction:column}
.g2{gap:var(--space-2)}.g3{gap:var(--space-3)}.g4{gap:var(--space-4)}.g5{gap:var(--space-5)}.g6{gap:var(--space-6)}
.hrow{display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap}
.sp{flex:1}
.new{display:inline-flex;align-items:center;gap:6px;font-size:var(--fs-caption);font-weight:var(--fw-semibold);color:var(--accent)}
.new::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--accent)}
.chg{display:grid;grid-template-columns:84px 1fr;gap:10px var(--space-3);align-items:start}
.chg .label{justify-self:start;margin-top:-1px}
.mono-x{font-variant-numeric:tabular-nums}

/* frames */
.phone{width:360px;max-width:100%;height:740px;border-radius:36px;overflow:hidden;position:relative;box-shadow:0 0 0 6px #050608,0 0 0 7px #34373E;flex:none}
.screen{position:absolute;inset:0;background:var(--page);overflow:hidden}
.screen.flat{background:var(--bg)}
.pad{padding:var(--space-3) var(--page-margin) 0}
.sbar{height:28px;display:flex;justify-content:space-between;align-items:center;padding:0 26px;font-size:var(--fs-caption);font-weight:var(--fw-semibold);color:var(--text)}
.sbar i{display:inline-block;width:22px;height:11px;border-radius:3px;border:1.5px solid currentColor;opacity:.8}
.desk-wrap{max-width:100%;overflow-x:auto;padding:8px 8px 12px;margin:-8px -8px 0}
.desk{width:1200px;height:720px;border-radius:var(--radius-lg);overflow:hidden;position:relative;box-shadow:0 0 0 1px #34373E;display:flex;background:var(--page)}
.desk.short{height:560px}
.desk .main{flex:1;min-width:0;padding:var(--space-6) var(--space-8);position:relative}
.desk .main-h{display:flex;align-items:flex-end;gap:var(--space-3);margin-bottom:var(--space-5)}
.desk .main-h .t{flex:1;min-width:0}
.desk .main-h h1{margin:0;font-size:var(--fs-heading);line-height:var(--lh-heading);font-weight:var(--fw-semibold);letter-spacing:var(--tracking-heading)}
.desk .status{left:auto;right:var(--space-8);bottom:var(--space-6);width:420px}
.center{display:flex;align-items:center;justify-content:center}
.signin{width:100%;max-width:var(--form-max)}
@media (prefers-reduced-motion:reduce){.sk,.spin{animation:none}}
"""

DOC_CSS = r"""
/* ===== presentation page (not part of the design system) ===== */
html{scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font-sans);-webkit-font-smoothing:antialiased;font-size:16px;line-height:1.55}
*,*::before,*::after{box-sizing:border-box}
.doc{max-width:1280px;margin:0 auto;padding:56px 40px 120px}
.doc h1{font-size:56px;line-height:1.02;letter-spacing:-.035em;font-weight:600;margin:0 0 20px}
.doc .intro{font-size:18px;max-width:64ch;margin:0 0 12px}
.doc .intro2{font-size:16px;max-width:72ch;margin:0;color:var(--text)}
.toc{display:flex;flex-wrap:wrap;gap:4px 8px;margin:32px 0 0;padding:0;list-style:none}
.toc a{display:inline-flex;align-items:center;height:44px;padding:0 14px;border-radius:12px;background:var(--surface);color:var(--text);text-decoration:none;font-size:15px;font-weight:500}
.toc a:hover{background:var(--fill)}
.toc a.fb-done{box-shadow:inset 0 0 0 2px var(--positive)}
.toc a:focus-visible,.doc a:focus-visible,.doc button:focus-visible,.doc textarea:focus-visible{outline:var(--focus-ring);outline-offset:var(--focus-offset)}
section.flow{margin-top:128px}
section.flow>h2{font-size:40px;line-height:1.1;letter-spacing:-.025em;font-weight:600;margin:0 0 12px}
section.flow>p.s-intro{font-size:17px;max-width:68ch;margin:0}
.shot{margin-top:72px}
.shot-h{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin:0 0 6px}
.shot-h h3{font-size:24px;line-height:1.25;letter-spacing:-.015em;font-weight:600;margin:0}
.shot-h .sid{color:var(--accent)}
.shot-h .spr{font-size:15px;color:var(--muted)}
.notes{margin:8px 0 0;padding-left:20px;max-width:80ch;font-size:15px}
.notes li{margin:2px 0}
.frames{display:flex;flex-wrap:wrap;gap:40px 36px;align-items:flex-start;margin-top:28px}
.frames figure{margin:0;max-width:100%}
.frames figure:not(.wide){width:min(360px,100%)}
.frames figcaption{font-size:14px;color:var(--muted);margin-top:14px}
.frames figure.wide{width:100%}
.panel{border-radius:20px;padding:24px;background:var(--bg);flex:1 1 420px;min-width:0}
.panel>.ph{font-size:17px;font-weight:600;margin:0 0 16px}
.sw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.sw{border-radius:14px;overflow:hidden;background:var(--fill)}
.sw i{display:block;height:48px}
.sw b{display:block;font-size:13px;font-weight:600;padding:8px 12px 0;color:var(--text)}
.sw span{display:block;font-size:13px;padding:0 12px 10px;color:var(--muted);font-variant-numeric:tabular-nums}
.kv{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;font-size:15px;align-items:baseline}
.kv dt{font-weight:600}
.kv dd{margin:0;color:var(--text)}
.demo{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.demo-col{display:flex;flex-direction:column;gap:20px}
.demo-lbl{font-size:14px;color:var(--muted);margin:0 0 8px}
.scale-row{display:flex;align-items:baseline;gap:20px;padding:10px 0}
.scale-row .meta{width:170px;flex:none;font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums}
.boxes{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end}
.boxes .bx{display:flex;flex-direction:column;gap:6px;align-items:flex-start;font-size:13px;color:var(--muted)}
.dd{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:28px}
.dd>div{border-radius:20px;padding:24px;background:var(--surface)}
.dd h4{margin:0 0 10px;font-size:18px}
.dd ul{margin:0;padding-left:20px;font-size:15px}
.dd li{margin:4px 0}
/* feedback */
.fb-box{margin-top:24px;max-width:720px}
.fb-box label,.fb-final label,.qa-item label{display:block;font-size:14px;font-weight:600;margin:0 0 6px}
.doc textarea{width:100%;font:15px/1.5 var(--font-sans);color:var(--text);background:var(--surface);border:1px solid var(--input-border);border-radius:12px;padding:10px 14px;resize:vertical}
.doc textarea:focus{border-color:var(--focus);box-shadow:0 0 0 1px var(--focus);outline:0}
.fb-box.has-fb textarea,.qa-item.has-fb textarea{border-color:var(--positive)}
.qa{margin-top:40px;display:grid;gap:20px;max-width:820px}
.qa h3{font-size:22px;margin:0}
.qa-item .qid,.dec .qid{color:var(--accent);margin-right:8px}
.dec{background:var(--surface);border-radius:16px;padding:16px 20px}
.dec .dq{margin:0;font-size:15px;font-weight:600}
.dec .da{margin:4px 0 0;font-size:15px}
.dec a{color:var(--accent);font-weight:600;text-decoration:none}
.fb-final{max-width:820px;margin-top:20px}
.fb-actions{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}
.fb-btn{display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 20px;border-radius:12px;border:0;background:var(--accent);color:var(--on-accent);font:600 15px/1 var(--font-sans);text-decoration:none;cursor:pointer}
.fb-btn.sec{background:var(--fill);color:var(--text)}
.fb-btn[aria-disabled=true]{background:var(--fill);color:var(--muted);pointer-events:none}
.fb-count,.fb-status{font-size:15px;margin:12px 0 0}
.fb-warn{display:none;font-size:15px;margin:8px 0 0}
#fb-preview{margin-top:8px;color:var(--text)}
@media (max-width:760px){
  .doc{padding:32px 15px 96px}
  .doc h1{font-size:40px}
  section.flow{margin-top:96px}
  section.flow>h2{font-size:32px}
  .shot{margin-top:56px}
  .shot-h h3{font-size:21px}
  .frames{gap:32px}
  .panel{padding:16px;flex-basis:100%}
  .dd{grid-template-columns:1fr}
  .scale-row{flex-direction:column;gap:2px}
}
"""

# ---------------------------------------------------------------- icons
ICONS = {
 'menu': '<path d="M4 7h16M4 12h16M4 17h16"/>',
 'rides': '<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 9 9.5h6.5l3 7M9 9.5l3 7 3.5-7M7.5 6.5H10M15.5 9.5l-1-3h2"/>',
 'import': '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/>',
 'settings': '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
 'history': '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2"/>',
 'chev-r': '<path d="m9 6 6 6-6 6"/>',
 'chev-l': '<path d="m15 6-6 6 6 6"/>',
 'x': '<path d="M6 6l12 12M18 6 6 18"/>',
 'check': '<path d="m5 12.5 4.5 4.5L19 7"/>',
 'alert': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V13M12 16.3v.2"/>',
 'file': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
 'trash': '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
 'external': '<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
 'mail': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
 'copy': '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
 'spinner': '<path d="M12 3a9 9 0 1 0 9 9"/>',
 'arrow-down': '<path d="M12 5v14M6.5 13.5 12 19l5.5-5.5"/>',
 'arrow-up': '<path d="M12 19V5M6.5 10.5 12 5l5.5 5.5"/>',
 'chev-d': '<path d="m6 9 6 6 6-6"/>',
 'search': '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
}
def ic(name, cls=''):
    return f'<svg class="i {cls}" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-{name}"/></svg>'
SPRITE = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' + ''.join(
    f'<symbol id="i-{k}" viewBox="0 0 24 24">{v}</symbol>' for k, v in ICONS.items()) + '</defs></svg>'

ROUTES = {
 'loop': 'M5 22 C7 14 4 9 9 6 S17 8 19 5 S26 9 24 15 S20 20 22 24 S12 26 9 23 Z',
 'line': 'M4 24 L10 20 L12 14 L18 12 L21 7 L26 5',
 'mtb': 'M15 25 C9 24 6 20 8 16 S6 9 10 7 S15 9 17 6 S24 7 23 12 S19 15 22 19 S20 25 15 25',
 'lunch': 'M6 24 C6 18 10 16 9 11 S13 4 18 6 S25 10 22 15 S16 18 18 22 S10 27 6 24',
 'indoor': 'M5 15 H25',
 'kluis': 'M8 25 C4 20 6 14 5 10 S10 4 15 6 S22 3 25 8 S22 16 25 20 S16 27 8 25',
}
def thumb(r):
    return f'<span class="thumb"><svg viewBox="0 0 30 30" aria-hidden="true"><path class="route" d="{ROUTES[r]}"/></svg></span>'

# ---------------------------------------------------------------- data
METRICS = [('dist', 'Distance', 'km'), ('time', 'Moving time', 'h'), ('speed', 'Avg speed', 'km/h'),
           ('power', 'Avg power', 'W'), ('hr', 'Avg heart rate', 'bpm'), ('elev', 'Elevation', 'm')]
RIDES = {
 'long':   dict(name='Sunday Long Ride', day='Sun 11 Oct', time='08:30', tag='Road', r='loop', v=['96.0', '3:12', '30.0', '214', '141', '1,020']),
 'eve1':   dict(name='Evening Ride', day='Thu 8 Oct', time='17:48', tag='Commute', r='line', v=['18.6', '0:40', '27.9', None, None, '84']),
 'lunch':  dict(name='Lunch Ride', day='Wed 7 Oct', time='12:05', tag='Road', r='lunch', v=['73.4', '2:22', '31.0', '228', '145', '640']),
 'morn':   dict(name='Morning Ride', day='Tue 6 Oct', time='07:10', tag='MTB', r='mtb', v=['22.0', '1:05', '20.3', '176', '148', '410']),
 'kluis':  dict(name='Kluisbos loop', day='Sun 4 Oct', time='09:02', tag='Road', r='kluis', v=['104.2', '3:36', '28.9', '205', '139', '1,310']),
 'eve2':   dict(name='Evening Ride', day='Thu 1 Oct', time='17:51', tag='Commute', r='line', v=['18.4', '0:41', '26.9', None, None, '79']),
 'indoor': dict(name='Indoor intervals', day='Tue 29 Sep', time='19:30', tag='Indoor', r='indoor', v=['41.4', '1:24', '29.6', '241', '152', '0']),
}
WEEKS = [('Week 41 · 5–11 Oct', '4 rides · 210.0 km · 7:19 h', ['long', 'eve1', 'lunch', 'morn']),
         ('Week 40 · 28 Sep – 4 Oct', '3 rides · 164.0 km · 5:41 h', ['kluis', 'eve2', 'indoor'])]

def ride_card(key, hover=False):
    d = RIDES[key]
    cells = ''
    for (m, label, unit), val in zip(METRICS, d['v']):
        if val is None:
            cells += f'<div><div class="mv none">—<span class="u">{unit}</span></div><div class="ml">{label}</div></div>'
        else:
            cells += f'<div><div class="mv c-{m}">{val}<span class="u">{unit}</span></div><div class="ml">{label}</div></div>'
    return (f'<a class="ride{" is-hover" if hover else ""}" href="#B4"><div class="ride-h">{thumb(d["r"])}<span class="nm"><b>{d["name"]}</b>'
            f'<span>{d["day"]} · {d["time"]} · {d["tag"]}</span></span></div><div class="mgrid">{cells}</div></a>')

def table_rows(weeks, hover_key=None, focus_key=None, hide_commutes=False):
    out = ''
    for title, tot, keys in weeks:
        wk, rng = title.split(' · ', 1)
        out += f'<tr class="wk"><td class="l" colspan="2"><b>{wk}</b> · {rng}</td><td colspan="6">{tot}</td></tr>'
        for k in keys:
            d = RIDES[k]
            if hide_commutes and d['tag'] == 'Commute':
                continue
            cls = ' class="is-hover"' if k == hover_key else (' class="is-focus"' if k == focus_key else '')
            tag = '' if d['tag'] == 'Road' else f' · {d["tag"]}'
            cells = ''.join(f'<td class="dash">—</td>' if v is None else f'<td class="c-{m}">{v}</td>' for (m, _, _), v in zip(METRICS, d['v']))
            out += f'<tr{cls}><td class="l dt">{d["day"]} · {d["time"]}{tag}</td><td class="l nm">{d["name"]}</td>{cells}</tr>'
    return out

def flat_rows(keys, focus_key=None):
    out = ''
    for k in keys:
        d = RIDES[k]
        cls = ' class="is-focus"' if k == focus_key else ''
        tag = '' if d['tag'] == 'Road' else f' · {d["tag"]}'
        cells = ''.join(f'<td class="dash">—</td>' if v is None else f'<td class="c-{m}">{v}</td>' for (m, _, _), v in zip(METRICS, d['v']))
        out += f'<tr{cls}><td class="l dt">{d["day"]} · {d["time"]}{tag}</td><td class="l nm">{d["name"]}</td>{cells}</tr>'
    return out

def sort_head(key, label, unit, left, sort, hover, focus):
    col, direction = sort
    on = key == col
    arrow = ic('arrow-up' if (on and direction == 'ascending') else 'arrow-down', 'ar')
    cls = 'sb' + (' is-hover' if key == hover else '') + (' is-focus' if key == focus else '')
    if left:
        inner = f'<span class="lt"><span class="hl">{label}{arrow}</span></span>'
    else:
        inner = f'<span class="lt"><span>{label}</span><span class="u">{arrow}{unit}</span></span>'
    th_cls = ('l ' if left else '') + 'sort'
    aria = f' aria-sort="{direction}"' if on else ''
    return f'<th class="{th_cls}" scope="col"{aria}><button type="button" class="{cls}">{inner}</button></th>'

def table(weeks=None, sort=('date', 'descending'), hover_head=None, focus_head=None, flat=None, focus_key=None, **kw):
    heads = sort_head('date', 'Date', '', True, sort, hover_head, focus_head) + sort_head('name', 'Name', '', True, sort, hover_head, focus_head)
    heads += ''.join(sort_head(m, 'Avg HR' if m == 'hr' else label, unit, False, sort, hover_head, focus_head) for m, label, unit in METRICS)
    body = flat_rows(flat, focus_key) if flat else table_rows(weeks, focus_key=focus_key, **kw)
    return f'<div class="tbl"><table><thead><tr>{heads}</tr></thead><tbody>{body}</tbody></table></div>'

def select_field(label, value, width):
    return (f'<div class="field" style="width:{width}px"><label>{label}</label>'
            f'<div class="input select"><span class="v">{value}</span>{ic("chev-d")}</div></div>')

def filter_bar(query='', kind='All types', period='All time', hide=False, active=False):
    q = (f'<div class="field" style="width:240px"><label>Search by name</label>'
         f'<div class="input"><span class="lead-ic">{ic("search")}</span><span class="v">{query}</span></div></div>')
    chk = f'<span class="check{" on" if hide else ""}"><span class="box">{ic("check") if hide else ""}</span>Hide commutes</span>'
    clear = '<span class="btn btn-text">Clear filters</span>' if active else ''
    return (f'<div class="filters" role="search" aria-label="Filter rides">{q}{select_field("Type", kind, 156)}'
            f'{select_field("Period", period, 172)}{chk}<span class="sp"></span>{clear}</div>')

# ---------------------------------------------------------------- frames
def phone(theme, body, extra='', screen_cls='', sbar=True):
    sb = '<div class="sbar" aria-hidden="true"><span>9:41</span><i></i></div>' if sbar else ''
    return f'<div class="phone ui" data-theme="{theme}"><div class="screen {screen_cls}">{sb}{body}</div>{extra}</div>'

def topbar(title, right='', left='menu'):
    l = (f'<span class="icon-btn" aria-label="Open menu">{ic("menu")}</span>' if left == 'menu'
         else f'<span class="icon-btn" aria-label="Back">{ic("chev-l")}</span>' if left == 'back' else '')
    return f'<div class="topbar">{l}<span class="ttl">{title}</span>{right}</div>'

def side(active, version='0.2.0', status=''):
    items = [('rides', 'Rides'), ('import', 'Import'), ('settings', 'Settings')]
    nav = ''.join(f'<a class="nav{" on" if k == active else ""}" href="#">{ic(k)}{t}</a>' for k, t in items)
    return f'<aside class="side"><div class="wordmark">Cycling Hub</div>{nav}{status}<div class="ver">Version {version}</div></aside>'

def desk(theme, active, main, cls='', main_style='', with_side=True, status=''):
    s = side(active, status=status) if with_side else ''
    return f'<div class="desk-wrap"><div class="desk ui {cls}" data-theme="{theme}">{s}<div class="main" style="{main_style}">{main}</div></div></div>'

def fig(frame, cap, wide=False):
    return f'<figure{" class=\"wide\"" if wide else ""}>{frame}<figcaption>{cap}</figcaption></figure>'

def shot(sid, title, sprint, notes, frames):
    nl = ''.join(f'<li>{n}</li>' for n in notes)
    return (f'<div class="shot" id="{sid}"><div class="shot-h"><h3><span class="sid">{sid}</span> <span class="stitle">{title}</span></h3>'
            f'<span class="spr">{sprint}</span></div>' + (f'<ul class="notes">{nl}</ul>' if notes else '') +
            f'<div class="frames">{"".join(frames)}</div></div>')

def status_update(desk_=False):
    return f'<div class="status" role="status"><span class="dot"></span><span class="msg">Updated to v0.2.0</span><a class="act" href="#G2">What\'s new</a><span class="icon-btn muted" aria-label="Dismiss">{ic("x")}</span></div>'

def status_error():
    return f'<div class="status error" role="alert"><span class="ic">{ic("alert")}</span><span class="msg">Couldn\'t load your rides. Check your connection.</span><span class="act">Try again</span></div>'

def side_status(kind='update'):
    # desktop variant (D-PO2): the same card inside the side menu, at the bottom, as wide as the menu
    if kind == 'update':
        return status_update().replace('class="status"', 'class="status in-side"')
    if kind == 'password':
        return ('<div class="status in-side" role="status"><span class="dot" style="background:var(--positive)"></span>'
                f'<span class="msg">Password changed.</span><span class="icon-btn muted" aria-label="Dismiss">{ic("x")}</span></div>')
    return status_error().replace('class="status error"', 'class="status error in-side"')

# ---------------------------------------------------------------- screens: rides
def rides_controls(view='Week', hide=False, phone_=True):
    seg = f'<div class="seg"><span{" class=on" if view == "Week" else ""}>Week</span><span{" class=on" if view == "Month" else ""}>Month</span></div>'
    chk = f'<span class="check{" on" if hide else ""}"><span class="box">{ic("check") if hide else ""}</span>Hide commutes</span>'
    return f'<div class="hrow" style="justify-content:space-between">{seg}{chk}</div>'

def rides_phone_week(theme, status=True):
    body = topbar('Rides', f'<span class="icon-btn" aria-label="Import rides">{ic("import")}</span>')
    body += '<div class="pad" style="padding-top:4px">' + rides_controls()
    t, tot, keys = WEEKS[0]
    body += f'<div class="grp-h"><b>{t}</b><span>{tot}</span></div>' + ''.join(ride_card(k) for k in keys) + '</div>'
    return phone(theme, body, status_update() if status else '')

def rides_phone_month(theme):
    body = topbar('Rides', f'<span class="icon-btn" aria-label="Import rides">{ic("import")}</span>')
    body += '<div class="pad" style="padding-top:4px">' + rides_controls('Month', True)
    body += '<div class="grp-h"><b>October 2026</b><span>4 rides · 295.6 km · 10:15 h</span></div>'
    body += ''.join(ride_card(k) for k in ['long', 'lunch', 'morn', 'kluis']) + '</div>'
    return phone(theme, body)

def rides_desk(theme, status=False, month=False, hide=False, hover=None, focus=None):
    seg = f'<div class="seg"><span{"" if month else " class=on"}>Week</span><span{" class=on" if month else ""}>Month</span></div>'
    head = (f'<div class="main-h"><div class="t"><h1>Rides</h1><p class="cap">267 rides · last import 14 Oct, 21:05</p></div>'
            f'{seg}<span class="btn btn-primary">{ic("import")}Import rides</span></div>')
    main = head + filter_bar(hide=hide) + table(WEEKS, hover_key=hover, focus_key=focus, hide_commutes=hide)
    return desk(theme, 'rides', main, status=side_status('update') if status else '')

def rides_desk_sorted(theme):
    # filtered (Road, last 3 months) and sorted by avg power, highest first: one flat list, no week rows
    head = (f'<div class="main-h"><div class="t"><h1>Rides</h1><p class="cap">267 rides · last import 14 Oct, 21:05</p></div>'
            f'<span class="btn btn-primary">{ic("import")}Import rides</span></div>')
    res = '<div class="result"><span class="cap num">3 rides · 273.6 km · 9:10 h</span></div>'
    main = (head + filter_bar(kind='Road', period='Last 3 months', active=True) + res
            + table(sort=('power', 'descending'), focus_head='power', flat=['lunch', 'long', 'kluis']))
    return desk(theme, 'rides', main)

# ---------------------------------------------------------------- build page
P = []
def add(s): P.append(s)

# ---------- system sheet
def swatches(theme):
    D = {'dark': [('bg', '#111318', '—'), ('surface', '#191C22', 'cards'), ('raised', '#23262C', 'floating'), ('fill', '#23262C', 'tone step'),
                  ('track', '#0F1116', 'inset'), ('border', '#30343B', 'dividers'), ('input-border', '#6E7279', '3.5 : 1'),
                  ('text', '#E6EDF7', '14.5 : 1'), ('muted', '#A1A5AB', '6.9 : 1'), ('accent', '#5B9BFF', '6.2 : 1'),
                  ('on-accent', '#0D1015', '6.9 : 1 on accent'), ('positive', '#8FD07A', '9.3 : 1'), ('danger', '#FF8A80', '7.5 : 1')],
         'light': [('bg', '#F2F5F9', '—'), ('surface', '#FFFFFF', 'cards'), ('raised', '#FFFFFF', 'floating'), ('fill', '#E6EAF0', 'tone step'),
                   ('track', '#E6EAF0', 'inset'), ('border', '#DDDFE2', 'dividers'), ('input-border', '#74777C', '4.5 : 1'),
                   ('text', '#171A1F', '17.4 : 1'), ('muted', '#5C6067', '6.3 : 1'), ('accent', '#2457D6', '6.2 : 1'),
                   ('on-accent', '#FFFFFF', '6.2 : 1 on accent'), ('positive', '#2F6A1C', '6.6 : 1'), ('danger', '#B3261E', '6.5 : 1')]}[theme]
    cells = ''.join(f'<div class="sw"><i style="background:{h}"></i><b>--{n}</b><span>{h} · {r}</span></div>' for n, h, r in D)
    return f'<div class="panel ui" data-theme="{theme}"><p class="ph">{theme.capitalize()}</p><div class="sw-grid">{cells}</div><p class="cap" style="margin-top:12px">Ratios against --surface.</p></div>'

def metric_panel(theme):
    vals = {'dark': ['#56D2AC', '#C8CBD0', '#9DD9F0', '#E9CD4C', '#E8728F', '#D6A97A'],
            'light': ['#0D7050', '#5A5F66', '#1F6585', '#806200', '#A63A5B', '#6B4A2B']}[theme]
    cells = ''.join(f'<div class="stat"><div class="stat-l">{label}</div><div class="stat-v c-{m}">{v}</div><div class="cap">--m-{m}</div></div>'
                    for (m, label, unit), v in zip(METRICS, vals))
    return f'<div class="panel ui" data-theme="{theme}"><p class="ph">{theme.capitalize()}</p><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">{cells}</div></div>'

def type_panel():
    rows = [('display · 44 / 46 · 600', '<span class="disp c-dist">96.0<span class="u">km</span></span>'),
            ('stat · 32 / 36 · 600', '<span class="out-n">262</span>'),
            ('heading · 24 / 30 · 600', '<span class="h-screen">Import complete</span>'),
            ('title · 20 / 26 · 600', '<span class="h-card">Sunday Long Ride</span>'),
            ('body-lg · 17 / 24 · 600', '<span class="mv c-speed">30.0<span class="u">km/h</span></span>'),
            ('body · 15 / 22 · 400', '<span class="lead">Activities you already imported are updated, never duplicated.</span>'),
            ('caption · 13 / 18 · 400', '<span class="cap">Sun 11 Oct · 08:30 · Road</span>')]
    r = ''.join(f'<div class="scale-row"><span class="meta">{m}</span>{s}</div>' for m, s in rows)
    return f'<div class="panel ui" data-theme="dark" style="flex-basis:100%">{r}</div>'

def buttons_panel(theme):
    sp = f'<svg class="i spin" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-spinner"/></svg>'
    def line(lbl, items):
        return f'<p class="demo-lbl">{lbl}</p><div class="demo">{items}</div>'
    c = line('Primary: default, hover, pressed, focus, loading, disabled',
             '<span class="btn btn-primary">Import rides</span><span class="btn btn-primary is-hover">Import rides</span>'
             '<span class="btn btn-primary is-pressed">Import rides</span><span class="btn btn-primary is-focus">Import rides</span>'
             f'<span class="btn btn-primary" aria-busy="true">{sp}Saving</span><span class="btn btn-primary is-disabled" aria-disabled="true">Import rides</span>')
    c += line('Secondary', '<span class="btn btn-secondary">Cancel</span><span class="btn btn-secondary is-hover">Cancel</span><span class="btn btn-secondary is-focus">Cancel</span><span class="btn btn-secondary is-disabled" aria-disabled="true">Cancel</span>')
    c += line('Destructive: calm in the page, solid only to confirm', f'<span class="btn btn-danger">{ic("trash")}Delete ride</span><span class="btn btn-danger is-hover">{ic("trash")}Delete ride</span><span class="btn btn-danger-solid">Delete</span>')
    c += line('Text and icon buttons', f'<span class="btn btn-text">Forgot password?</span><span class="btn btn-text is-hover">Forgot password?</span><span class="icon-btn">{ic("menu")}</span><span class="icon-btn is-hover">{ic("x")}</span><span class="icon-btn is-focus">{ic("import")}</span>')
    return f'<div class="panel ui demo-col" data-theme="{theme}"><p class="ph" style="margin:0">{theme.capitalize()}</p>{c}</div>'

def inputs_panel(theme):
    f = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px">'
    f += '<div class="field"><label>Email</label><div class="input"></div><div class="help">The address you sign in with.</div></div>'
    f += '<div class="field"><label>Email</label><div class="input is-hover"></div><div class="help">Hover</div></div>'
    f += '<div class="field"><label>Email</label><div class="input is-focus"><span class="caret"></span></div><div class="help">Focus: 2 px ring, no blur.</div></div>'
    f += '<div class="field"><label>Email</label><div class="input"><span class="v">yoran.broodcooren@inthepocket.com</span></div><div class="help">Filled</div></div>'
    f += f'<div class="field"><label>New password</label><div class="input is-error"><span class="v">••••••••</span><span class="show">Show</span></div><div class="err">{ic("alert", "sm")}Use at least 12 characters.</div></div>'
    f += '<div class="field"><label>Time zone</label><div class="input is-disabled"><span class="v">Europe/Brussels</span></div><div class="help">Disabled: fixed for now.</div></div>'
    f += '</div>'
    seg = ('<p class="demo-lbl" style="margin-top:8px">Segmented control and checkbox</p><div class="demo">'
           '<div class="seg"><span class="on">Week</span><span>Month</span></div>'
           '<div class="seg"><span>System</span><span class="on">Light</span><span>Dark</span></div>'
           f'<span class="check"><span class="box"></span>Hide commutes</span><span class="check on"><span class="box">{ic("check")}</span>Hide commutes</span></div>')
    lab = ('<p class="demo-lbl" style="margin-top:8px">Change-type labels, the only pills</p><div class="demo">'
           '<span class="label label-feature">Feature</span><span class="label label-fix">Fix</span><span class="label label-tech">Technical</span></div>')
    return f'<div class="panel ui demo-col" data-theme="{theme}"><p class="ph" style="margin:0">{theme.capitalize()}</p>{f}{seg}{lab}</div>'

def cards_panel(theme):
    c = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;align-items:start">'
    c += '<div><p class="demo-lbl">Ride card, default and hover</p>' + ride_card('long') + ride_card('eve1', hover=True) + '</div>'
    c += ('<div class="stack g4"><div><p class="demo-lbl">Card and settings group</p><div class="group">'
          f'<div class="row"><span class="k">Units</span><span class="v">Metric</span></div>'
          f'<div class="row link is-hover"><span class="k">What\'s new</span><span class="chev">{ic("chev-r")}</span></div></div></div>'
          '<div><p class="demo-lbl">Stat tile and outcome card</p><div class="out-grid"><div class="stat"><div class="stat-l">Avg power</div><div class="stat-v c-power">214<span class="u">W</span></div></div>'
          '<div class="out hl"><span class="out-t">New rides</span><span class="out-n">262</span></div></div></div>'
          f'<div><p class="demo-lbl">Bottom status card: info and error</p><div class="stack g3">{status_update().replace("class=\"status\"", "class=\"status static\"")}'
          f'{status_error().replace("class=\"status error\"", "class=\"status error static\"")}</div></div></div>')
    c += '</div>'
    return f'<div class="panel ui" data-theme="{theme}" style="flex-basis:100%"><p class="ph">{theme.capitalize()}</p>{c}</div>'

def states_panel(theme):
    empty = (f'<div class="card stack g3" style="align-items:flex-start;padding:24px"><span class="tile-ic">{ic("rides", "lg")}</span>'
             '<p class="h-card">No rides yet</p><p class="lead">Import the file from the Cycling Hub extension to see your rides here.</p>'
             '<span class="btn btn-primary">Import rides</span></div>')
    load = ('<div class="card" aria-busy="true"><div class="ride-h"><span class="sk" style="width:44px;height:44px;border-radius:12px"></span><span class="stack g2" style="flex:1"><span class="sk" style="width:60%;height:14px"></span><span class="sk" style="width:40%;height:12px"></span></span></div>'
            '<div class="mgrid"><span class="sk" style="height:36px"></span><span class="sk" style="height:36px"></span><span class="sk" style="height:36px"></span><span class="sk" style="height:36px"></span><span class="sk" style="height:36px"></span><span class="sk" style="height:36px"></span></div></div>')
    err = (f'<div class="notice danger">{ic("alert")}<span>Email or password is incorrect.</span></div>')
    return (f'<div class="panel ui" data-theme="{theme}"><p class="ph">{theme.capitalize()}</p><div class="stack g5">'
            f'<div><p class="demo-lbl">Empty</p>{empty}</div><div><p class="demo-lbl">Loading: skeleton, no spinner screen</p>{load}</div>'
            f'<div><p class="demo-lbl">Inline error (forms); page errors use the bottom card</p>{err}</div></div></div>')

def spacing_panel():
    sp = ''.join(f'<div class="bx"><span style="display:block;width:{v}px;height:{v}px;background:var(--accent);border-radius:3px"></span>{v}</div>' for v in (4, 8, 12, 16, 20, 24, 32, 40, 48, 64))
    rd = ''.join(f'<div class="bx"><span style="display:block;width:64px;height:48px;background:var(--fill);border-radius:{v}px"></span>{n} · {v}</div>' for n, v in (('sm', 8), ('md', 12), ('lg', 16), ('xl', 20)))
    el = ('<div class="bx"><span style="display:block;width:120px;height:64px;background:var(--bg);border-radius:12px"></span>bg</div>'
          '<div class="bx"><span style="display:block;width:120px;height:64px;background:var(--surface);border-radius:12px"></span>surface</div>'
          '<div class="bx"><span style="display:block;width:120px;height:64px;background:var(--fill);border-radius:12px"></span>fill</div>'
          '<div class="bx"><span style="display:block;width:120px;height:64px;background:var(--raised);border-radius:12px;box-shadow:var(--shadow-float)"></span>raised + float shadow</div>')
    return (f'<div class="panel ui" data-theme="dark"><p class="ph">Spacing, 4 px base</p><div class="boxes">{sp}</div></div>'
            f'<div class="panel ui" data-theme="dark"><p class="ph">Radius</p><div class="boxes">{rd}</div><p class="ph" style="margin-top:24px">Elevation: tone steps; a shadow only on what floats</p><div class="boxes">{el}</div></div>'
            f'<div class="panel ui" data-theme="light"><p class="ph">Elevation, light</p><div class="boxes">{el}</div></div>')

def shell_panel(theme):
    tb = f'<div class="card" style="padding:0 4px">{topbar("Rides", "<span class=\"icon-btn\" aria-label=\"Import rides\">" + ic("import") + "</span>")}</div>'
    nav = ('<div class="card" style="padding:12px;width:260px">'
           f'<a class="nav on" href="#">{ic("rides")}Rides</a><a class="nav is-hover" href="#">{ic("import")}Import</a><a class="nav" href="#">{ic("settings")}Settings</a></div>')
    return (f'<div class="panel ui" data-theme="{theme}"><p class="ph">{theme.capitalize()}</p><div class="stack g4">'
            f'<div><p class="demo-lbl">Top bar (phone): menu, page title, one page action</p>{tb}</div>'
            f'<div><p class="demo-lbl">Menu items: active, hover, default</p>{nav}</div></div></div>')

def side_cards_panel(theme):
    def box(st, cap):
        return (f'<div><p class="demo-lbl">{cap}</p><div style="height:400px;display:flex;border-radius:16px;overflow:hidden;background:var(--page)">'
                f'{side("rides", status=st)}</div></div>')
    return (f'<div class="panel ui" data-theme="{theme}" style="flex-basis:100%"><p class="ph">Desktop side menu with a status card, {theme}</p>'
            '<div style="display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start">'
            + box(side_status('update'), 'What\'s new') + box(side_status('password'), 'Password changed')
            + box(side_status('error'), 'Error') + '</div></div>')

add('<section class="flow" id="system"><h2>Design system</h2><p class="s-intro">Every part below is drawn from <b>src/styles/tokens.css</b>; the rules are in <b>docs/design/DESIGN.md</b>.</p>')
add(shot('DS1', 'Colour', 'Tokens', ['Charcoal surfaces with a faint cool hint (P22), one cobalt accent. Cards separate from the background by a tone step, not an outline (P28).',
         'Every text colour passes 4.5 : 1 on bg, surface, raised and fill; input borders and focus pass 3 : 1.'],
         [swatches('dark'), swatches('light')]))
add(shot('DS2', 'Metric colours', 'Tokens', ['One fixed colour per metric everywhere, in the order of P10. The accent blue is never a metric colour.',
         'Changed from the direction: heart rate is brighter in dark (#E8728F) and speed, heart rate and the positive green are darker in light, so they also pass on tone-step tiles. Approved by the PO (D-PO3).'],
         [metric_panel('dark'), metric_panel('light')]))
add(shot('DS3', 'Type', 'Tokens', ['Inter only, shipped with the app as a self-hosted variable font (D-PO7). Tabular numbers for every value. Seven sizes, nothing under 13 px. Weight 600 for headings and values, 500 for segments and labels, 400 for text.'], [type_panel()]))
add(shot('DS4', 'Spacing, radius, elevation', 'Tokens', [], [spacing_panel()]))
add(shot('DS5', 'Buttons', 'Components', ['Rounded rectangles (12 px), 44 px high, one primary per screen. No glows: hover and pressed change the fill only (P21).'],
         [buttons_panel('dark'), buttons_panel('light')]))
add(shot('DS6', 'Inputs, segmented control, checkbox, labels', 'Components', ['Label above, helper or error below, never an example value inside the field. The error replaces the helper text and adds an icon, so colour is not the only cue.'],
         [inputs_panel('dark'), inputs_panel('light')]))
add(shot('DS7', 'Cards, rows and status cards', 'Components', ['Status messages are cards at the bottom of the page (P12). On the phone they float above the bottom edge and are the only cards with a shadow; on desktop they sit in the side menu (DS8).'],
         [cards_panel('dark'), cards_panel('light')]))
add(shot('DS8', 'Top bar and side menu', 'Components', ['Active item: accent-tinted fill plus a bold label and accent icon. Hover: neutral fill.',
         'Desktop status cards (D-PO2): the same card at the bottom of the side menu, as wide as the menu inside its padding, above the version. It never covers the content, so it has no shadow. One card at a time: What\'s new, Password changed, an update prompt or an error.'],
         [shell_panel('dark'), shell_panel('light'), side_cards_panel('dark'), side_cards_panel('light')]))
add(shot('DS9', 'Empty, loading and error', 'Components', [], [states_panel('dark'), states_panel('light')]))
add('</section>')

# ---------- N shell
def drawer_phone(theme):
    dr =('<div class="scrim"></div><nav class="drawer" aria-label="Main">'
          f'<div class="wordmark">Cycling Hub</div><a class="nav on" href="#">{ic("rides")}Rides</a><a class="nav" href="#">{ic("import")}Import</a>'
          f'<a class="nav" href="#">{ic("settings")}Settings</a><div class="ver">Version 0.2.0</div></nav>')
    return phone(theme, '<div aria-hidden="true" inert>' + body_of_rides_week() + '</div>' + dr)

def body_of_rides_week():
    body = topbar('Rides', f'<span class="icon-btn" aria-label="Import rides">{ic("import")}</span>')
    body += '<div class="pad" style="padding-top:4px">' + rides_controls()
    t, tot, keys = WEEKS[0]
    body += f'<div class="grp-h"><b>{t}</b><span>{tot}</span></div>' + ''.join(ride_card(k) for k in keys) + '</div>'
    return body

add('<section class="flow" id="shell"><h2>App shell</h2><p class="s-intro">Top bar and a side menu on the phone, a permanent side menu from 960 px (N1b, P7, P8).</p>')
add(shot('N1b', 'Side menu open', 'Sprint 0', ['The menu slides in from the left over a dark scrim; it closes on a tap outside, a swipe left, Escape or after choosing an item.',
         'More destinations arrive with later epics; the menu grows downward, version stays at the bottom.'],
         [fig(drawer_phone('dark'), 'Phone · dark'), fig(drawer_phone('light'), 'Phone · light')]))
add('</section>')

# ---------- A sign in
def signin_body(state='idle'):
    err = f'<div class="notice danger" role="alert">{ic("alert")}<span>Email or password is incorrect.</span></div>' if state == 'error' else ''
    pw_cls = ' is-focus' if state == 'error' else ''
    pw_val = '<span class="caret"></span><span class="v"></span>' if state == 'error' else '<span class="v"></span>'
    email_val = '<span class="v">yoran.broodcooren@inthepocket.com</span>' if state == 'error' else ''
    return (f'<div class="signin stack g5">{err}'
            f'<div class="field"><label>Email</label><div class="input">{email_val}</div></div>'
            f'<div class="field"><label>Password</label><div class="input{pw_cls}">{pw_val}<span class="show">Show</span></div></div>'
            '<span class="btn btn-primary btn-block">Sign in</span>'
            '<span class="btn btn-text" style="align-self:center">Forgot password?</span></div>')

def signin_phone(theme, state='idle'):
    b = (f'<div class="pad" style="padding-top:72px"><p class="wordmark" style="font-size:20px">Cycling Hub</p>'
         f'<h2 class="h-screen" style="margin:40px 0 24px">Sign in</h2>{signin_body(state)}</div>')
    return phone(theme, b)

def signin_desk(theme):
    m = (f'<div class="center" style="height:100%"><div class="signin"><p class="wordmark" style="font-size:20px">Cycling Hub</p>'
         f'<div class="card" style="padding:32px;margin-top:24px"><h2 class="h-screen" style="margin:0 0 24px">Sign in</h2>{signin_body()}</div></div></div>')
    return desk(theme, None, m, cls='short', with_side=False)

def forgot_phone(theme):
    b = (topbar('Forgot password', left='back') + '<div class="pad stack g5" style="padding-top:24px">'
         '<p class="lead">Enter your email. We\'ll send a link to choose a new password.</p>'
         '<div class="field"><label>Email</label><div class="input"></div><div class="help">The link works once and expires after 1 hour.</div></div>'
         '<span class="btn btn-primary btn-block">Send reset link</span></div>')
    return phone(theme, b)

def sent_phone(theme):
    b = (topbar('Forgot password', left='back') + f'<div class="pad stack g5" style="padding-top:24px"><span class="tile-ic">{ic("mail", "lg")}</span>'
         '<h2 class="h-screen">Check your email</h2><p class="lead">If an account exists for this address, a reset link is on its way.</p>'
         '<div class="stack g3" style="margin-top:8px"><span class="btn btn-secondary btn-block">Back to sign in</span>'
         '<span class="btn btn-text is-disabled" aria-disabled="true">Resend link in 60 s</span></div></div>')
    return phone(theme, b)

def newpw_phone(theme, expired=False):
    if expired:
        inner = (f'<div class="notice danger" role="alert">{ic("alert")}<span>This link has expired or was already used.</span></div>'
                 '<span class="btn btn-primary btn-block">Send a new link</span><span class="btn btn-text" style="align-self:center">Back to sign in</span>')
    else:
        inner = ('<div class="field"><label>New password</label><div class="input is-focus"><span class="caret"></span><span class="v"></span><span class="show">Show</span></div>'
                 '<div class="help">At least 12 characters. A few words together are easy to remember.</div></div>'
                 '<span class="btn btn-primary btn-block">Save and sign in</span>')
    b = (f'<div class="pad" style="padding-top:72px"><p class="wordmark" style="font-size:20px">Cycling Hub</p>'
         f'<h2 class="h-screen" style="margin:40px 0 24px">Choose a new password</h2><div class="stack g5">{inner}</div></div>')
    return phone(theme, b)

add('<section class="flow" id="signin"><h2>Sign in</h2><p class="s-intro">Email and password, no sign-up anywhere (A1). Sign in again after 30 days (A3).</p>')
add(shot('A1', 'Sign in', 'Sprint 0', ['Fields support the password manager (autocomplete email / current-password). Show toggles the password; there is no confirm field.',
         'Desktop: the same column, centred on a card, without the side menu.'],
         [fig(signin_phone('dark'), 'Phone · dark'), fig(signin_phone('light'), 'Phone · light'), fig(signin_desk('dark'), 'Desktop · dark', wide=True)]))
add(shot('A2', 'Sign in, error', 'Sprint 0', ['One message for a wrong email or password, above the form and announced to screen readers. The password is cleared and focused, the email stays.'],
         [fig(signin_phone('dark', 'error'), 'Phone · dark'), fig(signin_phone('light', 'error'), 'Phone · light')]))
add(shot('A3', 'Forgot password', 'Sprint 0', [], [fig(forgot_phone('dark'), 'Phone · dark'), fig(forgot_phone('light'), 'Phone · light')]))
add(shot('A4', 'Reset link sent', 'Sprint 0', ['Neutral wording: it does not reveal whether the address has an account. Resend is disabled for 60 seconds.'],
         [fig(sent_phone('dark'), 'Phone · dark')]))
add(shot('A5', 'Choose a new password', 'Sprint 0', ['Opened from the email link (Supabase default flow). An expired or used link shows the message on the right.'],
         [fig(newpw_phone('dark'), 'Phone · dark'), fig(newpw_phone('light', True), 'Phone · light, link expired')]))
add('</section>')

# ---------- C import
LAST = ('<div class="group"><a class="row link" href="#C5"><span class="k stack"><span>Last import</span>'
        '<span class="cap">14 Oct 2026, 21:05 · 4 new · 1 updated</span></span><span class="chev">' + ic('chev-r') + '</span></a></div>')

def import_idle_phone(theme):
    b = (topbar('Import') + '<div class="pad stack g4" style="padding-top:8px">'
         f'<div class="drop"><span class="tile-ic">{ic("file", "lg")}</span><p class="h-card">Choose your export file</p>'
         '<p class="cap" style="max-width:26ch">The .json file from the Cycling Hub extension.</p><span class="btn btn-primary" style="margin-top:4px">Choose file</span></div>'
         f'{LAST}<p class="cap" style="padding:0 2px">Rides you already imported are updated, never duplicated.</p></div>')
    return phone(theme, b)

def import_desk_over(theme):
    m = ('<div class="main-h"><div class="t"><h1>Import</h1></div></div><div class="stack g4" style="max-width:720px">'
         f'<div class="drop over" style="padding:64px 24px"><span class="tile-ic">{ic("import", "lg")}</span><p class="h-card">Drop the file to import</p>'
         '<p class="cap">One .json file from the Cycling Hub extension.</p></div>'
         f'{LAST}</div>')
    return desk(theme, 'import', m)

def import_progress_phone(theme):
    b = (topbar('Import') + '<div class="pad stack g4" style="padding-top:8px">'
         f'<div class="card stack g4"><div class="hrow" style="flex-wrap:nowrap"><span class="tile-ic" style="width:44px;height:44px;border-radius:12px">{ic("file")}</span>'
         '<span class="stack" style="min-width:0"><b style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">activities.json</b><span class="cap">1.4 MB</span></span></div>'
         f'<div class="hrow" style="flex-wrap:nowrap;align-items:flex-start;color:var(--positive)">{ic("check")}<span class="stack"><span style="color:var(--text)">File checked</span><span class="cap">305 activities · 2 will be skipped</span></span></div>'
         '<div class="stack g2"><div class="hrow" style="justify-content:space-between"><span>Saving rides</span><span class="cap num">130 of 303</span></div>'
         '<div class="progress" role="progressbar" aria-valuenow="43" aria-valuemin="0" aria-valuemax="100" aria-label="Saving rides"><i style="width:43%"></i></div></div></div>'
         '<p class="cap" style="padding:0 2px">Keep this screen open until the import is finished.</p></div>')
    return phone(theme, b)

OUT_BACKFILL = [('New rides', '262', True), ('Updated', '0', False), ('Unchanged', '0', False), ('Not a ride', '41', False), ('Skipped (errors)', '2', False), ('Deleted earlier', '0', False)]
OUT_REGULAR = [('New rides', '4', True), ('Updated', '1', False), ('Unchanged', '0', False), ('Not a ride', '0', False), ('Skipped (errors)', '0', False), ('Deleted earlier', '0', False)]
def outcomes(rows, cols=2):
    return f'<div class="out-grid" style="grid-template-columns:repeat({cols},1fr)">' + ''.join(
        f'<div class="out{" hl" if m else ""}"><span class="out-t">{t}</span><span class="out-n">{n}</span></div>' for t, n, m in rows) + '</div>'

SKIPPED = ('<div class="stack g2"><p class="group-t" style="margin:8px 0 0">Skipped (errors)</p><div class="group">'
           '<div class="row stack" style="gap:2px"><span class="num">Activity 87 · Morning Ride, 3 May 2019</span><span class="cap">startDateLocal is not a valid date</span></div>'
           '<div class="row stack" style="gap:2px"><span class="num">Activity 212 · Afternoon Ride</span><span class="cap">distance must be a number (metres)</span></div></div></div>')

def summary_phone(theme):
    b = (topbar('Import') + f'<div class="pad stack g4" style="padding-top:8px"><div class="hrow" style="flex-wrap:nowrap;align-items:flex-start;gap:10px"><span style="color:var(--positive);margin-top:5px">{ic("check")}</span><span class="stack"><h2 class="h-screen">Import complete</h2>'
         '<span class="cap">activities.json · 305 activities</span></span></div>' + outcomes(OUT_BACKFILL) + SKIPPED + '</div>'
         '<div style="position:absolute;left:16px;right:16px;bottom:20px" class="stack g2"><span class="btn btn-primary btn-block">View rides</span></div>')
    return phone(theme, b)

def summary_desk(theme):
    m = (f'<div class="main-h"><div class="t"><h1>Import complete</h1><p class="cap">cycling-hub-export-2026-10-14.json · 5 activities · 14 Oct 2026, 21:05</p></div>'
         '<span class="btn btn-secondary">Import another file</span><span class="btn btn-primary">View rides</span></div>' + outcomes(OUT_REGULAR, 3)
         + '<div class="group" style="margin-top:20px;max-width:420px"><a class="row link" href="#C5"><span class="k">Import history</span><span class="chev">' + ic('chev-r') + '</span></a></div>')
    return desk(theme, 'import', m, cls='short')

def invalid_phone(theme):
    b = (topbar('Import') + f'<div class="pad stack g4" style="padding-top:8px"><div class="hrow" style="flex-wrap:nowrap;align-items:flex-start;gap:10px"><span style="color:var(--danger);margin-top:5px">{ic("alert")}</span>'
         '<span class="stack"><h2 class="h-screen">This file can\'t be imported</h2><span class="cap">Nothing was changed.</span></span></div>'
         '<div class="card stack g2"><b style="font-weight:600">cycling-hub-export.json</b><p class="lead">This is not a Cycling Hub export: the file has no activities list.</p></div>'
         '<div class="stack g3"><span class="btn btn-primary btn-block">Choose another file</span>'
         f'<span class="btn btn-secondary btn-block">{ic("copy")}Copy error details</span></div></div>')
    return phone(theme, b)

HIST = [('14 Oct 2026, 21:05', 'cycling-hub-export-2026-10-14.json', '5', ['4', '1', '0', '0', '0', '0'], None),
        ('6 Oct 2026, 19:30', 'cycling-hub-export-2026-10-06.json', '5', ['1', '0', '4', '0', '0', '0'], None),
        ('3 Oct 2026, 08:12', 'activities (1).json', '—', None, 'Not imported: not a Cycling Hub export'),
        ('2 Oct 2026, 22:40', 'activities.json', '305', ['262', '0', '0', '41', '2', '0'], None)]
def hist_phone(theme):
    rows = ''
    for d, f, n, c, err in HIST:
        if err:
            detail = f'<span class="cap" style="color:var(--danger)">{err}</span>'
        else:
            parts = [f'{c[0]} new', f'{c[1]} updated', f'{c[2]} unchanged']
            if c[3] != '0': parts.append(f'{c[3]} not a ride')
            if c[4] != '0': parts.append(f'{c[4]} skipped')
            detail = f'<span class="cap num">{" · ".join(parts)}</span>'
        rows += (f'<a class="row link stack" href="#C3" style="gap:2px;flex-direction:column"><span class="hrow" style="justify-content:space-between;flex-wrap:nowrap"><b style="font-weight:600" class="num">{d}</b></span>'
                 f'<span class="cap" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{f}</span>{detail}</a>')
    b = topbar('Import history', left='back') + f'<div class="pad" style="padding-top:8px"><div class="group">{rows}</div></div>'
    return phone(theme, b)

def hist_desk(theme):
    heads = ''.join(f'<th>{h}</th>' for h in ['Activities', 'New rides', 'Updated', 'Unchanged', 'Not a ride', 'Skipped', 'Deleted earlier'])
    body = ''
    for d, f, n, c, err in HIST:
        d = d.replace(' 2026', '')
        if err:
            body += f'<tr><td class="l dt">{d}</td><td class="l nm fn">{f}</td><td class="dash">{n}</td><td class="l" colspan="6" style="color:var(--danger)">{err}</td></tr>'
        else:
            body += f'<tr><td class="l dt">{d}</td><td class="l nm fn">{f}</td><td>{n}</td>' + ''.join(f'<td{" class=dash" if v == "0" else ""}>{v}</td>' for v in c) + '</tr>'
    m = (f'<div class="main-h"><div class="t"><h1>Import history</h1><p class="cap">4 imports</p></div><span class="btn btn-primary">{ic("import")}Import rides</span></div>'
         f'<div class="tbl"><table><thead><tr><th class="l">Date</th><th class="l">File</th>{heads}</tr></thead><tbody>{body}</tbody></table></div>')
    return desk(theme, 'import', m, cls='short')

add('<section class="flow" id="import"><h2>Import</h2><p class="s-intro">Pick the file on the phone, drop it on desktop. Every activity is stored, only rides are shown (P13); broken activities are skipped and listed (P14).</p>')
add(shot('C1', 'Choose file', 'Sprint 1', ['The whole card is the target: a tap opens the file picker. On desktop the file can be dropped anywhere on the page (X2).'],
         [fig(import_idle_phone('dark'), 'Phone · dark'), fig(import_idle_phone('light'), 'Phone · light')]))
add(shot('X2', 'Import on desktop, dragging a file over', 'Sprint 1', ['Drag-over: accent-tinted fill and a 2 px accent edge; no glow.'],
         [fig(import_desk_over('dark'), 'Desktop · dark', wide=True)]))
add(shot('C2', 'Checking and saving', 'Sprint 1', ['Step 1 checks the whole file, step 2 saves in one database call. A five-activity file finishes in about a second, so this mainly shows for the backfill.'],
         [fig(import_progress_phone('dark'), 'Phone · dark')]))
add(shot('C3', 'Import summary', 'Sprint 1', ['Outcome titles name what the number is (P17); the six numbers add up to the activities in the file. New rides is the one tinted card. Numbers count up once (off with reduce motion).',
         'Skipped activities are listed with their position in the file and the reason; the rest is saved (P14).'],
         [fig(summary_phone('dark'), 'Phone · dark, the backfill'), fig(summary_desk('light'), 'Desktop · light, a regular import', wide=True)]))
add(shot('C4', 'File can\'t be imported', 'Sprint 1', ['Only for a file that is not a valid export at all (not JSON, wrong structure, unsupported version). Nothing is saved.'],
         [fig(invalid_phone('dark'), 'Phone · dark'), fig(invalid_phone('light'), 'Phone · light')]))
add(shot('C5', 'Import history', 'Sprint 1', ['Newest first, reached from Last import on C1. On desktop a table with one column per outcome; zeros are muted.',
         'A file that is not a valid export also appears, as "Not imported" with the reason (decided, D-PO4).'],
         [fig(hist_phone('light'), 'Phone · light'), fig(hist_desk('dark'), 'Desktop · dark', wide=True)]))
add('</section>')

# ---------- G settings
def settings_groups(theme_on='System'):
    seg = ''.join(f'<span{" class=on" if t == theme_on else ""}>{t}</span>' for t in ('System', 'Light', 'Dark'))
    return ('<p class="group-t" style="margin-top:8px">Account</p><div class="group"><div class="row"><span class="k">Email</span><span class="v">yoran.broodcooren@inthepocket.com</span></div><a class="row link" href="#A1"><span class="k" style="color:var(--accent);font-weight:600">Sign out</span></a></div>'
            f'<p class="group-t">Appearance</p><div class="group"><div class="row stack"><span>Theme</span><div class="seg block">{seg}</div></div></div>'
            '<p class="group-t">Units and time</p><div class="group"><div class="row"><span class="k">Units</span><span class="v">Metric · km, km/h, W, bpm</span></div>'
            '<div class="row"><span class="k">Time zone</span><span class="v">Europe/Brussels</span></div></div>'
            '<p class="group-t">About</p><div class="group"><div class="row"><span class="k">Version</span><span class="v num">0.2.0</span></div>'
            f'<a class="row link" href="#G2"><span class="k">What\'s new</span><span class="chev">{ic("chev-r")}</span></a>'
            f'<a class="row link" href="#G3"><span class="k">What\'s next</span><span class="chev">{ic("chev-r")}</span></a></div>')

def settings_phone(theme, on='System'):
    b = topbar('Settings') + f'<div class="pad" style="padding-top:0">{settings_groups(on)}</div>'
    return phone(theme, b)

def settings_desk(theme):
    m = f'<div class="main-h"><div class="t"><h1>Settings</h1></div></div><div style="max-width:560px">{settings_groups("Dark")}</div>'
    return desk(theme, 'settings', m)

CHANGES = [('v0.2.0', '23 Oct 2026', True, [('feature', 'Import rides from your export file'), ('feature', 'Import history with the outcome of every import'),
                                             ('feature', 'Settings, What\'s new and What\'s next'), ('fix', 'Sign-in keeps you signed in for 30 days on iOS'),
                                             ('tech', 'Database checks run on every pull request')]),
           ('v0.1.0', '17 Oct 2026', False, [('feature', 'Sign in and reset your password'), ('feature', 'Install Cycling Hub on your phone'),
                                             ('tech', 'Project setup, CI and automatic releases')])]
LBL = {'feature': ('label-feature', 'Feature'), 'fix': ('label-fix', 'Fix'), 'tech': ('label-tech', 'Technical')}
def changes_html():
    out = ''
    for v, d, new, items in CHANGES:
        rows = ''.join(f'<span class="label {LBL[k][0]}">{LBL[k][1]}</span><span>{t}</span>' for k, t in items)
        out += (f'<div class="card stack g4"><div class="hrow" style="justify-content:space-between"><span class="stack"><b class="h-card num">{v}</b><span class="cap">{d}</span></span>'
                f'{"<span class=new>New</span>" if new else ""}</div><div class="chg">{rows}</div></div>')
    return out

def whatsnew_phone(theme):
    b = topbar('What\'s new', left='back') + f'<div class="pad stack g3" style="padding-top:8px">{changes_html()}</div>'
    return phone(theme, b)

def whatsnew_desk(theme):
    m = f'<div class="main-h"><div class="t"><h1>What\'s new</h1></div></div><div class="stack g4" style="max-width:640px">{changes_html()}</div>'
    return desk(theme, 'settings', m)

NEXT = [('v0.3.0', 'Rides', 'Sprint 2', 'In progress', 'All your rides by week or month, with the details of every ride.'),
        ('v0.4.0', 'Baseline and zones', 'Sprint 3', 'Planned', 'Test your FTP and get power and heart rate zones.'),
        ('v0.5.0', 'Training plan', 'Sprint 4', 'Planned', 'A weekly plan around your Wednesday and Sunday rides.')]
def whatsnext_phone(theme):
    items = ''.join(f'<div class="card stack g2"><div class="hrow" style="justify-content:space-between"><b class="h-card">{t}</b>'
                    f'<span class="cap num" style="{"color:var(--accent);font-weight:600" if s == "In progress" else ""}">{s}</span></div>'
                    f'<span class="cap num">{v} · {sp}</span><p class="lead">{tl}</p></div>' for v, t, sp, s, tl in NEXT)
    b = topbar('What\'s next', left='back') + f'<div class="pad stack g3" style="padding-top:8px"><p class="cap" style="padding:0 2px">Plans can change.</p>{items}</div>'
    return phone(theme, b)

add('<section class="flow" id="settings"><h2>Settings, What\'s new, What\'s next</h2><p class="s-intro">Theme switch with System as default (P9); release notes with Feature, Fix and Technical labels (P18).</p>')
add(shot('G1', 'Settings', 'Sprint 1', ['Units and time zone are information only. Sign out sits with the account and needs no confirmation.'],
         [fig(settings_phone('dark'), 'Phone · dark'), fig(settings_phone('light', 'Light'), 'Phone · light'), fig(settings_desk('dark'), 'Desktop · dark', wide=True)]))
add(shot('G2', 'What\'s new', 'Sprint 1', ['The version you have not seen yet is marked New; opening this page or dismissing the bottom card marks it as seen on every device.'],
         [fig(whatsnew_phone('dark'), 'Phone · dark'), fig(whatsnew_phone('light'), 'Phone · light'), fig(whatsnew_desk('light'), 'Desktop · light', wide=True)]))
add(shot('G3', 'What\'s next', 'Sprint 1', ['Only version, title, sprint, status and tagline (P18), read from the backlog at build time.'],
         [fig(whatsnext_phone('dark'), 'Phone · dark'), fig(whatsnext_phone('light'), 'Phone · light')]))
add('</section>')

# ---------- B rides
def empty_phone(theme):
    b = (topbar('Rides') + f'<div class="pad stack g4" style="padding-top:72px;align-items:flex-start"><span class="tile-ic">{ic("rides", "lg")}</span>'
         '<h2 class="h-screen">No rides yet</h2><p class="lead">Import the file from the Cycling Hub extension to see your rides here.</p>'
         '<span class="btn btn-primary" style="margin-top:4px">Import rides</span><span class="btn btn-text" style="margin-left:-12px">How do I get the file?</span></div>')
    return phone(theme, b)

def empty_desk(theme):
    m = ('<div class="main-h"><div class="t"><h1>Rides</h1></div></div>'
         f'<div class="card stack g4" style="max-width:520px;padding:32px;align-items:flex-start"><span class="tile-ic">{ic("rides", "lg")}</span>'
         '<p class="h-card">No rides yet</p><p class="lead">Import the file from the Cycling Hub extension to see your rides here.</p>'
         '<div class="hrow"><span class="btn btn-primary">Import rides</span><span class="btn btn-text">How do I get the file?</span></div></div>')
    return desk(theme, 'rides', m, cls='short')

def sk_card():
    return ('<div class="ride" aria-hidden="true"><div class="ride-h"><span class="sk" style="width:44px;height:44px;border-radius:12px"></span><span class="stack g2" style="flex:1"><span class="sk" style="width:60%;height:14px"></span><span class="sk" style="width:40%;height:12px"></span></span></div>'
            '<div class="mgrid">' + '<span class="sk" style="height:38px"></span>' * 6 + '</div></div>')

def loading_phone(theme):
    b = (topbar('Rides', f'<span class="icon-btn" aria-label="Import rides">{ic("import")}</span>') + '<div class="pad" style="padding-top:4px" aria-busy="true">' + rides_controls()
         + '<div class="grp-h"><span class="sk" style="width:140px;height:14px"></span><span class="sk" style="width:110px;height:12px"></span></div>' + sk_card() * 3 + '<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Loading rides</span></div>')
    return phone(theme, b)

def error_phone(theme):
    b = (topbar('Rides', f'<span class="icon-btn" aria-label="Import rides">{ic("import")}</span>') + '<div class="pad" style="padding-top:4px">' + rides_controls()
         + '<p class="cap" style="padding:72px 8px 0;text-align:center">Your rides appear here once they load.</p></div>')
    return phone(theme, b, status_error())

def detail_body():
    d = RIDES['long']
    tiles = ''.join(f'<div class="stat"><div class="stat-l">{label}</div><div class="stat-v c-{m}">{v}<span class="u">{u}</span></div></div>'
                    for (m, label, u), v in zip(METRICS[1:], d['v'][1:]))
    return tiles + '<div class="stat"><div class="stat-l">Max speed</div><div class="stat-v c-speed">61.4<span class="u">km/h</span></div></div>'

ROUTE_BIG = 'M40 150 C60 120 30 90 70 70 S120 80 140 45 S210 20 230 55 S260 110 225 130 S170 120 160 150 S90 175 40 150 Z'
def route_card(h=200):
    return (f'<div class="card" style="padding:0;overflow:hidden;background:var(--surface)"><svg viewBox="0 0 270 190" style="display:block;width:100%;height:{h}px" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Route shape of the ride">'
            f'<path d="{ROUTE_BIG}" style="fill:none;stroke:var(--accent);stroke-width:3;stroke-linecap:round;stroke-linejoin:round"/>'
            '<circle cx="40" cy="150" r="6" style="fill:var(--surface);stroke:var(--accent);stroke-width:3"/></svg></div>')

DETAILS = ('<div class="group"><div class="row"><span class="k">Elapsed time</span><span class="v num">3:31 h</span></div>'
           '<div class="row"><span class="k">Type</span><span class="v">Road ride</span></div>'
           '<div class="row"><span class="k">Commute</span><span class="v">No</span></div>'
           f'<a class="row link" href="#"><span class="k">Open in Strava</span><span class="chev">{ic("external")}</span></a></div>')

def detail_phone(theme):
    b = (topbar('Ride', left='back') + '<div class="pad stack g3" style="padding-top:0;padding-bottom:24px">'
         '<div class="stack"><h2 class="h-screen">Sunday Long Ride</h2><span class="cap">Sun 11 Oct 2026 · 08:30 · Road</span></div>'
         '<div class="disp c-dist" style="margin-top:4px">96.0<span class="u">km</span></div>'
         + route_card(150) + f'<div class="out-grid">{detail_body()}</div></div>')
    return phone(theme, b)

def detail_phone_lower(theme):
    b = (topbar('Sunday Long Ride', left='back') + '<div class="pad stack g3" style="padding-top:0">'
         f'<div class="out-grid">{detail_body()}</div>{DETAILS}'
         f'<span class="btn btn-danger btn-block" style="margin-top:12px">{ic("trash")}Delete ride</span></div>')
    return phone(theme, b)

def confirm_phone(theme):
    b = detail_body_full = (topbar('Sunday Long Ride', left='back') + '<div class="pad stack g3" style="padding-top:0">'
         f'<div class="out-grid">{detail_body()}</div>{DETAILS}</div>')
    b = '<div aria-hidden="true" inert>' + b + '</div>'
    sheet = ('<div class="scrim"></div><div role="dialog" aria-label="Delete ride" style="position:absolute;left:12px;right:12px;bottom:16px;z-index:3;background:var(--raised);border-radius:var(--radius-xl);box-shadow:var(--shadow-float);padding:20px" class="stack g3">'
             '<p class="h-card">Delete this ride?</p><p class="lead">Sunday Long Ride is removed from your rides and skipped on later imports. You can undo this for a few seconds.</p>'
             '<span class="btn btn-danger-solid btn-block" style="margin-top:4px">Delete ride</span><span class="btn btn-secondary btn-block">Cancel</span></div>')
    return phone(theme, b + sheet)

def detail_desk(theme):
    m = (f'<div class="main-h" style="align-items:center"><a class="icon-btn" href="#X1" aria-label="Back to rides" style="margin-left:-12px">{ic("chev-l")}</a><div class="t"><h1>Sunday Long Ride</h1><p class="cap">Sun 11 Oct 2026 · 08:30 · Road</p></div>'
         f'<span class="btn btn-danger">{ic("trash")}Delete ride</span></div>'
         '<div style="display:grid;grid-template-columns:1.25fr 1fr;gap:20px;align-items:start">'
         f'<div class="stack g4">{route_card(330)}{DETAILS}</div>'
         '<div class="stack g4"><div class="stat"><div class="stat-l">Distance</div><div class="disp c-dist">96.0<span class="u">km</span></div></div>'
         f'<div class="out-grid">{detail_body()}</div></div></div>')
    return desk(theme, 'rides', m)

add('<section class="flow" id="rides"><h2>Rides</h2><p class="s-intro">Cards on the phone, a dense table on desktop (P10); week or month with totals, commutes can be hidden (P11). Power and heart rate show a dash when missing.</p>')
add(shot('B1a', 'Rides, week view', 'Sprint 2', ['Six metrics in two rows, fixed order and colours. Ride tags (Road, MTB, Commute, Indoor) are plain text in the meta line (P24).',
         'Bottom card after an update (B1d): the list keeps bottom padding the height of the card, so no ride stays hidden.'],
         [fig(rides_phone_week('dark'), 'Phone · dark, with the What\'s new card (B1d)'), fig(rides_phone_week('light', status=False), 'Phone · light')]))
add(shot('B1a-month', 'Rides, month view with commutes hidden', 'Sprint 2', ['Hide commutes is remembered on the device. Totals follow the filter.'],
         [fig(rides_phone_month('light'), 'Phone · light'), fig(rides_phone_month('dark'), 'Phone · dark')]))
add(shot('X1', 'Rides on desktop', 'Sprint 2', ['Sortable and filterable (D-PO6). Default: newest first, grouped by week or month with totals. Rows open the ride (B4); hover is a tone step, keyboard focus a 2 px ring.',
         'Every column header is a 44 px button with aria-sort on the header cell. The arrow shows on the sorted column only (and on hover). Numbers sort highest first, Name A to Z; a second click reverses.',
         'Sorting by any column other than Date shows one flat list without week rows; Week / Month comes back when you sort by Date again. The line above the table gives the count and totals of what is shown.',
         'Filters: search by name, Type (All types, Road, Gravel, MTB, E-bike, Indoor, Commute), Period (All time, Last 4 weeks, Last 3 months, This year, a year, Custom range with From and To fields) and Hide commutes. Clear filters appears once a filter is on. No matches: "No rides match these filters." with Clear filters.',
         'Phone keeps Week / Month and Hide commutes (B1a); no sort or filter on the phone for now.'],
         [fig(rides_desk('dark', status=True, hover='lunch'), 'Desktop · dark, newest first, row hover, What\'s new card in the side menu', wide=True),
          fig(rides_desk_sorted('light'), 'Desktop · light, Road and last 3 months, sorted by avg power with keyboard focus on the header', wide=True)]))
add(shot('B2', 'Rides, empty', 'Sprint 2', ['Import rides opens the Import page (C1). How do I get the file opens a short help sheet.'],
         [fig(empty_phone('dark'), 'Phone · dark'), fig(empty_desk('light'), 'Desktop · light', wide=True)]))
add(shot('B3a', 'Rides, loading', 'Sprint 2', ['Skeleton cards in the fill tone with a slow pulse (static with reduce motion); never a spinner-only screen.'],
         [fig(loading_phone('dark'), 'Phone · dark'), fig(loading_phone('light'), 'Phone · light')]))
add(shot('B3b', 'Rides, error', 'Sprint 2', ['The error is a bottom card like the update card (P12) with Try again. No offline mode.'],
         [fig(error_phone('light'), 'Phone · light'), fig(error_phone('dark'), 'Phone · dark')]))
add(shot('B4', 'Ride detail, first version', 'Sprint 2', ['Distance is the one large number; the other five metrics follow in the fixed order.',
         'Route shape only (D-PO5): the ride\'s polyline drawn as one accent line on a plain card, with a start dot.',
         'Delete ride is a calm destructive button that asks to confirm; a deleted ride is skipped on later imports (P15). Weather is parked (P19).'],
         [fig(detail_phone('dark'), 'Phone · dark'), fig(detail_phone_lower('dark'), 'Phone · dark, scrolled down'), fig(confirm_phone('light'), 'Phone · light, confirm delete'), fig(detail_desk('dark'), 'Desktop · dark', wide=True)]))
add('</section>')

# ---------- background Q4
def bg_phone(theme, cls):
    return phone(theme, body_of_rides_week(), screen_cls=cls)
def bg_desk(cls):
    seg = '<div class="seg"><span class="on">Week</span><span>Month</span></div>'
    head = f'<div class="main-h"><div class="t"><h1>Rides</h1><p class="cap">267 rides · last import 14 Oct, 21:05</p></div>{seg}<span class="btn btn-primary">{ic("import")}Import rides</span></div>'
    return f'<div class="desk-wrap"><div class="desk ui {cls}" data-theme="dark">{side("rides")}<div class="main">{head}{table(WEEKS[:1])}</div></div></div>'

add('<section class="flow" id="background"><h2>Background</h2><p class="s-intro">The gradient splash is the background (D-PO1, Q4 closed).</p>')
add(shot('BG1', 'Background: splash', 'Decided', ['Three soft colour fields on the screen root only (P25); cards stay opaque. Flow lines are dropped.',
         'Flat (data-background="flat") is only a technical fallback, not a choice in Settings.'],
         [fig(bg_phone('dark', ''), 'Phone · dark'), fig(bg_phone('light', ''), 'Phone · light'),
          fig(bg_desk(''), 'Desktop · dark', wide=True)]))
add('</section>')

# ---------- questions + feedback
DECIDED = [
 ('D-PO1', 'Background (Q4)', 'Gradient splash. Flow lines are dropped; flat is only a technical fallback.', 'BG1'),
 ('D-PO2', 'Desktop What\'s new card', 'The same card at the bottom of the side menu, as wide as the menu. Applies to every desktop status card; the phone keeps the bottom card.', 'DS8'),
 ('D-PO3', 'Adjusted metric colours', 'Approved as they are.', 'DS2'),
 ('D-PO4', 'Failed imports in the history', 'Yes, shown as "Not imported" with the reason.', 'C5'),
 ('D-PO5', 'Map on the ride detail', 'No map. Route shape only.', 'B4'),
 ('D-PO6', 'Desktop table', 'Sortable by every column (newest first by default) and filterable by name, type, period and commutes.', 'X1'),
 ('D-PO7', 'Font', 'Ship Inter with the app as a self-hosted variable font, no CDN.', 'DS3'),
]
add('<section class="flow" id="decided"><h2>Decided</h2><p class="s-intro">The PO answered the design review questions on 17 Oct 2026. The screens above show the answers.</p><div class="qa">')
for q, t, a, ref in DECIDED:
    add(f'<div class="dec"><p class="dq"><span class="qid">{q}</span>{H.escape(t)}</p><p class="da">{H.escape(a)} <a href="#{ref}">{ref}</a></p></div>')
add('</div></section>')

add('''<section class="flow" id="feedback"><h2>Send your feedback</h2>
<div class="fb-final">
<p class="s-intro">Write in the box under each screen. Notes stay in this browser, so you can come back later. When you are done, open the email: every screen ID and your notes are filled in.</p>
<div style="margin-top:24px"><label for="fb-general">General feedback</label>
<textarea id="fb-general" data-fb="General" rows="5"></textarea></div>
<p class="fb-count" id="fb-count" aria-live="polite"></p>
<div class="fb-actions">
<a class="fb-btn" id="fb-mail" href="#" target="_top" rel="noopener">Open in my email app</a>
<button type="button" class="fb-btn sec" id="fb-copy">Copy feedback</button>
<button type="button" class="fb-btn sec" id="fb-clear">Clear all</button>
</div>
<p class="fb-warn" id="fb-warn">Your feedback is long; some email apps cut off long links. If the email is incomplete, use Copy feedback and paste it into a new email.</p>
<p class="fb-status" id="fb-status" aria-live="polite"></p>
<label for="fb-preview" style="margin-top:16px">Preview</label>
<textarea id="fb-preview" rows="10" readonly></textarea>
</div></section>''')

SCRIPT = r"""<script>
(function(){
  var TO='yoran.broodcooren@inthepocket.com';
  var SUBJECT='Cycling Hub design v1 - feedback';
  var KEY='cycling-hub-design-v1-feedback';
  var MAX_URL=1800;
  var store={};
  try{store=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){store={};}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(store));}catch(e){}}
  var fields=[];
  document.querySelectorAll('.shot[id]').forEach(function(shot){
    var id=shot.id;
    var titleEl=shot.querySelector('.stitle');
    var title=titleEl?titleEl.textContent.trim():'';
    var box=document.createElement('div');
    box.className='fb-box';
    var tid='fb-'+id;
    var label=document.createElement('label');
    label.setAttribute('for',tid);
    label.textContent='Your feedback on '+id+(title?' · '+title:'');
    var ta=document.createElement('textarea');
    ta.id=tid; ta.rows=3; ta.dataset.fb=id;
    box.appendChild(label); box.appendChild(ta);
    shot.appendChild(box);
    fields.push(ta);
  });
  document.querySelectorAll('.qa-item textarea').forEach(function(ta){fields.push(ta);});
  var general=document.getElementById('fb-general');
  if(general) fields.push(general);
  function bullet(lines,key,v){
    var parts=v.split(/\r?\n/).map(function(l){return l.trim();}).filter(Boolean);
    lines.push('- '+key+': '+parts[0]);
    for(var i=1;i<parts.length;i++) lines.push('  '+parts[i]);
  }
  function buildBody(){
    var screens=[],answers=[],gen=[],n=0,q=0;
    fields.forEach(function(ta){
      var v=ta.value.trim();
      if(!v) return;
      var key=ta.dataset.fb;
      if(key==='General'){bullet(gen,key,v);}
      else if(ta.dataset.q){q++;answers.push('- '+key+' '+ta.dataset.q);v.split(/\r?\n/).map(function(l){return l.trim();}).filter(Boolean).forEach(function(p){answers.push('  > '+p);});}
      else{n++;bullet(screens,key,v);}
    });
    var out=[];
    if(screens.length) out.push('SCREENS\n'+screens.join('\n'));
    if(answers.length) out.push('OPEN QUESTIONS\n'+answers.join('\n'));
    if(gen.length) out.push('GENERAL\n'+gen.join('\n'));
    var body=out.length?('Feedback on the Cycling Hub design (v1):\n\n'+out.join('\n\n')+'\n'):'';
    return {body:body,screens:n,questions:q,general:gen.length>0,any:out.length>0};
  }
  var mail=document.getElementById('fb-mail');
  var preview=document.getElementById('fb-preview');
  var count=document.getElementById('fb-count');
  var warn=document.getElementById('fb-warn');
  var status=document.getElementById('fb-status');
  function refresh(){
    var r=buildBody();
    var href='mailto:'+TO+'?subject='+encodeURIComponent(SUBJECT)+'&body='+encodeURIComponent(r.body);
    mail.href=href;
    mail.setAttribute('aria-disabled',r.any?'false':'true');
    preview.value=r.body;
    var bits=[];if(r.screens)bits.push(r.screens+' screen'+(r.screens===1?'':'s'));if(r.questions)bits.push(r.questions+' question'+(r.questions===1?'':'s')+' answered');if(r.general)bits.push('general feedback');
    count.textContent=r.any?('Ready to send: '+bits.join(' + ')+'.'):'No feedback written yet.';
    warn.style.display=(r.any&&href.length>MAX_URL)?'block':'none';
    fields.forEach(function(ta){
      var has=!!ta.value.trim();
      if(ta.parentNode.classList.contains('fb-box')||ta.parentNode.classList.contains('qa-item')) ta.parentNode.classList.toggle('has-fb',has);
      var sec=ta.closest('section.flow'); if(sec){var a=document.querySelector('.toc a[href="#'+sec.id+'"]');
        if(a){var any=[].some.call(sec.querySelectorAll('textarea'),function(t){return !!t.value.trim();});a.classList.toggle('fb-done',any);}}
    });
  }
  fields.forEach(function(ta){
    if(store[ta.dataset.fb]) ta.value=store[ta.dataset.fb];
    ta.addEventListener('input',function(){
      if(ta.value.trim()) store[ta.dataset.fb]=ta.value; else delete store[ta.dataset.fb];
      save(); refresh();
    });
  });
  document.getElementById('fb-copy').addEventListener('click',function(){
    var text='To: '+TO+'\nSubject: '+SUBJECT+'\n\n'+buildBody().body;
    function done(){status.textContent='Copied. Paste it into an email to '+TO+'.';}
    function fallback(){preview.focus();preview.select();try{document.execCommand('copy');done();}catch(e){status.textContent='Select the text in the preview and copy it manually.';}}
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done,fallback);}else{fallback();}
  });
  document.getElementById('fb-clear').addEventListener('click',function(){
    if(!confirm('Remove all feedback you wrote on this page?')) return;
    fields.forEach(function(ta){ta.value='';});
    store={}; save(); refresh();
    status.textContent='All feedback cleared.';
  });
  refresh();
})();
</script>"""

TOC = [('system', 'Design system'), ('shell', 'App shell'), ('signin', 'Sign in'), ('import', 'Import'), ('settings', 'Settings'),
       ('rides', 'Rides'), ('background', 'Background'), ('decided', 'Decided'), ('feedback', 'Send feedback')]
toc = '<ul class="toc">' + ''.join(f'<li><a href="#{k}">{t}</a></li>' for k, t in TOC) + '</ul>'

ui_css = UI_CSS
page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cycling Hub design V1</title>
<style>
/* ---- src/styles/tokens.css, inlined verbatim ---- */
{TOKENS}
{ui_css}
{DOC_CSS}
</style></head><body>
{SPRITE}
<main class="doc">
<h1>Cycling Hub design V1</h1>
<p class="intro">Deep Ocean, turned into a design system and every screen of Sprints 0 to 2, on phone and desktop, dark and light.</p>
<p class="intro2">Updated 17 Oct 2026 with the PO's design review (D-PO1 to D-PO7, see Decided). Screen IDs match the wireframes. Leave a note under any screen and send it all in one email at the end. This page follows your system theme; every frame shows its own theme.</p>
{toc}
{"".join(P)}
</main>
{SCRIPT}
</body></html>'''
os.makedirs(os.path.join(ROOT, 'docs/design/V1'), exist_ok=True)
open(os.path.join(ROOT, 'docs/design/V1/index.html'), 'w').write(page)
print('written', len(page))
