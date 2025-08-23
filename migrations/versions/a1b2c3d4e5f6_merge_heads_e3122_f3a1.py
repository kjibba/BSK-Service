"""merge heads e3122 and f3a1

Revision ID: a1b2c3d4e5f6
Revises: e3122ba67342, f3a1d2b4c6e7
Create Date: 2025-08-22

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = ('e3122ba67342', 'f3a1d2b4c6e7')
branch_labels = None
depends_on = None


def upgrade():
    # This is a merge migration; no schema changes required here.
    pass


def downgrade():
    # Downgrade to the two previous heads is not supported automatically for merge.
    pass
