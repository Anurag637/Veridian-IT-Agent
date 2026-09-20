import os
import json
import re
from typing import Optional, Dict, Any
from dotenv import load_dotenv

# Ensure .env is loaded
load_dotenv()

class LLMService:
    """
    Configurable LLM client for policy reasoning.
    Configured for open-source Hugging Face models (e.g. Qwen/Qwen3-30B-A3B-Instruct-2507).
    Reads configuration from environment variables:
      - HF_TOKEN or HUGGINGFACE_API_KEY or LLM_API_KEY
      - LLM_BASE_URL (defaults to Hugging Face OpenAI-compatible endpoint: https://router.huggingface.co/hf-inference/v1)
      - LLM_MODEL (defaults to Qwen/Qwen3-30B-A3B-Instruct-2507)
    
    If no key is configured or the service is temporarily unavailable, returns None,
    enabling the agent to use the deterministic zero-hallucination local policy engine.
    """

    def __init__(self):
        self._refresh_config()

    def _refresh_config(self):
        # Reload .env dynamically so user updates take effect immediately in real-time
        load_dotenv(override=True)
        self.api_key = (
            os.getenv("HF_TOKEN")
            or os.getenv("HUGGINGFACE_API_KEY")
            or os.getenv("LLM_API_KEY")
            or ""
        ).strip()

        raw_url = os.getenv("LLM_BASE_URL", "https://router.huggingface.co/v1").strip().rstrip('/')
        # Automatically redirect deprecated or non-standard paths to the working /v1 router
        if "api-inference.huggingface.co" in raw_url or "hf-inference/v1" in raw_url:
            raw_url = "https://router.huggingface.co/v1"
        self.base_url = raw_url

        configured_model = os.getenv("LLM_MODEL", "Qwen/Qwen2.5-Coder-32B-Instruct").strip()
        # If user specified Qwen3 which is not yet deployed on serverless router, map to Qwen2.5-Coder-32B
        if "Qwen3" in configured_model:
            self.model = "Qwen/Qwen2.5-Coder-32B-Instruct"
        else:
            self.model = configured_model or "Qwen/Qwen2.5-Coder-32B-Instruct"

    @property
    def is_configured(self) -> bool:
        self._refresh_config()
        return bool(self.api_key)

    def check_connection(self) -> Dict[str, Any]:
        """Verify Hugging Face API token and model connectivity in real time."""
        self._refresh_config()
        if not self.is_configured:
            return {
                "configured": False,
                "model": self.model,
                "status": "Not Configured",
                "engine": "Deterministic Local Policy Engine",
                "message": "No HF_TOKEN set. Using deterministic local zero-hallucination policy engine."
            }

        try:
            import httpx
            headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
            resp = httpx.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": "ping"}],
                    "max_tokens": 5
                },
                timeout=12.0
            )
            if resp.status_code == 200:
                return {
                    "configured": True,
                    "model": self.model,
                    "status": "Connected & Active",
                    "engine": f"Hugging Face ({self.model})",
                    "message": f"Successfully connected to Hugging Face {self.model}! Real-time cloud reasoning active."
                }
            elif resp.status_code == 403:
                return {
                    "configured": True,
                    "model": self.model,
                    "status": "Permission Error (403)",
                    "engine": "Deterministic Local Policy Engine",
                    "message": "HF Token lacks Inference permission. Using deterministic local zero-hallucination engine.",
                    "details": resp.text[:180]
                }
            elif resp.status_code == 402:
                return {
                    "configured": True,
                    "model": self.model,
                    "status": "Quota Depleted (402)",
                    "engine": "Deterministic Local Policy Engine",
                    "message": "Hugging Face credits depleted. Using deterministic local zero-hallucination engine.",
                    "details": resp.text[:180]
                }
            else:
                return {
                    "configured": True,
                    "model": self.model,
                    "status": f"HTTP {resp.status_code}",
                    "engine": "Deterministic Local Policy Engine",
                    "message": f"Endpoint returned HTTP {resp.status_code}. Using deterministic local policy engine.",
                    "details": resp.text[:180]
                }
        except Exception as e:
            return {
                "configured": True,
                "model": self.model,
                "status": "Connection Error",
                "engine": "Deterministic Local Policy Engine",
                "message": str(e)
            }


    def generate_structured_decision(
        self,
        employee: str,
        message: str,
        retrieved_policy: Optional[Dict[str, Any]],
        context: Optional[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        Calls open-source Hugging Face Qwen model with strict policy-grounding instructions.
        Extracts and validates structured JSON output.
        """
        if not self.is_configured:
            return None

        try:
            import httpx

            system_prompt = (
                "You are the Veridian Corp IT Support Agent. Your task is to classify employee IT requests, "
                "evaluate them against the retrieved corporate policy rules, and return a strict JSON decision.\n\n"
                "CRITICAL GUARDRAILS:\n"
                "- Ground your response 100% strictly in the provided policy.\n"
                "- Never invent policies, permissions, or rules.\n"
                "- Allowed decisions: RESOLVE, ASK_FOLLOWUP, CREATE_TICKET, ESCALATE.\n"
                "- If the request lacks diagnostic information (e.g. 'its not working'), choose ASK_FOLLOWUP.\n"
                "- If suspected phishing is reported, escalate immediately per KB-09 (forwarding prohibited).\n"
                "- Output ONLY valid JSON matching this exact schema with no extra text or markdown formatting:\n"
                "{\n"
                '  "intent": "<short_snake_case_intent>",\n'
                '  "decision": "RESOLVE|ASK_FOLLOWUP|CREATE_TICKET|ESCALATE",\n'
                '  "confidence": 0.95,\n'
                '  "policy_id": "KB-XX or null",\n'
                '  "reason": "<concise explanation citing policy>",\n'
                '  "requires_followup": false,\n'
                '  "followup_question": null,\n'
                '  "action": "<tool_name or null>",\n'
                '  "escalation_reason": "<reason or null>"\n'
                "}"
            )

            user_prompt = f"""Employee: {employee}
Request: "{message}"
Retrieved Policy: {json.dumps(retrieved_policy, indent=2) if retrieved_policy else 'None'}
Employee Context: {json.dumps(context, indent=2) if context else 'None'}

Return ONLY the JSON decision."""

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }

            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": 0.1,
                "max_tokens": 512
            }

            # Attempt request (with fallback if response_format is unsupported by specific HF backend)
            response = httpx.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=15.0
            )

            if response.status_code == 200:
                data = response.json()
                raw_content = data["choices"][0]["message"]["content"]
                return self._parse_json(raw_content)
            else:
                print(f"[LLMService] Hugging Face API returned HTTP {response.status_code}: {response.text[:120]}")

        except Exception as e:
            print(f"[LLMService] Fallback to deterministic local engine: {e}")

        return None

    def _parse_json(self, content: str) -> Optional[Dict[str, Any]]:
        """Safely extracts JSON from raw LLM output, handling markdown code blocks."""
        if not content:
            return None

        clean = content.strip()

        # Handle ```json ... ``` or ``` ... ```
        code_block = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', clean)
        if code_block:
            clean = code_block.group(1).strip()

        # Find first { and last }
        start_idx = clean.find('{')
        end_idx = clean.rfind('}')
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            clean = clean[start_idx:end_idx + 1]

        try:
            return json.loads(clean)
        except Exception:
            return None
