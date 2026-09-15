"""Small HTTP client for a local InvokeAI server.

The caller must supply an *executable graph*. A workflow saved by the InvokeAI
editor is UI data and must be converted to a graph before it can be queued.
"""

import json
import mimetypes
import os
import uuid
from collections.abc import Mapping
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class InvokeError(Exception):
    """An InvokeAI request failed."""

    status_code = 502


class InvokeUnavailable(InvokeError):
    """InvokeAI is not running or cannot be reached."""

    status_code = 503


class InvokeClient:
    """Client for the local, single-user InvokeAI HTTP API."""

    def __init__(self):
        self.base_url = os.environ.get('INVOKEAI_URL', 'http://127.0.0.1:9090').rstrip('/')
        self.queue_id = os.environ.get('INVOKEAI_QUEUE_ID', 'default')
        self.timeout = float(os.environ.get('INVOKEAI_TIMEOUT', '30'))
        self.token = os.environ.get('INVOKEAI_TOKEN', '').strip()

    @property
    def is_configured(self):
        return bool(self.base_url)

    def queue_status(self):
        """Return the queue status; use this as a lightweight availability check."""
        return self._request_json('GET', f'/api/v1/queue/{self.queue_id}/status')

    def upload_image(self, content: bytes, filename: str, content_type: str | None = None):
        """Upload an input image and return InvokeAI's image metadata."""
        if not content:
            raise ValueError('An image file is required.')
        if not filename:
            raise ValueError('An image filename is required.')

        boundary = f'----BetWinInvoke{uuid.uuid4().hex}'
        mime_type = content_type or mimetypes.guess_type(filename)[0] or 'application/octet-stream'
        body = b''.join((
            f'--{boundary}\r\n'.encode(),
            (
                'Content-Disposition: form-data; name="file"; '
                f'filename="{filename}"\r\n'
            ).encode(),
            f'Content-Type: {mime_type}\r\n\r\n'.encode(),
            content,
            f'\r\n--{boundary}--\r\n'.encode(),
        ))
        return self._request_json(
            'POST',
            '/api/v1/images/upload?image_category=user&is_intermediate=false',
            body=body,
            headers={'Content-Type': f'multipart/form-data; boundary={boundary}'},
        )

    def enqueue_graph(self, graph: Mapping, *, runs: int = 1, origin: str = 'betwin-tools'):
        """Put an executable Invoke graph into the configured queue."""
        if not isinstance(graph, Mapping):
            raise ValueError('graph must be a JSON object.')
        if not isinstance(runs, int) or runs < 1:
            raise ValueError('runs must be a positive integer.')

        result = self._request_json(
            'POST',
            f'/api/v1/queue/{self.queue_id}/enqueue_batch',
            payload={'batch': {'graph': dict(graph), 'runs': runs, 'origin': origin}},
        )
        item_ids = result.get('item_ids')
        if not isinstance(item_ids, list) or not item_ids:
            requested = result.get('requested', 'unknown')
            enqueued = result.get('enqueued', 'unknown')
            raise InvokeError(
                'InvokeAI did not return a queue item ID '
                f'(requested={requested}, enqueued={enqueued}).'
            )
        return result

    def queue_item(self, item_id: str):
        """Return one queued job, including status and completed session results."""
        if not item_id:
            raise ValueError('item_id is required.')
        return self._request_json('GET', f'/api/v1/queue/{self.queue_id}/i/{item_id}')

    def download_image(self, image_name: str):
        """Return the full generated image as ``(bytes, content_type)``."""
        if not image_name:
            raise ValueError('image_name is required.')
        return self._request_bytes('GET', f'/api/v1/images/i/{image_name}/full')

    @staticmethod
    def image_names_from_results(results: object) -> list[str]:
        """Extract image names from a completed queue item's session results."""
        names: list[str] = []

        def visit(value: object):
            if isinstance(value, Mapping):
                image = value.get('image')
                if isinstance(image, Mapping) and isinstance(image.get('image_name'), str):
                    names.append(image['image_name'])
                for child in value.values():
                    visit(child)
            elif isinstance(value, list):
                for child in value:
                    visit(child)

        visit(results)
        return list(dict.fromkeys(names))

    def _request_json(self, method: str, path: str, *, payload=None, body=None, headers=None):
        response_body, _ = self._request(method, path, payload=payload, body=body, headers=headers)
        if not response_body:
            return {}
        try:
            parsed = json.loads(response_body.decode('utf-8'))
        except json.JSONDecodeError as error:
            raise InvokeError('InvokeAI returned invalid JSON.') from error
        if not isinstance(parsed, dict):
            raise InvokeError('InvokeAI returned an unexpected JSON response.')
        return parsed

    def _request_bytes(self, method: str, path: str):
        return self._request(method, path)

    def _request(self, method: str, path: str, *, payload=None, body=None, headers=None):
        if payload is not None and body is not None:
            raise ValueError('Provide either payload or body, not both.')
        if payload is not None:
            body = json.dumps(payload).encode('utf-8')

        request_headers = {'Accept': 'application/json'}
        if payload is not None:
            request_headers['Content-Type'] = 'application/json'
        if self.token:
            request_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            request_headers.update(headers)

        request = Request(
            f'{self.base_url}{path}',
            data=body,
            headers=request_headers,
            method=method,
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                return response.read(), response.headers.get_content_type()
        except HTTPError as error:
            error_body = error.read().decode('utf-8', errors='replace').strip()
            detail = f'InvokeAI returned HTTP {error.code}'
            if error_body:
                detail = f'{detail}: {error_body}'
            raise InvokeError(detail) from error
        except URLError as error:
            raise InvokeUnavailable('InvokeAI is unreachable. Start it, then try again.') from error
