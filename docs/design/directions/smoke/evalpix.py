import json, re, sys
from PIL import Image
d='/tmp/claude-0/-home-user-cycling-hub/b423f3f8-90e2-5e5d-b3fe-007a8d43be0b/scratchpad/design/pix/'
items=json.load(open(d+'items.json'))
def lum(c):
    c=[x/255 for x in c[:3]]; c=[x/12.92 if x<=.03928 else ((x+.055)/1.055)**2.4 for x in c]
    return .2126*c[0]+.7152*c[1]+.0722*c[2]
fails=[];allr=[]
for it in items:
    if it.get('err'): continue
    m=re.findall(r'[\d.]+',it['color']); tc=tuple(int(float(x)) for x in m[:3])
    im=Image.open(d+f"{it['i']}.png").convert('RGB'); px=list(im.getdata())
    lt=lum(tc); rs=sorted(((max(lt,lum(p))+.05)/(min(lt,lum(p))+.05)) for p in px)
    r=rs[int(len(rs)*.05)]
    large=it['size']>=24 or (it['size']>=18.66 and it['w']>=700)
    need=3 if large else 4.5
    allr.append((r,it['sec'],it['txt']))
    if r<need: fails.append((round(r,2),need,it['sec'],it['txt'],it['color']))
print(len(items),'items; min',min(allr)[:3] if allr else None)
print('FAILS',len(fails)); [print(f) for f in fails]
