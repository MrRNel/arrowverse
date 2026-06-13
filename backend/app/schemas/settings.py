from typing import Literal

from pydantic import BaseModel, Field

SeriesPlaybackSource = Literal['jellyfin', 'netflix']


class UserSettingsResponse(BaseModel):
    jellyfin_url: str
    series_sources: dict[str, SeriesPlaybackSource] = Field(default_factory=dict)


class UserSettingsUpdateRequest(BaseModel):
    jellyfin_url: str | None = Field(default=None, max_length=512)
    series_sources: dict[str, SeriesPlaybackSource] | None = None
