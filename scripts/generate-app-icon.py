from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LOGO = ROOT.parent / 'logo.jpg'
RES = ROOT / 'android' / 'app' / 'src' / 'main' / 'res'
SIZES = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
}


def generate_icons(logo_path: Path = DEFAULT_LOGO) -> None:
    img = Image.open(logo_path).convert('RGBA')
    width, height = img.size
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    square = img.crop((left, top, left + side, top + side))

    for folder, size in SIZES.items():
        out_dir = RES / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        icon = square.resize((size, size), Image.Resampling.LANCZOS)
        icon.save(out_dir / 'ic_launcher.png')
        icon.save(out_dir / 'ic_launcher_round.png')
        print(f'Wrote {folder} {size}x{size}')


if __name__ == '__main__':
    generate_icons()
