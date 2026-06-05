from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/")
async def health_check():
    response = JSONResponse({"status": "ok"})
    response.headers["Cache-Control"] = "public, max-age=30"
    return response
