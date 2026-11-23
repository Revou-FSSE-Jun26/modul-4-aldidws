"""Comments route handlers."""

import uuid

from flask import jsonify, request

from app.blueprints.auth.decorators import token_required
from app.blueprints.comments import comments_bp
from app.blueprints.comments import service
from app.blueprints.comments.schema import (
    CreateCommentSchema,
    UpdateCommentSchema,
    comment_to_dict,
)


# ---------------------------------------------------------------------------
# Card-scoped routes
# Registered at /api/cards/<card_id>/comments via the "comments_cards"
# registration in app/__init__.py.
# ---------------------------------------------------------------------------


@comments_bp.route("/<card_id>/comments", methods=["POST"])
@token_required
def create_comment(current_user, card_id):
    """Add a comment to a card.
    ---
    tags:
      - Comments
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
            required:
              - body
            properties:
              body:
                type: string
                example: This needs more details.
    responses:
      201:
        description: Comment created successfully.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
      400:
        description: Validation error (missing body).
      403:
        description: User does not have access to the board.
    """
    data = CreateCommentSchema().load(request.get_json() or {})
    comment = service.create_comment(current_user, uuid.UUID(card_id), data)
    return jsonify({"data": comment_to_dict(comment)}), 201


@comments_bp.route("/<card_id>/comments", methods=["GET"])
@token_required
def list_comments(current_user, card_id):
    """List all comments for a card.
    ---
    tags:
      - Comments
    security:
      - BearerAuth: []
    parameters:
      - name: card_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      200:
        description: Array of comments.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: array
                  items:
                    type: object
    """
    comments = service.list_comments(current_user, uuid.UUID(card_id))
    return jsonify({"data": [comment_to_dict(c) for c in comments]}), 200


# ---------------------------------------------------------------------------
# Comment-level routes
# Registered at /api/comments/<comment_id> via the primary comments_bp
# registration in app/__init__.py.
# ---------------------------------------------------------------------------


@comments_bp.route("/<comment_id>", methods=["PATCH"])
@token_required
def update_comment(current_user, comment_id):
    """Edit a comment.
    ---
    tags:
      - Comments
    security:
      - BearerAuth: []
    parameters:
      - name: comment_id
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
              body:
                type: string
                example: Updated comment text.
    responses:
      200:
        description: Updated comment data.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
      403:
        description: Not the comment author.
      404:
        description: Comment not found.
    """
    data = UpdateCommentSchema().load(request.get_json() or {}, partial=True)
    comment = service.update_comment(current_user, uuid.UUID(comment_id), data)
    return jsonify({"data": comment_to_dict(comment)}), 200


@comments_bp.route("/<comment_id>", methods=["DELETE"])
@token_required
def delete_comment(current_user, comment_id):
    """Delete a comment.
    ---
    tags:
      - Comments
    security:
      - BearerAuth: []
    parameters:
      - name: comment_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      204:
        description: Comment deleted successfully.
      403:
        description: Not the comment author.
      404:
        description: Comment not found.
    """
    service.delete_comment(current_user, uuid.UUID(comment_id))
    return "", 204
