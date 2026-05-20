import traceback

try:
    from _server import app
except Exception as _e:
    try:
        from fastapi import FastAPI
        from fastapi.responses import JSONResponse
        _err = {"error": str(_e), "type": type(_e).__name__, "trace": traceback.format_exc()}
        app = FastAPI()

        @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
        async def _catch(_path: str = ""):
            return JSONResponse(_err, status_code=500)
    except Exception as _e2:
        # fastapi itself is broken — use raw ASGI to surface the error
        _msg = f"outer: {_e}\ninner: {_e2}\n{traceback.format_exc()}".encode()

        async def app(scope, receive, send):
            await send({"type": "http.response.start", "status": 500,
                        "headers": [[b"content-type", b"text/plain"]]})
            await send({"type": "http.response.body", "body": _msg})
