"""Headless Blender render wrapper: runs a scene script and verifies output.

Usage:
    python feeders/blender/render.py <scene.py> --out <dir> [--frame N | --animation] [scene-specific flags...]

Any flag not recognized by this wrapper (e.g. a scene's --brand/--seed/--palette
knobs) is forwarded verbatim to the scene script after the `--` separator.
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read_env(path: Path) -> dict:
    """Minimal KEY=VALUE .env reader (duplicated from launch.py to keep the feeder standalone)."""
    if not path.is_file():
        return {}
    out = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def find_blender(env: dict) -> str | None:
    configured = env.get("BLENDER_PATH")
    if configured and Path(configured).is_file():
        return configured
    return shutil.which("blender")


def build_cmd(
    blender: str,
    scene: str,
    out: str,
    frame: int | None,
    animation: bool,
    extra: list[str] | None = None,
) -> list[str]:
    cmd = [
        blender,
        "--background",
        "--factory-startup",
        "--python",
        scene,
        "--",
        "--out",
        out,
    ]
    if animation:
        cmd.append("--animation")
    else:
        cmd += ["--frame", str(frame)]
    if extra:
        cmd += extra
    return cmd


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scene", help="path to a bpy scene script")
    parser.add_argument(
        "--out", required=True, help="output directory for frame_%%04d.png"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--frame", type=int, help="render a single frame")
    group.add_argument(
        "--animation", action="store_true", help="render the scene's full range"
    )
    args, extra = parser.parse_known_args()

    scene = Path(args.scene).resolve()
    if not scene.is_file():
        print(f"scene script not found: {scene}", file=sys.stderr)
        return 1

    blender = find_blender(read_env(ROOT / ".env"))
    if not blender:
        print(
            "Blender not found: set BLENDER_PATH in .env or add blender to PATH",
            file=sys.stderr,
        )
        return 1

    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    cmd = build_cmd(
        blender, str(scene), str(out_dir), args.frame, args.animation, extra
    )
    print("render:", " ".join(cmd))
    proc = subprocess.run(cmd)
    if proc.returncode != 0:
        print(f"blender exited {proc.returncode}", file=sys.stderr)
        return proc.returncode or 1

    frames = sorted(out_dir.glob("frame_*.png"))
    if not frames:
        print(
            f"blender exited 0 but produced no frame_*.png in {out_dir}",
            file=sys.stderr,
        )
        return 1
    print(f"render OK: {len(frames)} frame(s) in {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
