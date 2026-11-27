"""add_card_priority

Adds ``cards.priority`` (nullable string) with a check constraint that
restricts the value to NULL, 'low', 'medium', or 'high'.  Additive and
backward compatible: the column is nullable so previously deployed code that
does not set priority continues to work.  Downgrade drops the check
constraint first, then the column.

Revision ID: b3p0r10r1ty
Revises: a2c0l0r5d0n1
Create Date: 2026-11-26 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b3p0r10r1ty'
down_revision = 'a2c0l0r5d0n1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('cards', sa.Column('priority', sa.String(16), nullable=True))
    op.create_check_constraint(
        'ck_cards_priority',
        'cards',
        "priority IS NULL OR priority IN ('low','medium','high')",
    )


def downgrade():
    op.drop_constraint('ck_cards_priority', 'cards', type_='check')
    op.drop_column('cards', 'priority')
