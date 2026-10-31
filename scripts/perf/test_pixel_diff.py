# /// script
# requires-python = ">=3.12"
# dependencies = ["pillow==11.3.0"]
# ///
"""uv run --no-project scripts/perf/test_pixel_diff.py"""
import pathlib
import subprocess
import sys
import tempfile

from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from pixel_diff import compare  # noqa: E402

SCRIPT = pathlib.Path(__file__).with_name("pixel_diff.py")


def image(path: pathlib.Path, size=(4, 3), pixel=None, value=(0, 0, 0, 255)) -> str:
    img = Image.new("RGBA", size, (0, 0, 0, 255))
    if pixel:
        img.putpixel(pixel, value)
    img.save(path)
    return str(path)


def gate(a: str, b: str, *extra: str) -> int:
    return subprocess.run([sys.executable, "-I", str(SCRIPT), a, b, *extra], capture_output=True).returncode


with tempfile.TemporaryDirectory() as tmp:
    root = pathlib.Path(tmp)
    base = image(root / "base.png")
    same = image(root / "same.png")
    blue = image(root / "blue.png", pixel=(1, 1), value=(0, 0, 1, 255))
    alpha = image(root / "alpha.png", pixel=(2, 2), value=(0, 0, 0, 254))
    wide = image(root / "wide.png", size=(5, 3))

    assert compare(base, same, None)["differentPixels"] == 0
    # Grayscale conversion rounds a one-level blue change to zero; every channel counts.
    assert compare(base, blue, None)["differentPixels"] == 1
    assert compare(base, alpha, None)["differentPixels"] == 1
    assert compare(base, wide, None)["sameSize"] is False

    assert gate(base, same) == 0
    assert gate(base, blue) == 1
    assert gate(base, blue, "--max-pixels", "1") == 0
    assert gate(base, wide, "--max-pixels", "1000") == 1
print("pixel_diff: ok")
