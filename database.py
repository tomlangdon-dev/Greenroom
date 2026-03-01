import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_managed INTEGER DEFAULT 0,
    config TEXT,
    brainsuite_test TEXT,
    cta INTEGER,
    file_type TEXT DEFAULT 'video'
);
CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
    base_name TEXT NOT NULL,
    display_name TEXT,
    phase TEXT,
    platform TEXT,
    format TEXT,
    is_master INTEGER DEFAULT 0,
    audience_tags TEXT,
    content_origin TEXT DEFAULT 'Brand',
    language TEXT,
    review_status TEXT DEFAULT 'unreviewed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    video_filename TEXT,
    video_path TEXT,
    pptx_filename TEXT,
    pptx_path TEXT,
    ace_score INTEGER,
    kpi_data TEXT,
    asset_info TEXT,
    thumbnail TEXT,
    duration INTEGER,
    is_latest INTEGER DEFAULT 1,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_id INTEGER NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
    timecode REAL NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
    """)
    ec = lambda t: [r[1] for r in conn.execute("PRAGMA table_info(%s)" % t).fetchall()]
    [conn.execute("ALTER TABLE folders ADD COLUMN %s %s" % (c,v)) for c,v in [('is_managed','INTEGER DEFAULT 0'),('config','TEXT'),('brainsuite_test','TEXT'),('cta','INTEGER'),('file_type',"TEXT DEFAULT 'video'")] if c not in ec('folders')]
    [conn.execute("ALTER TABLE assets ADD COLUMN %s %s" % (c,v)) for c,v in [('display_name','TEXT'),('phase','TEXT'),('platform','TEXT'),('format','TEXT'),('is_master','INTEGER DEFAULT 0'),('audience_tags','TEXT'),('content_origin',"TEXT DEFAULT 'Brand'"),('language','TEXT'),('review_status',"TEXT DEFAULT 'unreviewed'")] if c not in ec('assets')]
    [conn.execute("ALTER TABLE versions ADD COLUMN %s %s" % (c,v)) for c,v in [('duration','INTEGER')] if c not in ec('versions')]
    conn.commit()
    conn.close()
    print("Database ready")
