"""Boards request schemas and serialization helpers."""

from marshmallow import Schema, ValidationError, fields, validate

from app.blueprints.cards.schema import card_to_dict, sort_labels
from app.blueprints.labels.schema import label_to_dict
from app.blueprints.columns.schema import column_to_dict
from app.models.board import Board


def _strict_boolean(value):
    """Reject non-boolean values for boolean fields."""
    if not isinstance(value, bool):
        raise ValidationError("is_favorite must be a boolean.")


class CreateBoardSchema(Schema):
    name = fields.String(
        required=True,
        validate=validate.Length(min=1, max=100),
    )

    def load(self, data, **kwargs):
        result = super().load(data, **kwargs)
        result["name"] = result["name"].strip()
        if not result["name"]:
            raise ValidationError({"name": ["Name must not be blank."]})
        return result


class UpdateBoardSchema(Schema):
    name = fields.String(
        required=False,
        validate=validate.Length(min=1, max=100),
    )
    is_favorite = fields.Boolean(required=False, validate=_strict_boolean)

    def load(self, data, **kwargs):
        # Validate is_favorite type before marshmallow coercion
        raw = data if isinstance(data, dict) else {}
        if "is_favorite" in raw and not isinstance(raw["is_favorite"], bool):
            raise ValidationError({"is_favorite": ["is_favorite must be a boolean."]})
        result = super().load(data, **kwargs)
        if "name" in result:
            result["name"] = result["name"].strip()
            if not result["name"]:
                raise ValidationError({"name": ["Name must not be blank."]})
        return result


def board_to_dict(board: Board, role: str | None = None) -> dict:
    """Serialise a Board to a safe, API-facing dictionary.

    Used for the plain board payloads (create, update, list).  The list
    endpoint passes ``role='owner'`` or ``role='member'`` so the caller
    knows their role on the board; the create/update endpoints omit it.
    The detail endpoint adds ``access`` and ``members`` on top via
    ``board_detail_to_dict``.
    """
    data = {
        "id": str(board.id),
        "name": board.name,
        "user_id": str(board.owner_id),
        "is_favorite": board.is_favorite,
        "created_at": board.created_at.isoformat(),
        "updated_at": board.updated_at.isoformat(),
    }
    if role is not None:
        data["role"] = role
    return data


def member_to_dict(member, user) -> dict:
    """Serialise a (BoardMember, User) pair for the board-detail response."""
    return {
        "user_id": str(member.user_id),
        "email": user.email,
        "name": user.name,
        "role": member.role,
    }


def board_detail_to_dict(
    board: Board,
    columns,
    cards_by_column,
    labels,
    members: list = (),
    can_move_by_card: dict = None,
    assignees_by_card: dict = None,
    caller_id: str | None = None,
) -> dict:
    """Serialise a board with nested columns, their cards and its labels.

    Adds on top of the plain board payload:
    - ``role``: the caller's role on this board (``'owner'`` or ``'member'``).
    - ``access.role``: same value, nested for client convenience.
    - ``members``: one entry per board member, including the owner.
    - ``can_move`` on every card: whether the caller may drag that card
      (board owner, card creator, or tagged on it).
    - ``assignee_ids`` on every card: the board-member ids tagged on it;
      drives the owner's "who can move this card" picker.
    """
    can_move_by_card = can_move_by_card or {}
    assignees_by_card = assignees_by_card or {}
    caller_role = None
    if caller_id is not None:
        caller_role = "owner" if str(board.owner_id) == str(caller_id) else "member"
    data = board_to_dict(board, role=caller_role)
    data["labels"] = [label_to_dict(l) for l in sort_labels(labels)]
    data["columns"] = [
        {
            **column_to_dict(col),
            "cards": [
                card_to_dict(
                    c,
                    can_move=can_move_by_card.get(c.id, True),
                    assignee_ids=assignees_by_card.get(c.id),
                )
                for c in cards_by_column.get(col.id, [])
            ],
        }
        for col in columns
    ]
    if caller_id is not None:
        data["access"] = {"role": caller_role}
        data["members"] = [member_to_dict(m, u) for m, u in members]
    return data
