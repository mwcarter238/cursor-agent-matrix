"""HTTP client for Cursor Cloud Agents API (Basic auth: API key as username, empty password)."""

from __future__ import annotations

import asyncio
import base64
from typing import Any

import httpx

from app.config import settings


class CursorAPIError(Exception):
    def __init__(self, status_code: int, body: str):
        self.status_code = status_code
        self.body = body
        super().__init__(f"Cursor API {status_code}: {body[:500]}")


def _auth_header() -> str:
    if not settings.CURSOR_API_KEY:
        raise CursorAPIError(401, "CURSOR_API_KEY is not configured on the server.")
    raw = f"{settings.CURSOR_API_KEY}:".encode()
    return "Basic " + base64.b64encode(raw).decode()


async def _request(
    method: str,
    path: str,
    *,
    params: dict[str, str] | None = None,
    json_body: dict[str, Any] | None = None,
    max_retries: int = 4,
) -> Any:
    url = f"{settings.CURSOR_API_BASE.rstrip('/')}{path}"
    headers = {"Authorization": _auth_header(), "Accept": "application/json"}
    if json_body is not None:
        headers["Content-Type"] = "application/json"

    delay = 1.0
    last_exc: Exception | None = None
    for attempt in range(max_retries):
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                r = await client.request(method, url, headers=headers, params=params, json=json_body)
            except httpx.RequestError as e:
                last_exc = e
                await asyncio.sleep(delay)
                delay = min(delay * 2, 30.0)
                continue

        if r.status_code == 429:
            await asyncio.sleep(delay)
            delay = min(delay * 2, 30.0)
            continue

        if r.status_code >= 400:
            raise CursorAPIError(r.status_code, r.text)

        if r.status_code == 204 or not r.content:
            return None
        return r.json()

    if last_exc:
        raise CursorAPIError(503, str(last_exc)) from last_exc
    raise CursorAPIError(503, "Max retries exceeded")


async def list_agents(limit: int | None = None, cursor: str | None = None, pr_url: str | None = None) -> Any:
    params: dict[str, str] = {}
    if limit is not None:
        params["limit"] = str(limit)
    if cursor:
        params["cursor"] = cursor
    if pr_url:
        params["prUrl"] = pr_url
    return await _request("GET", "/v0/agents", params=params or None)


async def get_agent(agent_id: str) -> Any:
    return await _request("GET", f"/v0/agents/{agent_id}")


async def get_conversation(agent_id: str) -> Any:
    return await _request("GET", f"/v0/agents/{agent_id}/conversation")


async def launch_agent(body: dict[str, Any]) -> Any:
    return await _request("POST", "/v0/agents", json_body=body)


async def followup(agent_id: str, body: dict[str, Any]) -> Any:
    return await _request("POST", f"/v0/agents/{agent_id}/followup", json_body=body)


async def stop_agent(agent_id: str) -> Any:
    return await _request("POST", f"/v0/agents/{agent_id}/stop")


async def delete_agent(agent_id: str) -> Any:
    return await _request("DELETE", f"/v0/agents/{agent_id}")
