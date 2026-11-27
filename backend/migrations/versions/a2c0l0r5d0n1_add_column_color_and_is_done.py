"""add_column_color_and_is_done

Adds ``board_columns.color`` (nullable status color) and
``board_columns.is_done`` (boolean, default false). Additive and backward
compatible: both columns are nullable or have a server default, so the
previously deployed code keeps working. Downgrade drops both columns (and the
check constraint), losing any stored color or done flag.

Revision ID: a2c0l0r5d0n1
Revises: 43535c2f36bf
Create Date: 2026-11-25 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a2c0l0r5d0n1'
down_revision = '43535c2f36bf'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('board_columns', sa.Column('color', sa.String(length=16), nullable=True))
    op.add_column(
        'board_columns',
        sa.Column('is_done', sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.create_check_constraint(
        'ck_board_columns_color',
        'board_columns',
        "color IS NULL OR color IN ('gray','blue','orange','green','red')",
    )


def downgrade():
    op.drop_constraint('ck_board_columns_color', 'board_columns', type_='check')
    op.drop_column('board_columns', 'is_done')
    op.drop_column('board_columns', 'color')
