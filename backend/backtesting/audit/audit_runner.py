#!/usr/bin/env python3
"""
=========================================================================================
MAVRIX TRADING PLATFORM — FULL AUDIT RUNNER
=========================================================================================
Runs the full verification pipeline:
  1. Locates latest exported strategy CSV or runs backtest via local HTTP API
  2. Runs verifier.py across all 15 audit pillars
  3. Outputs audit_report_sep25.json
  4. Prints summary
=========================================================================================
"""

import os
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime
from verifier import StrategyVerifier
from report import format_console_report, generate_markdown_report

AUDIT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_JSON = os.path.join(AUDIT_DIR, 'audit_report_sep25.json')
OUTPUT_MD = os.path.join(AUDIT_DIR, 'AUDIT_VERIFICATION_REPORT.md')


def fetch_backtest_csv(days: int = 7) -> str:
    """Fetches real backtest CSV from local backend API."""
    url = f"http://localhost:5000/api/backtest/export?strategyId=nifty-009-atm-breakout&symbol=NIFTY%2050&days={days}&format=csv"
    req = urllib.request.Request(url, headers={'User-Agent': 'MavrixAudit/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read().decode('utf-8-sig')
            target_csv = os.path.join(AUDIT_DIR, f"latest_backtest_{days}D.csv")
            with open(target_csv, 'w', encoding='utf-8') as f:
                f.write(content)
            return target_csv
    except Exception as e:
        print(f"Warning: Could not fetch from localhost:5000 ({e}). Looking for local CSV...")
        # Check if local CSV exists in directory
        for f in os.listdir(AUDIT_DIR):
            if f.endswith('.csv'):
                return os.path.join(AUDIT_DIR, f)
        raise RuntimeError("No backtest CSV found to audit!")


def run_audit(csv_path: str = None, days: int = 7):
    print(f"Starting Mavrix Independent Audit Pipeline...")
    if not csv_path:
        csv_path = fetch_backtest_csv(days)

    print(f"Auditing CSV: {csv_path}")
    verifier = StrategyVerifier(initial_capital=100000.0)
    result = verifier.verify_csv(csv_path)

    # Save JSON report
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2)
    print(f"Saved JSON audit artifact: {OUTPUT_JSON}")

    # Save Markdown report
    md_content = generate_markdown_report(result)
    with open(OUTPUT_MD, 'w', encoding='utf-8') as f:
        f.write(md_content)
    print(f"Saved Markdown audit report: {OUTPUT_MD}")

    # Print console summary
    format_console_report(result)

    return result


if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else None
    run_audit(target)
