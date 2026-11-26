"""Smoke auth gate for estimate_food_from_photo.

Skipped when local Supabase is down. Full OpenAI path needs OPENAI_API_KEY and a
user JWT; this only checks that callers without a user JWT are rejected.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request

import pytest

from python_seeds.client import SUPABASE_SECRET_KEY, SUPABASE_URL

pytestmark = pytest.mark.integration


def test_estimate_food_from_photo_rejects_missing_user_jwt(admin_client):
    del admin_client
    request = urllib.request.Request(
        f"{SUPABASE_URL}/functions/v1/estimate_food_from_photo",
        data=json.dumps(
            {
                "image_base64": "AAAA",
                "mime_type": "image/jpeg",
            }
        ).encode(),
        headers={
            "apikey": SUPABASE_SECRET_KEY,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with pytest.raises(urllib.error.HTTPError) as raised:
        urllib.request.urlopen(request, timeout=60)
    assert raised.value.code in {401, 403}
