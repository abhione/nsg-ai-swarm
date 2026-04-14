#!/usr/bin/env python3
"""
NSG AI Swarm — Demo Video Generator

Captures screenshots of the Paperclip UI showing the NSG Vision Care Marketing
swarm, generates TTS narration, and assembles into an MP4 demo video.

Requirements:
    pip install playwright edge-tts Pillow
    playwright install chromium
    ffmpeg must be installed and on PATH

Usage:
    python record_demo.py
    python record_demo.py --url http://localhost:3100 --output output/nsg-swarm-demo.mp4
"""

import argparse
import asyncio
import json
import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

# ---------------------------------------------------------------------------
# Scene definitions — matches demo-script.md
# ---------------------------------------------------------------------------

@dataclass
class Scene:
    """A single scene in the demo video."""
    id: str
    title: str
    nav_action: str  # CSS selector to click, or URL path to navigate
    nav_type: str  # "click" or "navigate"
    settle_sec: float  # seconds to wait after navigation before screenshot
    narration: str


SCENES = [
    Scene(
        id="01-dashboard",
        title="Dashboard Overview",
        nav_action="/",
        nav_type="navigate",
        settle_sec=2.0,
        narration=(
            "Welcome to the NSG Vision Care Marketing AI Swarm, powered by Paperclip. "
            "This is the command center for a fully autonomous marketing team. "
            "Nine AI agents work around the clock to grow patient acquisition for "
            "NSG vision care practices. On this dashboard, you can see real-time activity: "
            "agents completing tasks, campaigns being optimized, and content being published, "
            "all without human intervention. Let's take a closer look at how it all works."
        ),
    ),
    Scene(
        id="02-agents",
        title="Agent Roster",
        nav_action="a[href*='agents'], [data-nav='agents']",
        nav_type="click",
        settle_sec=1.0,
        narration=(
            "Here's the full team. Nine specialized agents, each with a clear role. "
            "Iris is the CEO, setting strategy and reviewing executive performance. "
            "Clarity, the CMO, manages campaigns and brand voice. Lens, the CTO, handles "
            "marketing technology. Under them, specialists like Focal for SEO, Spectrum for "
            "content writing, Prism for social media, and Retina for paid advertising. "
            "Optic tracks budgets as CFO, while Cornea produces analytics reports. "
            "Every agent has a defined place in the org chart and a specific adapter, "
            "OpenClaw for agents that need browser access, Hermes for text-heavy analytical work."
        ),
    ),
    Scene(
        id="03-issues",
        title="Issue Board",
        nav_action="a[href*='issues'], [data-nav='issues']",
        nav_type="click",
        settle_sec=1.0,
        narration=(
            "This is where work happens. Every task in the swarm is tracked as an issue, "
            "from drafting a blog post about blue light glasses to optimizing Google Ads bids "
            "for LASIK keywords. Issues flow through a clear lifecycle: open, in progress, and done. "
            "Agents pick up assigned work automatically on their heartbeat cycle. You can see "
            "Spectrum is currently writing next month's content calendar, while Retina just "
            "finished optimizing the pediatric eye care ad group. Every issue traces back to a "
            "company goal. Nothing happens in isolation."
        ),
    ),
    Scene(
        id="04-org-chart",
        title="Org Chart",
        nav_action="a[href*='org'], [data-nav='org-chart']",
        nav_type="click",
        settle_sec=2.0,
        narration=(
            "The org chart shows how delegation flows. Iris, the CEO, delegates strategic "
            "initiatives to three executives: Lens, Clarity, and Optic. They break those down "
            "into specific tasks for their direct reports. When Iris says increase patient "
            "acquisition by forty percent this quarter, Clarity turns that into a content calendar "
            "for Spectrum, social campaigns for Prism, and ad budgets for Retina. Results roll back "
            "up through the chain. This hierarchical structure keeps agents focused and aligned. "
            "Every piece of work traces back to the company mission."
        ),
    ),
    Scene(
        id="05-agent-detail",
        title="Agent Detail — Spectrum",
        nav_action="a[href*='agents']:has-text('Spectrum'), tr:has-text('Spectrum')",
        nav_type="click",
        settle_sec=1.0,
        narration=(
            "Let's look at Spectrum, the content writer, in detail. You can see her current "
            "status: idle, waiting for the next heartbeat. Her recent runs show a successful blog "
            "post draft about children's eye health, an email campaign for annual exam reminders, "
            "and landing page copy for a new blue light glasses line. The run transcript shows "
            "exactly what the agent did: the prompt it received, the tools it used, and the content "
            "it produced. Token usage and cost are tracked per run. This blog post cost twelve cents "
            "in API calls. You have full visibility and control."
        ),
    ),
    Scene(
        id="06-costs",
        title="Cost Dashboard",
        nav_action="a[href*='costs'], a[href*='billing'], [data-nav='costs']",
        nav_type="click",
        settle_sec=1.0,
        narration=(
            "Cost control is critical when running nine agents continuously. The cost dashboard "
            "shows real-time spend across the entire swarm. This month, the team has used eighteen "
            "hundred dollars in API tokens. Spectrum and Retina are the highest spenders because "
            "content generation and ad analysis are token-intensive. The daily burn rate is about "
            "sixty dollars, well within our twenty-five hundred dollar monthly budget. If any agent "
            "approaches its individual limit, Paperclip automatically pauses it and alerts the board. "
            "No surprises, no runaway costs."
        ),
    ),
    Scene(
        id="07-closing",
        title="Closing",
        nav_action="/",
        nav_type="navigate",
        settle_sec=1.0,
        narration=(
            "That's the NSG Vision Care Marketing AI Swarm. Nine agents, working autonomously, "
            "executing a coordinated marketing strategy. Content gets written. Ads get optimized. "
            "Social media stays active. Reports get generated. All governed by clear budgets, "
            "approval gates, and full audit trails. The board maintains control while the swarm "
            "does the work. This is what autonomous marketing looks like, and it's running right "
            "now. Visit the GitHub repo to set up your own swarm with Paperclip."
        ),
    ),
]

# ---------------------------------------------------------------------------
# Screenshot capture
# ---------------------------------------------------------------------------

async def capture_screenshots(
    base_url: str,
    output_dir: Path,
    width: int,
    height: int,
    cookie: str | None = None,
    company_id: str | None = None,
) -> list[Path]:
    """Launch Playwright, navigate through scenes, capture screenshots."""
    from playwright.async_api import async_playwright

    screenshots: list[Path] = []
    output_dir.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": width, "height": height},
            device_scale_factor=2,  # Retina-quality screenshots
        )

        # Set auth cookie if provided (for authenticated mode)
        if cookie:
            await context.add_cookies([{
                "name": "better-auth.session_token",
                "value": cookie,
                "domain": base_url.split("//")[1].split(":")[0],
                "path": "/",
            }])

        page = await context.new_page()

        # Resolve company URL prefix
        company_prefix = ""
        if company_id:
            company_prefix = f"/{company_id}"
        else:
            # Try to detect the first company
            await page.goto(f"{base_url}/api/companies")
            try:
                body = await page.inner_text("body")
                companies = json.loads(body)
                if companies and len(companies) > 0:
                    slug = companies[0].get("slug") or companies[0].get("id", "")
                    company_prefix = f"/{slug}"
                    print(f"  Auto-detected company: {slug}")
            except Exception:
                pass

        for scene in SCENES:
            print(f"  Capturing scene: {scene.title}")

            try:
                if scene.nav_type == "navigate":
                    url = f"{base_url}{company_prefix}{scene.nav_action}"
                    await page.goto(url, wait_until="networkidle", timeout=15000)
                elif scene.nav_type == "click":
                    # Try multiple selectors (comma-separated)
                    selectors = [s.strip() for s in scene.nav_action.split(",")]
                    clicked = False
                    for selector in selectors:
                        try:
                            elem = page.locator(selector).first
                            if await elem.is_visible(timeout=3000):
                                await elem.click()
                                clicked = True
                                break
                        except Exception:
                            continue

                    if not clicked:
                        # Fallback: navigate to a reasonable URL
                        fallback_paths = {
                            "02-agents": "/agents",
                            "03-issues": "/issues",
                            "04-org-chart": "/org-chart",
                            "05-agent-detail": "/agents",
                            "06-costs": "/costs",
                        }
                        path = fallback_paths.get(scene.id, "/")
                        await page.goto(
                            f"{base_url}{company_prefix}{path}",
                            wait_until="networkidle",
                            timeout=15000,
                        )
            except Exception as exc:
                print(f"    Warning: navigation failed for {scene.title}: {exc}")
                # Continue anyway — capture whatever is on screen

            # Wait for content to settle
            await asyncio.sleep(scene.settle_sec)

            # Capture screenshot
            screenshot_path = output_dir / f"{scene.id}.png"
            await page.screenshot(path=str(screenshot_path), full_page=False)
            screenshots.append(screenshot_path)
            print(f"    Saved: {screenshot_path}")

        await browser.close()

    return screenshots


# ---------------------------------------------------------------------------
# TTS narration generation
# ---------------------------------------------------------------------------

async def generate_narration(output_dir: Path, voice: str = "en-US-AndrewNeural") -> list[Path]:
    """Generate TTS audio for each scene using edge-tts."""
    import edge_tts

    audio_files: list[Path] = []
    output_dir.mkdir(parents=True, exist_ok=True)

    for scene in SCENES:
        audio_path = output_dir / f"{scene.id}.mp3"
        print(f"  Generating TTS: {scene.title}")

        communicate = edge_tts.Communicate(scene.narration, voice)
        await communicate.save(str(audio_path))

        audio_files.append(audio_path)
        print(f"    Saved: {audio_path}")

    return audio_files


# ---------------------------------------------------------------------------
# Video assembly with ffmpeg
# ---------------------------------------------------------------------------

def get_audio_duration(audio_path: Path) -> float:
    """Get duration of an audio file in seconds using ffprobe."""
    result = subprocess.run(
        [
            "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(audio_path),
        ],
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def assemble_video(
    screenshots: list[Path],
    audio_files: list[Path],
    output_path: Path,
    width: int,
    height: int,
) -> None:
    """Combine screenshots and audio into a single MP4 using ffmpeg."""
    if len(screenshots) != len(audio_files):
        raise ValueError("Mismatch between screenshot and audio file counts")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Create intermediate scene videos
    scene_videos: list[Path] = []
    tmp_dir = Path(tempfile.mkdtemp(prefix="nsg-demo-"))

    for i, (img, audio) in enumerate(zip(screenshots, audio_files)):
        duration = get_audio_duration(audio)
        # Add 1 second padding after narration
        total_duration = duration + 1.0

        scene_video = tmp_dir / f"scene_{i:02d}.mp4"

        subprocess.run(
            [
                "ffmpeg", "-y",
                "-loop", "1", "-i", str(img),
                "-i", str(audio),
                "-c:v", "libx264",
                "-tune", "stillimage",
                "-c:a", "aac", "-b:a", "192k",
                "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black",
                "-pix_fmt", "yuv420p",
                "-t", str(total_duration),
                "-shortest",
                str(scene_video),
            ],
            check=True,
            capture_output=True,
        )

        scene_videos.append(scene_video)
        print(f"  Assembled scene {i + 1}/{len(screenshots)}: {SCENES[i].title} ({total_duration:.1f}s)")

    # Create concat file
    concat_file = tmp_dir / "concat.txt"
    with open(concat_file, "w") as f:
        for video in scene_videos:
            f.write(f"file '{video}'\n")

    # Concatenate all scenes
    print(f"  Concatenating {len(scene_videos)} scenes...")
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-f", "concat", "-safe", "0",
            "-i", str(concat_file),
            "-c:v", "libx264",
            "-c:a", "aac",
            "-movflags", "+faststart",
            str(output_path),
        ],
        check=True,
        capture_output=True,
    )

    # Clean up temp files
    for f in tmp_dir.iterdir():
        f.unlink()
    tmp_dir.rmdir()

    print(f"  Final video: {output_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main():
    parser = argparse.ArgumentParser(description="NSG AI Swarm Demo Video Generator")
    parser.add_argument("--url", default="http://localhost:3100", help="Paperclip base URL")
    parser.add_argument("--output", default="output/nsg-swarm-demo.mp4", help="Output video path")
    parser.add_argument("--width", type=int, default=1920, help="Video width")
    parser.add_argument("--height", type=int, default=1080, help="Video height")
    parser.add_argument("--voice", default="en-US-AndrewNeural", help="Edge TTS voice name")
    parser.add_argument("--skip-tts", action="store_true", help="Skip TTS generation (use existing audio)")
    parser.add_argument("--screenshots-only", action="store_true", help="Only capture screenshots, no video")
    parser.add_argument("--company-id", default=None, help="Paperclip company ID or slug")
    args = parser.parse_args()

    base_dir = Path(__file__).parent
    screenshot_dir = base_dir / "output" / "screenshots"
    audio_dir = base_dir / "output" / "audio"
    output_path = Path(args.output) if os.path.isabs(args.output) else base_dir / args.output

    # Get session cookie from environment (for authenticated mode)
    cookie = os.environ.get("PAPERCLIP_COOKIE")

    # Step 1: Capture screenshots
    print("\n=== Step 1: Capturing Screenshots ===")
    screenshots = await capture_screenshots(
        base_url=args.url,
        output_dir=screenshot_dir,
        width=args.width,
        height=args.height,
        cookie=cookie,
        company_id=args.company_id,
    )
    print(f"  Captured {len(screenshots)} screenshots")

    if args.screenshots_only:
        print("\n=== Done (screenshots only) ===")
        return

    # Step 2: Generate TTS narration
    if args.skip_tts:
        print("\n=== Step 2: Skipping TTS (using existing audio) ===")
        audio_files = sorted(audio_dir.glob("*.mp3"))
    else:
        print("\n=== Step 2: Generating TTS Narration ===")
        audio_files = await generate_narration(audio_dir, voice=args.voice)
    print(f"  Generated {len(audio_files)} audio files")

    # Step 3: Assemble video
    print("\n=== Step 3: Assembling Video ===")
    # Check ffmpeg is available
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
    except FileNotFoundError:
        print("ERROR: ffmpeg not found. Install with: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)")
        sys.exit(1)

    assemble_video(screenshots, audio_files, output_path, args.width, args.height)

    # Report final stats
    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    duration = sum(get_audio_duration(a) for a in audio_files)
    print(f"\n=== Demo Video Complete ===")
    print(f"  File: {output_path}")
    print(f"  Size: {file_size_mb:.1f} MB")
    print(f"  Duration: {duration:.0f} seconds ({duration/60:.1f} minutes)")
    print(f"  Scenes: {len(SCENES)}")


if __name__ == "__main__":
    asyncio.run(main())
