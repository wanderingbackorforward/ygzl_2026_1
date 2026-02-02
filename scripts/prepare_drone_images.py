# -*- coding: utf-8 -*-
"""
Prepare drone photos for web display.
Converts JPG to WebP, generates thumbnails, and writes a manifest.json.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare drone photos for web display")
    parser.add_argument("--src", required=True, help="Source directory containing drone photos")
    parser.add_argument("--dst", required=True, help="Destination directory for web assets")
    parser.add_argument("--max-size", type=int, default=1600, help="Max edge length for main images")
    parser.add_argument("--thumb-size", type=int, default=480, help="Max edge length for thumbnails")
    parser.add_argument("--quality", type=int, default=72, help="WebP quality (0-100)")
    parser.add_argument("--stride", type=int, default=1, help="Keep every Nth image")
    return parser.parse_args()


def _resize(img: Image.Image, max_edge: int) -> Image.Image:
    width, height = img.size
    max_current = max(width, height)
    if max_current <= max_edge:
        return img
    scale = max_edge / float(max_current)
    new_size = (int(width * scale), int(height * scale))
    return img.resize(new_size, Image.LANCZOS)


def _convert_image(src_path: Path, dst_path: Path, max_edge: int, quality: int) -> tuple[int, int]:
    with Image.open(src_path) as img:
        if img.mode != "RGB":
            img = img.convert("RGB")
        img = _resize(img, max_edge)
        dst_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(dst_path, "WEBP", quality=quality, method=6)
        return img.size


def main() -> None:
    args = _parse_args()
    src_dir = Path(args.src)
    dst_dir = Path(args.dst)
    thumb_dir = dst_dir / "thumbs"
    dst_dir.mkdir(parents=True, exist_ok=True)
    thumb_dir.mkdir(parents=True, exist_ok=True)

    manifest = []
    supported = {".jpg", ".jpeg"}
    all_images = [p for p in sorted(src_dir.rglob("*")) if p.is_file() and p.suffix.lower() in supported]

    if args.stride < 1:
        args.stride = 1

    for idx, src_path in enumerate(all_images):
        if idx % args.stride != 0:
            continue

        group = src_path.parent.name
        stem = src_path.stem
        safe_name = f"{group}_{stem}".replace(" ", "_")

        main_name = f"{safe_name}.webp"
        thumb_name = f"{safe_name}.webp"

        main_path = dst_dir / main_name
        thumb_path = thumb_dir / thumb_name

        width, height = _convert_image(src_path, main_path, args.max_size, args.quality)
        _convert_image(src_path, thumb_path, args.thumb_size, max(50, args.quality - 10))

        manifest.append(
            {
                "id": safe_name,
                "group": group,
                "image": f"assets/drone/{main_name}",
                "thumb": f"assets/drone/thumbs/{thumb_name}",
                "width": width,
                "height": height,
            }
        )

    manifest_path = dst_dir / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump({"items": manifest}, f, ensure_ascii=False, indent=2)

    print(f"[OK] Prepared {len(manifest)} images")
    print(f"[OK] Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
