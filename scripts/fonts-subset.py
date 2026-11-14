#!/usr/bin/env python3
"""MOBO（本文）と Corporate Logo Rounded Bold ver3（見出し）の OTF から、画面で使う字だけを残した WOFF2 を作る。

普段は直接動かさず、`npm run fonts:build -- --src <MOBO のフォルダ>`（scripts/fonts-build.mjs）が呼ぶ。
字の集め方・glyphs.txt・simulator.css の書き出しは、Node 側（scripts/fonts-lib.mjs）が受け持つ。
この台本は、「渡された字を、元のフォントから切り出して WOFF2 にする」ところだけを行う。

要るもの: Python 3.8 以上・fonttools・brotli
    python3 -m pip install fonttools brotli

入力
    --src          MOBO のフォルダ（MOBO-Regular.otf・MOBO-Bold.otf・LICENSE_OFL.txt が入っている）
    --display-src  見出し書体のフォルダ（Corporate-Logo-Rounded-Bold-ver3.otf・SIL_Open_Font_License_1.1.txt が入っている）
    --core-chars  全ページで使う字（UTF-8 のテキスト 1 本）。見出し書体も、この字に絞る
    --extra-chars シミュレーターだけで使う字（同上）。核の字は含めない
    --out         WOFF2 とライセンスを置くフォルダ
    --report      結果（収録できた字・MOBO に無い字・大きさ）を書き出す JSON のパス

書体の名前（MOBO・Corporate Logo Rounded）は変えない。OFL（SIL Open Font License 1.1）に従い、
書体ごとのライセンス文を一緒に置く。元のフォントの著作権表示（name 表）は、残す。
"""
import argparse
import json
import shutil
import sys
from pathlib import Path

try:
    from fontTools import subset
    from fontTools.ttLib import TTFont
except ImportError:  # 初心者向けに、入れ方まで書く
    sys.exit("fonttools が入っていません。次を実行してください: python3 -m pip install fonttools brotli")

try:
    import brotli  # noqa: F401  WOFF2 の書き出しに要る
except ImportError:
    sys.exit("brotli が入っていません。次を実行してください: python3 -m pip install fonttools brotli")

WEIGHTS = ["Regular", "Bold"]  # 400 と 700。画面が使う太さはこの 2 つだけ
# 残すレイアウト機能。kern（字間）・ccmp・liga だけ。縦書き（vert・vrt2・vkna）と palt などは使わないので外す
LAYOUT_FEATURES = ["kern", "ccmp", "liga"]
# 縦書き用の表は要らない
DROP_TABLES = ["VORG", "vhea", "vmtx"]
# 字形の無い空白（半角・全角）は、いつも入れる（無いと、空白だけ別の書体の幅になる）
ALWAYS = [0x20, 0x3000]
# 見出し書体の元のファイル名・ライセンス文・書体名の頭。出力のファイル名は scripts/fonts-lib.mjs の定数と同じ
DISPLAY_OTF = "Corporate-Logo-Rounded-Bold-ver3.otf"
DISPLAY_LICENSE_SRC = "SIL_Open_Font_License_1.1.txt"
DISPLAY_WOFF2 = "Corporate-Logo-Rounded-Bold-ver3.woff2"
DISPLAY_FAMILY_HEAD = "Corporate Logo Rounded"
LICENSE_MOBO = "LICENSE_OFL_MOBO.txt"
LICENSE_DISPLAY = "LICENSE_OFL_Corporate-Logo-Rounded.txt"


def read_chars(path):
    """テキストの字を、空白を除いて集める"""
    text = Path(path).read_text(encoding="utf-8")
    return {c for c in text if not c.isspace()}


def cmap_of(otf):
    font = TTFont(str(otf), lazy=True)
    try:
        return set(font.getBestCmap())
    finally:
        font.close()


def subset_to_woff2(otf, chars, out_path):
    """otf から chars だけを残して、WOFF2 として out_path に書く。書いたバイト数を返す"""
    options = subset.Options()
    options.layout_features = list(LAYOUT_FEATURES)
    options.name_IDs = ["*"]  # 著作権・ライセンスなどの name 表を残す（OFL の条件）
    options.name_languages = ["*"]
    options.drop_tables += DROP_TABLES
    options.flavor = "woff2"
    font = subset.load_font(str(otf), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=sorted(ord(c) for c in chars))
    subsetter.subset(font)
    subset.save_font(font, str(out_path), options)
    return Path(out_path).stat().st_size


def main():
    parser = argparse.ArgumentParser(description="MOBO から、画面で使う字だけの WOFF2 を作る")
    parser.add_argument("--src", required=True, help="MOBO のフォルダ（otf と LICENSE_OFL.txt）")
    parser.add_argument("--display-src", required=True, help="見出し書体のフォルダ（otf とライセンス文）")
    parser.add_argument("--core-chars", required=True)
    parser.add_argument("--extra-chars", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()

    src = Path(args.src).expanduser()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    otf = {w: src / f"MOBO-{w}.otf" for w in WEIGHTS}
    for w, path in otf.items():
        if not path.is_file():
            sys.exit(f"{path} がありません。--src に、MOBO のフォルダ（MOBO-Regular.otf などが入っている所）を渡してください")
    license_src = src / "LICENSE_OFL.txt"
    if not license_src.is_file():
        sys.exit(f"{license_src} がありません。OFL のライセンス文を一緒に置く決まりのため、止めます")
    display_src = Path(args.display_src).expanduser()
    display_otf = display_src / DISPLAY_OTF
    display_license_src = display_src / DISPLAY_LICENSE_SRC
    for path in (display_otf, display_license_src):
        if not path.is_file():
            sys.exit(f"{path} がありません。--display-src に、見出し書体のフォルダ（{DISPLAY_OTF} などが入っている所）を渡してください")

    # 取り違えの防止: 書体の名前が MOBO であること
    for w, path in otf.items():
        font = TTFont(str(path), lazy=True)
        family = font["name"].getDebugName(1) or ""
        font.close()
        if not family.startswith("MOBO"):
            sys.exit(f"{path} の書体名が MOBO ではありません（{family}）。別のフォントを渡していないか確かめてください")

    font = TTFont(str(display_otf), lazy=True)
    display_family = font["name"].getDebugName(4) or ""
    font.close()
    if not display_family.startswith(DISPLAY_FAMILY_HEAD):
        sys.exit(f"{display_otf} の書体名が {DISPLAY_FAMILY_HEAD} ではありません（{display_family}）。別のフォントを渡していないか確かめてください")

    # 400 と 700 の、どちらにも字がある字だけを入れる（片方だけにあると、太さによって別の書体に落ちるため）
    cmaps = [cmap_of(path) for path in otf.values()]
    both = set.intersection(*cmaps)
    core = read_chars(args.core_chars)
    extra = read_chars(args.extra_chars) - core
    core_ok = {c for c in core if ord(c) in both}
    extra_ok = {c for c in extra if ord(c) in both}
    missing = (core | extra) - core_ok - extra_ok

    sizes = {}
    for w, path in otf.items():
        # 核: 全ページが使う。空白は、いつも入れる
        name = f"MOBO-{w}.woff2"
        sizes[name] = subset_to_woff2(path, core_ok | {chr(c) for c in ALWAYS}, out / name)
        # 追加: シミュレーターだけが使う字
        name = f"MOBO-{w}-sim.woff2"
        sizes[name] = subset_to_woff2(path, extra_ok, out / name)

    # 見出し書体: 核と同じ字の集合に絞る（見出しに出る字だけを機械では集められないため）。字が無い字は MOBO で表示される
    display_cmap = cmap_of(display_otf)
    display_ok = {c for c in core if ord(c) in display_cmap}
    display_missing = core - display_ok
    sizes[DISPLAY_WOFF2] = subset_to_woff2(display_otf, display_ok | {chr(c) for c in ALWAYS}, out / DISPLAY_WOFF2)

    shutil.copyfile(license_src, out / LICENSE_MOBO)
    shutil.copyfile(display_license_src, out / LICENSE_DISPLAY)

    report = {
        "included": "".join(sorted(core_ok)),
        "extra": "".join(sorted(extra_ok)),
        "missing": "".join(sorted(missing)),
        "display": "".join(sorted(display_ok)),
        "displayMissing": "".join(sorted(display_missing)),
        "sizes": sizes,
    }
    Path(args.report).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"WOFF2 を書きました: {json.dumps(sizes, ensure_ascii=False)}")


if __name__ == "__main__":
    main()
