// UI stress audit: run inside a preview page; writes JSON findings into #audit.
(function () {
  function lum(c) {
    const m = c.match(/[\d.]+/g); if (!m) return null;
    const [r, g, b] = m.slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function alpha(c) { const m = c.match(/[\d.]+/g); return m && m.length > 3 ? Number(m[3]) : 1; }
  function bgOf(el) {
    for (let e = el; e; e = e.parentElement) {
      const bg = getComputedStyle(e).backgroundColor;
      if (bg && alpha(bg) > 0.5) return bg;
    }
    return "rgb(255,255,255)";
  }
  const out = [];
  document.querySelectorAll(".ph").forEach((ph, pi) => {
    const theme = ph.className.split(" ")[1];
    const P = ph.getBoundingClientRect();
    const sheets = ph.querySelectorAll(".sheet");
    const top = sheets.length ? sheets[sheets.length - 1] : ph;
    const abar = ph.querySelector(".abar");
    const scope = [top]; if (!sheets.length && abar) scope.push(abar);
    const name = el => (el.getAttribute("aria-label") || el.textContent || el.className).trim().replace(/\s+/g, " ").slice(0, 40);
    scope.forEach(root => {
      root.querySelectorAll("button").forEach(b => {
        const r = b.getBoundingClientRect();
        if (r.width === 0 || r.bottom < P.top || r.top > P.bottom) return;
        if (getComputedStyle(b).display === "none") return;
        if (r.height < 43.5 || r.width < 43.5) out.push({ theme, kind: "target<44", what: name(b), size: `${Math.round(r.width)}x${Math.round(r.height)}` });
        const cx = Math.min(Math.max(r.left + r.width / 2, P.left + 1), P.right - 1), cy = Math.min(Math.max(r.top + Math.min(r.height / 2, 20), P.top + 1), P.bottom - 1);
        const hit = document.elementFromPoint(cx, cy);
        if (hit && !b.contains(hit) && !hit.contains(b) && r.top > P.top + 40 && r.top < P.bottom - 60) out.push({ theme, kind: "occluded", what: name(b), by: (hit.className || hit.tagName).toString().slice(0, 30) });
      });
    });
    ph.querySelectorAll(".sttl").forEach(t => {
      if (sheets.length && !top.contains(t)) return;
      const r = t.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && !t.contains(hit)) out.push({ theme, kind: "occluded", what: "sheet title: " + name(t), by: (hit.className || hit.tagName).toString().slice(0, 30) });
    });
    ph.querySelectorAll("*").forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.display === "none") return;
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > P.right + 0.5 || r.left < P.left - 0.5) && r.top < P.bottom && r.bottom > P.top && !el.closest(".sheet.back") && !el.classList.contains("selg") && !el.classList.contains("here-row") && !el.classList.contains("island"))
        out.push({ theme, kind: "overflow-x", what: name(el), px: Math.round(Math.max(r.right - P.right, P.left - r.left)) });
      if (el.scrollWidth > el.clientWidth + 1 && cs.overflow === "hidden" && cs.textOverflow !== "ellipsis" && el.textContent.trim() && !el.classList.contains("ph") && !el.classList.contains("sbody") && !el.classList.contains("rbody"))
        out.push({ theme, kind: "clipped", what: name(el) });
    });
    if (theme !== "ax5") ph.querySelectorAll("p,span,button,h3,mark,b").forEach(el => {
      if (!el.childNodes.length || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
      if (sheets.length && !top.contains(el)) return;
      const r = el.getBoundingClientRect(); if (r.bottom < P.top || r.top > P.bottom || !r.width) return;
      const fg = getComputedStyle(el).color, bg = bgOf(el);
      const a = lum(fg), b = lum(bg); if (a == null || b == null) return;
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const big = parseFloat(getComputedStyle(el).fontSize) >= 24;
      if (ratio < (big ? 3 : 4.5)) out.push({ theme, kind: "contrast", what: name(el), ratio: ratio.toFixed(2) });
    });
  });
  const seen = new Set();
  const uniq = out.filter(o => { const k = JSON.stringify(o); if (seen.has(k)) return false; seen.add(k); return true; });
  const pre = document.createElement("pre"); pre.id = "audit"; pre.textContent = JSON.stringify(uniq); document.body.appendChild(pre);
})();
