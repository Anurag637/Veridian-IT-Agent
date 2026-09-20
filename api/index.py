import os
import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Ensure VERCEL environment flag is set
os.environ["VERCEL"] = "1"

from backend.app.main import app

# Export for Vercel ASGI serverless handler
handler = app
