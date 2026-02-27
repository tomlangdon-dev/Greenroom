import subprocess, sys, os, webbrowser, time, threading

os.chdir(os.path.dirname(os.path.abspath(__file__)))

subprocess.run([sys.executable, '-m', 'pip', 'install', 'flask', '--user', '-q'])

threading.Thread(
target=lambda: (time.sleep(2.5), webbrowser.open('http://127.0.0.1:5000')),
daemon=True
).start()

from app import app
from database import init_db

init_db()
print("\n🎬  Video Asset Manager → http://localhost:5000")
print("Press Ctrl+C to stop.\n")
app.run(debug=False, port=5000, use_reloader=False)