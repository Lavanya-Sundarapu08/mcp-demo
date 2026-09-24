"""
Documentation RAG (Retrieval-Augmented Generation) MCP Server
Enables the AI agent to search and retrieve relevant internal engineering specifications,
architecture guides, and data contracts to verify intended software behavior.
"""

import os
import sys
import json
import re
from pathlib import Path
from typing import Dict, Any, List, Tuple

DOCS_DIR = Path(__file__).resolve().parent.parent / "benchmark_repo" / "docs"


def _extract_chunks(docs_dir: Path) -> List[Dict[str, Any]]:
    """Splits markdown documentation files into searchable section chunks."""
    chunks = []
    if not docs_dir.exists():
        return chunks

    for doc_file in docs_dir.glob("*.md"):
        try:
            content = doc_file.read_text(encoding="utf-8")
            sections = re.split(r"\n(?=##?\s)", content)
            doc_title = doc_file.stem.replace("_", " ").title()

            for section in sections:
                lines = section.strip().splitlines()
                if not lines:
                    continue
                header = lines[0].replace("#", "").strip()
                body = "\n".join(lines[1:]).strip() if len(lines) > 1 else lines[0]
                chunks.append({
                    "document": doc_file.name,
                    "title": doc_title,
                    "section": header,
                    "content": section.strip(),
                    "text_for_search": f"{doc_title} {header} {body}".lower()
                })
        except Exception:
            continue

    return chunks


def _score_chunk(query_tokens: List[str], chunk_text: str) -> float:
    """Scores chunk relevance based on keyword frequency and header weight."""
    score = 0.0
    for token in query_tokens:
        if token in chunk_text:
            count = chunk_text.count(token)
            score += 1.0 + (count * 0.4)
            # Higher weight if token appears in first 100 chars (likely in heading)
            if token in chunk_text[:100]:
                score += 2.0
    return score


def search_docs(query: str, top_k: int = 3) -> Dict[str, Any]:
    """Retrieves relevant documentation chunks matching the engineering query."""
    chunks = _extract_chunks(DOCS_DIR)
    if not chunks:
        return {"query": query, "results": [], "total_chunks": 0}

    # Tokenize query, filtering out small stop words
    stop_words = {"the", "a", "an", "is", "in", "and", "or", "for", "to", "of", "with", "on", "at", "by"}
    query_tokens = [w.lower() for w in re.findall(r"\w+", query) if w.lower() not in stop_words and len(w) > 2]

    scored: List[Tuple[float, Dict[str, Any]]] = []
    for chunk in chunks:
        score = _score_chunk(query_tokens, chunk["text_for_search"])
        if score > 0.0:
            scored.append((score, chunk))

    # Sort descending by relevance score
    scored.sort(key=lambda x: x[0], reverse=True)
    top_results = []
    for score, chunk in scored[:top_k]:
        top_results.append({
            "document": chunk["document"],
            "title": chunk["title"],
            "section": chunk["section"],
            "content": chunk["content"],
            "relevance_score": round(score, 2)
        })

    return {
        "query": query,
        "results_count": len(top_results),
        "results": top_results
    }


TOOLS_SCHEMA = [
    {
        "name": "rag_search_docs",
        "description": "Searches internal engineering documentation, API specifications, and service policy contracts to verify requirements and design rules.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Natural language or keyword search query (e.g. 'registration optional phone specification', 'error logging policy')."
                },
                "top_k": {
                    "type": "integer",
                    "description": "Maximum number of documentation excerpts to retrieve (default 3)."
                }
            },
            "required": ["query"]
        }
    }
]


def handle_tool_call(name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    if name == "rag_search_docs":
        return search_docs(arguments.get("query", ""), arguments.get("top_k", 3))
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
