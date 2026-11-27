"""add cards due_date

Adds the nullable ``cards.due_date`` column (timestamp with time zone).
Additive and backward compatible: the previously deployed code lists its
columns explicitly and ignores the new one.

Revision ID: 421f6e5e8ae5
Revises: e75e73442f21
Create Date: 2026-11-25 04:25:13.676196

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '421f6e5e8ae5'
down_revision = 'e75e73442f21'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'cards',
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_column('cards', 'due_date')
