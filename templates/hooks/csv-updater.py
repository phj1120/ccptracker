#!/usr/bin/env python3
"""
CSV Updater - Claude conversation data CSV update tool
"""

import csv
import sys
import os
from datetime import datetime

# Find ccptracker directory in project root
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CCPTRACKER_DIR = os.path.dirname(SCRIPT_DIR)
CSV_FILE = os.path.join(CCPTRACKER_DIR, 'data', 'ccptracker.csv')


def read_csv():
    """Read CSV file"""
    if not os.path.exists(CSV_FILE):
        return []

    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        return list(reader)


def write_csv(rows):
    """Write CSV file"""
    if not rows:
        return

    fieldnames = ['id', 'request', 'response', 'star', 'star_desc',
                  'request_dtm', 'response_dtm', 'star_dtm']

    with open(CSV_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def format_datetime_id(dt_string):
    """YYYY-MM-DD HH:MM:SS -> YYYYMMDDHHmmss (for ID)"""
    try:
        dt = datetime.strptime(dt_string, '%Y-%m-%d %H:%M:%S')
        return dt.strftime('%Y%m%d%H%M%S')
    except:
        return ''


def add_row(session_id, timestamp, project_path, user_prompt):
    """Add new row"""
    rows = read_csv()

    # ID is numeric format, request_dtm is readable format
    row_id = format_datetime_id(timestamp)
    request_dtm = timestamp  # Use YYYY-MM-DD HH:MM:SS format as-is

    new_row = {
        'id': row_id,
        'request': user_prompt,
        'response': '',
        'star': '',
        'star_desc': '',
        'request_dtm': request_dtm,
        'response_dtm': '',
        'star_dtm': ''
    }

    rows.append(new_row)
    write_csv(rows)
    print(f"✅ New row added to CSV (ID: {row_id}, Session: {session_id})")


def update_response(session_id, response, duration, tools_used, tools_count):
    """Update response information (most recent row)"""
    rows = read_csv()

    # Update most recent row
    if rows:
        response_dtm = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        rows[-1]['response'] = response
        rows[-1]['response_dtm'] = response_dtm

    write_csv(rows)
    print(f"✅ Response information updated (Session: {session_id})")


def update_satisfaction(session_id, score, comment):
    """Update satisfaction information (most recent row)"""
    rows = read_csv()

    # Update most recent row
    if rows:
        star_dtm = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        rows[-1]['star'] = str(score)
        rows[-1]['star_desc'] = comment
        rows[-1]['star_dtm'] = star_dtm

    write_csv(rows)
    print(f"✅ Satisfaction information updated (Session: {session_id}, Score: {score}/5)")


def get_latest_row():
    """Return most recent row"""
    rows = read_csv()
    if rows:
        return rows[-1]
    return None


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: csv-updater.py [add|update-response|update-satisfaction|get-latest]")
        sys.exit(1)

    command = sys.argv[1]

    if command == 'add':
        # add <session_id> <timestamp> <project_path> <user_prompt>
        if len(sys.argv) < 6:
            print("Usage: csv-updater.py add <session_id> <timestamp> <project_path> <user_prompt>")
            sys.exit(1)
        add_row(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])

    elif command == 'update-response':
        # update-response <session_id> <response> <duration> <tools_used> <tools_count>
        if len(sys.argv) < 7:
            print("Usage: csv-updater.py update-response <session_id> <response> <duration> <tools_used> <tools_count>")
            sys.exit(1)
        update_response(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6])

    elif command == 'update-satisfaction':
        # update-satisfaction <session_id> <score> <comment>
        if len(sys.argv) < 5:
            print("Usage: csv-updater.py update-satisfaction <session_id> <score> <comment>")
            sys.exit(1)
        update_satisfaction(sys.argv[2], sys.argv[3], sys.argv[4])

    elif command == 'get-latest':
        row = get_latest_row()
        if row:
            import json
            print(json.dumps(row, ensure_ascii=False))
        else:
            print("{}")

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)