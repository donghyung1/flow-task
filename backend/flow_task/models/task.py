import enum
from datetime import datetime

from sqlalchemy import Enum, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from flow_task.core import clock
from flow_task.db.base import MYSQL_TABLE_ARGS, Base, BigIntU, UTCDateTime
from flow_task.models.project import Project
from flow_task.models.tag import Tag, task_tags


class TaskStatus(enum.StrEnum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"


class Priority(enum.StrEnum):
    NONE = "NONE"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


def _now() -> datetime:
    return clock.utcnow()


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        Index("idx_tasks_status_due", "status", "due_at"),
        Index("idx_tasks_project", "project_id"),
        Index("idx_tasks_parent", "parent_id"),
        Index("ft_tasks_title_desc", "title", "description", mysql_prefix="FULLTEXT"),
        MYSQL_TABLE_ARGS,
    )

    id: Mapped[int] = mapped_column(BigIntU, primary_key=True, autoincrement=True)
    project_id: Mapped[int | None] = mapped_column(
        BigIntU, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
    )
    parent_id: Mapped[int | None] = mapped_column(
        BigIntU, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus, native_enum=True, length=11),
        nullable=False,
        default=TaskStatus.TODO,
        server_default="TODO",
    )
    priority: Mapped[Priority] = mapped_column(
        Enum(Priority, native_enum=True, length=6),
        nullable=False,
        default=Priority.NONE,
        server_default="NONE",
    )
    due_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    recurrence_rule: Mapped[str | None] = mapped_column(String(255), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, nullable=False, default=_now, onupdate=_now
    )

    project: Mapped[Project | None] = relationship(lazy="raise")
    tags: Mapped[list[Tag]] = relationship(secondary=task_tags, lazy="raise", order_by=Tag.id)
