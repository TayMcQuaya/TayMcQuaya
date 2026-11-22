"""Counts the repos owned by the account below that were created since FIRST_YEAR, private ones included,
and writes the number into data/projects.js (SITE.repos) and index.html.

Run by .github/workflows/contributions.yml together with the contribution refresh. It can also be run by hand:
    REPOS_TOKEN=... python3 tools/update_repo_count.py

REPOS_TOKEN is a fine-grained personal access token of the account: "All repositories", read-only.
It can see the names of private repos, but only the count is written anywhere.
Without the token, or when it has expired, nothing changes and the last number stays on the page.
Forks are counted too, set COUNT_FORKS to False to leave them out.
"""
import json, os, re, sys, urllib.error, urllib.request

LOGIN = "TayMcQuaya"
FIRST_YEAR = 2024
COUNT_FORKS = True


def get(url, token):
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "taymcquaya-site"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)


def count(token):
    me = get("https://api.github.com/user", token)
    if me.get("login", "").lower() != LOGIN.lower():
        raise SystemExit(f"REPOS_TOKEN belongs to {me.get('login')}, not {LOGIN}. Nothing written.")
    total, page = 0, 1
    seen = {"all": 0, "private": 0, "forks": 0, f"before {FIRST_YEAR}": 0, "other owners": 0}
    while True:
        repos = get(f"https://api.github.com/user/repos?affiliation=owner&visibility=all&per_page=100&page={page}", token)
        for r in repos:
            seen["all"] += 1
            seen["private"] += r["private"]
            seen["forks"] += r["fork"]
            if int(r["created_at"][:4]) < FIRST_YEAR: seen[f"before {FIRST_YEAR}"] += 1
            if r["owner"]["login"].lower() != LOGIN.lower(): seen["other owners"] += 1; continue
            if r["fork"] and not COUNT_FORKS: continue
            if int(r["created_at"][:4]) >= FIRST_YEAR: total += 1
        if len(repos) < 100:
            print("the token sees:", ", ".join(f"{k} {v}" for k, v in seen.items()))   # numbers only, no names
            return total
        page += 1


def main():
    token = os.environ.get("REPOS_TOKEN")
    if not token:
        print("REPOS_TOKEN is not set, the repo count stays as it is.")
        return
    try:
        n = count(token)
    except urllib.error.HTTPError as e:
        print(f"GitHub answered {e.code} (expired or wrong token?). The repo count stays as it is.")
        return

    projects = open("data/projects.js").read()
    m = re.search(r"^(\s*repos:\s*)(\d+)(,.*)$", projects, re.M)
    if not m:
        raise SystemExit("Could not find 'repos:' in data/projects.js")
    before = int(m.group(2))
    # the hand-typed number before the first automatic count may be off, so the check starts after that
    if "counted by" in m.group(3) and n < before * 0.8:
        raise SystemExit(f"Counted {n}, far below the saved {before}. Does the token still see all repos? Nothing written.")
    line = f"{m.group(1)}{n},           // counted by tools/update_repo_count.py: repos owned by {LOGIN}, created since {FIRST_YEAR}, private included"
    projects = projects[:m.start()] + line + projects[m.end():]
    open("data/projects.js", "w").write(projects)

    page = open("index.html").read()
    page = re.sub(r"\d+ repos since 2024", f"{n} repos since 2024", page)
    page = re.sub(r'(<dd id="fact-repos">)\d+(</dd>)', rf"\g<1>{n}\g<2>", page)
    open("index.html", "w").write(page)
    print(f"repos: {before} -> {n}")


if __name__ == "__main__":
    main()
