from datetime import datetime

from pydantic import BaseModel, Field


class EpisodePayload(BaseModel):
    row_number: int
    series: str
    episode_id: str
    episode_name: str
    air_date: str | None = None


class WatchedEpisodeRecord(BaseModel):
    row_number: int
    watched_at: datetime
    source: str


class ProgressResponse(BaseModel):
    watched_rows: list[int]
    watched: list[WatchedEpisodeRecord]


class ProgressUpdateRequest(BaseModel):
    watched: bool = True
    source: str = Field(default="manual", pattern=r"^(manual|extension)$")


class BulkProgressRequest(BaseModel):
    row_numbers: list[int]
    source: str = Field(default="extension", pattern=r"^(manual|extension)$")


class ProgressStatsResponse(BaseModel):
    watched: int
    outstanding: int
    total: int
    progress_percent: int
    up_next: EpisodePayload | None


class GamificationMetaResponse(BaseModel):
    best_streak: int
    seen_achievement_ids: list[str]


class GamificationMetaUpdateRequest(BaseModel):
    best_streak: int | None = None
    seen_achievement_ids: list[str] | None = None
