from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.deps import get_current_user
from app.db.models import User


router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/chat")
async def chat(
    body: dict,
    _user: User = Depends(get_current_user),
) -> dict[str, str]:
    """
    AI 助理预留接口：
    - 后续你接入 agent 时，可以在这里转发到你的 agent 服务（HTTP/gRPC/SDK 等）
    - 建议接入点：记录操作日志、加入限流、注入上下文（当前主机、最近告警、日志片段等）
    """
    prompt = str(body.get("prompt") or "").strip()
    if not prompt:
        return {"reply": "请先输入问题。"}
    return {"reply": "（占位）AI 助理尚未接入。后续接入 agent 后，将在此返回模型答复。"}

