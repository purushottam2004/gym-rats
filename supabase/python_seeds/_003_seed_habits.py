"""
Seed sample Habit sections and Habits for seed_user from
python_seeds/data/_003_data_habits.py.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from python_seeds.client import get_supabase_admin_client
from python_seeds.data import _003_data_habits as habit_data


def seed_habits():
    supabase = get_supabase_admin_client()
    print(f"Seeding {len(habit_data.SEED_HABIT_SECTIONS)} habit sections...\n")

    for section in habit_data.SEED_HABIT_SECTIONS:
        existing = (
            supabase.table("habit_sections").select("id").eq("id", section["id"]).limit(1).execute()
        )
        if existing.data:
            supabase.table("habit_sections").update(
                {
                    "name": section["name"],
                    "sort_order": section["sort_order"],
                }
            ).eq("id", section["id"]).execute()
            print(f"  Updated habit section {section['name']}")
        else:
            supabase.table("habit_sections").insert(section).execute()
            print(f"  Inserted habit section {section['name']}")

    print(f"\nSeeding {len(habit_data.SEED_HABITS)} habits...\n")

    for habit in habit_data.SEED_HABITS:
        existing = supabase.table("habits").select("id").eq("id", habit["id"]).limit(1).execute()
        payload = {
            "name": habit["name"],
            "recurrence": habit["recurrence"],
            "frequency": habit["frequency"],
            "weekdays": habit["weekdays"],
            "sort_order": habit["sort_order"],
            "active": habit["active"],
            "section_id": habit["section_id"],
            "remind_enabled": habit.get("remind_enabled", False),
            "remind_first_time": habit.get("remind_first_time"),
            "remind_every_minutes": habit.get("remind_every_minutes"),
        }
        if existing.data:
            supabase.table("habits").update(payload).eq("id", habit["id"]).execute()
            print(f"  Updated habit {habit['name']}")
        else:
            supabase.table("habits").insert(habit).execute()
            print(f"  Inserted habit {habit['name']}")

    print("\nHabit seeding complete!")


if __name__ == "__main__":
    seed_habits()
