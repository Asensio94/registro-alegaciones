"""Build docs/: one self-contained page (common style, logo, app CSS and JS inlined) and what makes it
installable as an app (manifest, service worker, icons).

The page carries code only. Each organisation's data lives in its own shared folder.
Usage: python build.py
"""

import hashlib
import json
import math
import re
from pathlib import Path

from estilo.logo import LOGO_SVG, favicon_link

ROOT = Path(__file__).parent
APP = ROOT / "app"
ACCENT, ACCENT_DARK = "#c03a55", "#f590a5"  # a lighter shade of the observatory's red: its private companion
SCRIPTS = ["deadlines.js", "store.js", "mail.js", "demo.js", "app.js"]


def build() -> Path:
    page = (APP / "index.html").read_text(encoding="utf-8")
    parts = {
        "<!--FAVICON-->": favicon_link(ACCENT, ACCENT_DARK),
        "<!--LOGO-->": LOGO_SVG,
        "/*COMMON_CSS*/": (ROOT / "estilo" / "common.css").read_text(encoding="utf-8"),
        "/*APP_CSS*/": (APP / "app.css").read_text(encoding="utf-8"),
        "/*SCRIPTS*/": "\n".join((APP / s).read_text(encoding="utf-8") for s in SCRIPTS),
    }
    for marker, text in parts.items():
        assert page.count(marker) == 1, marker
        page = page.replace(marker, text)
    assert "</script" not in parts["/*SCRIPTS*/"], "a script would close the inline <script> early"
    out = ROOT / "docs" / "index.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(page, encoding="utf-8")
    (ROOT / "docs" / ".nojekyll").touch()
    build_pwa(out.parent, page)
    return out


# --- Installable app: manifest, service worker and icons -------------------------------------------
# The icons are the robin of estilo/logo.py, drawn here with Pillow so the shape stays the shared one.

PAPER, INK = "#faf8f6", "#221d1a"
ICONS = {"icon-192.png": (192, 0.8), "icon-512.png": (512, 0.8), "icon-maskable-512.png": (512, 0.6)}
ROBIN_BOX = (7, 12, 60, 61)  # x0, y0, x1, y1 of the drawing in the 64-unit viewBox


def _flatten(d: str) -> list[list[tuple[float, float]]]:
    """Polygons for an SVG path (M L H V C A Z, absolute and relative), curves cut into segments."""
    tokens = re.findall(r"[MmLlHhVvCcAaZz]|-?(?:\d+\.?\d*|\.\d+)", d)
    polys, cur, x, y, sx, sy, cmd, i = [], [], 0.0, 0.0, 0.0, 0.0, "", 0

    def nums(n):
        nonlocal i
        out = [float(t) for t in tokens[i:i + n]]
        i += n
        return out

    while i < len(tokens):
        if tokens[i].isalpha():
            cmd = tokens[i]
            i += 1
            if cmd in "Zz":
                if cur:
                    polys.append(cur)
                cur, x, y = [], sx, sy
                continue
        rel = cmd.islower()
        c = cmd.upper()
        ox, oy = (x, y) if rel else (0.0, 0.0)
        if c == "M":
            if cur:
                polys.append(cur)
            px, py = nums(2)
            x, y = sx, sy = ox + px, oy + py
            cur = [(x, y)]
            cmd = "l" if rel else "L"  # further pairs after M are line-tos
        elif c == "L":
            px, py = nums(2)
            x, y = ox + px, oy + py
            cur.append((x, y))
        elif c == "H":
            (px,) = nums(1)
            x = (x if rel else 0.0) + px
            cur.append((x, y))
        elif c == "V":
            (py,) = nums(1)
            y = (y if rel else 0.0) + py
            cur.append((x, y))
        elif c == "C":
            x1, y1, x2, y2, px, py = nums(6)
            p0, p1, p2, p3 = (x, y), (ox + x1, oy + y1), (ox + x2, oy + y2), (ox + px, oy + py)
            for k in range(1, 25):
                t = k / 24
                cur.append(tuple((1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * e + t ** 3 * f
                                 for a, b, e, f in zip(p0, p1, p2, p3)))
            x, y = p3
        elif c == "A":
            rx, ry, rot, large, sweep, px, py = nums(7)
            ex, ey = ox + px, oy + py
            cur.extend(_arc(x, y, rx, ry, rot, bool(large), bool(sweep), ex, ey))
            x, y = ex, ey
    if cur:
        polys.append(cur)
    return polys


def _arc(x1, y1, rx, ry, rot, large, sweep, x2, y2, steps=48):
    """Points of an elliptical arc, from its endpoint form (SVG 1.1, appendix F.6.5)."""
    phi = math.radians(rot)
    cp, sp = math.cos(phi), math.sin(phi)
    dx, dy = (x1 - x2) / 2, (y1 - y2) / 2
    x1p, y1p = cp * dx + sp * dy, -sp * dx + cp * dy
    lam = x1p ** 2 / rx ** 2 + y1p ** 2 / ry ** 2
    if lam > 1:
        rx, ry = rx * math.sqrt(lam), ry * math.sqrt(lam)
    num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    k = math.sqrt(max(0.0, num / den)) * (1 if large != sweep else -1)
    cxp, cyp = k * rx * y1p / ry, -k * ry * x1p / rx
    cx, cy = cp * cxp - sp * cyp + (x1 + x2) / 2, sp * cxp + cp * cyp + (y1 + y2) / 2

    def angle(ux, uy, vx, vy):
        a = math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
        return a

    t1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    dt = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if not sweep and dt > 0:
        dt -= 2 * math.pi
    elif sweep and dt < 0:
        dt += 2 * math.pi
    pts = []
    for s in range(1, steps + 1):
        t = t1 + dt * s / steps
        pts.append((cx + rx * math.cos(t) * cp - ry * math.sin(t) * sp, cy + rx * math.cos(t) * sp + ry * math.sin(t) * cp))
    return pts


def _robin(size: int, fill: float):
    from PIL import Image, ImageDraw

    from estilo.logo import _BODY, _BREAST, _EYE, _EYE_FILL, _LEGS

    ss = 4
    big = size * ss
    img = Image.new("RGB", (big, big), PAPER)
    draw = ImageDraw.Draw(img)
    x0, y0, x1, y1 = ROBIN_BOX
    scale = big * fill / max(x1 - x0, y1 - y0)
    offx = big / 2 - (x0 + x1) / 2 * scale
    offy = big / 2 - (y0 + y1) / 2 * scale

    def tr(p):
        return (offx + p[0] * scale, offy + p[1] * scale)

    def shapes(svg, colour):
        for cx, cy, r in re.findall(r'<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"', svg):
            (px, py), rr = tr((float(cx), float(cy))), float(r) * scale
            draw.ellipse((px - rr, py - rr, px + rr, py + rr), fill=colour)
        for d in re.findall(r'<path d="([^"]+)"', svg):
            for poly in _flatten(d):
                draw.polygon([tr(p) for p in poly], fill=colour)

    shapes(_BODY, INK)
    for poly in _flatten(_BREAST):
        draw.polygon([tr(p) for p in poly], fill=ACCENT)
    shapes(_EYE, _EYE_FILL)
    width = 2.2 * scale
    for line in _flatten(_LEGS):
        pts = [tr(p) for p in line]
        draw.line(pts, fill=INK, width=round(width))
        for px, py in (pts[0], pts[-1]):
            draw.ellipse((px - width / 2, py - width / 2, px + width / 2, py + width / 2), fill=INK)
    return img.resize((size, size), Image.LANCZOS)


def build_pwa(out_dir: Path, page: str) -> None:
    for name, (size, fill) in ICONS.items():
        _robin(size, fill).save(out_dir / name, optimize=True)
    manifest = {
        "name": "Registro de alegaciones",
        "short_name": "Alegaciones",
        "description": "Expedientes, plazos y documentos de las alegaciones de una organización.",
        "lang": "es",
        "start_url": "./",
        "scope": "./",
        "display": "standalone",
        "background_color": PAPER,
        "theme_color": ACCENT,
        "icons": [
            {"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
            {"src": "icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
    }
    (out_dir / "manifest.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    version = hashlib.sha256(page.encode("utf-8")).hexdigest()[:12]
    precache = ["./", "index.html", "manifest.webmanifest", *ICONS]
    (out_dir / "sw.js").write_text(SW.replace("__VERSION__", version).replace("__PRECACHE__", json.dumps(precache)), encoding="utf-8")


# Network first: a new version is picked up as soon as there is connection; without it, the last one
# seen keeps working. Only this site's own files: the observatory feed and the data are never cached
# here (the data lives in the organisation's folder, not in the browser).
SW = """// Generated by build.py. Keeps the app usable offline; it never stores the organisation's data.
const CACHE = "registro-__VERSION__";
const PRECACHE = __PRECACHE__;
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith("registro-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("./index.html") : Response.error()))));
});
"""


if __name__ == "__main__":
    print(build())
