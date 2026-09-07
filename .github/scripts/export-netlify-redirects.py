"""Export the site's supported TOML routes for direct API deployments."""
import pathlib
import sys
import tomllib

root = pathlib.Path(sys.argv[1]).resolve()
config = tomllib.loads((root / "netlify.toml").read_text(encoding="utf-8"))
lines = ["# Generated from netlify.toml by export-netlify-redirects.py"]
for rule in config.get("redirects", []):
    supported = {"from", "to", "status", "force"}
    extra = {key: value for key, value in rule.items() if key not in supported and value}
    if extra:
        raise ValueError(f"Route needs explicit API export support: {rule['from']} ({list(extra)})")
    source, target = rule["from"], rule["to"]
    if any(char.isspace() for char in source + target):
        raise ValueError("Whitespace is not supported in redirect paths")
    status = int(rule.get("status", 301))
    force = "!" if rule.get("force", False) else ""
    lines.append(f"{source} {target} {status}{force}")
output = "\n".join(lines) + "\n"
destination = root / "_redirects"
if destination.exists():
    expected = {" ".join(line.split()) for line in lines if not line.startswith("#")}
    existing = {" ".join(line.split()) for line in destination.read_text(encoding="utf-8").splitlines()
                if line.strip() and not line.lstrip().startswith("#")}
    if existing - expected:
        raise ValueError("Existing _redirects rules differ; reconcile them with netlify.toml first")
destination.write_text(output, encoding="utf-8", newline="\n")
print(f"Exported {len(lines) - 1} routes without changing their order or force settings.")
