"""
Builds the Play Store listing graphics from raw emulator screenshots.

    python scripts/play-graphics.py <screenshot-dir> <out-dir>

<screenshot-dir> must contain 720x1280 PNGs named home, bill, find, stock,
receipt and reports (the emulator's `screencap` output). Produces six framed
1080x1920 phone screenshots and a 1024x500 feature graphic in <out-dir>.
Requires Pillow; fonts come from the Inter package already in node_modules.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(ROOT, "node_modules", "@expo-google-fonts", "inter")
BOLD = os.path.join(FONT_DIR, "700Bold", "Inter_700Bold.ttf")
MEDIUM = os.path.join(FONT_DIR, "500Medium", "Inter_500Medium.ttf")
LOGO = os.path.join(ROOT, "assets", "logo-disc.png")

W, H = 1080, 1920
TOP = (13, 22, 46)      # deep navy
BOTTOM = (24, 78, 200)  # MOPX blue

SHOTS = [
    ("home", "Your shop at a glance", "Today's sales, stock and credit on one screen"),
    ("bill", "Bill 200 lines without scrolling", "Search the cart by name or price, even with a typo"),
    ("find", "See what's already in the cart", "Green badges show the quantity on the bill"),
    ("stock", "Every product one tap away", "Photos, units, categories and low-stock alerts"),
    ("receipt", "Receipts customers can read", "Print, share as PDF or send to a thermal printer"),
    ("reports", "Know what sold", "Daily and weekly sales, profit and margin"),
]


def gradient(size, top, bottom):
    w, h = size
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(w):
            px[x, y] = c
    return img


def blob(img, center, radius, color, alpha):
    """Soft circle for a little depth behind the phone."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius], fill=color + (alpha,))
    layer = layer.filter(ImageFilter.GaussianBlur(120))
    img.paste(layer, (0, 0), layer)


def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1], radius=radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def phone_shot(shot, headline, subline):
    canvas = gradient((W, H), TOP, BOTTOM).convert("RGBA")
    blob(canvas, (900, 200), 420, (58, 120, 255), 110)
    blob(canvas, (120, 1700), 380, (10, 40, 120), 160)
    d = ImageDraw.Draw(canvas)

    logo = Image.open(LOGO).convert("RGBA").resize((88, 88), Image.LANCZOS)
    canvas.paste(logo, (72, 64), logo)
    d.text((180, 86), "MOPX", font=ImageFont.truetype(MEDIUM, 34), fill=(210, 225, 255))

    d.text((72, 190), headline, font=ImageFont.truetype(BOLD, 64), fill="white")
    d.text((72, 276), subline, font=ImageFont.truetype(MEDIUM, 32), fill=(196, 212, 245))

    # Phone: a dark rounded bezel around the screenshot, scaled to fill the lower ~80 %.
    scale = 1.15
    inner = shot.resize((int(720 * scale), int(1280 * scale)), Image.LANCZOS)
    bezel = 26
    frame = Image.new("RGBA", (inner.width + bezel * 2, inner.height + bezel * 2), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle([0, 0, frame.width - 1, frame.height - 1], radius=74, fill=(18, 18, 22, 255))
    frame.paste(rounded(inner, 50), (bezel, bezel), rounded(inner, 50))
    shadow = Image.new("RGBA", (frame.width + 160, frame.height + 160), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([80, 100, 80 + frame.width, 100 + frame.height], radius=74, fill=(0, 0, 0, 150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(40))
    x = (W - frame.width) // 2
    y = 380
    canvas.paste(shadow, (x - 80, y - 80), shadow)
    canvas.paste(frame, (x, y), frame)
    return canvas.convert("RGB")


def feature_graphic():
    canvas = gradient((1024, 500), TOP, BOTTOM).convert("RGBA")
    blob(canvas, (880, 80), 300, (58, 120, 255), 120)
    blob(canvas, (80, 480), 260, (10, 40, 120), 170)
    d = ImageDraw.Draw(canvas)
    logo = Image.open(LOGO).convert("RGBA").resize((300, 300), Image.LANCZOS)
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([60, 60, 400, 400], fill=(80, 140, 255, 120))
    glow = glow.filter(ImageFilter.GaussianBlur(60))
    canvas.paste(glow, (0, 0), glow)
    canvas.paste(logo, (80, 100), logo)
    d.text((430, 118), "MOPX", font=ImageFont.truetype(BOLD, 92), fill="white")
    d.text((434, 232), "Billing & stock for small shops", font=ImageFont.truetype(MEDIUM, 36), fill=(220, 232, 255))
    d.text((434, 288), "Scan barcodes, print receipts, track credit", font=ImageFont.truetype(MEDIUM, 26), fill=(190, 208, 245))
    d.text((434, 328), "Works offline. No account needed.", font=ImageFont.truetype(MEDIUM, 26), fill=(190, 208, 245))
    return canvas.convert("RGB")


def main(src, out):
    os.makedirs(out, exist_ok=True)
    for index, (name, headline, subline) in enumerate(SHOTS, start=1):
        shot = Image.open(os.path.join(src, f"{name}.png")).convert("RGB")
        if shot.size != (720, 1280):
            shot = shot.resize((720, 1280), Image.LANCZOS)
        target = os.path.join(out, f"phone-{index:02d}-{name}-1080x1920.png")
        phone_shot(shot, headline, subline).save(target, optimize=True)
        print("wrote", target)
    target = os.path.join(out, "feature-graphic-1024x500.png")
    feature_graphic().save(target, optimize=True)
    print("wrote", target)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
