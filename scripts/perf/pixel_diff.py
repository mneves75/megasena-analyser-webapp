# /// script
# requires-python = ">=3.12"
# dependencies = ["pillow==11.3.0"]
# ///
"""Exact pixel comparison of PNG screenshots (threshold 0, anti-aliasing counted).

    uv run --no-project scripts/perf/pixel_diff.py <a.png> <b.png> [--out diff.png]

Prints JSON: size match, differing pixel count and ratio, bounding box of the
difference. Exit 0 always; the caller compares the count with the A/A noise floor.
"""
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
    diff = ImageChops.difference(a, b)
    mask = diff.convert("L").point(lambda value: 255 if value else 0)
    count = sum(1 for value in mask.getdata() if value)
    result.update(differentPixels=count, ratio=count / (a.size[0] * a.size[1]), bbox=mask.getbbox())
    if out and count:
        highlight = Image.new("RGBA", a.size, (255, 0, 0, 255))
        Image.composite(highlight, a, mask).save(out)
    return result


def main() -> None:
    args = sys.argv[1:]
    out = None
    if "--out" in args:
        index = args.index("--out")
        out = args[index + 1]
        del args[index:index + 2]
    if len(args) != 2:
        sys.exit(__doc__)
    print(json.dumps(compare(args[0], args[1], out)))


if __name__ == "__main__":
    main()
