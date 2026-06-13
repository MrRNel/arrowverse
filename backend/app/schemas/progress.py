from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

EpisodeStatus = Literal['unwatched', 'partial', 'watched']


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
    status: EpisodeStatus = 'watched'


class ProgressResponse(BaseModel):
    watched_rows: list[int]
    partial_rows: list[int]
    watched: list[WatchedEpisodeRecord]


class ProgressUpdateRequest(BaseModel):
    status: EpisodeStatus | None = None
    watched: bool | None = None
    source: str = Field(default='manual', pattern=r'^(manual|extension)$')

    @model_validator(mode='after')
    def resolve_status(self) -> 'ProgressUpdateRequest':
        if self.status is not None:
            return self
        if self.watched is not None:
            self.status = 'watched' if self.watched else 'unwatched'
        else:
            self.status = 'watched'
        return self


class BulkProgressRequest(BaseModel):
    row_numbers: list[int]
    source: str = Field(default='extension', pattern=r'^(manual|extension)$')


class ProgressStatsResponse(BaseModel):
    watched: int
    partial: int
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
