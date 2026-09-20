import json
import re
from typing import List, Dict, Any, Optional
from ..models.db import get_db_connection

class PolicyRetriever:
    """
    Lightweight, reliable local RAG retriever strictly grounded in Veridian policies.
    Guarantees zero-hallucination by retrieving only existing policies from SQLite.
    """

    def __init__(self):
        pass

    def retrieve(self, query: str, top_k: int = 2) -> List[Dict[str, Any]]:
        """
        Retrieves the most relevant policy documents based on token overlap,
        keyword matching, and category indexing.
        """
        query_clean = query.lower()
        tokens = set(re.findall(r'\b\w+\b', query_clean))

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM policies")
        rows = cursor.fetchall()
        conn.close()

        scored_policies = []

        for row in rows:
            policy = dict(row)
            policy["rules"] = json.loads(policy.get("rules_json", "[]"))
            policy["keywords"] = json.loads(policy.get("keywords_json", "[]"))

            score = 0.0

            # 1. Exact ID match (e.g. "KB-01")
            if policy["id"].lower() in query_clean:
                score += 50.0

            # 2. Keyword hits
            for kw in policy["keywords"]:
                if kw.lower() in query_clean:
                    score += 15.0

            # 3. Title token overlap
            title_tokens = set(re.findall(r'\b\w+\b', policy["title"].lower()))
            common_title = tokens.intersection(title_tokens)
            score += len(common_title) * 8.0

            # 4. Specific domain rules
            if policy["id"] == "KB-01":
                if "password" in tokens or "locked" in tokens or "unlock" in tokens or "attempts" in tokens:
                    score += 25.0
            elif policy["id"] == "KB-02":
                if "vpn" in tokens or "remote access" in query_clean or "contractor" in tokens:
                    score += 25.0
            elif policy["id"] == "KB-03":
                if "laptop" in tokens or "flicker" in tokens or "dead" in tokens or "turn on" in query_clean:
                    score += 25.0
            elif policy["id"] == "KB-04":
                if "software" in tokens or "install" in tokens or "catalog" in tokens or "extension" in tokens:
                    score += 25.0
            elif policy["id"] == "KB-05":
                if "printer" in tokens or "paper jam" in query_clean or "spooler" in tokens:
                    score += 25.0
            elif policy["id"] == "KB-06":
                if "mailbox" in tokens or "quota" in tokens or "inbox" in tokens or "send email" in query_clean:
                    score += 25.0
            elif policy["id"] == "KB-07":
                if "wifi" in tokens or "wi-fi" in query_clean or "guest" in tokens or "visitor" in tokens:
                    score += 25.0
            elif policy["id"] == "KB-08":
                if "expense" in tokens or "concur" in tokens:
                    score += 25.0
            elif policy["id"] == "KB-09":
                if "phishing" in tokens or "suspicious" in tokens or "malware" in tokens or "forward" in tokens:
                    score += 35.0
            elif policy["id"] == "KB-10":
                if "working from home" in query_clean or "wfh" in tokens or "monitor" in tokens or "chair" in tokens:
                    score += 25.0
            elif policy["id"] == "ASSET-POLICY-01":
                if "refresh" in tokens or "asset" in tokens or ("laptop" in tokens and ("year" in tokens or "yrs" in tokens)):
                    score += 20.0

            if score > 0:
                scored_policies.append((score, policy))

        scored_policies.sort(key=lambda x: x[0], reverse=True)
        return [p[1] for p in scored_policies[:top_k]]
