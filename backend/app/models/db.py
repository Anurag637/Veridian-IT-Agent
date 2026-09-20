import sqlite3
import json
import os
from pathlib import Path
from typing import List, Dict, Any, Optional

if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    DB_PATH = Path("/tmp/veridian.db")
else:
    DB_PATH = Path(__file__).resolve().parent.parent.parent / "veridian.db"

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "backend" / "data"
if not DATA_DIR.exists():
    DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

def get_db_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Policies Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS policies (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            summary TEXT NOT NULL,
            full_policy TEXT NOT NULL,
            rules_json TEXT NOT NULL,
            keywords_json TEXT NOT NULL
        )
    """)

    # 2. Tickets Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tickets (
            ticket_id TEXT PRIMARY KEY,
            request_id TEXT,
            employee TEXT NOT NULL,
            category TEXT NOT NULL,
            summary TEXT NOT NULL,
            priority TEXT NOT NULL,
            status TEXT NOT NULL,
            policy_id TEXT,
            created_at TEXT NOT NULL,
            resolution_or_escalation TEXT
        )
    """)

    # 3. Audit Events Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            audit_id TEXT NOT NULL,
            request_id TEXT,
            timestamp TEXT NOT NULL,
            stage TEXT NOT NULL,
            action_type TEXT NOT NULL,
            policy_id TEXT,
            details TEXT NOT NULL
        )
    """)

    # 4. Employees & Requests Context Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS requests (
            id TEXT PRIMARY KEY,
            employee TEXT NOT NULL,
            email TEXT NOT NULL,
            date_opened TEXT NOT NULL,
            request TEXT NOT NULL,
            initial_action_taken TEXT NOT NULL
        )
    """)

    conn.commit()

    # Seed initial data if empty
    cursor.execute("SELECT COUNT(*) FROM policies")
    if cursor.fetchone()[0] == 0:
        seed_db(conn)

    conn.close()

def seed_db(conn):
    cursor = conn.cursor()

    # Seed Policies
    kb_file = DATA_DIR / "kb.json"
    if kb_file.exists():
        with open(kb_file, "r", encoding="utf-8") as f:
            kb_data = json.load(f)
            for p in kb_data:
                cursor.execute("""
                    INSERT OR REPLACE INTO policies (id, title, category, summary, full_policy, rules_json, keywords_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    p["id"], p["title"], p["category"], p["summary"],
                    p["full_policy"], json.dumps(p.get("rules", [])),
                    json.dumps(p.get("keywords", []))
                ))

    # Seed Requests
    req_file = DATA_DIR / "requests.json"
    if req_file.exists():
        with open(req_file, "r", encoding="utf-8") as f:
            req_data = json.load(f)
            for r in req_data:
                cursor.execute("""
                    INSERT OR REPLACE INTO requests (id, employee, email, date_opened, request, initial_action_taken)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    r["id"], r["employee"], r["email"], r["date_opened"],
                    r["request"], r["initial_action_taken"]
                ))

    # Seed Tickets
    tk_file = DATA_DIR / "tickets.json"
    if tk_file.exists():
        with open(tk_file, "r", encoding="utf-8") as f:
            tk_data = json.load(f)
            for t in tk_data:
                cursor.execute("""
                    INSERT OR REPLACE INTO tickets (ticket_id, request_id, employee, category, summary, priority, status, policy_id, created_at, resolution_or_escalation)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    t["ticket_id"], None, t["employee"], t["category"],
                    t["issue_summary"], "P3 - Medium", t["status"],
                    t.get("policy_ref"), "Mon 21 Sep 2026", t.get("resolution_notes")
                ))

    conn.commit()

def reset_database():
    """Reset database to initial pristine seed state."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DROP TABLE IF EXISTS policies")
    cursor.execute("DROP TABLE IF EXISTS tickets")
    cursor.execute("DROP TABLE IF EXISTS audit_events")
    cursor.execute("DROP TABLE IF EXISTS requests")
    conn.commit()
    conn.close()
    init_db()
