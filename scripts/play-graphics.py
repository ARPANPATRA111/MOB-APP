"""
Builds the Play Store listing graphics from raw device screenshots.

    python scripts/play-graphics.py <screenshot-dir> <out-dir>

<screenshot-dir> holds PNGs named home, bill, find, stock, receipt and
reports, captured on a 1440x3120 (19.5:9) display — `adb shell wm size
1440x3120` and `wm density 560` on the emulator give exactly that. Produces
six 1440x2560 phone screenshots (9:16, the ratio Play prefers for featuring)
and the 1024x500 feature graphic. Everything is drawn at 2x and downsampled
so frame edges and text stay smooth. Requires Pillow; fonts come from the
Inter package in node_modules.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(ROOT, "node_modules", "@expo-google-fonts", "inter")
BOLD = os.path.join(FONT_DIR, "700Bold", "Inter_700Bold.ttf")
SEMIBOLD = os.path.join(FONT_DIR, "600SemiBold", "Inter_600SemiBold.ttf")
MEDIUM = os.path.join(FONT_DIR, "500Medium", "Inter_500Medium.ttf")
LOGO = os.path.join(ROOT, "assets", "logo-disc.png")

SS = 2  # supersampling factor
OUT_W, OUT_H = 1440, 2560
SHOT_W, SHOT_H = 1440, 3120

SHOTS = [
    ("home", "Your shop at a glance"),
    ("bill", "Fast, simple billing"),
    ("find", "Add items in a tap"),
    ("stock", "Stock under control"),
    ("receipt", "Clean, clear receipts"),
    ("reports", "Know what sells"),
]

# Brand gradient, kept desaturated so the white screen stays the focal point.
TOP_LEFT = (9, 16, 36)
BOTTOM_RIGHT = (23, 78, 194)


def font(path, size):
    return ImageFont.truetype(path, size * SS)


def diagonal_gradient(size, a, b):
    """Top-left → bottom-right gradient, built from two 1-D ramps for speed."""
    w, h = size
    ramp = Image.new("L", (w + h, 1))
    ramp.putdata([int(255 * i / (w + h - 1)) for i in range(w + h)])
    mask = Image.new("L", size)
    for y in range(h):
        mask.paste(ramp.crop((y, 0, y + w, 1)), (0, y))
    return Image.composite(Image.new("RGB", size, b), Image.new("RGB", size, a), mask)


def glow(img, center, radius, color, alpha, blur):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse(
        [center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius], fill=color + (alpha,)
    )
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(layer)


def background(size):
    img = diagonal_gradient(size, TOP_LEFT, BOTTOM_RIGHT).convert("RGBA")
    w, h = size
    glow(img, (int(w * 0.85), int(h * 0.12)), int(w * 0.45), (56, 132, 255), 90, int(w * 0.18))
    glow(img, (int(w * 0.1), int(h * 0.95)), int(w * 0.4), (4, 12, 40), 140, int(w * 0.18))
    return img


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return mask


def device(shot, screen_w):
    """
    A current flagship silhouette: flat glass, near-square corners, a thin
    uniform bezel, a centred punch-hole camera and side keys on a graphite
    titanium frame. `shot` is pasted 1:1 into the screen area, so the caller
    chooses the scale. Returns an RGBA image with the drop shadow baked in.
    """
    screen_h = round(screen_w * SHOT_H / SHOT_W)
    bezel = round(screen_w * 0.022)
    frame_r = round(screen_w * 0.075)
    screen_r = round(screen_w * 0.052)
    edge = max(2, round(screen_w * 0.0035))  # metallic rim thickness
    body_w, body_h = screen_w + 2 * bezel, screen_h + 2 * bezel
    pad = round(screen_w * 0.25)  # room for shadow and keys
    canvas = Image.new("RGBA", (body_w + 2 * pad, body_h + 2 * pad), (0, 0, 0, 0))
    ox, oy = pad, pad

    # Shadow.
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [ox, oy + round(screen_w * 0.06), ox + body_w, oy + body_h + round(screen_w * 0.06)],
        radius=frame_r,
        fill=(0, 0, 0, 120),
    )
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(round(screen_w * 0.07))))

    # Side keys (right: volume rocker and power), drawn before the body so they sit behind its edge.
    keys = ImageDraw.Draw(canvas)
    key_w = round(screen_w * 0.012)
    for top, height in ((0.20, 0.13), (0.36, 0.075)):
        y0 = oy + round(body_h * top)
        keys.rounded_rectangle(
            [ox + body_w - 1, y0, ox + body_w + key_w, y0 + round(body_h * height)],
            radius=key_w // 2,
            fill=(52, 56, 64, 255),
        )

    # Titanium rim: light outer line fading to the dark body.
    rim = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(rim).rounded_rectangle([ox, oy, ox + body_w, oy + body_h], radius=frame_r, fill=(150, 156, 168, 255))
    canvas.alpha_composite(rim)
    body = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle(
        [ox + edge, oy + edge, ox + body_w - edge, oy + body_h - edge], radius=frame_r - edge, fill=(24, 26, 31, 255)
    )
    canvas.alpha_composite(body)

    # Screen.
    screen = shot.convert("RGBA").resize((screen_w, screen_h), Image.LANCZOS)
    screen.putalpha(rounded_mask(screen.size, screen_r))
    canvas.alpha_composite(screen, (ox + bezel, oy + bezel))

    # Punch-hole camera, centred just below the top of the panel.
    hole_r = round(screen_w * 0.011)
    cx, cy = ox + bezel + screen_w // 2, oy + bezel + round(screen_w * 0.033)
    d = ImageDraw.Draw(canvas)
    d.ellipse([cx - hole_r - 2 * SS, cy - hole_r - 2 * SS, cx + hole_r + 2 * SS, cy + hole_r + 2 * SS], fill=(28, 30, 36, 255))
    d.ellipse([cx - hole_r, cy - hole_r, cx + hole_r, cy + hole_r], fill=(8, 9, 12, 255))
    d.ellipse([cx - hole_r // 3, cy - hole_r // 2, cx + hole_r // 3, cy], fill=(40, 46, 70, 255))

    # A faint sheen across the glass so it reads as a real panel, not a flat paste.
    sheen = Image.new("RGBA", screen.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheen)
    sd.polygon([(0, 0), (int(screen_w * 0.55), 0), (0, int(screen_h * 0.32))], fill=(255, 255, 255, 14))
    sheen = sheen.filter(ImageFilter.GaussianBlur(round(screen_w * 0.05)))
    sheen.putalpha(Image.composite(sheen.getchannel("A"), Image.new("L", screen.size, 0), rounded_mask(screen.size, screen_r)))
    canvas.alpha_composite(sheen, (ox + bezel, oy + bezel))

    return canvas, (ox, oy, body_w, body_h)


def brand_lockup(draw, canvas, cx, y, logo_px, text_px):
    logo = Image.open(LOGO).convert("RGBA").resize((logo_px, logo_px), Image.LANCZOS)
    f = font(SEMIBOLD, text_px)
    tw = draw.textlength("MOPX", font=f)
    gap = round(logo_px * 0.28)
    total = logo_px + gap + tw
    x = cx - total / 2
    canvas.alpha_composite(logo, (int(x), int(y)))
    draw.text((x + logo_px + gap, y + logo_px / 2), "MOPX", font=f, fill=(226, 234, 255), anchor="lm")


def phone_shot(shot, headline):
    W, H = OUT_W * SS, OUT_H * SS
    canvas = background((W, H))
    d = ImageDraw.Draw(canvas)

    brand_lockup(d, canvas, W / 2, 146 * SS, 64 * SS, 30)
    d.text((W / 2, 320 * SS), headline, font=font(BOLD, 78), fill="white", anchor="mm")

    # Device sized so the whole panel, bottom bar included, is visible.
    top = 440 * SS
    avail = H - top - 70 * SS
    screen_w = int((avail / (SHOT_H / SHOT_W + 2 * 0.022)))
    dev, (ox, oy, bw, bh) = device(shot, screen_w)
    canvas.alpha_composite(dev, ((W - bw) // 2 - ox, top - oy))
    return canvas.convert("RGB").resize((OUT_W, OUT_H), Image.LANCZOS)


def feature_graphic(shot):
    W, H = 1024 * SS, 500 * SS
    canvas = background((W, H))
    d = ImageDraw.Draw(canvas)

    # The disc is nearly black, so a soft glow lifts it off the navy corner.
    glow(canvas, (159 * SS, 167 * SS), 120 * SS, (70, 140, 255), 110, 40 * SS)
    logo = Image.open(LOGO).convert("RGBA").resize((150 * SS, 150 * SS), Image.LANCZOS)
    canvas.alpha_composite(logo, (84 * SS, 92 * SS))
    d.text((84 * SS, 296 * SS), "MOPX", font=font(BOLD, 84), fill="white", anchor="ls")
    d.text((86 * SS, 346 * SS), "Billing & stock for small shops", font=font(MEDIUM, 30), fill=(200, 214, 245), anchor="ls")
    d.text((86 * SS, 388 * SS), "Works offline · No account", font=font(MEDIUM, 24), fill=(160, 180, 225), anchor="ls")

    # Device on the right, running off the bottom edge.
    dev, (ox, oy, bw, bh) = device(shot, 330 * SS)
    canvas.alpha_composite(dev, (W - bw - 120 * SS - ox, 60 * SS - oy))
    return canvas.convert("RGB").resize((1024, 500), Image.LANCZOS)


def main(src, out):
    os.makedirs(out, exist_ok=True)
    shots = {}
    for name, _ in SHOTS:
        shot = Image.open(os.path.join(src, f"{name}.png")).convert("RGB")
        if shot.size != (SHOT_W, SHOT_H):
            shot = shot.resize((SHOT_W, SHOT_H), Image.LANCZOS)
        shots[name] = shot
    for index, (name, headline) in enumerate(SHOTS, start=1):
        target = os.path.join(out, f"phone-{index:02d}-{name}-{OUT_W}x{OUT_H}.png")
        phone_shot(shots[name], headline).save(target, optimize=True)
        print("wrote", target)
    target = os.path.join(out, "feature-graphic-1024x500.png")
    feature_graphic(shots["bill"]).save(target, optimize=True)
    print("wrote", target)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
