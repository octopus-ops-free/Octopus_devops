from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import SmtpSettingIn, SmtpSettingOut
from app.core.deps import require_admin
from app.db.models import NotificationSetting, User
from app.db.session import get_db
from app.services.email_notify import send_email


router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/smtp", response_model=SmtpSettingOut)
async def get_smtp(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> SmtpSettingOut:
    row = await db.scalar(select(NotificationSetting).order_by(NotificationSetting.id.desc()).limit(1))
    if row is None:
        return SmtpSettingOut()
    return SmtpSettingOut(
        smtp_host=row.smtp_host,
        smtp_port=row.smtp_port,
        smtp_username=row.smtp_username,
        smtp_from=row.smtp_from,
        use_tls=bool(row.use_tls),
    )


@router.put("/smtp", response_model=SmtpSettingOut)
async def upsert_smtp(
    body: SmtpSettingIn,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> SmtpSettingOut:
    row = await db.scalar(select(NotificationSetting).order_by(NotificationSetting.id.desc()).limit(1))
    if row is None:
        row = NotificationSetting()
        db.add(row)
    row.smtp_host = body.smtp_host
    row.smtp_port = body.smtp_port
    row.smtp_username = body.smtp_username
    row.smtp_password = body.smtp_password
    row.smtp_from = body.smtp_from
    row.use_tls = body.use_tls
    await db.commit()
    await db.refresh(row)
    return SmtpSettingOut(
        smtp_host=row.smtp_host,
        smtp_port=row.smtp_port,
        smtp_username=row.smtp_username,
        smtp_from=row.smtp_from,
        use_tls=bool(row.use_tls),
    )


@router.post("/smtp/test")
async def test_smtp(
    to: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> dict[str, str]:
    to_list = [x.strip() for x in to.split(",") if x.strip()]
    if not to_list:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="to 不能为空（逗号分隔）")
    await send_email(db, to_list=to_list, subject="[Octopus] SMTP 测试邮件", body="这是一封测试邮件，用于验证 Octopus SMTP 配置。")
    return {"status": "ok"}

