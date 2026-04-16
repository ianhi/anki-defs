"""Minimal type stubs for Bottle — covers the API surface we actually use."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

class Request:
    json: dict[str, Any] | None
    method: str
    path: str
    remote_addr: str | None
    query: FormsDict
    url: str
    def get_header(self, name: str, default: str = ...) -> str: ...

class FormsDict:
    def get(self, key: str, default: str | None = ...) -> str | None: ...
    def __getattr__(self, key: str) -> str: ...

class Response:
    status: int | str
    content_type: str
    def set_header(self, name: str, value: str) -> None: ...
    def add_header(self, name: str, value: str) -> None: ...

class HTTPResponse(Exception):
    status_code: int
    def __init__(
        self,
        body: str = ...,
        status: int = ...,
        headers: dict[str, str] | None = ...,
        Content_Type: str = ...,
        **kwargs: Any,
    ) -> None: ...

class Bottle:
    def __call__(self, environ: dict[str, Any], start_response: Any) -> Any: ...
    def route(
        self, path: str, method: str = ..., **kwargs: Any
    ) -> Callable[..., Any]: ...
    def get(self, path: str, **kwargs: Any) -> Callable[..., Any]: ...
    def post(self, path: str, **kwargs: Any) -> Callable[..., Any]: ...
    def put(self, path: str, **kwargs: Any) -> Callable[..., Any]: ...
    def delete(self, path: str, **kwargs: Any) -> Callable[..., Any]: ...
    def hook(self, name: str) -> Callable[..., Any]: ...
    def error(self, code: int) -> Callable[..., Any]: ...
    def run(self, server: Any = ..., **kwargs: Any) -> None: ...

class BaseRequest:
    MEMFILE_MAX: int

class ServerAdapter:
    host: str
    port: int
    def __init__(self, host: str = ..., port: int = ..., **kwargs: Any) -> None: ...
    def run(self, handler: Any) -> None: ...

def static_file(
    filename: str,
    root: str,
    mimetype: str | None = ...,
    download: bool | str = ...,
    charset: str = ...,
) -> HTTPResponse: ...

request: Request
response: Response
