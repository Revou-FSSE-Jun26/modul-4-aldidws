"""Boards request schemas and serialization helpers."""

from marshmallow import Schema, fields, validate

from app.blueprints.cards.schema import card_to_dict
from app.blueprints.columns.schema import column_to_dict
from app.models.board import Board


class CreateBoardSchema(Schema):
    name = fields.String(
        required=True,
        validate=validate.Length(min=1, max=100),
    )

    def load(self, data, **kwargs):
        result = super().load(data, **kwargs)
        result["name"] = result["name"].strip()
        if not result["name"]:
            from marshmallow import ValidationError

            raise ValidationError({"name": ["Name must not be blank."]})
        return result


class UpdateBoardSchema(Schema):
    name = fields.String(
        required=False,
        validate=validate.Length(min=1, max=100),
    )

    def load(self, data, **kwargs):
        result = super().load(data, **kwargs)
        if "name" in result:
            result["name"] = result["name"].strip()
            if not result["name"]:
                from marshmallow import ValidationError

                raise ValidationError({"name": ["Name must not be blank."]})
        return result


def board_to_dict(board: Board) -> dict:
    """Serialise a Board to a safe, API-facing dictionary.

    Maps ``owner_id`` to ``user_id`` for the response contract and
    intentionally excludes any internal fields.
    """
    return {
        "id": str(board.id),
        "name": board.name,
        "user_id": str(board.owner_id),
        "created_at": board.created_at.isoformat(),
        "updated_at": board.updated_at.isoformat(),
    }


def board_detail_to_dict(board: Board, columns, cards_by_column) -> dict:
    """Serialise a board with nested columns and their cards."""
    data = board_to_dict(board)
    data["columns"] = [
        {**column_to_dict(col), "cards": [card_to_dict(c) for c in cards_by_column.get(col.id, [])]}
        for col in columns
    ]
    return data
