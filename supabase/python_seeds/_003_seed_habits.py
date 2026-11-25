"""
Seed sample Habits for seed_user from python_seeds/data/_003_data_habits.py.
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
    print(f"Seeding {len(habit_data.SEED_HABITS)} habits...\n")

    for habit in habit_data.SEED_HABITS:
        existing = supabase.table("habits").select("id").eq("id", habit["id"]).limit(1).execute()
        if existing.data:
            supabase.table("habits").update(
                {
                    "name": habit["name"],
                    "recurrence": habit["recurrence"],
                    "frequency": habit["frequency"],
                    "weekdays": habit["weekdays"],
                    "sort_order": habit["sort_order"],
                    "active": habit["active"],
                }
            ).eq("id", habit["id"]).execute()
            print(f"  Updated habit {habit['name']}")
        else:
            supabase.table("habits").insert(habit).execute()
            print(f"  Inserted habit {habit['name']}")

    print("\nHabit seeding complete!")


if __name__ == "__main__":
    seed_habits()
