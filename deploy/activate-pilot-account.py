#!/usr/bin/env python3
"""Prompt-only operator flow for listing and activating verified pilot accounts."""

import getpass
import json
import sys
import urllib.error
import urllib.request
import http.cookiejar


def request(opener, url, origin, key=None, method="GET", body=None):
    headers = {"Origin": origin, "Accept": "application/json"}
    if key is not None:
        headers["X-Pilot-Admin-Key"] = key
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with opener.open(req, timeout=15) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, b""


def main():
    if len(sys.argv) != 3:
        print("Usage: activate-pilot-account.py https://api.example https://frontend.example")
        return 2
    base_url, origin = (value.rstrip("/") for value in sys.argv[1:])
    if not base_url.startswith("https://") or not origin.startswith("https://"):
        print("API and frontend origins must use HTTPS.")
        return 2

    email = input("Operator e-mail: ").strip()
    password = getpass.getpass("Operator password: ")
    key = getpass.getpass("Pilot admin key: ")
    if len(key) < 32:
        print("Pilot admin key must contain at least 32 characters.")
        return 2

    cookies = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))
    status, _ = request(opener, f"{base_url}/api/v1/auth/login", origin,
                        method="POST", body={"email": email, "password": password})
    password = ""
    if status != 204:
        print(f"Sign-in failed (HTTP {status}).")
        return 1

    status, payload = request(opener, f"{base_url}/api/v1/admin/accounts/pending", origin, key)
    if status != 200:
        print(f"Pending account lookup failed (HTTP {status}).")
        return 1
    accounts = json.loads(payload)
    if not accounts:
        print("No pending accounts.")
        return 0
    for account in accounts:
        ready = "verified" if account["ownerEmailConfirmed"] else "email not verified"
        print(f"{account['id']}  {account['name']}  {account['createdAtUtc']}  {ready}")

    account_id = input("Account ID to activate (Enter cancels): ").strip()
    selected = next((item for item in accounts if item["id"].lower() == account_id.lower()), None)
    if selected is None:
        print("No matching pending account; cancelled.")
        return 0
    if not selected["ownerEmailConfirmed"]:
        print("Owner email is not verified; account cannot be activated.")
        return 1
    status, _ = request(opener, f"{base_url}/api/v1/admin/accounts/{account_id}/activate",
                        origin, key, "POST")
    if status != 204:
        print(f"Activation failed (HTTP {status}).")
        return 1
    print("Account activated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
