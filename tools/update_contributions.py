"""Refreshes the daily contribution counts from GitHub and rebuilds data/activity.js.

Run by .github/workflows/contributions.yml every few hours. It can also be run by hand:
    GITHUB_TOKEN=... python3 tools/update_contributions.py

It reads the public contribution calendar of the account below. Private work is included
only while "Private contributions" is switched on in the GitHub profile settings.
If the new total comes back much lower than the saved one, nothing is written.
"""
import datetime, json, os, re, subprocess, sys, urllib.request

LOGIN = "TayMcQuaya"
FIRST_YEAR = 2024
FILE = "tools/github-contributions.txt"

QUERY = """
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
    }
  }
}"""


def fetch_year(token, year):
    body = json.dumps({"query": QUERY, "variables": {
        "login": LOGIN, "from": f"{year}-01-01T00:00:00Z", "to": f"{year}-12-31T23:59:59Z"}}).encode()
    req = urllib.request.Request("https://api.github.com/graphql", data=body, headers={
        "Authorization": f"bearer {token}", "Content-Type": "application/json", "User-Agent": "taymcquaya-site"})
    with urllib.request.urlopen(req, timeout=30) as res:
        data = json.load(res)
    if data.get("errors") or not (data.get("data") or {}).get("user"):
        raise SystemExit(f"GitHub did not return a calendar for {year}: {data.get('errors')}")
    cal = data["data"]["user"]["contributionsCollection"]["contributionCalendar"]
    days = {}
    for week in cal["weeks"]:
        for day in week["contributionDays"]:
            if day["date"].startswith(str(year)) and day["contributionCount"] > 0:
                days[day["date"]] = day["contributionCount"]
    return cal["totalContributions"], days


def saved_total():
    try:
        return sum(int(m.group(1)) for m in re.finditer(r"^\d{4} (\d+)$", open(FILE).read(), re.M))
    except FileNotFoundError:
        return 0


def main():
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        raise SystemExit("GITHUB_TOKEN is not set")
    today = datetime.date.today()
    lines = [
        f"# Daily contribution counts as shown on github.com/{LOGIN} (private contributions included).",
        f"# Read on {today.isoformat()} by tools/update_contributions.py. Format per year: \"YEAR total\", then \"MM: day=count ...\".",
    ]
    grand = 0
    for year in range(today.year, FIRST_YEAR - 1, -1):
        total, days = fetch_year(token, year)
        grand += total
        lines.append(f"{year} {total}")
        for month in range(1, 13):
            items = [f"{int(d[8:])}={n}" for d, n in sorted(days.items()) if int(d[5:7]) == month]
            if items:
                lines.append(f"{month:02d}: " + " ".join(items))
    before = saved_total()
    if before and grand < before * 0.9:
        raise SystemExit(f"New total {grand} is far below the saved {before}. Is 'Private contributions' still on? Nothing written.")
    open(FILE, "w").write("\n".join(lines) + "\n")
    subprocess.run([sys.executable, "tools/build_activity.py"], check=True)
    print(f"contributions: {before} -> {grand}")


if __name__ == "__main__":
    main()
