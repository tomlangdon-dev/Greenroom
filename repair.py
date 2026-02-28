import os, sqlite3

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database.db')
conn = sqlite3.connect(DB_PATH)

# Add new columns to folders
existing_f = [r[1] for r in conn.execute("PRAGMA table_info(folders)").fetchall()]
folder_cols = [
('is_managed', 'INTEGER DEFAULT 0'),
('config', 'TEXT'),
('brainsuite_test', 'TEXT'),
('cta', 'INTEGER'),
('file_type', 'TEXT DEFAULT "video"')
]
[conn.execute("ALTER TABLE folders ADD COLUMN "+c+" "+d) for c,d in folder_cols if c not in existing_f]

# Add new columns to assets
existing_a = [r[1] for r in conn.execute("PRAGMA table_info(assets)").fetchall()]
asset_cols = [
('content_origin', 'TEXT DEFAULT "Brand"'),
('language', 'TEXT')
]
[conn.execute("ALTER TABLE assets ADD COLUMN "+c+" "+d) for c,d in asset_cols if c not in existing_a]

conn.commit()
conn.close()
print("✅ Database updated")