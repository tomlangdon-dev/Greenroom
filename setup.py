import os

os.makedirs('templates', exist_ok=True)
os.makedirs('uploads/videos', exist_ok=True)
os.makedirs('uploads/pptx', exist_ok=True)

S = chr(32) * 4
N = chr(10)

app = (
'from flask import Flask, render_template' + N +
'import os' + N + N +
'app = Flask(__name__)' + N + N +
'BASE_DIR = os.path.dirname(os.path.abspath(__file__))' + N +
'UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")' + N +
'VIDEO_DIR = os.path.join(UPLOAD_DIR, "videos")' + N +
'PPTX_DIR = os.path.join(UPLOAD_DIR, "pptx")' + N + N +
'os.makedirs(VIDEO_DIR, exist_ok=True)' + N +
'os.makedirs(PPTX_DIR, exist_ok=True)' + N + N +
'@app.route("/")' + N +
'def index():' + N +
S + 'return render_template("index.html")' + N
)

db = (
'import sqlite3, os' + N + N +
'DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.db")' + N + N +
'def get_db():' + N +
S + 'conn = sqlite3.connect(DB_PATH)' + N +
S + 'conn.row_factory = sqlite3.Row' + N +
S + 'conn.execute("PRAGMA foreign_keys = ON")' + N +
S + 'return conn' + N + N +
'def init_db():' + N +
S + 'conn = get_db()' + N +
S + 'conn.executescript("""' + N +
'CREATE TABLE IF NOT EXISTS folders (' + N +
S + 'id INTEGER PRIMARY KEY AUTOINCREMENT,' + N +
S + 'name TEXT NOT NULL,' + N +
S + 'parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,' + N +
S + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP' + N +
');' + N + N +
'CREATE TABLE IF NOT EXISTS assets (' + N +
S + 'id INTEGER PRIMARY KEY AUTOINCREMENT,' + N +
S + 'folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,' + N +
S + 'base_name TEXT NOT NULL,' + N +
S + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP' + N +
');' + N + N +
'CREATE TABLE IF NOT EXISTS versions (' + N +
S + 'id INTEGER PRIMARY KEY AUTOINCREMENT,' + N +
S + 'asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,' + N +
S + 'version_number INTEGER NOT NULL DEFAULT 1,' + N +
S + 'video_filename TEXT,' + N +
S + 'video_path TEXT,' + N +
S + 'pptx_filename TEXT,' + N +
S + 'pptx_path TEXT,' + N +
S + 'ace_score INTEGER,' + N +
S + 'kpi_data TEXT,' + N +
S + 'asset_info TEXT,' + N +
S + 'thumbnail TEXT,' + N +
S + 'is_latest INTEGER DEFAULT 1,' + N +
S + 'uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP' + N +
');' + N +
S + '""")' + N +
S + 'conn.commit()' + N +
S + 'conn.close()' + N +
S + 'print("Database ready")' + N
)

open('app.py', 'w').write(app)
open('database.py', 'w').write(db)
print("Python files created")