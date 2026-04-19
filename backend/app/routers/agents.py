from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel

from app.cursor_client import (
    CursorAPIError,
    delete_agent,
    followup,
    get_agent,
    get_conversation,
    launch_agent,
    list_agents,
    stop_agent,
)

router = APIRouter(prefix="/api/v1", tags=["agents"])


@router.get("/agents")
async def agents_list(
    limit: Annotated[int | None, Query(ge=1, le=100)] = None,
    cursor: str | None = None,
    pr_url: str | None = None,
) -> Any:
    try:
        return await list_agents(limit=limit, cursor=cursor, pr_url=pr_url)
    except CursorAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.body) from e


@router.get("/agents/{agent_id}")
async def agents_get(agent_id: str) -> Any:
    try:
        return await get_agent(agent_id)
    except CursorAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.body) from e


@router.get("/agents/{agent_id}/conversation")
async def agents_conversation(agent_id: str) -> Any:
    try:
        return await get_conversation(agent_id)
    except CursorAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.body) from e


@router.post("/agents")
async def agents_launch(payload: dict[str, Any] = Body(...)) -> Any:
    try:
        return await launch_agent(payload)
    except CursorAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.body) from e


class FollowupBody(BaseModel):
    prompt: dict[str, Any]


@router.post("/agents/{agent_id}/followup")
async def agents_followup(agent_id: str, body: FollowupBody) -> Any:
    try:
        return await followup(agent_id, body.model_dump())
    except CursorAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.body) from e


@router.post("/agents/{agent_id}/stop")
async def agents_stop(agent_id: str) -> Any:
    try:
        return await stop_agent(agent_id)
    except CursorAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.body) from e


@router.delete("/agents/{agent_id}")
async def agents_delete(agent_id: str) -> Any:
    try:
        return await delete_agent(agent_id)
    except CursorAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.body) from e
