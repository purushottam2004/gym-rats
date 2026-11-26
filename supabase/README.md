# Supabase

Local Supabase project for this template (migrations, seeds, CLI config, and Edge Functions).

[`functions/hello_world`](./functions/hello_world/index.ts) is a dummy function. [`add_set_from_voice`](./functions/add_set_from_voice/index.ts) and [`add_intake_from_voice`](./functions/add_intake_from_voice/index.ts) log a set or food from speech (need `OPENAI_API_KEY`). [`estimate_food_from_photo`](./functions/estimate_food_from_photo/index.ts) suggests Other-entry nutrients from a plate photo (also needs `OPENAI_API_KEY`; does not write intakes). Details: [SETUP_GUIDE.md](./SETUP_GUIDE.md).

## Setup

Setup steps live in [SETUP_GUIDE.md](./SETUP_GUIDE.md).

For the full local stack order, see the root [SETUP_GUIDE.md](../SETUP_GUIDE.md).
