"""One-time: insert the 'Alternative: smoke' subsection (markup copies) into each fragment."""
import pathlib, re
D = pathlib.Path('/home/user/cycling-hub/docs/design/directions')

def between(s, a, b):
    i = s.index(a); j = s.index(b, i)
    return s[i:j]

def add_class(block, pattern, cls='smoke', count=1):
    new, n = re.subn(pattern, lambda m: m.group(0).replace('class="', f'class="{cls} ', 1) if False else m.group(0)[:-1] + f' {cls}"', block, count=count)
    assert n == count, (pattern, n)
    return new

# ---------- A ----------
p = D/'midnight-teal.fragment.html'; s = p.read_text()
if 'Alternative: smoke' not in s:
    rides = between(s, '    <!-- a. Rides list -->', '    <!-- b. Import summary -->')
    sett = between(s, '    <!-- c. Settings -->', '  </div>\n\n  <!-- d. Desktop -->')
    desk = between(s, '  <!-- d. Desktop -->', '  <!-- 7. Trade-offs -->')
    rides = add_class(rides, r'class="phone theme-dark"').replace('<div class="cap">Rides</div>', '<div class="cap">Rides · smoke</div>')
    sett = add_class(sett, r'class="phone theme-light"').replace('<div class="cap">Settings · light</div>', '<div class="cap">Settings · smoke</div>')
    desk = add_class(desk, r'class="dmain"').replace('<div class="cap">Desktop</div>', '<div class="cap">Desktop · smoke</div>')
    for x in (rides, sett, desk): assert 'smoke' in x
    sec = ('  <!-- 6b. Alternative: smoke -->\n  <h3 class="mt-h">Alternative: smoke</h3>\n'
           '  <p class="mt-note" style="margin:0 0 20px">Same screens, with an iridescent smoke background.</p>\n'
           '  <div class="mt-phones">\n\n' + rides + sett + '  </div>\n\n' + desk)
    s = s.replace('  <!-- 7. Trade-offs -->', sec + '  <!-- 7. Trade-offs -->', 1)
    p.write_text(s)

# ---------- B ----------
p = D/'graphite-lime.fragment.html'; s = p.read_text()
if 'Alternative: smoke' not in s:
    rides = between(s, '  <!-- a. Rides list (dark) -->', '  <!-- b. Import summary (dark) -->')
    sett = between(s, '  <!-- c. Settings (light) -->', '</div>\n\n<!-- d. Desktop -->')
    desk = between(s, '<!-- d. Desktop -->', '<!-- 7. Trade-offs -->')
    rides = add_class(rides, r'class="phone theme-dark"').replace('<p class="phone-cap">Rides</p>', '<p class="phone-cap">Rides · smoke</p>')
    sett = add_class(sett, r'class="phone theme-light"').replace('<p class="phone-cap">Settings · light</p>', '<p class="phone-cap">Settings · smoke</p>')
    desk = add_class(desk, r'class="main"').replace('text-align:center">Desktop</p>', 'text-align:center">Desktop · smoke</p>')
    for x in (rides, sett, desk): assert 'smoke' in x
    sec = ('<!-- 6b. Alternative: smoke -->\n<h3 class="sec">Alternative: smoke</h3>\n'
           '<p class="note" style="margin:0 0 20px">Same screens, with an iridescent smoke background.</p>\n'
           '<div class="phones">\n\n' + rides + sett + '</div>\n\n' + desk)
    s = s.replace('<!-- 7. Trade-offs -->', sec + '<!-- 7. Trade-offs -->', 1)
    p.write_text(s)

# ---------- C ----------
p = D/'deep-ocean.fragment.html'; s = p.read_text()
if 'Alternative: smoke' not in s:
    rides = between(s, '    <!-- a. Rides list -->', '    <!-- b. Import summary -->')
    sett = between(s, '    <!-- c. Settings light -->', '  </div>\n\n  <!-- d. Desktop -->')
    desk = between(s, '  <!-- d. Desktop -->', '  <!-- 7. Trade-offs -->')
    rides = add_class(rides, r'class="phone theme-dark"').replace('<p class="mock-cap">Rides</p>', '<p class="mock-cap">Rides · smoke</p>')
    sett = add_class(sett, r'class="phone theme-light"').replace('<p class="mock-cap">Settings · light</p>', '<p class="mock-cap">Settings · smoke</p>')
    desk = add_class(desk, r'class="desk theme-dark"').replace('<p class="mock-cap">Desktop</p>', '<p class="mock-cap">Desktop · smoke</p>')
    for x in (rides, sett, desk): assert 'smoke' in x
    sec = ('  <!-- 6b. Alternative: smoke -->\n  <h3 class="sec">Alternative: smoke</h3>\n'
           '  <p class="mock-cap" style="margin:0 0 20px">Same screens, with an iridescent smoke background.</p>\n'
           '  <div class="mocks">\n' + rides + sett + '  </div>\n\n' + desk)
    s = s.replace('  <!-- 7. Trade-offs -->', sec + '  <!-- 7. Trade-offs -->', 1)
    p.write_text(s)
print('ok')
