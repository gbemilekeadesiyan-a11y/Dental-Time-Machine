"""Shared Bedrock helper tests. AWS is never called: the client is replaced with a fake."""

from __future__ import annotations

import logging
from typing import Any

import pytest
from botocore.exceptions import ClientError, NoCredentialsError, ReadTimeoutError

from app.ai import bedrock

SYSTEM = "You explain dental benefits."
SECRET_TEXT = "my private dental history"


class FakeClient:
    def __init__(self, reply: dict[str, Any] | None = None, error: Exception | None = None) -> None:
        self.reply = reply
        self.error = error
        self.kwargs: dict[str, Any] = {}

    def converse(self, **kwargs: Any) -> dict[str, Any]:
        self.kwargs = kwargs
        if self.error:
            raise self.error
        assert self.reply is not None
        return self.reply


def reply_with(*texts: str) -> dict[str, Any]:
    return {"output": {"message": {"role": "assistant", "content": [{"text": t} for t in texts]}}}


@pytest.fixture
def use_client(monkeypatch: pytest.MonkeyPatch):
    def install(client: FakeClient) -> FakeClient:
        monkeypatch.setattr(bedrock, "_client", lambda: client)
        return client

    return install


def user_says(text: str) -> list[dict[str, Any]]:
    return bedrock.text_messages([("user", text)])


# ---------- call ----------


def test_call_returns_text_and_sends_settings(use_client) -> None:
    client = use_client(FakeClient(reply_with("Hello ", "there.")))
    assert bedrock.call(SYSTEM, user_says("Hi"), max_tokens=200) == "Hello there."
    assert client.kwargs["modelId"] == bedrock.MODEL_ID
    assert client.kwargs["system"] == [{"text": SYSTEM}]
    assert client.kwargs["messages"] == [{"role": "user", "content": [{"text": "Hi"}]}]
    assert client.kwargs["inferenceConfig"]["maxTokens"] == 200


@pytest.mark.parametrize(
    "error",
    [
        ClientError({"Error": {"Code": "AccessDeniedException", "Message": "nope"}}, "Converse"),
        ClientError({"Error": {"Code": "ThrottlingException", "Message": "slow down"}}, "Converse"),
        NoCredentialsError(),
        ReadTimeoutError(endpoint_url="https://bedrock"),
        RuntimeError("anything else"),
    ],
)
def test_call_returns_none_on_any_error(use_client, error: Exception) -> None:
    use_client(FakeClient(error=error))
    assert bedrock.call(SYSTEM, user_says("Hi")) is None


@pytest.mark.parametrize(
    "reply",
    [
        reply_with(),
        reply_with("   "),
        {"output": {}},
        {},
    ],
)
def test_call_returns_none_on_empty_reply(use_client, reply: dict[str, Any]) -> None:
    use_client(FakeClient(reply))
    assert bedrock.call(SYSTEM, user_says("Hi")) is None


def test_call_returns_none_when_client_cannot_be_built(monkeypatch: pytest.MonkeyPatch) -> None:
    def broken() -> FakeClient:
        raise NoCredentialsError()

    monkeypatch.setattr(bedrock, "_client", broken)
    assert bedrock.call(SYSTEM, user_says("Hi")) is None


def test_errors_never_log_user_text(use_client, caplog: pytest.LogCaptureFixture) -> None:
    use_client(FakeClient(error=RuntimeError(SECRET_TEXT)))
    with caplog.at_level(logging.DEBUG):
        bedrock.call(SYSTEM, user_says(SECRET_TEXT))
    assert "RuntimeError" in caplog.text
    assert SECRET_TEXT not in caplog.text


# ---------- client settings ----------


def test_client_config_has_timeout_and_no_retries() -> None:
    config = bedrock.client_config()
    assert config.connect_timeout == bedrock.TIMEOUT_SECONDS == 8
    assert config.read_timeout == bedrock.TIMEOUT_SECONDS
    assert config.retries == {"total_max_attempts": 1}
    assert config.region_name == bedrock.REGION


# ---------- text_messages ----------


def test_text_messages_merges_same_role_turns() -> None:
    messages = bedrock.text_messages([("user", "One."), ("user", "Two."), ("assistant", "Ok.")])
    assert messages == [
        {"role": "user", "content": [{"text": "One.\n\nTwo."}]},
        {"role": "assistant", "content": [{"text": "Ok."}]},
    ]


def test_text_messages_starts_with_user() -> None:
    # Bedrock requires the first message to come from the user.
    messages = bedrock.text_messages([("assistant", "What did your dentist say?"), ("user", "Two crowns.")])
    assert messages[0]["role"] == "user"
    assert messages[-1] == {"role": "user", "content": [{"text": "Two crowns."}]}
    assert [m["role"] for m in messages] == ["user", "assistant", "user"]


def test_text_messages_skips_blank_turns() -> None:
    assert bedrock.text_messages([("user", "  "), ("user", "Hi")]) == [
        {"role": "user", "content": [{"text": "Hi"}]}
    ]
