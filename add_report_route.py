import os

S = chr(32)*4
S2 = chr(32)*8
N = chr(10)

addition = (
N+N+
'@app.route("/api/versions/<int:vid>/report", methods=["POST"])'+N+
'def add_report(vid):'+N+
S+'pptx = request.files.get("pptx")'+N+
S+'scores_json = request.form.get("scores")'+N+
S+'asset_info_json = request.form.get("asset_info")'+N+
S+'thumbnail = request.form.get("thumbnail")'+N+
S+'ace_score = request.form.get("ace_score")'+N+
S+'pptx_filename = pptx_path = None'+N+
S+'if pptx:'+N+
S2+'uid = str(uuid.uuid4())[:8]'+N+
S2+'pptx_orig = secure_filename(pptx.filename)'+N+
S2+'pptx_filename = uid + "_" + pptx_orig'+N+
S2+'pptx_path = os.path.join(PPTX_DIR, pptx_filename)'+N+
S2+'pptx.save(pptx_path)'+N+
S+'conn = get_db()'+N+
S+'conn.execute("UPDATE versions SET pptx_filename=?, pptx_path=?, ace_score=?, kpi_data=?, asset_info=?, thumbnail=? WHERE id=?", (pptx_filename, pptx_path, ace_score, scores_json, asset_info_json, thumbnail, vid))'+N+
S+'conn.commit()'+N+
S+'conn.close()'+N+
S+'return jsonify({"ok": True})'+N
)

content = open('app.py').read()
open('app.py', 'w').write(content + addition)
print('Done')