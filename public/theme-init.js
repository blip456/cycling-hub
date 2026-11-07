// P9: apply a stored theme choice before first paint (no flash). Without one the system setting decides.
// An external file, not an inline script: the Content-Security-Policy (vercel.json) is script-src 'self'.
// Keep the key and the colours in sync with src/lib/theme.ts.
(function () {
  try {
    var t = localStorage.getItem("theme");
    if (t !== "light" && t !== "dark") return;
    var root = document.documentElement;
    root.setAttribute("data-theme", t);
    root.style.colorScheme = t;
    var color = t === "light" ? "#F2F5F9" : "#111318";
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
      m.setAttribute("content", color);
    });
  } catch (e) {}
})();
