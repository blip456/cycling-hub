// Pixel-based contrast: for every text element on top of a gradient, hide the text, screenshot its box, and take the worst background pixel.
const {chromium}=require('playwright-core');const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1280,height:900}});
await p.goto('file:///home/user/cycling-hub/docs/design/directions/index.html');
const items=await p.evaluate(()=>{const out=[];let i=0;
 document.querySelectorAll('section.direction *').forEach(el=>{const own=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());if(!own)return;
  let grad=false;for(let e=el;e&&!e.matches('section');e=e.parentElement){const cs=getComputedStyle(e);if(cs.backgroundImage!=='none'){grad=true;break}const c=cs.backgroundColor;if(c!=='rgba(0, 0, 0, 0)'&&!/, 0\)$/.test(c))break}
  if(!grad)return;const cs=getComputedStyle(el);el.dataset.pix=i;out.push({i:i++,sec:el.closest('section').id,txt:el.textContent.trim().slice(0,30),color:cs.color,size:parseFloat(cs.fontSize),w:+cs.fontWeight})});return out});
const dir='/tmp/claude-0/-home-user-cycling-hub/b423f3f8-90e2-5e5d-b3fe-007a8d43be0b/scratchpad/design/pix/';fs.mkdirSync(dir,{recursive:true});
await p.addStyleTag({content:'[data-pix]{color:transparent!important;-webkit-text-fill-color:transparent!important} [data-pix] *{visibility:hidden}'});
for(const it of items){const l=p.locator(`[data-pix="${it.i}"]`);try{await l.screenshot({path:dir+it.i+'.png'})}catch(e){it.err=1}}
fs.writeFileSync(dir+'items.json',JSON.stringify(items));console.log(items.length);await b.close()})();
