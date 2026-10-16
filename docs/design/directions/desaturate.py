import re,sys,colorsys
K=float(sys.argv[2]); path=sys.argv[1]
def lin(c): c/=255; return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
def gam(c): c=max(0,min(1,c)); v=12.92*c if c<=0.0031308 else 1.055*c**(1/2.4)-0.055; return round(v*255)
def bluish_dark(r,g,b):
    h,l,s=colorsys.rgb_to_hls(r/255,g/255,b/255)
    return 0.5<=h<=0.72 and s>0.12 and (l<0.32 or (l<0.92 and s<0.35 and b>r))
def fix(r,g,b):
    R,G,B=lin(r),lin(g),lin(b); Y=0.2126*R+0.7152*G+0.0722*B
    return tuple(gam(Y+K*(c-Y)) for c in (R,G,B))
t=open(path).read(); changed={}
def hx(m):
    s=m.group(0); v=s[1:]
    r,g,b=int(v[0:2],16),int(v[2:4],16),int(v[4:6],16)
    if not bluish_dark(r,g,b): return s
    n='#%02X%02X%02X'%fix(r,g,b); changed[s]=n; return n
t=re.sub(r'#[0-9A-Fa-f]{6}\b',hx,t)
def rg(m):
    r,g,b=int(m.group(1)),int(m.group(2)),int(m.group(3))
    if not bluish_dark(r,g,b): return m.group(0)
    r2,g2,b2=fix(r,g,b); changed[m.group(0)]='rgba(%d,%d,%d,'%(r2,g2,b2); return 'rgba(%d,%d,%d,'%(r2,g2,b2)
t=re.sub(r'rgba\((\d+),\s*(\d+),\s*(\d+),',rg,t)
open(path,'w').write(t)
for a,b in sorted(changed.items()): print(a,'->',b)
