# /// script
# requires-python = ">=3.12"
# dependencies = ["pillow==11.3.0"]
# ///
"""Exact pixel comparison of PNG screenshots (threshold 0, anti-aliasing counted).

    uv run --no-project scripts/perf/pixel_diff.py <a.png> <b.png> [--max-pixels N] [--out diff.png]

Prints JSON: size match, differing pixel count and ratio, bounding box of the
difference. A pixel differs when any RGBA channel differs. Exits 1 when the
sizes differ or more than N pixels differ (default 0); pass the A/A noise floor
as N.
"""
import functools
import json
import pathlib
import sys

from PIL import Image, ImageChops


def compare(a_path: str, b_path: str, out: str | None) -> dict:
    a = Image.open(a_path).convert("RGBA")
    b = Image.open(b_path).convert("RGBA")
    result = {"a": pathlib.Path(a_path).name, "b": pathlib.Path(b_path).name,
              "sizeA": a.size, "sizeB": b.size, "sameSize": a.size == b.size}
    if a.size != b.size:
        result.update(differentPixels=None, ratio=None, bbox=None)
        return result
    # Per-channel maximum: a grayscale conversion would round small single-channel
    # changes to zero and drop alpha entirely.
    channel_max = functools.reduce(ImageChops.lighter, ImageChops.difference(a, b).split())
    mask = channel_max.point(lambda value: 255 if value else 0)
    count = mask.histogram()[255]
    result.update(differentPixels=count, ratio=count / (a.size[0] * a.size[1]), bbox=mask.getbbox())
    if out and count:
        highlight = Image.new("RGBA", a.size, (255, 0, 0, 255))
        Image.composite(highlight, a, mask).save(out)
    return result


def take(args: list[str], flag: str) -> str | None:
    if flag not in args:
        return None
    index = args.index(flag)
    value = args[index + 1]
    del args[index:index + 2]
    return value


def main() -> None:
    args = sys.argv[1:]
    out = take(args, "--out")
    max_pixels = int(take(args, "--max-pixels") or 0)
    if len(args) != 2:
        sys.exit(__doc__)
    result = compare(args[0], args[1], out)
    result["maxPixels"] = max_pixels
    result["pass"] = bool(result["sameSize"]) and result["differentPixels"] <= max_pixels
    print(json.dumps(result))
    sys.exit(0 if result["pass"] else 1)


if __name__ == "__main__":
    main()
