from __future__ import annotations

import os
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import certifi
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.errors import PyMongoError

load_dotenv()

try:
    import mongomock
except ImportError:  # pragma: no cover
    mongomock = None


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _mock_client() -> tuple[MongoClient, bool]:
    if mongomock is None:
        raise RuntimeError("mongomock is not installed but MongoDB fallback/mock mode was requested.")
    return mongomock.MongoClient(), True


def _standard_atlas_uri(srv_uri: str) -> str | None:
    hosts = os.getenv("MONGODB_STANDARD_HOSTS", "").strip()
    replica_set = os.getenv("MONGODB_REPLICA_SET", "").strip()
    if not hosts or not replica_set:
        return None

    parsed = urlsplit(srv_uri)
    credentials = ""
    if parsed.username is not None:
        credentials = parsed.username
        if parsed.password is not None:
            credentials += f":{parsed.password}"
        credentials += "@"

    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query.update(
        {
            "authSource": query.get("authSource", "admin"),
            "replicaSet": replica_set,
            "tls": "true",
        }
    )
    return urlunsplit(("mongodb", f"{credentials}{hosts}", parsed.path, urlencode(query), ""))


def _create_client() -> tuple[MongoClient, bool]:
    uri = os.getenv("MONGODB_URI", "").strip()
    use_mock = os.getenv("MONGODB_USE_MOCK", "false").lower() == "true"
    timeout_ms = int(os.getenv("MONGODB_TIMEOUT_MS", "15000"))

    if use_mock or uri.startswith("mongomock://") or not uri:
        return _mock_client()

    kwargs: dict = {}
    if uri.startswith("mongodb+srv://"):
        kwargs["tlsCAFile"] = certifi.where()
    connection_uris = [uri]
    standard_uri = _standard_atlas_uri(uri) if uri.startswith("mongodb+srv://") else None
    if standard_uri:
        connection_uris.append(standard_uri)

    last_error: PyMongoError | None = None
    client = None
    connected = False
    for connection_uri in connection_uris:
        connection_kwargs = dict(kwargs)
        if connection_uri.startswith("mongodb://"):
            connection_kwargs.pop("tlsCAFile", None)
            connection_kwargs["tlsCAFile"] = certifi.where()
        try:
            client = MongoClient(
                connection_uri,
                serverSelectionTimeoutMS=timeout_ms,
                connectTimeoutMS=timeout_ms,
                **connection_kwargs,
            )
            client.admin.command("ping")
            connected = True
            break
        except PyMongoError as exc:
            last_error = exc

    if not connected or client is None:
        exc = last_error or PyMongoError("Unknown MongoDB connection error")
        detail = str(exc).lower()
        if "dns" in detail or "resolution" in detail:
            reason = (
                "MongoDB Atlas DNS lookup failed. Configure MONGODB_STANDARD_HOSTS and "
                "MONGODB_REPLICA_SET to bypass SRV DNS."
            )
        elif "no replica set members" in detail or "server selection" in detail:
            reason = (
                "MongoDB Atlas is unreachable. In Atlas, add this computer's current IP "
                "under Security > Network Access and ensure the cluster is running."
            )
        elif "authentication failed" in detail:
            reason = "MongoDB authentication failed. Check the database username and password in MONGODB_URI."
        else:
            reason = "Check MONGODB_URI, Atlas database credentials, and Atlas Network Access."
        raise RuntimeError(
            f"MongoDB connection failed while MONGODB_USE_MOCK=false. {reason}"
        ) from exc
    return client, False


client, is_mock_client = _create_client()
database_name = os.getenv("MONGODB_DATABASE", "careerai")
db: Database = client[database_name]

users_collection: Collection = db["users"]
sessions_collection: Collection = db["sessions"]
bookmarks_collection: Collection = db["bookmarks"]
job_feed_collection: Collection = db["job_feeds"]


def init_db() -> None:
    users_collection.create_index("email", unique=True)
    sessions_collection.create_index("token", unique=True)
    sessions_collection.create_index("userId")
    bookmarks_collection.create_index([("userId", 1), ("job.id", 1)], unique=True)
    job_feed_collection.create_index("storedAt")

    if not is_mock_client:
        client.admin.command("ping")
