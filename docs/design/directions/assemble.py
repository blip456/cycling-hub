import sys, html, pathlib
root = pathlib.Path('/home/user/cycling-hub/docs/design')
dirs = [('midnight-teal','A','Midnight Teal'),('graphite-lime','B','Graphite & Lime'),('deep-ocean','C','Deep Ocean')]
import re
frag = {s:(root/'directions'/f'{s}.fragment.html').read_text() for s,_,_ in dirs}
for k in frag:
    frag[k]=re.sub(r'(<div class="desk-(?:outer|wrap|scale)")', r'<p class="swipe-hint">Desktop sketch: swipe sideways to see the whole screen.</p>\1', frag[k], count=1)
questions = [
 ('Q1','Which direction is closest to how Cycling Hub should feel? (A, B, C, or a mix — e.g. "A\'s surfaces with B\'s metric colours")'),
 ('Q2','Dark surfaces: blue-tinted (A, C) or neutral graphite (B)?'),
 ('Q3','Accent: teal (A), lime (B) or blue (C)? Or another from these families?'),
 ('Q4','Metric colours: vivid (B), balanced (A) or muted (C)? Any metric whose colour feels wrong (e.g. heart rate should be red)?'),
 ('Q5','Glow and depth: none, subtle (as shown) or more?'),
 ('Q6','Light mode: does it feel as good as dark in your favourite direction? Anything missing?'),
 ('Q7','Anything you want to see explored that is not here?'),
]
toc = ''.join(f'<a href="#{s}">Direction {l} · {html.escape(n)}</a>' for s,l,n in dirs)
sections = ''
for s,l,n in dirs:
    sections += frag[s] + f'''
<div class="fb"><label for="fb-{s}">Your feedback on Direction {l} · {html.escape(n)}</label>
<textarea id="fb-{s}" data-key="Direction {l} ({html.escape(n)})" rows="4"></textarea>
<p class="help">What do you like, what not? Saved in this browser.</p></div>'''
qs = ''.join(f'''<div class="fb"><label for="q-{q}"><b>{q}</b> {html.escape(t)}</label>
<textarea id="q-{q}" data-key="{q} {html.escape(t)}" rows="2"></textarea></div>''' for q,t in questions)
RESP = r'''
.page .swipe-hint{display:none;font-size:13px;margin:0 0 8px;opacity:.75}
@media (max-width:900px){
 .page{padding:20px 12px 64px}
 .page h1{font-size:24px}
 .page .direction{border-radius:16px;margin-top:32px}
 .page section.direction{padding:32px 16px 40px!important}
 .page section.direction .dir-title{font-size:28px!important}
 .page .dir-midnight-teal .mt-pal,.page .dir-midnight-teal .mt-metrics,.page .dir-midnight-teal .mt-type,.page .dir-midnight-teal .mt-comp,.page .dir-midnight-teal .mt-why,
 .page .dir-graphite-lime .two,
 .page .dir-deep-ocean .two,.page .dir-deep-ocean .why{grid-template-columns:1fr!important}
 .page .dir-graphite-lime .metric-grid{grid-template-columns:repeat(3,1fr)!important}
 .page .dir-midnight-teal .mt-palcard,.page .dir-deep-ocean .panel,.page .dir-graphite-lime .panel{padding:16px!important}
 .page section.direction h1,.page section.direction h2{word-break:break-word}
 .page .dir-midnight-teal .desk-outer,.page .dir-graphite-lime .desk-wrap,.page .dir-deep-ocean .desk-scale{width:100%!important;max-width:100%;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch}
 .page .swipe-hint{display:block}
 .page .dir-midnight-teal .mt-phones,.page .dir-graphite-lime .phones,.page .dir-deep-ocean .mocks{justify-content:center;gap:20px!important}
 .page .dir-deep-ocean .tab span{min-width:0!important}
}
@media (max-width:520px){
 .page .dir-midnight-teal .mt-sw,.page .dir-graphite-lime .swatches,.page .dir-deep-ocean .sw-grid{grid-template-columns:repeat(2,1fr)!important}
 .page .dir-midnight-teal .mt-mrow{grid-template-columns:repeat(2,1fr)!important}
 .page .dir-graphite-lime .metric-grid{grid-template-columns:repeat(2,1fr)!important}
 .page .dir-deep-ocean .met-grid{grid-template-columns:1fr!important}
 .page .dir-midnight-teal .type-row,.page .dir-graphite-lime .type-row,.page .dir-deep-ocean .type-row{flex-wrap:wrap}
 .page .dir-graphite-lime .type-row .tag,.page .dir-deep-ocean .type-row .lbl{width:100%!important}
 .page section.direction .phone{zoom:.86}
}
@media (max-width:360px){ .page section.direction .phone{zoom:.76} }
'''
page = f'''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Cycling Hub — design directions V1</title>
<style>
.page{{font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1d2330;max-width:1240px;margin:0 auto;padding:32px 20px 80px;line-height:1.5}}
.page h1{{font-size:30px;margin:0 0 6px}} .page .lead{{color:#4a5263;max-width:760px}}
.page nav.toc{{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0 28px}} .page nav.toc a{{padding:10px 16px;border-radius:999px;background:#e9edf3;color:#1d2330;text-decoration:none;font-weight:600}}
.page .direction{{margin:48px 0 0;border-radius:24px;overflow:hidden}}
.page .fb{{margin:16px 0 0;background:#f4f6f9;border:1px solid #d7dce4;border-radius:16px;padding:16px}}
.page .fb label{{display:block;font-weight:600;margin-bottom:8px}} .page .fb textarea{{width:100%;box-sizing:border-box;font:inherit;border:1px solid #b9c0cc;border-radius:12px;padding:10px;background:#fff}}
.page .help{{color:#5a6273;font-size:13px;margin:6px 0 0}}
.page h2.sec{{margin:64px 0 8px;font-size:24px}}
.page .send{{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}} .page .send a,.page .send button{{min-height:44px;padding:0 20px;border-radius:999px;border:0;font:inherit;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;text-decoration:none}}
.page .send .p{{background:#1d2330;color:#fff}} .page .send .s{{background:#e9edf3;color:#1d2330}}
{RESP}</style></head><body style="margin:0;background:#fbfcfd"><div class="page">
<h1>Cycling Hub — design directions V1</h1>
<p class="lead">Three high-level directions built on your design brief (calm &amp; analytical, dark-first with an equally good light mode, blue/teal or green/lime accents, one clean sans, soft rounded shapes, fixed colour per metric). They differ in surface tone, accent and how vivid the metric colours are. Pick one, or combine parts. Numbers are sample data. After you choose, the wireframes become real designs plus <code>DESIGN.md</code> and design tokens.</p>
<p class="lead"><b>Accessibility:</b> all three directions are checked against WCAG 2.2 AA (contrast of text, input borders, focus rings, selected states, target sizes) and pass after the fixes listed in <code>docs/design/directions/accessibility-audit.md</code>.</p>
<nav class="toc">{toc}<a href="#questions">Questions &amp; send</a></nav>
{sections}
<h2 class="sec" id="questions">Questions</h2>
<p class="lead">Answer what you have an opinion on; skip the rest.</p>
{qs}
<div class="fb"><label for="q-general">Anything else</label><textarea id="q-general" data-key="General" rows="3"></textarea></div>
<div class="send"><a class="p" id="mail" href="#">Send your feedback by email</a><button class="s" id="copy" type="button">Copy feedback</button><button class="s" id="clear" type="button">Clear</button></div>
<p class="help" id="status"></p>
</div>
<script>
const K='cycling-hub-design-directions-v1';const st=JSON.parse(localStorage.getItem(K)||'{{}}');
const tas=[...document.querySelectorAll('textarea[data-key]')];
tas.forEach(t=>{{t.value=st[t.id]||'';t.addEventListener('input',()=>{{st[t.id]=t.value;localStorage.setItem(K,JSON.stringify(st));upd()}})}});
function body(){{return 'Feedback on the Cycling Hub design directions (V1):\\n\\n'+tas.filter(t=>t.value.trim()).map(t=>'- '+t.dataset.key+'\\n  > '+t.value.trim().replace(/\\n/g,'\\n  > ')).join('\\n')}}
function upd(){{document.getElementById('mail').href='mailto:yoran.broodcooren@inthepocket.com?subject='+encodeURIComponent('Cycling Hub design directions V1 - feedback')+'&body='+encodeURIComponent(body());
document.getElementById('status').textContent=tas.filter(t=>t.value.trim()).length+' answers filled in.'}}
document.getElementById('copy').onclick=()=>navigator.clipboard.writeText(body()).then(()=>document.getElementById('status').textContent='Copied. Paste it in the chat with Claude.');
document.getElementById('clear').onclick=()=>{{if(confirm('Clear all feedback?')){{localStorage.removeItem(K);tas.forEach(t=>t.value='');for(const k in st)delete st[k];upd()}}}};
upd();
</script></body></html>'''
out = root/'directions'/'index.html'
out.write_text(page)
print(out, len(page))
