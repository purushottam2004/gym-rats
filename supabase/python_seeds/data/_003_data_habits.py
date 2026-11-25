"""Sample Habits for the seeded user (stable UUIDs)."""

from python_seeds.data._001_data_users import SEED_USER_ID

# Stable ids in the seed-user range so resets stay deterministic.
HABIT_MORNING_BRUSH_ID = "00000000-0000-0000-0000-000000000201"
HABIT_EVENING_BRUSH_ID = "00000000-0000-0000-0000-000000000202"
HABIT_BATH_ID = "00000000-0000-0000-0000-000000000203"
HABIT_MOBILITY_ID = "00000000-0000-0000-0000-000000000204"

SEED_HABITS = [
    {
        "id": HABIT_MORNING_BRUSH_ID,
        "user_id": SEED_USER_ID,
        "name": "Morning Brush",
        "recurrence": "per_day",
        "frequency": 1,
        "weekdays": [0, 1, 2, 3, 4, 5, 6],
        "sort_order": 0,
        "active": True,
    },
    {
        "id": HABIT_EVENING_BRUSH_ID,
        "user_id": SEED_USER_ID,
        "name": "Evening Brush",
        "recurrence": "per_day",
        "frequency": 1,
        "weekdays": [0, 1, 2, 3, 4, 5, 6],
        "sort_order": 1,
        "active": True,
    },
    {
        "id": HABIT_BATH_ID,
        "user_id": SEED_USER_ID,
        "name": "Bath",
        "recurrence": "per_day",
        "frequency": 1,
        "weekdays": [0, 1, 2, 3, 4, 5, 6],
        "sort_order": 2,
        "active": True,
    },
    {
        "id": HABIT_MOBILITY_ID,
        "user_id": SEED_USER_ID,
        "name": "Mobility",
        "recurrence": "per_week",
        "frequency": 3,
        "weekdays": [0, 1, 2, 3, 4, 5, 6],
        "sort_order": 3,
        "active": True,
    },
]
