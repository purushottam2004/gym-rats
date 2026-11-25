"""Sample Habits and Habit sections for the seeded user (stable UUIDs)."""

from python_seeds.data._001_data_users import SEED_USER_ID

# Stable ids in the seed-user range so resets stay deterministic.
HABIT_SECTION_HYGIENE_ID = "00000000-0000-0000-0000-000000000210"

HABIT_MORNING_BRUSH_ID = "00000000-0000-0000-0000-000000000201"
HABIT_EVENING_BRUSH_ID = "00000000-0000-0000-0000-000000000202"
HABIT_BATH_ID = "00000000-0000-0000-0000-000000000203"
HABIT_MOBILITY_ID = "00000000-0000-0000-0000-000000000204"

SEED_HABIT_SECTIONS = [
    {
        "id": HABIT_SECTION_HYGIENE_ID,
        "user_id": SEED_USER_ID,
        "name": "Hygiene",
        "sort_order": 0,
    },
]

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
        "section_id": HABIT_SECTION_HYGIENE_ID,
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
        "section_id": HABIT_SECTION_HYGIENE_ID,
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
        "section_id": HABIT_SECTION_HYGIENE_ID,
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
        "section_id": None,
    },
]
