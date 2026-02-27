import os

S = chr(32)*4
N = chr(10)

addition = (
N+N+
'@app.route("/api/assets/<int:aid>", methods=["PUT"])'+N+
'def update_asset(aid):'+N+
S+'data = request.get_json()'+N+
S+'folder_id = data.get("folder_id")'+N+
S+'conn = get_db()'+N+
S+'conn.execute("UPDATE assets SET folder_id = ? WHERE id = ?", (folder_id, aid))'+N+
S+'conn.commit()'+N+
S+'conn.close()'+N+
S+'return jsonify({"ok": True})'+N
)

content = open('app.py').read()
open('app.py', 'w').write(content + addition)
print('app.py updated')