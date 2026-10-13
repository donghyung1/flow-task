from sqlalchemy import Column, ForeignKey, String, Table
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column

from flow_tarsk.db.base import MYSQL_TABLE_ARGS, Base, BigIntU


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = MYSQL_TABLE_ARGS

    id: Mapped[int] = mapped_column(BigIntU, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    color: Mapped[str | None] = mapped_column(mysql.CHAR(7), nullable=True)


task_tags = Table(
    "task_tags",
    Base.metadata,
    Column("task_id", BigIntU, ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", BigIntU, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    mysql_engine="InnoDB",
    mysql_charset="utf8mb4",
    mysql_collate="utf8mb4_unicode_ci",
)
