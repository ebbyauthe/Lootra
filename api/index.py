try:
    from server import app
except Exception as _e:
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    _err = {"error": str(_e), "type": type(_e).__name__}
    app = FastAPI()

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
    async def _catch(_path: str = ""):
        return JSONResponse(_err, status_code=500)
