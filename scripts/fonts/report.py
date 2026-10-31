# /// script
# requires-python = ">=3.12"
# dependencies = ["fonttools==4.68.0", "brotli==1.2.1"]
# ///
"""Describe font files: bytes, glyphs, cmap, axes, features, hinting, license.

    uv run --no-project scripts/fonts/report.py <font> [<font> ...] [--json out.json]

Read-only. Works on TTF, OTF, WOFF and WOFF2 inputs.
"""
import hashlib
import json
import pathlib
import sys

from fontTools.ttLib import TTFont

HINTING_TABLES = ("fpgm", "prep", "cvt ", "gasp", "hdmx", "LTSH", "VDMX", "cvar")


def features(font: TTFont, tag: str) -> list[str]:
    if tag not in font:
        return []
    table = font[tag].table
    if not table.FeatureList:
        return []
    return sorted({record.FeatureTag for record in table.FeatureList.FeatureRecord})


def describe(path: pathlib.Path) -> dict:
    data = path.read_bytes()
    font = TTFont(path)
    cmap = font.getBestCmap() or {}
    name = font["name"]
    axes = []
    if "fvar" in font:
        axes = [{"tag": a.axisTag, "min": a.minValue, "default": a.defaultValue, "max": a.maxValue}
                for a in font["fvar"].axes]
    license_text = name.getDebugName(13) or ""
    return {
        "file": path.name,
        "sha256": hashlib.sha256(data).hexdigest(),
        "bytes": len(data),
        "flavor": font.flavor or "sfnt",
        "family": name.getDebugName(1),
        "fullName": name.getDebugName(4),
        "version": name.getDebugName(5),
        "glyphs": font["maxp"].numGlyphs,
        "codepoints": len(cmap),
        "cmapRanges": ranges(sorted(cmap)),
        "axes": axes,
        "gsub": features(font, "GSUB"),
        "gpos": features(font, "GPOS"),
        "gdef": "GDEF" in font,
        "hintingTables": [t.strip() for t in HINTING_TABLES if t in font],
        "tables": sorted(font.keys()),
        "license": license_text[:200],
        "licenseUrl": name.getDebugName(14),
        "reservedFontName": "Reserved Font Name" in (name.getDebugName(0) or "") + license_text,
        "copyright": (name.getDebugName(0) or "")[:200],
    }


def ranges(points: list[int]) -> str:
    out, start, prev = [], None, None
    for point in points:
        if start is None:
            start = prev = point
        elif point == prev + 1:
            prev = point
        else:
            out.append((start, prev))
            start = prev = point
    if start is not None:
        out.append((start, prev))
    return ", ".join(f"U+{a:04X}" if a == b else f"U+{a:04X}-{b:04X}" for a, b in out)


def main() -> None:
    args = sys.argv[1:]
    out = None
    if "--json" in args:
        index = args.index("--json")
        out = pathlib.Path(args[index + 1])
        del args[index:index + 2]
    if not args:
        sys.exit(__doc__)
    report = [describe(pathlib.Path(arg)) for arg in args]
    text = json.dumps(report, indent=1, ensure_ascii=False)
    if out:
        out.write_text(text + "\n")
    print(text)


if __name__ == "__main__":
    main()
