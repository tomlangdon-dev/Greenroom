S = chr(32)*4
S2 = chr(32)*8
N = chr(10)
Q = chr(34)
A = chr(39)

f = open('app.py', 'r')
src = f.read()
f.close()

old = 'def get_media_dirs(project_id):' + N
old += S + 'base = os.path.join(MEDIA_ROOT, ' + Q + 'projects' + Q + ', str(project_id)) if project_id else os.path.join(MEDIA_ROOT, ' + Q + 'unsorted' + Q + ')' + N
old += S + 'vid = os.path.join(base, ' + Q + 'videos' + Q + ')' + N
old += S + 'pptx = os.path.join(base, ' + Q + 'pptx' + Q + ')' + N
old += S + 'os.makedirs(vid, exist_ok=True)' + N
old += S + 'os.makedirs(pptx, exist_ok=True)' + N
old += S + 'return vid, pptx'

new = 'def get_media_dirs(project_id):' + N
new += S + 'if project_id:' + N
new += S2 + 'conn_n = get_db()' + N
new += S2 + 'row = conn_n.execute(' + Q + 'SELECT name FROM folders WHERE id=?' + Q + ', (project_id,)).fetchone()' + N
new += S2 + 'conn_n.close()' + N
new += S2 + 'name = row[' + Q + 'name' + Q + '] if row else str(project_id)' + N
new += S2 + 'safe = ' + Q + Q + '.join(c if c.isalnum() or c == ' + A + '-' + A + ' else ' + A + '_' + A + ' for c in name)' + N
new += S2 + 'base = os.path.join(MEDIA_ROOT, ' + Q + 'projects' + Q + ', str(project_id) + ' + A + '_' + A + ' + safe)' + N
new += S + 'else:' + N
new += S2 + 'base = os.path.join(MEDIA_ROOT, ' + Q + 'unsorted' + Q + ')' + N
new += S + 'vid = os.path.join(base, ' + Q + 'videos' + Q + ')' + N
new += S + 'pptx = os.path.join(base, ' + Q + 'pptx' + Q + ')' + N
new += S + 'os.makedirs(vid, exist_ok=True)' + N
new += S + 'os.makedirs(pptx, exist_ok=True)' + N
new += S + 'return vid, pptx'

src = src.replace(old, new)
f = open('app.py', 'w')
f.write(src)
f.close()
print('done')