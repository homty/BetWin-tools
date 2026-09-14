"""
Here we validate URL and choose destination,
where we run git clone and return result
"""

from pathlib import Path
import subprocess
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_DIR = BASE_DIR.parent / "workspaces"

#validation function
def validate_repository_url(repository_url):
    parsed = urlparse(repository_url)
    
    return (
    parsed.scheme == "https"
    and parsed.netloc == "github.com"
    and parsed.path.count("/") >= 2
)


def normalize_repository_url(repository_url):
    return repository_url.strip().rstrip('/').removesuffix('.git').lower()


def existing_repository_matches(destination, repository_url):
    if not (destination / '.git').is_dir():
        return False

    result = subprocess.run(
        ['git', '-C', str(destination), 'remote', 'get-url', 'origin'],
        capture_output=True,
        text=True,
        check=False,
    )

    return (
        result.returncode == 0
        and normalize_repository_url(result.stdout) == normalize_repository_url(repository_url)
    )


def repository_destination(product_name):
    return WORKSPACE_DIR / product_name.lower()

def clone_repository(repository_url, product_name):
    if not validate_repository_url(repository_url):
        raise ValueError("Only valid GitHub HTTPS URLs are allowed")

    destination = repository_destination(product_name)
    WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)

    if destination.exists():
        if existing_repository_matches(destination, repository_url):
            return destination
        raise FileExistsError(
            "The product directory already exists but contains a different repository."
        )

    result = subprocess.run(
        ["git", "clone", "--depth", "1", repository_url, str(destination)],
        capture_output=True,
        text=True,
        check=False,
    )

    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip())

    return destination
