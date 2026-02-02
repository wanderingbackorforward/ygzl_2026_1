# -*- coding: utf-8 -*-
"""
Prepare tunnel images for web display.
Converts PNG/JPG to WebP, generates thumbnails, and writes a manifest.json.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from PIL import Image


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare tunnel images for web display")
    parser.add_argument("--src", required=True, help="Source directory containing images")
    parser.add_argument("--dst", required=True, help="Destination directory for web assets")
    parser.add_argument("--max-size", type=int, default=2560, help="Max edge length for main images")
    parser.add_argument("--thumb-size", type=int, default=512, help="Max edge length for thumbnails")
    parser.add_argument("--quality", type=int, default=80, help="WebP quality (0-100)")
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
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        elif img.mode == "RGBA":
            bg = Image.new("RGB", img.size, (0, 0, 0))
            bg.paste(img, mask=img.split()[-1])
            img = bg
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
    supported = {".png", ".jpg", ".jpeg"}

    for src_path in sorted(src_dir.rglob("*")):
        if not src_path.is_file():
            continue
        if src_path.suffix.lower() not in supported:
            continue

        stem = src_path.stem
        main_name = f"{stem}.webp"
        thumb_name = f"{stem}.webp"

        main_path = dst_dir / main_name
        thumb_path = thumb_dir / thumb_name

        width, height = _convert_image(src_path, main_path, args.max_size, args.quality)
        _convert_image(src_path, thumb_path, args.thumb_size, max(50, args.quality - 10))

        manifest.append(
            {
                "id": stem,
                "image": f"assets/tunnel/{main_name}",
                "thumb": f"assets/tunnel/thumbs/{thumb_name}",
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
