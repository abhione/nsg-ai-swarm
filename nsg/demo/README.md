# NSG Demo Video Generator

Automated demo video pipeline for the NSG Vision Care Marketing AI Swarm.
Uses Playwright to capture screenshots, Edge TTS for narration, and ffmpeg to
assemble the final MP4.

## Prerequisites

- Python 3.11+
- ffmpeg installed (`brew install ffmpeg` or `apt install ffmpeg`)
- A running Paperclip instance with NSG swarm seeded (see docs/GETTING_STARTED.md)

## Setup

```bash
cd nsg/demo

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium
```

## Generate the Demo Video

```bash
# Make sure Paperclip is running at http://localhost:3100
# with the NSG Vision Care Marketing company seeded

python record_demo.py
```

### Options

```bash
# Custom Paperclip URL
python record_demo.py --url http://192.168.1.50:3100

# Custom output path
python record_demo.py --output /path/to/nsg-demo.mp4

# Skip TTS generation (use existing audio files)
python record_demo.py --skip-tts

# Screenshot-only mode (no video assembly)
python record_demo.py --screenshots-only

# Custom resolution
python record_demo.py --width 1920 --height 1080

# Specify company ID (if multiple companies exist)
python record_demo.py --company-id <uuid>
```

## Output

- `output/screenshots/` — PNG screenshots for each scene
- `output/audio/` — MP3 narration files for each scene
- `output/nsg-swarm-demo.mp4` — Final assembled video

## Customizing the Script

Edit `demo-script.md` to change narration text. The 7-scene structure is:

1. Dashboard Overview
2. Agent Roster
3. Issue Board
4. Org Chart
5. Agent Detail (Spectrum)
6. Cost Dashboard
7. Closing

To add or remove scenes, edit both `demo-script.md` and the `SCENES` list in
`record_demo.py`.

## Troubleshooting

**Playwright can't connect:**
- Ensure Paperclip is running: `curl http://localhost:3100/api/health`
- Check if the NSG company is seeded: `curl http://localhost:3100/api/companies`

**ffmpeg not found:**
- Install: `brew install ffmpeg` (macOS) or `sudo apt install ffmpeg` (Linux)

**Edge TTS fails:**
- Check internet connectivity (Edge TTS requires Microsoft's API)
- Try: `edge-tts --voice en-US-AndrewNeural --text "test" --write-media test.mp3`

**Screenshots are blank or show login page:**
- In local_trusted mode, no login is needed
- In authenticated mode, the script needs a session cookie — set `PAPERCLIP_COOKIE` env var
