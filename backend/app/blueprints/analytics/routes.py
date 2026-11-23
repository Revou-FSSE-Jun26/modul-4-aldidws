"""Analytics route handlers."""

import uuid

from flask import jsonify

from app.blueprints.auth.decorators import token_required
from app.blueprints.analytics import analytics_bp
from app.blueprints.analytics import service
from app.blueprints.analytics.schema import board_summary_to_dict


@analytics_bp.route("/boards/<board_id>/summary", methods=["GET"])
@token_required
def board_summary(current_user, board_id):
    """Get analytics summary for a board.

    Full path: /api/analytics/boards/<board_id>/summary
    ---
    tags:
      - Analytics
    security:
      - BearerAuth: []
    parameters:
      - name: board_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
        description: UUID of the board.
    responses:
      200:
        description: Board analytics summary.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
                  properties:
                    board_id:
                      type: string
                      format: uuid
                    total_cards:
                      type: integer
                    completed_cards:
                      type: integer
      404:
        description: Board not found.
    """
    summary = service.board_summary(current_user, uuid.UUID(board_id))
    return jsonify({"data": board_summary_to_dict(
        summary["board_id"], summary["total_cards"], summary["completed_cards"]
    )}), 200
