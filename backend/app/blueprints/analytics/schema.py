"""Analytics serialization helpers (no request schemas needed — GET only)."""


def board_summary_to_dict(board_id, total_cards, completed_cards) -> dict:
    return {
        "board_id": str(board_id),
        "total_cards": total_cards,
        "completed_cards": completed_cards,
    }
