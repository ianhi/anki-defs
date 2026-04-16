"""SSE (Server-Sent Events) helper for streaming responses."""

import json


def format_sse_event(event_type, data):
    """Format an SSE event as a string ready to yield from a Bottle generator."""
    payload = json.dumps({"type": event_type, "data": data})
    return "data: {}\n\n".format(payload)
