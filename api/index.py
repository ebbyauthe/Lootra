import sys
import os

# Add the repo root to sys.path so `backend` is importable
# regardless of where Vercel sets the working directory.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.server import app
