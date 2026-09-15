"""
Here we validate URL and choose destination,
where we run git clone and return result
"""

from pathlib import Path
import os
import re
import subprocess
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_DIR = BASE_DIR.parent / "workspaces"

ALLOWED_SSH_HOSTS = {"github.com", "github-anislot"}
REPOSITORY_PATH_PATTERN = re.compile(
    r"^(?P<owner>[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)/"
    r"(?P<repository>[A-Za-z0-9_.-]+?)(?:\.git)?$",
    re.IGNORECASE,
)
SCP_SSH_PATTERN = re.compile(
    r"^git@(?P<host>[A-Za-z0-9.-]+):(?P<path>[^/?#]+/[^/?#]+/?)$",
    re.IGNORECASE,
)


def parse_repository_url(repository_url):
    """Return a canonical (owner, repository) pair for an allowed GitHub URL."""
    if not isinstance(repository_url, str):
        return None

    value = repository_url.strip()
    scp_match = SCP_SSH_PATTERN.fullmatch(value)
    if scp_match:
        host = scp_match.group('host').lower()
        path = scp_match.group('path').rstrip('/')
        if host not in ALLOWED_SSH_HOSTS:
            return None
    else:
        parsed = urlparse(value)
        if parsed.query or parsed.fragment:
            return None

        if parsed.scheme == 'https':
            if (
                parsed.hostname != 'github.com'
                or parsed.username is not None
                or parsed.password is not None
                or parsed.port is not None
            ):
                return None
        elif parsed.scheme == 'ssh':
            if (
                parsed.hostname not in ALLOWED_SSH_HOSTS
                or parsed.username != 'git'
                or parsed.password is not None
                or parsed.port is not None
            ):
                return None
        else:
            return None

        path = parsed.path.strip('/')

    path_match = REPOSITORY_PATH_PATTERN.fullmatch(path)
    if not path_match:
        return None

    return (
        path_match.group('owner').lower(),
        path_match.group('repository').lower(),
    )


def validate_repository_url(repository_url):
    return parse_repository_url(repository_url) is not None


def normalize_repository_url(repository_url):
    repository = parse_repository_url(repository_url)
    if repository:
        owner, name = repository
        return f'github.com/{owner}/{name}'
    return repository_url.strip().rstrip('/').removesuffix('.git').lower()


def clone_environment(repository_url):
    """Use AniSlot's deploy key for SSH clones when it is available."""
    value = repository_url.strip()
    if not (value.startswith('git@') or urlparse(value).scheme == 'ssh'):
        return None

    configured_path = os.environ.get('ANISLOT_DEPLOY_KEY_PATH')
    deploy_key = (
        Path(configured_path).expanduser()
        if configured_path
        else Path.home() / '.ssh' / 'anislot_deploy'
    )
    if not deploy_key.is_file():
        return None

    environment = os.environ.copy()
    environment['GIT_SSH_COMMAND'] = (
        f'ssh -i "{deploy_key.as_posix()}" -o IdentitiesOnly=yes'
    )
    return environment


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
        raise ValueError(
            "Enter a valid GitHub HTTPS or SSH repository URL."
        )

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
        env=clone_environment(repository_url),
    )

    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip())

    return destination
