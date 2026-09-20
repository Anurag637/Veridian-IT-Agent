"""
Veridian IT Agent — One-Command Runner
Starts the FastAPI application and opens the enterprise dashboard in the default web browser.
"""

import sys
import os
import webbrowser
import time
import subprocess
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()

def main():
    print("=" * 65)
    print("      Veridian Corp — Autonomous IT Service Agent")
    print("           Enterprise Internal IT Support Copilot")
    print("=" * 65)
    print("\n[1/3] Initializing SQLite Database & Grounded Knowledge Base...")

    # Ensure backend path is in sys.path
    project_root = Path(__file__).resolve().parent
    sys.path.insert(0, str(project_root))

    from backend.app.models.db import init_db
    init_db()
    print("      Database and seed records verified.")

    print("\n[2/3] Starting FastAPI Server on http://127.0.0.1:8000...")
    url = "http://127.0.0.1:8000"

    # Open browser after slight delay
    def open_browser():
        time.sleep(1.2)
        print(f"\n[3/3] Opening Dashboard: {url}")
        webbrowser.open(url)

    import threading
    threading.Thread(target=open_browser, daemon=True).start()

    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)

if __name__ == "__main__":
    main()
