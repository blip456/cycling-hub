import sys; sys.path.insert(0,'.')
from smoke import *
PAL={'A':(['#2DD4BF','#67E8F9','#A78BFA','#F9A8D4'],['#14B8A6','#22D3EE','#8B5CF6','#F472B6'])}
spots_dark=[(0,0,330,300,1),(360,430,160,260,.7)]
spots_light=[(0,0,300,260,.9),(360,700,330,360,1)]
h=''
for k,(pd,pl) in PAL.items():
    a=make(pd,'dark',360,744,spots_dark,(3,11,23)); b=make(pl,'light',360,744,spots_light,(5,17,29))
    print(len(a),len(b))
    h+=f'<div style="display:inline-block;margin:10px;width:360px;height:744px;background:url(&quot;{uri(a)}&quot;) center/cover no-repeat,#101217"></div>'
    h+=f'<div style="display:inline-block;margin:10px;width:360px;height:744px;background:url(&quot;{uri(b)}&quot;) center/cover no-repeat,#F3F6F9"></div>'
open('preview.html','w').write('<body style="margin:0;background:#888">'+h+'</body>')
