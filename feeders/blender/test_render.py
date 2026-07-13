import tempfile
import unittest
from pathlib import Path

from render import build_cmd, find_blender, read_env


class TestHelpers(unittest.TestCase):
    def test_read_env_parses_and_ignores_comments(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / ".env"
            p.write_text(
                "# comment\nBLENDER_PATH=C:/x/blender.exe\nEMPTY_LINE_BELOW=1\n\n"
            )
            env = read_env(p)
        self.assertEqual(env["BLENDER_PATH"], "C:/x/blender.exe")
        self.assertEqual(env["EMPTY_LINE_BELOW"], "1")

    def test_read_env_missing_file_is_empty(self):
        self.assertEqual(read_env(Path("definitely/not/here/.env")), {})

    def test_find_blender_prefers_existing_configured_path(self):
        with tempfile.NamedTemporaryFile(suffix=".exe", delete=False) as f:
            fake = f.name
        self.assertEqual(find_blender({"BLENDER_PATH": fake}), fake)

    def test_find_blender_ignores_missing_configured_path(self):
        # falls through to PATH lookup; result is whatever which() says (str or None)
        result = find_blender({"BLENDER_PATH": "Z:/nope/blender.exe"})
        self.assertNotEqual(result, "Z:/nope/blender.exe")

    def test_build_cmd_single_frame(self):
        cmd = build_cmd(
            "blender.exe", "scenes/x.py", "outdir", frame=45, animation=False
        )
        self.assertEqual(
            cmd,
            [
                "blender.exe",
                "--background",
                "--factory-startup",
                "--python",
                "scenes/x.py",
                "--",
                "--out",
                "outdir",
                "--frame",
                "45",
            ],
        )

    def test_build_cmd_animation(self):
        cmd = build_cmd(
            "blender.exe", "scenes/x.py", "outdir", frame=None, animation=True
        )
        self.assertEqual(
            cmd,
            [
                "blender.exe",
                "--background",
                "--factory-startup",
                "--python",
                "scenes/x.py",
                "--",
                "--out",
                "outdir",
                "--animation",
            ],
        )

    def test_build_cmd_forwards_extra_scene_flags(self):
        cmd = build_cmd(
            "blender.exe",
            "scenes/x.py",
            "outdir",
            frame=None,
            animation=True,
            extra=["--brand", "magnetic", "--scale", "2.6"],
        )
        self.assertEqual(
            cmd,
            [
                "blender.exe",
                "--background",
                "--factory-startup",
                "--python",
                "scenes/x.py",
                "--",
                "--out",
                "outdir",
                "--animation",
                "--brand",
                "magnetic",
                "--scale",
                "2.6",
            ],
        )


if __name__ == "__main__":
    unittest.main()
