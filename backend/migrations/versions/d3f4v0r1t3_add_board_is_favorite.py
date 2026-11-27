"""add_board_is_favorite

Adds ``boards.is_favorite`` (BOOLEAN NOT NULL DEFAULT false) so users can
star boards for quick access in the sidebar Favorites section.

Additive and backward-compatible: existing rows receive the default value
of false.  Downgrade simply drops the column.

Revision ID: d3f4v0r1t3
Revises: b3p0r10r1ty
Create Date: 2026-11-27 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd3f4v0r1t3'
down_revision = 'b3p0r10r1ty'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'boards',
        sa.Column(
            'is_favorite',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('false'),
        ),
    )


def downgrade():
    op.drop_column('boards', 'is_favorite')
