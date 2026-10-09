import json, re, os

root = os.environ.get('ARENA_WORKSPACE', os.path.expanduser('~'))
src = os.path.join(root, 'uploads', 'neon-warden_V1921.html')
with open(src, 'r', encoding='utf-8') as f:
    html = f.read()

m = re.search(r'<script type="application/json" id="modsrc">(.*?)</script>', html, re.DOTALL)
data = json.loads(m.group(1))
print("Modules:", list(data.keys()))
outdir = os.path.join(root, 'work', 'extracted')
os.makedirs(outdir, exist_ok=True)
for k, v in data.items():
    print(f"  {k}: {len(v)} chars")
    with open(os.path.join(outdir, k + '.js'), 'w', encoding='utf-8') as out:
        out.write(v)

idx = html.find('<script type="application/json" id="modsrc">')
rest = html[idx:]
end = rest.find('</script>')
after = rest[end+len('</script>'):]
with open(os.path.join(outdir, '_after_modsrc.txt'), 'w', encoding='utf-8') as out:
    out.write(after)
print("After modsrc length:", len(after))
