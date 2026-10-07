# Module 12 Completion Report

## Instruction File
- Filename: use-retrieve_issue.agent.md

### Retrieve Jira Issues

- Use this instruction when current Jira issue details are needed for delivery reporting, risk analysis, or issue review.
- Run `tools/retrieve_issue.py` from the project root.
- Provide one or more Jira issue keys as positional arguments:
  - `python tools/retrieve_issue.py SAM1-123 KAN-456`
- Configure Jira authentication with these environment variables:
  - `JIRA_BASE_URL`: Jira site URL, such as `https://example.atlassian.net`.
  - `JIRA_EMAIL`: Jira account email.
  - `JIRA_API_TOKEN`: Jira API token.
- Optional flags `--base-url`, `--email`, and `--api-token` can override the environment variables for a single run.
- Read the JSON output for each issue's status, priority, assignee, due date, labels, estimates, update timestamp, and source URL.
- Treat an issue object containing `error` as a retrieval failure and report its issue key and error without discarding successful results.
- Keep API tokens out of command output, source files, and reports.
- Use the returned `source_url` when linking findings back to Jira.

## Script File
- Filename: retrieve_issue.py
- Language: Python

import argparse
import base64
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


ISSUE_FIELDS = ",".join(
    [
        "status",
        "priority",
        "assignee",
        "duedate",
        "labels",
        "timeoriginalestimate",
        "timeestimate",
        "aggregatetimeoriginalestimate",
        "aggregatetimeestimate",
        "updated",
    ]
)


def get_auth_header(email: str, api_token: str) -> str:
    credentials = f"{email}:{api_token}".encode("utf-8")
    return "Basic " + base64.b64encode(credentials).decode("ascii")


def retrieve_issue(issue_key: str, base_url: str, email: str, api_token: str) -> dict:
    normalized_base_url = base_url.rstrip("/")
    encoded_key = quote(issue_key, safe="")
    issue_url = f"{normalized_base_url}/rest/api/3/issue/{encoded_key}?fields={ISSUE_FIELDS}"
    request = Request(
        issue_url,
        headers={
            "Accept": "application/json",
            "Authorization": get_auth_header(email, api_token),
        },
    )

    with urlopen(request, timeout=30) as response:
        payload = json.load(response)

    fields = payload.get("fields", {})
    return {
        "key": payload.get("key", issue_key),
        "status": (fields.get("status") or {}).get("name"),
        "priority": (fields.get("priority") or {}).get("name"),
        "assignee": (fields.get("assignee") or {}).get("displayName"),
        "due_date": fields.get("duedate"),
        "labels": fields.get("labels", []),
        "estimates": {
            "original_seconds": fields.get("timeoriginalestimate"),
            "remaining_seconds": fields.get("timeestimate"),
            "aggregate_original_seconds": fields.get("aggregatetimeoriginalestimate"),
            "aggregate_remaining_seconds": fields.get("aggregatetimeestimate"),
        },
        "updated": fields.get("updated"),
        "source_url": f"{normalized_base_url}/browse/{quote(issue_key, safe='')}",
    }


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Retrieve selected Jira issue fields for one or more issue keys."
    )
    parser.add_argument("issues", nargs="+", metavar="ISSUE", help="Jira issue key, such as SAM1-123")
    parser.add_argument(
        "--base-url",
        default=os.getenv("JIRA_BASE_URL"),
        help="Jira base URL; defaults to JIRA_BASE_URL",
    )
    parser.add_argument(
        "--email",
        default=os.getenv("JIRA_EMAIL"),
        help="Jira account email; defaults to JIRA_EMAIL",
    )
    parser.add_argument(
        "--api-token",
        default=os.getenv("JIRA_API_TOKEN"),
        help="Jira API token; defaults to JIRA_API_TOKEN",
    )
    args = parser.parse_args()

    missing = [
        name
        for name, value in (
            ("--base-url/JIRA_BASE_URL", args.base_url),
            ("--email/JIRA_EMAIL", args.email),
            ("--api-token/JIRA_API_TOKEN", args.api_token),
        )
        if not value
    ]
    if missing:
        parser.error("missing Jira configuration: " + ", ".join(missing))
    return args


def main() -> int:
    args = parse_arguments()
    results = []
    failed = False

    for issue_key in args.issues:
        try:
            results.append(
                retrieve_issue(issue_key, args.base_url, args.email, args.api_token)
            )
        except (HTTPError, URLError, TimeoutError, ValueError) as error:
            failed = True
            results.append({"key": issue_key, "error": str(error)})

    print(json.dumps(results, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

## Script Execution Output

usage: retrieve_issue.py [-h] [--base-url BASE_URL] [--email EMAIL]
                         [--api-token API_TOKEN]
                         ISSUE [ISSUE ...]

Retrieve selected Jira issue fields for one or more issue keys.

positional arguments:
  ISSUE                 Jira issue key, such as SAM1-123

options:
  -h, --help            show this help message and exit
  --base-url BASE_URL   Jira base URL; defaults to JIRA_BASE_URL
  --email EMAIL         Jira account email; defaults to JIRA_EMAIL
  --api-token API_TOKEN
                        Jira API token; defaults to JIRA_API_TOKEN
