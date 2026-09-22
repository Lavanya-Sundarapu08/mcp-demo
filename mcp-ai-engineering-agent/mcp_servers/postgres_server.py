"""
PostgreSQL & Database MCP Server
Provides safe, read-only SQL query capabilities to inspect application tables and error logs.
Enforces strict least-privilege security by rejecting any data modification or schema change.
"""

import os
import sys
import json
import sqlite3
import re
from pathlib import Path
from typing import Dict, Any, List

DATABASE_URL = os.environ.get("DATABASE_URL", "")
DEFAULT_DB = Path(__file__).resolve().parent.parent / "benchmark_repo" / "data" / "app_logs.db"
LOCAL_DB_PATH = Path(os.environ.get("LOCAL_DB_PATH", str(DEFAULT_DB))).resolve()

# Forbidden SQL keywords that would mutate or damage data
FORBIDDEN_KEYWORDS = [
    r"\bDROP\b",
    r"\bDELETE\b",
    r"\bUPDATE\b",
    r"\bINSERT\b",
    r"\bTRUNCATE\b",
    r"\bALTER\b",
    r"\bGRANT\b",
    r"\bREVOKE\b",
    r"\bEXEC\b",
    r"\bREPLACE\b"
]


def _validate_safe_query(sql: str) -> None:
    """Blocks any query containing mutating or destructive commands."""
    sql_upper = sql.upper().strip()
    if not sql_upper.startswith("SELECT") and not sql_upper.startswith("PRAGMA") and not sql_upper.startswith("EXPLAIN"):
        raise PermissionError("Security Policy Violation: Only SELECT queries are permitted on this database.")

    for pattern in FORBIDDEN_KEYWORDS:
        if re.search(pattern, sql, re.IGNORECASE):
            raise PermissionError(f"Security Policy Violation: Mutating keyword matched by pattern '{pattern}'.")


def list_tables() -> Dict[str, Any]:
    """Lists available tables in the database."""
    if not LOCAL_DB_PATH.exists():
        return {"error": f"Database file not found at {LOCAL_DB_PATH}"}

    conn = sqlite3.connect(LOCAL_DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    tables = [row[0] for row in cursor.fetchall()]
    conn.close()

    return {"tables": tables, "count": len(tables)}


def query_readonly(sql: str, limit: int = 10) -> Dict[str, Any]:
    """Executes a validated read-only SQL query against the database."""
    try:
        _validate_safe_query(sql)
    except PermissionError as pe:
        return {"error": str(pe), "success": False}

    if not LOCAL_DB_PATH.exists():
        return {"error": f"Database not found at {LOCAL_DB_PATH}", "success": False}

    try:
        conn = sqlite3.connect(LOCAL_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Enforce safety limit if not specified
        clean_sql = sql.strip().rstrip(";")
        if "LIMIT" not in clean_sql.upper():
            clean_sql += f" LIMIT {min(limit, 50)}"

        cursor.execute(clean_sql)
        rows = cursor.fetchall()
        columns = [col[0] for col in cursor.description] if cursor.description else []
        results = [dict(row) for row in rows]
        conn.close()

        return {
            "success": True,
            "query": clean_sql,
            "columns": columns,
            "row_count": len(results),
            "rows": results
        }
    except Exception as e:
        return {"error": f"Database query failed: {str(e)}", "success": False}


TOOLS_SCHEMA = [
    {
        "name": "postgres_list_tables",
        "description": "Lists all tables available in the application database.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "postgres_query_readonly",
        "description": "Executes a safe, read-only SELECT query against application tables and error_logs.",
        "parameters": {
            "type": "object",
            "properties": {
                "sql": {"type": "string", "description": "The SELECT SQL query to execute (e.g. 'SELECT * FROM error_logs WHERE service = \"auth_service\"')."},
                "limit": {"type": "integer", "description": "Maximum rows to return (default 10)."}
            },
            "required": ["sql"]
        }
    }
]


def handle_tool_call(name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    if name == "postgres_list_tables":
        return list_tables()
    elif name == "postgres_query_readonly":
        return query_readonly(arguments.get("sql", ""), arguments.get("limit", 10))
    return {"error": f"Unknown tool: {name}"}


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--tools":
        print(json.dumps(TOOLS_SCHEMA, indent=2))
    else:
        for line in sys.stdin:
            if not line.strip():
                continue
            try:
                req = json.loads(line)
                res = handle_tool_call(req.get("name"), req.get("arguments", {}))
                print(json.dumps({"id": req.get("id"), "result": res}))
                sys.stdout.flush()
            except Exception as e:
                print(json.dumps({"error": str(e)}))
                sys.stdout.flush()
