import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class PipelineError(Exception):
    status_code = 502


class PipelineUnavailable(PipelineError):
    status_code = 503


class ModelPipelineClient:
    def __init__(self):
        self.url = os.environ.get('MODEL_PIPELINE_URL', '').strip()
        self.timeout = float(os.environ.get('MODEL_PIPELINE_TIMEOUT', '30'))

    @property
    def is_configured(self):
        return bool(self.url)

    def forward(self, payload):
        if not self.is_configured:
            raise PipelineUnavailable('MODEL_PIPELINE_URL is not configured.')

        request = Request(
            self.url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
            method='POST',
        )

        try:
            with urlopen(request, timeout=self.timeout) as response:
                body = response.read().decode('utf-8')
        except HTTPError as error:
            raise PipelineError(f'Pipeline returned HTTP {error.code}.') from error
        except URLError as error:
            raise PipelineUnavailable('Pipeline is unreachable.') from error

        if not body:
            return {}

        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            return {'raw': body}

        return parsed if isinstance(parsed, dict) else {'result': parsed}
