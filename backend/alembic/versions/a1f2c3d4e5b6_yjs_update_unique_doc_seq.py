"""yjs_update unique (document_id, seq)

Revision ID: a1f2c3d4e5b6
Revises: 7abc788c2a75
Create Date: 2026-06-04 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a1f2c3d4e5b6'
down_revision: Union[str, None] = '7abc788c2a75'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('yjs_updates', schema=None) as batch_op:
        batch_op.create_unique_constraint('uq_yjs_update_doc_seq', ['document_id', 'seq'])


def downgrade() -> None:
    with op.batch_alter_table('yjs_updates', schema=None) as batch_op:
        batch_op.drop_constraint('uq_yjs_update_doc_seq', type_='unique')
