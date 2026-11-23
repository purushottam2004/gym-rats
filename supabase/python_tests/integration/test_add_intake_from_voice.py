"""Smoke auth gate for add_intake_from_voice.

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


def test_add_intake_from_voice_rejects_missing_user_jwt(admin_client):
    del admin_client
    request = urllib.request.Request(
        f"{SUPABASE_URL}/functions/v1/add_intake_from_voice",
        data=json.dumps(
            {
                "logged_on": "2026-11-23",
                "audio_base64": "AAAA",
                "mime_type": "audio/m4a",
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
