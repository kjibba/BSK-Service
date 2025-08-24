"""add feedback table

Revision ID: a8b9c0d1e2f3
Revises: f3a1d2b4c6e7
Create Date: 2025-08-24

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a8b9c0d1e2f3'
down_revision = 'f3a1d2b4c6e7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'feedback',
        sa.Column('id', sa.Integer(), primary_key=True),
        # store user ids as plain integers to avoid cross-reference FK issues during migration
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('user_email', sa.String(length=200), nullable=True),
        sa.Column('text', sa.Text(), nullable=True),
        sa.Column('context', sa.JSON(), nullable=True),
        sa.Column('diagnostics', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=True, server_default='open'),
        sa.Column('handler_note', sa.Text(), nullable=True),
        sa.Column('handled_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_feedback_status', 'feedback', ['status'], unique=False)
    op.create_index('ix_feedback_user_id', 'feedback', ['user_id'], unique=False)


def downgrade():
    op.drop_index('ix_feedback_status', table_name='feedback')
    op.drop_table('feedback')
