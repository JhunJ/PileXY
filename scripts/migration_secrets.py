"""Portable authenticated encryption for PileXY migration credentials.

Install the project's pycryptodome dependency before using this helper.
The recovery key must be carried separately from the GitHub archive.
"""
import argparse
import os
from pathlib import Path, PurePosixPath
import tempfile
import zipfile

from Crypto.Cipher import AES

MAGIC = b"PILEXYSEAL1\n"
BLOCK = 1024 * 1024


def read_key(path):
    key = bytes.fromhex(Path(path).read_text(encoding="ascii").strip())
    if len(key) != 32:
        raise ValueError("Recovery key must contain exactly 64 hexadecimal characters")
    return key


def encrypt(source, output, key_file):
    source, output, key_file = Path(source).resolve(), Path(output).resolve(), Path(key_file).resolve()
    if not source.is_dir() or output.exists() or key_file.exists():
        raise ValueError("Source must exist; output and key file must be new")
    if output.is_relative_to(source) or key_file.is_relative_to(source):
        raise ValueError("Output and recovery key must be outside the plaintext directory")
    output.parent.mkdir(parents=True, exist_ok=True)
    key_file.parent.mkdir(parents=True, exist_ok=True)
    key = os.urandom(32)
    with key_file.open("x", encoding="ascii") as key_handle:
        key_handle.write(key.hex() + "\n")
    nonce = os.urandom(12)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    cipher.update(MAGIC)
    with tempfile.TemporaryFile() as packed:
        with zipfile.ZipFile(packed, "w", zipfile.ZIP_DEFLATED, allowZip64=True) as archive:
            for path in sorted(source.rglob("*")):
                if path.is_symlink() or (hasattr(path, "is_junction") and path.is_junction()):
                    raise ValueError("Links are not allowed in private configuration")
                if path.is_file():
                    archive.write(path, path.relative_to(source).as_posix())
        packed.seek(0)
        with output.open("xb") as sealed:
            sealed.write(MAGIC + nonce)
            while block := packed.read(BLOCK):
                sealed.write(cipher.encrypt(block))
            sealed.write(cipher.digest())
    print("Encrypted private configuration. Keep the separate recovery key.")


def decrypt(input_path, destination, key_file):
    input_path, destination = Path(input_path).resolve(), Path(destination).resolve()
    if destination.exists():
        raise ValueError("Decryption destination must be new")
    size = input_path.stat().st_size
    header_size = len(MAGIC) + 12
    if size < header_size + 16:
        raise ValueError("Invalid encrypted configuration")
    with input_path.open("rb") as sealed, tempfile.TemporaryFile() as packed:
        if sealed.read(len(MAGIC)) != MAGIC:
            raise ValueError("Invalid encrypted configuration header")
        cipher = AES.new(read_key(key_file), AES.MODE_GCM, nonce=sealed.read(12))
        cipher.update(MAGIC)
        remaining = size - header_size - 16
        while remaining:
            block = sealed.read(min(BLOCK, remaining))
            if not block:
                raise ValueError("Truncated encrypted configuration")
            packed.write(cipher.decrypt(block))
            remaining -= len(block)
        cipher.verify(sealed.read(16))
        packed.seek(0)
        with zipfile.ZipFile(packed) as archive:
            for entry in archive.infolist():
                rel = PurePosixPath(entry.filename)
                if rel.is_absolute() or ".." in rel.parts or "\\" in entry.filename or ":" in entry.filename:
                    raise ValueError("Unsafe path in private configuration")
                if (entry.external_attr >> 16) & 0o170000 == 0o120000:
                    raise ValueError("Links are not allowed in private configuration")
                if not destination.joinpath(*rel.parts).resolve().is_relative_to(destination):
                    raise ValueError("Unsafe private configuration destination")
            destination.mkdir(parents=True)
            archive.extractall(destination)
    print("Private configuration authenticated and decrypted.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    enc = sub.add_parser("encrypt")
    enc.add_argument("--source", required=True)
    enc.add_argument("--output", required=True)
    enc.add_argument("--key-file", required=True)
    dec = sub.add_parser("decrypt")
    dec.add_argument("--input", required=True)
    dec.add_argument("--destination", required=True)
    dec.add_argument("--key-file", required=True)
    args = parser.parse_args()
    if args.command == "encrypt":
        encrypt(args.source, args.output, args.key_file)
    else:
        decrypt(args.input, args.destination, args.key_file)


if __name__ == "__main__":
    main()
