"""Persistent local storage for completed AniSlot images."""

import mimetypes
import os
from pathlib import Path
import re

from django.conf import settings


class AniSlotResultStore:
    """Store generated images outside InvokeAI's disposable output directory."""

    _ITEM_ID = re.compile(r'^[A-Za-z0-9_-]+$')
    _ALLOWED_SUFFIXES = {'.avif', '.jpeg', '.jpg', '.png', '.webp'}

    def __init__(self):
        default_directory = settings.BASE_DIR.parent / 'workspaces' / 'anislot' / 'results'
        self.directory = Path(os.environ.get('ANISLOT_RESULTS_DIR', default_directory))

    def save(self, item_id: str, source_name: str, content: bytes) -> Path:
        safe_item_id = self._safe_item_id(item_id)
        suffix = Path(source_name).suffix.lower()
        if suffix not in self._ALLOWED_SUFFIXES:
            suffix = '.png'

        self.directory.mkdir(parents=True, exist_ok=True)
        destination = self.directory / f'{safe_item_id}{suffix}'
        temporary = destination.with_suffix(f'{suffix}.tmp')
        temporary.write_bytes(content)
        temporary.replace(destination)
        return destination

    def read(self, item_id: str) -> tuple[bytes, str]:
        safe_item_id = self._safe_item_id(item_id)
        matches = [path for path in self.directory.glob(f'{safe_item_id}.*') if path.suffix in self._ALLOWED_SUFFIXES]
        if not matches:
            raise FileNotFoundError(item_id)
        result = matches[0]
        return result.read_bytes(), mimetypes.guess_type(result.name)[0] or 'application/octet-stream'

    def _safe_item_id(self, item_id: str) -> str:
        value = str(item_id)
        if not self._ITEM_ID.fullmatch(value):
            raise ValueError('Invalid AniSlot result identifier.')
        return value
