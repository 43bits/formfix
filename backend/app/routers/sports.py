from fastapi import APIRouter
from ..services.sport_catalogue import list_sports, get_sport

router = APIRouter(prefix="/api/sports", tags=["sports"])

@router.get("/")
async def get_sports():
    return list_sports()

@router.get("/{sport_key}")
async def get_sport_detail(sport_key: str):
    spec = get_sport(sport_key)
    return {
        "key":   spec.key,
        "label": spec.label,
        "cues":  spec.cues,
        "joints": [
            {
                "name":       r.joint_name,
                "target_min": r.target_min,
                "target_max": r.target_max,
                "error_msg":  r.error_msg,
            }
            for r in spec.joint_rules
        ],
    }