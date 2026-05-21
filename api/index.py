import traceback

def _load_app():
    try:
        from _server import app
        return app
    except Exception as _e:
        _err = {"error": str(_e), "type": type(_e).__name__, "trace": traceback.format_exc()}
        try:
            from fastapi import FastAPI
            from fastapi.responses import JSONResponse
            _app = FastAPI()

            @_app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
            async def _catch(_path: str = ""):
                return JSONResponse(_err, status_code=500)

            return _app
        except Exception as _e2:
            _msg = f"outer: {_e}\ninner: {_e2}\n{traceback.format_exc()}".encode()

            async def _asgi(scope, receive, send):
                await send({"type": "http.response.start", "status": 500,
                            "headers": [[b"content-type", b"text/plain"]]})
                await send({"type": "http.response.body", "body": _msg})

            return _asgi

app = _load_app()
