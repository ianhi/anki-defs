"""SSE (Server-Sent Events) helper for streaming responses."""

import json


def format_sse_event(event_type, data):
    """Format an SSE event as a dict with type/data, then serialize."""
    payload = json.dumps({"type": event_type, "data": data})
    return "data: {}\n\n".format(payload)


def send_sse(sock, event_type, data):
    """Send an SSE event to a raw socket. Returns False if send failed."""
    msg = format_sse_event(event_type, data)
    try:
        sock.sendall(msg.encode("utf-8"))
        return True
    except OSError:
        return False
