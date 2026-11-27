"""Members route handlers."""

import uuid

from flask import jsonify, request

from app.blueprints.auth.decorators import token_required
from app.blueprints.members import members_boards, members_cards as _mc
from app.blueprints.members import service
from app.blueprints.members.schema import InviteMemberSchema, SetCardAssigneesSchema


@members_boards.route("/<board_id>/members", methods=["POST"])
@token_required
def invite_member(current_user, board_id):
    """Invite a registered account to a board (owner only).
    ---
    tags:
      - Members
    security:
      - BearerAuth: []
    parameters:
      - name: board_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - email
            properties:
              email:
                type: string
                format: email
                example: teammate@example.com
    responses:
      201:
        description: Membership created; the invitee receives a notification.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
      404:
        description: Board not found, or no account with that email.
      409:
        description: That user is already a member.
    """
    data = InviteMemberSchema().load(request.get_json() or {})
    membership = service.invite_member(current_user, uuid.UUID(board_id), data["email"])
    return (
        jsonify(
            {
                "data": {
                    "user_id": str(membership.user_id),
                    "role": membership.role,
                }
            }
        ),
        201,
    )


@members_boards.route("/<board_id>/members", methods=["GET"])
@token_required
def list_members(current_user, board_id):
    """List the members of a board (any board member).
    ---
    tags:
      - Members
    security:
      - BearerAuth: []
    parameters:
      - name: board_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      200:
        description: Member list.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: array
                  items:
                    type: object
                    properties:
                      user_id: {type: string}
                      email: {type: string}
                      name: {type: ["string", "null"]}
                      role: {type: string}
      404:
        description: Board not found.
    """
    rows = service.list_members(current_user, uuid.UUID(board_id))
    return (
        jsonify(
            {
                "data": [
                    {
                        "user_id": str(m.user_id),
                        "email": u.email,
                        "name": u.name,
                        "role": m.role,
                    }
                    for m, u in rows
                ]
            }
        ),
        200,
    )


@members_boards.route("/<board_id>/members/<member_user_id>", methods=["DELETE"])
@token_required
def remove_member(current_user, board_id, member_user_id):
    """Remove a member from a board (owner only; the owner row cannot be removed).
    ---
    tags:
      - Members
    security:
      - BearerAuth: []
    parameters:
      - name: board_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
      - name: member_user_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      204:
        description: Member removed.
      404:
        description: Board not found.
      409:
        description: The board owner cannot be removed.
    """
    service.remove_member(current_user, uuid.UUID(board_id), uuid.UUID(member_user_id))
    return "", 204


@_mc.route("/<card_id>/assignees", methods=["PATCH"])
@token_required
def set_card_assignees(current_user, card_id):
    """Replace the user tags on a card (board owner only).

    Registered under /api/v1/cards so the final path is
    /api/v1/cards/{card_id}/assignees — the same prefix the rest of the
    card routes use.
    ---
    tags:
      - Members
    security:
      - BearerAuth: []
    parameters:
      - name: card_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              user_ids:
                type: array
                items:
                  type: string
                  format: uuid
                description: Board member ids to tag on the card. Empty clears all tags.
    responses:
      200:
        description: Tags replaced.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
      404:
        description: Card not found, or a user id is not a member of the board.
    """
    data = SetCardAssigneesSchema().load(request.get_json() or {})
    user_ids = data.get("user_ids") or []
    card = service.set_card_assignees(current_user, uuid.UUID(card_id), user_ids)
    from app.blueprints.cards.schema import card_to_dict

    return jsonify({"data": card_to_dict(card)}), 200
