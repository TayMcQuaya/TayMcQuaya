"""Builds data/activity.js for the block skyline.

  counts: tools/github-contributions.txt  (what github.com/TayMcQuaya shows per day, private work included)
  labels: tools/git-activity.json         (which repos were touched that day; private repos are only ever "private work")

Run from the repo root:  python3 tools/build_activity.py
"""
import json, re, statistics

counts, year = {}, None
for line in open("tools/github-contributions.txt"):
    line = line.strip()
    if not line or line.startswith("#"): continue
    m = re.match(r"^(\d{4}) (\d+)$", line)
    if m: year = m.group(1); continue
    month, rest = line.split(":")
    for item in rest.split():
        day, n = item.split("=")
        counts[f"{year}-{month}-{int(day):02d}"] = int(n)

labels = json.load(open("tools/git-activity.json"))
out = {}
for date in sorted(counts):
    what = labels.get(date, [0, ""])[1] or "private work"
    out[date] = [counts[date], what]

body = json.dumps(out, separators=(",", ":"))
open("data/activity.js", "w").write(
    "// Contributions per day as GitHub counts them, private work included. Private repos are never named.\n"
    "// Rebuilt by tools/build_activity.py. Format: { 'YYYY-MM-DD': [contributions, 'what was touched that day'] }\n"
    "export const ACTIVITY = " + body + ";\n")
vals = sorted(counts.values())
print("days", len(out), "total", sum(vals), "quartiles", statistics.quantiles(vals, n=5), "max", vals[-1])
print("git-only days (commits I can see, but GitHub counts nothing):", sum(1 for d in labels if d not in counts))
print("days with no visible repo:", sum(1 for d in out if out[d][1] == "private work" and d not in labels))
