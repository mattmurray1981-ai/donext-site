from pathlib import Path
s = chr(32)*2 + "<script src=" + chr(34) + "/assets/js/hit.js" + chr(34) + " defer></script>\n"
for name in ["index.html", "now.html", "weekend-brief.html", "thank-you.html", "now/index.html"]:
    p = Path(name)
    if not p.exists():
        print("skip", name)
        continue
    t = p.read_text()
    if "assets/js/hit.js" in t:
        print("already", name)
        continue
    i = t.rfind("</body>")
    if i < 0:
        print("no body", name)
        continue
    p.write_text(t[:i] + s + t[i:])
    print("injected", name)
