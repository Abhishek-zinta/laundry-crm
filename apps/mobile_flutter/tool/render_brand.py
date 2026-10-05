"""Renders the RinseOps wave mark (same geometry as apps/web/src/app/icon.svg)
into the PNGs used by flutter_launcher_icons and flutter_native_splash.
Usage: python3 tool/render_brand.py   (writes assets/branding/*.png)"""
from PIL import Image, ImageDraw

TEAL = (15, 118, 110, 255)
WHITE = (255, 255, 255, 255)
SS = 4  # supersampling factor for smooth curves

def cubic(p0, p1, p2, p3, n=48):
    return [tuple((1-t)**3*a + 3*(1-t)**2*t*b + 3*(1-t)*t**2*c + t**3*d for a, b, c, d in zip(p0, p1, p2, p3))
            for t in (i / n for i in range(n + 1))]

def wave(y):
    # SVG: M9 y c2.2 1.6 4.5 1.6 7 0 s4.8-1.6 7 0  (32x32 viewBox)
    a = cubic((9, y), (11.2, y + 1.6), (13.5, y + 1.6), (16, y))
    # smooth curveto: first control point mirrors the previous one about (16, y)
    b = cubic((16, y), (18.5, y - 1.6), (20.8, y - 1.6), (23, y))
    return a + b[1:]

def mark(size, *, scale, background=None, rounded=False, stroke=2.0):
    """scale: fraction of the canvas the 32-unit viewBox occupies (centred)."""
    S = size * SS
    img = Image.new('RGBA', (S, S), background or (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 8 / 32, fill=TEAL)
    unit = S * scale / 32
    off = (S - 32 * unit) / 2
    w = stroke * unit
    for y in (10.5, 15.5, 20.5):
        pts = [(off + x * unit, off + yy * unit) for x, yy in wave(y)]
        # Stamp round discs densely along the curve: solid stroke, round caps, no join seams.
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            steps = max(1, int(((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5 / (w / 8)))
            for k in range(steps + 1):
                x, yy = x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps
                d.ellipse([x - w / 2, yy - w / 2, x + w / 2, yy + w / 2], fill=WHITE)
    return img.resize((size, size), Image.LANCZOS)

out = 'assets/branding/'
# Legacy/iOS icon: full-bleed teal square (launchers/iOS apply their own mask).
mark(1024, scale=1.0, background=TEAL).save(out + 'icon.png')
# Adaptive-icon foreground: waves only. flutter_launcher_icons adds a 16% inset,
# which keeps the mark inside the adaptive-icon safe zone at the favicon's proportions.
mark(1024, scale=1.0, stroke=2.0).save(out + 'icon_foreground.png')
# Splash logo (pre-Android 12 and iOS): the rounded tile from the web favicon.
mark(768, scale=1.0, rounded=True).save(out + 'splash_logo.png')
# Android 12+ splash icon: waves on transparent; the system draws the teal circle.
mark(1152, scale=0.5, stroke=2.2).save(out + 'splash_android12.png')
print('wrote', out)
