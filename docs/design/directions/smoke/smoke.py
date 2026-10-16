"""Generate iridescent smoke SVG backgrounds and write them into the fragments (between smoke markers)."""
import pathlib, re, sys, urllib.parse

D = pathlib.Path('/home/user/cycling-hub/docs/design/directions')
OUT = pathlib.Path('/tmp/claude-0/-home-user-cycling-hub/b423f3f8-90e2-5e5d-b3fe-007a8d43be0b/scratchpad/smokegen')

def layer(i, W, H, seed, freq, warp, band, blur, stops, angle, op, rot=-28, oct=4):
    """One wisp layer: banded fractal noise (thin veins), warped into swirls, coloured by a gradient.
    The layer is rotated so the streaks flow diagonally; its box is oversized so no edge shows."""
    fx, fy = freq
    x1, y1, x2, y2 = angle
    M = int(max(W, H) * .45); P = int(warp[1])
    X, Y, RW, RH = -M, -M, W + 2*M, H + 2*M
    st = ''.join(f"<stop offset='{o}' stop-color='{c}'/>" for o, c in stops)
    return (f"<linearGradient id='g{i}' gradientUnits='userSpaceOnUse' spreadMethod='reflect' x1='{x1*W}' y1='{y1*H}' x2='{x2*W}' y2='{y2*H}'>{st}</linearGradient>"
            f"<filter id='f{i}' x='{X-P}' y='{Y-P}' width='{RW+2*P}' height='{RH+2*P}' filterUnits='userSpaceOnUse' color-interpolation-filters='sRGB'>"
            f"<feTurbulence type='fractalNoise' baseFrequency='{fx} {fy}' numOctaves='{oct}' seed='{seed}'/>"
            f"<feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0' result='a'/>"
            f"<feTurbulence type='fractalNoise' baseFrequency='{warp[0]}' numOctaves='2' seed='{seed+7}' result='w'/>"
            f"<feDisplacementMap in='a' in2='w' scale='{warp[1]}' xChannelSelector='R' yChannelSelector='G'/>"
            f"<feComponentTransfer><feFuncA type='table' tableValues='{band}'/></feComponentTransfer>"
            f"<feGaussianBlur stdDeviation='{blur}' result='m'/>"
            f"<feComposite in='SourceGraphic' in2='m' operator='in'/></filter>"
            ), (f"<rect x='{X}' y='{Y}' width='{RW}' height='{RH}' fill='url(#g{i})' filter='url(#f{i})' opacity='{op}'"
                f" transform='rotate({rot} {W//2} {H//2})'/>")

def svg(W, H, layers, spots, top=None):
    defs, body = '', ''
    for i, L in enumerate(layers):
        d, b = layer(i, W, H, **L); defs += d; body += b
    # mask: smoke concentrated in a few soft elliptical spots
    mk = ''
    for j, (cx, cy, rx, ry, a) in enumerate(spots):
        defs += (f"<radialGradient id='r{j}'><stop offset='0' stop-color='#fff' stop-opacity='{a}'/>"
                 f"<stop offset='.3' stop-color='#fff' stop-opacity='{a*.75:.2f}'/><stop offset='.6' stop-color='#fff' stop-opacity='{a*.32:.2f}'/>"
                 f"<stop offset='.82' stop-color='#fff' stop-opacity='{a*.08:.2f}'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></radialGradient>")
        mk += f"<ellipse cx='{cx}' cy='{cy}' rx='{rx}' ry='{ry}' fill='url(#r{j})'/>"
    defs += f"<mask id='k' maskUnits='userSpaceOnUse' x='0' y='0' width='{W}' height='{H}'>{mk}</mask>"
    if top:  # dim the smoke behind the status bar and title (text sits directly on it)
        y0, y1, a = top
        defs += (f"<linearGradient id='t' gradientUnits='userSpaceOnUse' x1='0' y1='0' x2='0' y2='{H}'>"
                 f"<stop offset='{y0/H:.3f}' stop-color='#fff' stop-opacity='{a}'/><stop offset='{y1/H:.3f}' stop-color='#fff'/></linearGradient>"
                 f"<mask id='q' maskUnits='userSpaceOnUse' x='0' y='0' width='{W}' height='{H}'><rect width='{W}' height='{H}' fill='url(#t)'/></mask>")
        body = f"<g mask='url(#q)'>{body}</g>"
    return (f"<svg xmlns='http://www.w3.org/2000/svg' width='{W}' height='{H}' viewBox='0 0 {W} {H}'>"
            f"<defs>{defs}</defs><g mask='url(#k)'>{body}</g></svg>")

def uri(s):
    return 'data:image/svg+xml,' + s.replace('%', '%25').replace('#', '%23').replace('<', '%3C').replace('>', '%3E').replace('"', "'")

# veins (thin bright line), haze (broad soft body)
VEIN = '0 0 0 0 .08 .35 1 .35 .08 0 0 0 0'
VEIN2 = '0 0 .1 .5 .1 0 0 .12 .6 .12 0 0'
VEINS = '0 0 0 0 0 .02 .16 .55 .16 .03 .18 .9 .18 .03 .16 .5 .16 .02 0 0 0'
VEINS2 = '0 0 0 0 .02 .14 .45 .14 .03 .3 .03 .16 .6 .16 .03 .3 .02 0 0 0 0'
HAZE = '0 0 .05 .25 .55 .8 .55 .25 .05 0 0'

def make(pal, theme, W, H, spots, seeds, top=None):
    """pal: 4 hues. Haze body + two sets of fine veins, each coloured by a short reflected gradient."""
    c0, c1, c2, c3 = pal
    dark = theme == 'dark'
    L = [
        dict(seed=seeds[0], freq=(0.0026, 0.0055), warp=(0.0035, 240), band=HAZE, blur=8,
             stops=[(0, c0), (.5, c1), (1, c2)], angle=(0, 0, .9, .5), op=.30 if dark else .22),
        dict(seed=seeds[1], freq=(0.0032, 0.0075), warp=(0.0030, 300), band=VEINS, blur=2.8, oct=2,
             stops=[(0, c1), (.35, c2), (.7, c3), (1, c0)], angle=(.1, 0, .7, .45), op=.36 if dark else .32),
        dict(seed=seeds[2], freq=(0.0045, 0.0100), warp=(0.0040, 220), band=VEINS2, blur=2.4, oct=2,
             stops=[(0, c3), (.4, c0), (.75, c1), (1, c2)], angle=(.8, .1, .2, .5), op=.26 if dark else .24),
    ]
    return svg(W, H, L, spots, top)

CFG = {
  'midnight-teal': dict(dark=['#2DD4BF', '#67E8F9', '#A78BFA', '#F9A8D4'], light=['#14B8A6', '#22D3EE', '#8B5CF6', '#F472B6'],
                        desk='.dmain', dW=804, seeds=(3, 11, 23)),
  'graphite-lime': dict(dark=['#C6F432', '#2ED3E6', '#4D8EFF', '#B57BFF'], light=['#A3E635', '#22D3EE', '#3B82F6', '#A855F7'],
                        desk='.main', dW=800, seeds=(41, 53, 67)),
  'deep-ocean':    dict(dark=['#5B9BFF', '#56D2AC', '#9483F0', '#F5B47A'], light=['#3B82F6', '#2DBE97', '#8B5CF6', '#FDBA74'],
                        desk='.desk', dW=1000, seeds=(71, 83, 97)),
}
SPOTS = {
  'pd': [(0, 0, 340, 300, 1), (360, 430, 170, 280, .7)],
  'pl': [(0, 0, 300, 260, .8), (360, 744, 380, 440, 1)],
  'dk': lambda W: [(W, 0, 560, 360, .9), (W * .7, 600, 480, 220, .6)],
}

def build(slug):
    c = CFG[slug]; s0, s1, s2 = c['seeds']; W = c['dW']
    pd = make(c['dark'], 'dark', 360, 744, SPOTS['pd'], (s0, s1, s2), top=(70, 170, .5))
    pl = make(c['light'], 'light', 360, 744, SPOTS['pl'], (s1, s2, s0))
    dk = make(c['dark'], 'dark', W, 600, SPOTS['dk'](W), (s2, s0, s1))
    for n, x in (('pd', pd), ('pl', pl), ('dk', dk)):
        (OUT / f'{slug}-{n}.svg').write_text(x)
        assert len(uri(x)) < 15000, (slug, n, len(uri(x)))
    d = f'.dir-{slug}'
    bg = lambda x: f'background:url("{uri(x)}") center/cover no-repeat,var(--bg)!important'
    return ('/* smoke:start - Alternative: smoke (background only; cards stay opaque) */\n'
            f'{d} .phone.smoke.theme-dark{{{bg(pd)}}}\n'
            f'{d} .phone.smoke.theme-light{{{bg(pl)}}}\n'
            f'{d} {c["desk"]}.smoke{{{bg(dk)}}}\n'
            '/* smoke:end */\n')

if __name__ == '__main__':
    for slug in CFG:
        p = D / f'{slug}.fragment.html'; s = p.read_text()
        css = build(slug)
        if '/* smoke:start' in s:
            s = re.sub(r'/\* smoke:start.*?/\* smoke:end \*/\n', lambda m: css, s, flags=re.S)
        else:
            s = s.replace('</style>', css + '</style>', 1)
        p.write_text(s)
        print(slug, [len(l) for l in css.splitlines()])
