"""Animation studio entry point: health checks + Remotion Studio."""

import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent
STUDIO = ROOT / "studio"


def check(label: str, ok: bool, detail: str = "", required: bool = True) -> bool:
    mark = "OK " if ok else ("FAIL" if required else "-- ")
    print(f"[{mark}] {label}" + (f" ({detail})" if detail else ""))
    return ok or not required


def comfy_running() -> bool:
    for port in (8000, 8188):  # ComfyUI Desktop / classic default
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/system_stats", timeout=1)
            return True
        except Exception:
            continue
    return False


def main() -> int:
    ok = True
    node = shutil.which("node")
    npm = shutil.which("npm")  # resolves npm.cmd on Windows; lets us avoid shell=True
    ok &= check("Node.js", node is not None, node or "not on PATH")
    ok &= check("npm", npm is not None, npm or "not on PATH")
    ok &= check(
        "studio/ deps installed",
        (STUDIO / "node_modules").is_dir(),
        "run: cd studio && npm install",
    )
    blender = shutil.which("blender")
    check(
        "Blender (phase 3 feeder)",
        blender is not None,
        blender or "not on PATH",
        required=False,
    )
    check(
        "Capture feeder deps (phase 2)",
        (ROOT / "feeders" / "capture" / "node_modules").is_dir(),
        "run: cd feeders/capture && npm install",
        required=False,
    )
    check(
        "ComfyUI server (phase 5 feeder)",
        comfy_running(),
        "not reachable on :8000/:8188",
        required=False,
    )

    if not ok:
        print("\nRequired checks failed; fix the FAIL lines above.")
        return 1
    if "--check" in sys.argv:
        return 0

    print("\nStarting Remotion Studio (Ctrl+C to stop)...")
    return subprocess.call([npm, "run", "dev"], cwd=STUDIO)


if __name__ == "__main__":
    sys.exit(main())
