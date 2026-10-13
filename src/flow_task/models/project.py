from datetime import datetime

from sqlalchemy import Boolean, Integer, String, text
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column

from flow_task.core import clock
from flow_task.db.base import MYSQL_TABLE_ARGS, Base, BigIntU, UTCDateTime


def _now() -> datetime:
    return clock.utcnow()


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = MYSQL_TABLE_ARGS

    id: Mapped[int] = mapped_column(BigIntU, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str] = mapped_column(
        mysql.CHAR(7), nullable=False, default="#808080", server_default="#808080"
    )
    is_archived: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("0")
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, nullable=False, default=_now, onupdate=_now
    )
