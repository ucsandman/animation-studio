"""Seamless brand-driven background loop: accent wave drift on near-black.

Defaults reproduce the original noban tuning (240 frames, violet accent).
--brand selects any brands/<id>.json (uses colors.bg + colors.brand);
--frame-count/--scale/--distortion/--detail/--phase-start vary the Wave
texture so multiple renders of this one scene look visibly distinct."""

import argparse
import json
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[3]

FPS = 30
FRAMES = 240
DRIFT_PERIODS = 3  # whole wave periods advanced over the loop => seamless;
# odd, so the loop's midpoint sits at a half-period offset (max contrast from
# frame 1) instead of coincidentally landing back near phase 0 - true for any
# --frame-count since it's expressed as a fraction of the loop length.


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgba(hex_color: str, alpha: float = 1.0):
    h = hex_color.lstrip("#")
    return tuple(srgb_to_linear(int(h[i : i + 2], 16) / 255) for i in (0, 2, 4)) + (
        alpha,
    )


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--frame", type=int)
    parser.add_argument("--animation", action="store_true")
    parser.add_argument(
        "--brand", default="noban", help="brand id under brands/<id>.json"
    )
    parser.add_argument(
        "--frame-count",
        type=int,
        default=FRAMES,
        dest="frame_count",
        help="total loop length in frames (default 240 = 8s @ 30fps)",
    )
    parser.add_argument("--scale", type=float, default=1.2, help="Wave texture Scale")
    parser.add_argument(
        "--distortion", type=float, default=2.4, help="Wave texture Distortion"
    )
    parser.add_argument("--detail", type=float, default=2.0, help="Wave texture Detail")
    parser.add_argument(
        "--phase-start",
        type=float,
        default=0.0,
        dest="phase_start",
        help="starting Phase Offset as a fraction of tau (0-1); shifts the "
        "pattern's frame-1 appearance without breaking the seamless loop",
    )
    # Hue/brightness of the bright wave bands. Brightness comes from the
    # PALETTE values (accent hex x strength), never from emission strength -
    # emission stays 1.0 under the Standard view transform or brand colors
    # hue-shift (PLAYBOOK, Task 2 finding).
    parser.add_argument(
        "--accent",
        default=None,
        help="hex color for the bright wave bands (default: brand colors.brand)",
    )
    parser.add_argument(
        "--accent-strength",
        type=float,
        default=0.08,
        dest="accent_strength",
        help="linear multiplier on the accent color (0.08 = original subtle "
        "backdrop tuning; raise for brighter, thumbnail-readable footage)",
    )
    parser.add_argument(
        "--shadow-strength",
        type=float,
        default=0.0,
        dest="shadow_strength",
        help="linear accent added to the DARK bands (dark stop = brand bg + "
        "accent x this). 0 = original pure-bg shadows; small values (~0.05) "
        "tint-lift the shadows so the whole frame reads in a dark UI",
    )
    # Chunked --animation renders: restrict the rendered range without touching
    # the loop math (Phase Offset keyframes stay at frame 1 and frame_count+1,
    # so frame K's pixels are identical whether rendered in one run or in
    # chunks). Lets callers run many short Blender processes instead of one
    # long one — a full-length background render was observed to hang mid-
    # sequence (frame 67/360) on Blender 5.1.2 + EEVEE.
    parser.add_argument(
        "--start-frame",
        type=int,
        default=1,
        dest="start_frame",
        help="first frame of the rendered range (animation mode)",
    )
    parser.add_argument(
        "--end-frame",
        type=int,
        default=None,
        dest="end_frame",
        help="last frame of the rendered range (animation mode); default frame-count",
    )
    return parser.parse_args(argv)


def build_scene(args: argparse.Namespace) -> None:
    brand = json.loads((ROOT / "brands" / f"{args.brand}.json").read_text())
    scene = bpy.context.scene
    # NOTE (Task 2 finding): scene.collection.objects only lists objects linked
    # directly to the master collection; the factory-startup Cube/Light/Camera
    # live one level deeper in a child collection named "Collection", so that
    # loop sees an empty list and removes nothing. Clear bpy.data.objects
    # directly to guarantee a truly empty scene.
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    scene.render.engine = "BLENDER_EEVEE"  # noqa: vulture
    scene.render.film_transparent = False  # noqa: vulture
    scene.render.resolution_x = 1920  # noqa: vulture
    scene.render.resolution_y = 1080  # noqa: vulture
    scene.render.fps = FPS  # noqa: vulture
    scene.frame_start = args.start_frame  # noqa: vulture
    scene.frame_end = min(args.end_frame or args.frame_count, args.frame_count)  # noqa: vulture
    scene.view_settings.view_transform = "Standard"  # noqa: vulture
    scene.render.image_settings.file_format = "PNG"  # noqa: vulture
    scene.render.image_settings.color_mode = "RGB"  # noqa: vulture

    # emissive plane fills the camera; shader mixes bg -> accent by a wave texture
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
    plane = bpy.context.active_object

    mat = bpy.data.materials.new("loop")
    mat.use_nodes = True  # noqa: vulture
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    coord = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    wave = nodes.new("ShaderNodeTexWave")
    ramp = nodes.new("ShaderNodeValToRGB")
    emission = nodes.new("ShaderNodeEmission")
    output = nodes.new("ShaderNodeOutputMaterial")

    wave.wave_type = "BANDS"  # noqa: vulture
    wave.bands_direction = "DIAGONAL"  # noqa: vulture
    wave.inputs["Scale"].default_value = args.scale  # noqa: vulture
    wave.inputs["Distortion"].default_value = args.distortion  # noqa: vulture
    wave.inputs["Detail"].default_value = args.detail  # noqa: vulture

    # bg -> faint accent ramp; accent stays subtle (backdrop, not hero)
    accent_pre = hex_rgba(args.accent or brand["colors"]["brand"])
    bg = hex_rgba(brand["colors"]["bg"])
    ramp.color_ramp.elements[0].position = 0.35  # noqa: vulture
    ramp.color_ramp.elements[0].color = (  # noqa: vulture
        bg[0] + accent_pre[0] * args.shadow_strength,
        bg[1] + accent_pre[1] * args.shadow_strength,
        bg[2] + accent_pre[2] * args.shadow_strength,
        1.0,
    )
    ramp.color_ramp.elements[1].position = 1.0  # noqa: vulture
    # NOTE: 0.22 (as drafted) looked bright/saturated on render, not subtle -
    # sRGB gamma means a 22%-linear-scaled color still displays at ~50%
    # perceived brightness. 0.08 was tuned by rendering and inspecting frame 1.
    ramp.color_ramp.elements[1].color = (  # noqa: vulture
        accent_pre[0] * args.accent_strength,
        accent_pre[1] * args.accent_strength,
        accent_pre[2] * args.accent_strength,
        1.0,
    )

    # strength=1.0 (Task 2 finding): higher emission strength clips brand
    # colors to wrong hues under the "Standard" view transform.
    emission.inputs["Strength"].default_value = 1.0  # noqa: vulture

    links.new(coord.outputs["Object"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], wave.inputs["Vector"])
    links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], emission.inputs["Color"])
    links.new(emission.outputs["Emission"], output.inputs["Surface"])
    plane.data.materials.append(mat)

    # seamless drift: advance the Wave node's Phase Offset by whole 2*pi cycles.
    # NOTE (found via rendered seam check): the brief animated mapping.Location
    # instead, on the theory that the wave repeats every 2*pi/scale. That is
    # true for the plain sine band, but Distortion's noise samples the (static)
    # Vector position, not a phase - shifting Location moves the noise sample
    # point too, and Blender's noise has no small-scale period, so frame 241
    # never matched frame 1 exactly (diff up to 65/255 per channel, confirmed
    # by rendering both and comparing). Phase Offset only shifts the sine
    # argument and leaves the Distortion noise field spatially fixed, so
    # advancing it by DRIFT_PERIODS full 2*pi cycles reproduces frame 1's
    # value exactly at frame 241 (diff <= 1/255, i.e. PNG encoding noise only).
    tau = 2 * 3.141592653589793
    phase_start = args.phase_start * tau
    wave.inputs["Phase Offset"].default_value = phase_start  # noqa: vulture
    wave.inputs["Phase Offset"].keyframe_insert("default_value", frame=1)
    wave.inputs["Phase Offset"].default_value = phase_start + DRIFT_PERIODS * tau  # noqa: vulture
    wave.inputs["Phase Offset"].keyframe_insert(
        "default_value", frame=args.frame_count + 1
    )
    # Blender 5.1.2 uses layered actions: Action.fcurves no longer exists
    # (AttributeError). Fcurves live under action.layers[].strips[].channelbags[].
    action = mat.node_tree.animation_data.action
    for layer in action.layers:
        for strip in layer.strips:
            for channelbag in strip.channelbags:
                for fcurve in channelbag.fcurves:
                    for kp in fcurve.keyframe_points:
                        kp.interpolation = "LINEAR"  # noqa: vulture

    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 50  # noqa: vulture
    cam = bpy.data.objects.new("cam", cam_data)
    cam.location = (0.0, 0.0, 5.0)  # noqa: vulture
    bpy.context.scene.collection.objects.link(cam)
    scene.camera = cam  # noqa: vulture


def main() -> None:
    args = parse_args()
    build_scene(args)
    scene = bpy.context.scene
    if args.animation:
        scene.render.filepath = f"{args.out}/frame_"  # noqa: vulture
        bpy.ops.render.render(animation=True)
    else:
        frame = args.frame or 1
        scene.frame_set(frame)
        scene.render.filepath = f"{args.out}/frame_{frame:04d}.png"  # noqa: vulture
        bpy.ops.render.render(write_still=True)


main()
