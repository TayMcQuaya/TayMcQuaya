import subprocess, sys, os, json, collections, glob
hist = sys.argv[1]; out = sys.argv[2]
names = {"TayMcQuaya", "Tayfun Ergun"}
days = collections.defaultdict(lambda: [0, collections.Counter()])
seen = set()
for d in sorted(glob.glob(os.path.join(hist, "*.git"))):
    base = os.path.basename(d)[:-4]
    private = base.startswith("priv_")
    if private: base = base[5:]
    owner, repo = base.split("_", 1)
    # private repos never appear by name: only the date and the count are kept
    label = "private work" if private else (repo if owner == "TayMcQuaya" else "team work")
    if repo == "TayMcQuaya": label = "taymcquaya.com"
    p = subprocess.run(["git", "-C", d, "log", "--all", "--format=%H|%an|%ad", "--date=short"], capture_output=True, text=True)
    for line in p.stdout.splitlines():
        h, an, ad = line.split("|")
        if an not in names or h in seen: continue
        seen.add(h)
        days[ad][0] += 1; days[ad][1][label] += 1
res = {k: [v[0], ", ".join(n for n, _ in v[1].most_common(3))] for k, v in sorted(days.items())}
body = json.dumps(res, separators=(",", ":"))
open(out, "w").write("// Commits per day, public and private repos. Private repos are counted but never named.\n// Rebuilt by tools/activity.py. Format: { 'YYYY-MM-DD': [commits, 'what was touched that day'] }\nexport const ACTIVITY = " + body + ";\n")
tot = sum(v[0] for v in res.values())
print("commits", tot, "active days", len(res), "first", min(res), "last", max(res))
by = collections.Counter()
for k, v in res.items(): by[k[:4]] += v[0]
print(dict(by))
ad = collections.Counter(k[:4] for k in res); print("active days/yr", dict(ad))
print("max day", max(res.items(), key=lambda kv: kv[1][0]))
