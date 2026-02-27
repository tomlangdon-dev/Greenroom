from flask import Flask, render_template, request, jsonify, send_from_directory
import os, json, uuid
from database import get_db
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
VIDEO_DIR = os.path.join(UPLOAD_DIR, "videos")
PPTX_DIR = os.path.join(UPLOAD_DIR, "pptx")
os.makedirs(VIDEO_DIR, exist_ok=True)
os.makedirs(PPTX_DIR, exist_ok=True)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/uploads/videos/<path:filename>")
def serve_video(filename):
    return send_from_directory(VIDEO_DIR, filename)

@app.route("/api/folders", methods=["GET"])
def get_folders():
    conn = get_db()
    rows = conn.execute("SELECT * FROM folders ORDER BY name").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/folders", methods=["POST"])
def create_folder():
    data = request.get_json()
    name = data.get("name", "").strip()
    parent_id = data.get("parent_id")
    if not name: return jsonify({"error": "Name required"}), 400
    conn = get_db()
    cur = conn.execute("INSERT INTO folders (name, parent_id) VALUES (?, ?)", (name, parent_id))
    conn.commit()
    fid = cur.lastrowid
    conn.close()
    return jsonify({"id": fid, "name": name, "parent_id": parent_id}), 201

@app.route("/api/folders/<int:fid>", methods=["PUT"])
def rename_folder(fid):
    name = request.get_json().get("name", "").strip()
    if not name: return jsonify({"error": "Name required"}), 400
    conn = get_db()
    conn.execute("UPDATE folders SET name = ? WHERE id = ?", (name, fid))
    conn.commit()
    conn.close()
    return jsonify({"id": fid, "name": name})

@app.route("/api/folders/<int:fid>", methods=["DELETE"])
def delete_folder(fid):
    conn = get_db()
    ids = [fid]
    queue = [fid]
    while queue:
        cur_id = queue.pop()
        children = conn.execute("SELECT id FROM folders WHERE parent_id = ?", (cur_id,)).fetchall()
        for c in children:
            ids.append(c["id"])
            queue.append(c["id"])
    ph = ",".join(["?" for _ in ids])
    assets = conn.execute("SELECT id FROM assets WHERE folder_id IN (" + ph + ")", ids).fetchall()
    for a in assets:
        versions = conn.execute("SELECT video_path, pptx_path FROM versions WHERE asset_id = ?", (a["id"],)).fetchall()
        for v in versions:
            for p in [v["video_path"], v["pptx_path"]]:
                if p and os.path.exists(p): os.remove(p)
        conn.execute("DELETE FROM assets WHERE id = ?", (a["id"],))
    conn.execute("DELETE FROM folders WHERE id = ?", (fid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

@app.route("/api/folders/<int:fid>/count")
def folder_count(fid):
    conn = get_db()
    sql = (
        "WITH RECURSIVE pf AS ("
        "SELECT id FROM folders WHERE id = ? "
        "UNION ALL "
        "SELECT f.id FROM folders f INNER JOIN pf ON f.parent_id = pf.id) "
        "SELECT COUNT(DISTINCT a.id) as total "
        "FROM assets a WHERE a.folder_id IN (SELECT id FROM pf)"
    )
    row = conn.execute(sql, (fid,)).fetchone()
    conn.close()
    return jsonify({"count": row["total"] if row else 0})

@app.route("/api/assets", methods=["GET"])
def get_assets():
    folder_id = request.args.get("folder_id")
    project_id = request.args.get("project_id")
    conn = get_db()
    base_q = "SELECT a.id, a.base_name, a.display_name, a.phase, a.platform, a.format, a.is_master, a.audience_tags, a.folder_id, a.created_at, v.ace_score, v.asset_info, v.thumbnail, v.uploaded_at, v.version_number as latest_version, v.id as latest_version_id, v.video_filename FROM assets a LEFT JOIN versions v ON v.asset_id = a.id AND v.is_latest = 1"
    if project_id:
        pf = "WITH RECURSIVE pf AS (SELECT id FROM folders WHERE id = ? UNION ALL SELECT f.id FROM folders f INNER JOIN pf ON f.parent_id = pf.id) "
        rows = conn.execute(pf + base_q + " WHERE a.folder_id IN (SELECT id FROM pf) ORDER BY a.base_name", (project_id,)).fetchall()
    elif folder_id:
        rows = conn.execute(base_q + " WHERE a.folder_id = ? ORDER BY a.base_name", (folder_id,)).fetchall()
    else:
        rows = conn.execute(base_q + " WHERE a.folder_id IS NULL ORDER BY a.base_name").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/assets/<int:aid>", methods=["DELETE"])
def delete_asset(aid):
    conn = get_db()
    versions = conn.execute("SELECT * FROM versions WHERE asset_id = ?", (aid,)).fetchall()
    for v in versions:
        for p in [v["video_path"], v["pptx_path"]]:
            if p and os.path.exists(p): os.remove(p)
    conn.execute("DELETE FROM assets WHERE id = ?", (aid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

@app.route("/api/assets/<int:aid>", methods=["PUT"])
def update_asset(aid):
    data = request.get_json()
    folder_id = data.get("folder_id")
    conn = get_db()
    conn.execute("UPDATE assets SET folder_id = ? WHERE id = ?", (folder_id, aid))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

@app.route("/api/assets/<int:aid>/tags", methods=["PUT"])
def update_tags(aid):
    data = request.get_json()
    display_name = data.get("display_name")
    phase = data.get("phase")
    platform = data.get("platform")
    fmt = data.get("format")
    is_master = 1 if data.get("is_master") else 0
    audience_tags = json.dumps(data.get("audience_tags", []))
    project_id = data.get("project_id")
    conn = get_db()
    new_folder_id = None
    if project_id and phase and platform:
        def find_or_create(name, parent_id):
            r = conn.execute("SELECT id FROM folders WHERE name=? AND parent_id=?", (name, parent_id)).fetchone()
            if r: return r["id"]
            cur = conn.execute("INSERT INTO folders (name, parent_id) VALUES (?,?)", (name, parent_id))
            conn.commit()
            return cur.lastrowid
        phase_id = find_or_create(phase, project_id)
        plat_id = find_or_create(platform, phase_id)
        new_folder_id = find_or_create(fmt, plat_id) if fmt else plat_id
    conn.execute("UPDATE assets SET display_name=?,phase=?,platform=?,format=?,is_master=?,audience_tags=?,folder_id=? WHERE id=?", (display_name, phase, platform, fmt, is_master, audience_tags, new_folder_id, aid))
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "folder_id": new_folder_id})

@app.route("/api/tags")
def get_tags():
    project_id = request.args.get("project_id")
    conn = get_db()
    if project_id:
        sql = (
            "WITH RECURSIVE pf AS ("
            "SELECT id FROM folders WHERE id = ? "
            "UNION ALL "
            "SELECT f.id FROM folders f INNER JOIN pf ON f.parent_id = pf.id) "
            "SELECT audience_tags FROM assets "
            "WHERE folder_id IN (SELECT id FROM pf) "
            "AND audience_tags IS NOT NULL AND audience_tags != '[]'"
        )
        rows = conn.execute(sql, (project_id,)).fetchall()
    else:
        rows = conn.execute("SELECT audience_tags FROM assets WHERE audience_tags IS NOT NULL").fetchall()
    conn.close()
    all_tags = set()
    for row in rows:
        try:
            for tag in json.loads(row["audience_tags"] or "[]"):
                all_tags.add(tag)
        except: pass
    return jsonify(sorted(list(all_tags)))

@app.route("/api/versions/<int:aid>", methods=["GET"])
def get_versions(aid):
    conn = get_db()
    rows = conn.execute("SELECT * FROM versions WHERE asset_id = ? ORDER BY version_number DESC", (aid,)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/upload", methods=["POST"])
def upload():
    folder_id = request.form.get("folder_id") or None
    scores_json = request.form.get("scores")
    asset_info_json = request.form.get("asset_info")
    thumbnail = request.form.get("thumbnail")
    ace_score = request.form.get("ace_score")
    video = request.files.get("video")
    pptx = request.files.get("pptx")
    if not video: return jsonify({"error": "Video required"}), 400
    uid = str(uuid.uuid4())[:8]
    orig = secure_filename(video.filename)
    base_name = os.path.splitext(orig)[0]
    vid_filename = uid + "_" + orig
    vid_path = os.path.join(VIDEO_DIR, vid_filename)
    video.save(vid_path)
    pptx_filename = pptx_path = None
    if pptx:
        pptx_orig = secure_filename(pptx.filename)
        pptx_filename = uid + "_" + pptx_orig
        pptx_path = os.path.join(PPTX_DIR, pptx_filename)
        pptx.save(pptx_path)
    conn = get_db()
    if folder_id:
        existing = conn.execute("SELECT id FROM assets WHERE base_name = ? AND folder_id = ?", (base_name, folder_id)).fetchone()
    else:
        existing = conn.execute("SELECT id FROM assets WHERE base_name = ? AND folder_id IS NULL", (base_name,)).fetchone()
    if existing:
        asset_id = existing["id"]
        max_v = conn.execute("SELECT MAX(version_number) v FROM versions WHERE asset_id = ?", (asset_id,)).fetchone()["v"] or 0
        version_number = max_v + 1
        conn.execute("UPDATE versions SET is_latest = 0 WHERE asset_id = ?", (asset_id,))
    else:
        cur = conn.execute("INSERT INTO assets (folder_id, base_name) VALUES (?, ?)", (folder_id, base_name))
        asset_id = cur.lastrowid
        version_number = 1
    conn.execute("INSERT INTO versions (asset_id, version_number, video_filename, video_path, pptx_filename, pptx_path, ace_score, kpi_data, asset_info, thumbnail, is_latest) VALUES (?,?,?,?,?,?,?,?,?,?,1)", (asset_id, version_number, vid_filename, vid_path, pptx_filename, pptx_path, ace_score, scores_json, asset_info_json, thumbnail))
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "asset_id": asset_id, "version": version_number}), 201

@app.route("/api/versions/<int:vid>/report", methods=["POST"])
def add_report(vid):
    pptx = request.files.get("pptx")
    scores_json = request.form.get("scores")
    asset_info_json = request.form.get("asset_info")
    thumbnail = request.form.get("thumbnail")
    ace_score = request.form.get("ace_score")
    pptx_filename = pptx_path = None
    if pptx:
        uid = str(uuid.uuid4())[:8]
        pptx_orig = secure_filename(pptx.filename)
        pptx_filename = uid + "_" + pptx_orig
        pptx_path = os.path.join(PPTX_DIR, pptx_filename)
        pptx.save(pptx_path)
    conn = get_db()
    conn.execute("UPDATE versions SET pptx_filename=?, pptx_path=?, ace_score=?, kpi_data=?, asset_info=?, thumbnail=? WHERE id=?", (pptx_filename, pptx_path, ace_score, scores_json, asset_info_json, thumbnail, vid))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

@app.route("/api/projects/stats")
def project_stats():
    conn = get_db()
    projects = conn.execute("SELECT id FROM folders WHERE parent_id IS NULL").fetchall()
    result = {}
    sql = (
        "WITH RECURSIVE pf AS ("
        "SELECT id FROM folders WHERE id = ? "
        "UNION ALL "
        "SELECT f.id FROM folders f INNER JOIN pf ON f.parent_id = pf.id) "
        "SELECT COUNT(DISTINCT a.id) as total, "
        "SUM(CASE WHEN v.ace_score >= 67 THEN 1 ELSE 0 END) as green, "
        "SUM(CASE WHEN v.ace_score >= 34 AND v.ace_score < 67 THEN 1 ELSE 0 END) as amber, "
        "SUM(CASE WHEN v.ace_score IS NOT NULL AND v.ace_score < 34 THEN 1 ELSE 0 END) as red, "
        "SUM(CASE WHEN v.ace_score IS NULL THEN 1 ELSE 0 END) as unscored "
        "FROM assets a "
        "LEFT JOIN versions v ON v.asset_id = a.id AND v.is_latest = 1 "
        "WHERE a.folder_id IN (SELECT id FROM pf)"
    )
    for project in projects:
        pid = project["id"]
        row = conn.execute(sql, (pid,)).fetchone()
        result[str(pid)] = dict(row) if row else {"total":0,"green":0,"amber":0,"red":0,"unscored":0}
    conn.close()
    return jsonify(result)