"""
Command parser service: speech → structured whiteboard commands.
Uses Google Gemini (free tier) via LangChain; no local model download.
"""
from __future__ import annotations
import json
import logging
import os
import re
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")
from typing import Optional, List
from fastapi import FastAPI, HTTPException

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

from schema import ParseResponse
from prompts import SYSTEM_PROMPT

app = FastAPI(title="Command Parser", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(Exception)
def _catch_all(_request, exc):
    """Never return 403/5xx to gateway so frontend can fall back to mock; log Gemini/API errors."""
    err_msg = str(exc)
    status = getattr(getattr(exc, "response", None), "status_code", None) or getattr(exc, "status_code", None)
    if status == 403 or "403" in err_msg or "Forbidden" in err_msg:
        log.error("Gemini API 403: Check GOOGLE_API_KEY in .env. Get a free key at https://aistudio.google.com/apikey")
    else:
        log.exception("Unhandled error")
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=200,
        content={"commands": [{"type": "ERROR", "reason": "unclear"}]},
    )

# Gemini: free tier, no local model. Get key at https://aistudio.google.com/apikey
API_KEY = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
# Default: gemini-2.5-flash has free-tier quota (5 RPM, 20 RPD). gemini-2.0-flash often shows 0/0 and returns 429.
MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

if API_KEY:
    llm = ChatGoogleGenerativeAI(model=MODEL, google_api_key=API_KEY, temperature=0)
else:
    llm = None


class ParseRequest(BaseModel):
    speech: str
    context: Optional[dict] = None  # e.g. { "shapeIds": ["shape-1", "shape-2"] }


class ParseResponseBody(BaseModel):
    commands: List[dict]  # JSON-serializable list for gateway/frontend


@app.get("/health")
def health():
    return {"status": "ok", "service": "command-parser", "model_configured": llm is not None}


@app.post("/api/parse", response_model=ParseResponseBody)
async def parse(req: ParseRequest):
    if not req.speech or not req.speech.strip():
        raise HTTPException(status_code=400, detail="speech is required")
    if llm is None:
        raise HTTPException(
            status_code=503,
            detail="Gemini not configured. Set GOOGLE_API_KEY or GEMINI_API_KEY (free at https://aistudio.google.com/apikey)",
        )
    try:
        user_content = req.speech.strip()
        if req.context:
            user_content += f"\n\n[Context: {req.context}]"
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=user_content),
        ]
        # Raw JSON output: avoid LangChain structured-output passing commands as strings
        response = llm.invoke(messages)
        text = (response.content if hasattr(response, "content") else str(response)).strip()
        # Strip markdown code block if present
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        data = json.loads(text)
        if not isinstance(data.get("commands"), list):
            raise ValueError("Response must have a 'commands' array")
        # Normalize: Gemini sometimes returns commands as list of JSON strings
        raw_commands = data["commands"]
        commands = []
        for c in raw_commands:
            if isinstance(c, str):
                c = json.loads(c)
            commands.append(c)
        # Validate and allow only known fields (Pydantic will coerce types)
        result = ParseResponse.model_validate({"commands": commands})
        out = [cmd.model_dump() for cmd in result.commands]
        if len(out) == 1 and out[0].get("type") == "ERROR":
            log.warning("Model returned ERROR: %s (speech was: %r)", out[0].get("reason", "unclear"), req.speech[:80])
        return ParseResponseBody(commands=out)
    except Exception as e:
        # Always return 200 + ERROR so gateway gets 200 and frontend can use fallback; never leak 403/5xx
        err_msg = str(e)
        status = getattr(getattr(e, "response", None), "status_code", None) or getattr(e, "status_code", None)
        reason = "unclear"
        if status == 403 or "403" in err_msg or "Forbidden" in err_msg:
            log.error(
                "Gemini API 403: Check GOOGLE_API_KEY in .env. "
                "Get a free key at https://aistudio.google.com/apikey"
            )
            reason = "api key invalid or forbidden"
        elif status == 429 or "429" in err_msg or "ResourceExhausted" in type(e).__name__ or "quota" in err_msg.lower():
            log.error(
                "Gemini API 429: Quota / rate limit exceeded. "
                "Try another API key from https://aistudio.google.com/apikey or wait and retry. "
                "See https://ai.google.dev/gemini-api/docs/rate-limits"
            )
            reason = "quota exceeded"
        else:
            log.exception("Parse failed (exception below) - speech was: %r", req.speech[:80])
            log.error("Exception message: %s", err_msg)
        return ParseResponseBody(commands=[{"type": "ERROR", "reason": reason}])


@app.get("/")
def root():
    return {
        "service": "command-parser",
        "docs": "/docs",
        "health": "/health",
        "parse": "POST /api/parse",
    }
