"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-10-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = {
    "mysql_engine": "InnoDB",
    "mysql_charset": "utf8mb4",
    "mysql_collate": "utf8mb4_unicode_ci",
}
BIGU = mysql.BIGINT(unsigned=True)


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", BIGU, autoincrement=True, nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("color", mysql.CHAR(7), server_default="#808080", nullable=False),
        sa.Column("is_archived", sa.Boolean(), server_default=sa.text("0"), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", mysql.DATETIME(fsp=6), nullable=False),
        sa.Column("updated_at", mysql.DATETIME(fsp=6), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_projects"),
        **TABLE,
    )
    op.create_table(
        "tags",
        sa.Column("id", BIGU, autoincrement=True, nullable=False),
        sa.Column("name", sa.String(30), nullable=False),
        sa.Column("color", mysql.CHAR(7), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_tags"),
        sa.UniqueConstraint("name", name="uq_tags_name"),
        **TABLE,
    )
    op.create_table(
        "tasks",
        sa.Column("id", BIGU, autoincrement=True, nullable=False),
        sa.Column("project_id", BIGU, nullable=True),
        sa.Column("parent_id", BIGU, nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("TODO", "IN_PROGRESS", "DONE", name="taskstatus"),
            server_default="TODO",
            nullable=False,
        ),
        sa.Column(
            "priority",
            sa.Enum("NONE", "LOW", "MEDIUM", "HIGH", name="priority"),
            server_default="NONE",
            nullable=False,
        ),
        sa.Column("due_at", mysql.DATETIME(fsp=6), nullable=True),
        sa.Column("completed_at", mysql.DATETIME(fsp=6), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("recurrence_rule", sa.String(255), nullable=True),
        sa.Column("deleted_at", mysql.DATETIME(fsp=6), nullable=True),
        sa.Column("created_at", mysql.DATETIME(fsp=6), nullable=False),
        sa.Column("updated_at", mysql.DATETIME(fsp=6), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name="fk_tasks_project_id_projects",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["parent_id"], ["tasks.id"], name="fk_tasks_parent_id_tasks", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_tasks"),
        **TABLE,
    )
    op.create_index("idx_tasks_status_due", "tasks", ["status", "due_at"])
    op.create_index("idx_tasks_project", "tasks", ["project_id"])
    op.create_index("idx_tasks_parent", "tasks", ["parent_id"])
    # MariaDB does not ship the ngram parser (ERROR 1128), so a plain FULLTEXT index is used.
    # Search falls back to LIKE in the application layer.
    op.create_index(
        "ft_tasks_title_desc", "tasks", ["title", "description"], mysql_prefix="FULLTEXT"
    )
    op.create_table(
        "task_tags",
        sa.Column("task_id", BIGU, nullable=False),
        sa.Column("tag_id", BIGU, nullable=False),
        sa.ForeignKeyConstraint(
            ["task_id"], ["tasks.id"], name="fk_task_tags_task_id_tasks", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["tag_id"], ["tags.id"], name="fk_task_tags_tag_id_tags", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("task_id", "tag_id", name="pk_task_tags"),
        **TABLE,
    )


def downgrade() -> None:
    op.drop_table("task_tags")
    op.drop_table("tasks")
    op.drop_table("tags")
    op.drop_table("projects")
