from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

EpisodeStatus = Literal['unwatched', 'partial', 'watched']
WatchSource = Literal['manual', 'jellyfin', 'netflix', 'extension']


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
    play_item_id: str | None = None
    status: EpisodeStatus = 'watched'


class ProgressResponse(BaseModel):
    watched_rows: list[int]
    partial_rows: list[int]
    watched: list[WatchedEpisodeRecord]


class ProgressUpdateRequest(BaseModel):
    status: EpisodeStatus | None = None
    watched: bool | None = None
    source: WatchSource = Field(default='manual')
    play_item_id: str | None = Field(default=None, max_length=64)

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
    source: WatchSource = Field(default='extension')
    play_item_id: str | None = Field(default=None, max_length=64)


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
