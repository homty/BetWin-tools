import json
import os
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class PipelineError(Exception):
    status_code = 502


class PipelineUnavailable(PipelineError):
    status_code = 503


@dataclass(frozen=True)
class PipelineSettings:
    url: str
    timeout_seconds: float = 30.0

    @classmethod
    def from_environment(cls) -> "PipelineSettings":
        return cls(
            url=os.environ.get("MODEL_PIPELINE_URL", "").strip(),
            timeout_seconds=float(os.environ.get("MODEL_PIPELINE_TIMEOUT", "30")),
        )


class ModelPipelineClient:
    def __init__(self, settings: PipelineSettings | None = None):
        self.settings = settings or PipelineSettings.from_environment()

    @property
    def is_configured(self) -> bool:
        return bool(self.settings.url)

    def forward(self, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.is_configured:
            raise PipelineUnavailable("MODEL_PIPELINE_URL is not configured.")

        body = json.dumps(payload).encode("utf-8")
        request = Request(
            self.settings.url,
            data=body,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )

        try:
            with urlopen(request, timeout=self.settings.timeout_seconds) as response:
                response_body = response.read().decode("utf-8")
        except HTTPError as error:
            raise PipelineError(f"Pipeline returned HTTP {error.code}.") from error
        except URLError as error:
            raise PipelineUnavailable("Pipeline is unreachable.") from error

        if not response_body:
            return {}

        try:
            parsed = json.loads(response_body)
        except json.JSONDecodeError:
            return {"raw": response_body}

        if isinstance(parsed, dict):
            return parsed
        return {"result": parsed}
