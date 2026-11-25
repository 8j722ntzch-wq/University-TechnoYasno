"""Deploy only the compiled TechnoYasno site via authenticated SFTP."""
import errno
import hashlib
import os
import posixpath as pp
import shutil
import stat
import sys
import tarfile
import tempfile
import uuid
from pathlib import Path

import paramiko

DOMAIN = "markbuhayeu.com"
HOST = "vh167.hoster.by"
USER = "h220918"
MARKER = ".technoyasno-deploy-target"


def required(name):
    value = os.environ.get(name, "")
    if not value.strip():
        raise RuntimeError(f"Missing repository secret: {name}")
    return value


def info(sftp, path):
    try:
        return sftp.lstat(path)
    except OSError as exc:
        if exc.errno == errno.ENOENT:
            return None
        raise


def directory(sftp, path, create=False, mode=0o755):
    attr = info(sftp, path)
    if attr is None and create:
        sftp.mkdir(path, mode=mode)
        attr = sftp.lstat(path)
    if attr is None or not stat.S_ISDIR(attr.st_mode):
        raise RuntimeError("Expected a real directory, not a symlink or other file")
    return attr


def open_connection(tmp):
    if required("SFTP_HOST") != HOST or required("SFTP_PORT") != "22" or required("SFTP_USERNAME") != USER:
        raise RuntimeError("Connection settings do not match the approved TechnoYasno server/account")
    known = Path(tmp) / "known_hosts"
    known.write_text(required("SFTP_KNOWN_HOSTS").strip() + "\n", encoding="utf-8")
    known.chmod(0o600)
    password = os.environ.get("SFTP_PASSWORD", "")
    private_key = os.environ.get("SFTP_PRIVATE_KEY", "")
    if bool(password) == bool(private_key):
        raise RuntimeError("Configure exactly one authentication secret: SFTP_PASSWORD or SFTP_PRIVATE_KEY")
    auth = {"password": password} if password else {}
    if private_key:
        key = Path(tmp) / "id_deploy"
        key.write_text(private_key.rstrip() + "\n", encoding="utf-8")
        key.chmod(0o600)
        auth["key_filename"] = str(key)
    client = paramiko.SSHClient()
    client.load_host_keys(str(known))
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    client.connect(HOST, port=22, username=USER, allow_agent=False,
                   look_for_keys=False, timeout=20, banner_timeout=20,
                   auth_timeout=20, **auth)
    return client


def target(sftp):
    path = required("SFTP_REMOTE_DIR").strip()
    if any(part == ".." for part in path.split("/")):
        raise RuntimeError("Parent-directory traversal is prohibited")
    root = sftp.normalize(path)
    directory(sftp, root)
    home = sftp.normalize(".")
    # A chroot may hide the physical document root. Require a marker placed
    # in the intended site through the trusted hosting panel in that case.
    if not root.endswith("/www/" + DOMAIN):
        marker = pp.join(root, MARKER)
        attr = info(sftp, marker)
        if attr is None or not stat.S_ISREG(attr.st_mode):
            raise RuntimeError("Cannot establish the document root. Check SFTP_REMOTE_DIR; for chroot, create .technoyasno-deploy-target containing markbuhayeu.com in the actual document root via ispmanager")
        with sftp.open(marker, "rb") as f:
            if f.read(256).strip() != DOMAIN.encode():
                raise RuntimeError("Document-root marker does not match the target domain")
    print("Authenticated SFTP session and target directory verified.", flush=True)
    return root, home


def preflight(sftp, root):
    folder = pp.join(root, ".technoyasno-probe-" + uuid.uuid4().hex)
    sftp.mkdir(folder, mode=0o700)
    a, b = pp.join(folder, "probe"), pp.join(folder, "renamed")
    payload = b"technoyasno-sftp-preflight"
    try:
        with sftp.open(a, "wx") as f:
            f.write(payload)
        sftp.posix_rename(a, b)
        with sftp.open(b, "rb") as f:
            if f.read() != payload:
                raise RuntimeError("Write/read verification failed")
    finally:
        for p in (a, b):
            if info(sftp, p) is not None:
                sftp.remove(p)
        sftp.rmdir(folder)
    print("Preflight: write, rename, read and cleanup succeeded. No existing files changed.", flush=True)


def hash_stream(stream):
    digest = hashlib.sha256()
    while chunk := stream.read(1024 * 1024):
        digest.update(chunk)
    return digest.hexdigest()


def archive_tree(sftp, root, archive, prefix=""):
    path = pp.join(root, prefix)
    for attr in sftp.listdir_attr(path):
        name = attr.filename
        if name in (".", "..") or "/" in name:
            raise RuntimeError("Unexpected remote filename")
        rel = pp.join(prefix, name)
        remote = pp.join(root, rel)
        entry = tarfile.TarInfo(rel)
        entry.mode = stat.S_IMODE(attr.st_mode)
        entry.mtime = attr.st_mtime or 0
        if stat.S_ISDIR(attr.st_mode):
            entry.type = tarfile.DIRTYPE
            archive.addfile(entry)
            archive_tree(sftp, root, archive, rel)
        elif stat.S_ISREG(attr.st_mode):
            entry.size = attr.st_size
            with sftp.open(remote, "rb") as f:
                archive.addfile(entry, f)
        else:
            raise RuntimeError("Existing website contains a symlink or special file; use a verified hosting-panel backup instead")


def backup(sftp, root, home, tmp):
    # Keep private backups outside the published site, never in public GitHub artifacts.
    if root == home or not root.startswith(home.rstrip("/") + "/"):
        if os.environ.get("MANUAL_BACKUP_CONFIRMED", "").lower() == "true":
            print("Manual hosting-panel backup attested for this run.", flush=True)
            return
        raise RuntimeError("No verified private backup location outside document root; create and verify a panel backup, then use manual deploy with backup_confirmed")
    if os.environ.get("MANUAL_BACKUP_CONFIRMED", "").lower() == "true":
        print("Manual hosting-panel backup attested for this run.", flush=True)
        return
    backup_dir = pp.join(home, ".technoyasno-backups")
    attr = directory(sftp, backup_dir, create=True, mode=0o700)
    if stat.S_IMODE(attr.st_mode) & 0o077:
        raise RuntimeError("Backup directory is not private (expected mode 0700)")
    if sftp.normalize(backup_dir).startswith(root.rstrip("/") + "/"):
        raise RuntimeError("Backup directory is inside the public site")
    local = Path(tmp) / "site.tar.gz"
    with tarfile.open(local, "w:gz") as archive:
        archive_tree(sftp, root, archive)
    with tarfile.open(local, "r:gz") as archive:
        archive.getmembers()
    remote = pp.join(backup_dir, f"site-{os.environ['GITHUB_RUN_ID']}-{uuid.uuid4().hex}.tar.gz")
    with local.open("rb") as source, sftp.open(remote, "wx") as dest:
        shutil.copyfileobj(source, dest)
    sftp.chmod(remote, 0o600)
    with local.open("rb") as source, sftp.open(remote, "rb") as dest:
        if hash_stream(source) != hash_stream(dest):
            raise RuntimeError("Remote backup checksum mismatch")
    print("Private backup saved and SHA256 verified: " + pp.basename(remote), flush=True)


def publish(sftp, root):
    dist = Path("dist")
    if not (dist / "index.html").is_file():
        raise RuntimeError("dist/index.html is missing")
    paths = [p for p in dist.rglob("*") if p.is_file()]
    if any(p.is_symlink() for p in dist.rglob("*")):
        raise RuntimeError("Build contains a symlink")
    def order(p):
        return (2 if p.name == "technoyasno-release.json" else 1 if p.suffix == ".html" else 0, str(p))
    # Pre-check every existing destination before transferring any website file.
    for p in paths:
        parts = p.relative_to(dist).parts
        parent = root
        for part in parts[:-1]:
            parent = pp.join(parent, part)
            attr = info(sftp, parent)
            if attr is None:
                break
            if not stat.S_ISDIR(attr.st_mode):
                raise RuntimeError("Unsafe existing destination directory")
        else:
            attr = info(sftp, pp.join(parent, parts[-1]))
            if attr is not None and not stat.S_ISREG(attr.st_mode):
                raise RuntimeError("Unsafe existing destination file")
    for p in sorted(paths, key=order):
        parts = p.relative_to(dist).parts
        parent = root
        for part in parts[:-1]:
            parent = pp.join(parent, part)
            directory(sftp, parent, create=True)
        dest = pp.join(parent, parts[-1])
        attr = info(sftp, dest)
        if attr is not None and not stat.S_ISREG(attr.st_mode):
            raise RuntimeError("Refusing to replace a non-regular file")
        tmp = pp.join(parent, ".technoyasno-upload-" + uuid.uuid4().hex)
        try:
            with p.open("rb") as source, sftp.open(tmp, "wx") as out:
                shutil.copyfileobj(source, out)
            sftp.chmod(tmp, 0o644)
            if sftp.stat(tmp).st_size != p.stat().st_size:
                raise RuntimeError("Uploaded size mismatch")
            sftp.posix_rename(tmp, dest)
        finally:
            if info(sftp, tmp) is not None:
                sftp.remove(tmp)
    print(f"Published {len(paths)} static files. Existing unrelated files were not deleted.", flush=True)


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ("preflight", "deploy"):
        raise SystemExit("Usage: deploy-sftp.py preflight|deploy")
    with tempfile.TemporaryDirectory(prefix="technoyasno-") as tmp:
        client = open_connection(tmp)
        try:
            with client.open_sftp() as sftp:
                root, home = target(sftp)
                preflight(sftp, root)
                if sys.argv[1] == "deploy":
                    backup(sftp, root, home, tmp)
                    publish(sftp, root)
        finally:
            client.close()


if __name__ == "__main__":
    main()
