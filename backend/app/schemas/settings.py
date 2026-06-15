from typing import Literal

from pydantic import BaseModel, Field

SeriesPlaybackSource = Literal['jellyfin', 'netflix']


class UserSettingsResponse(BaseModel):
    jellyfin_url: str
    jellyfin_hosts: list[str] = Field(default_factory=list)
    series_sources: dict[str, SeriesPlaybackSource] = Field(default_factory=dict)


class UserSettingsUpdateRequest(BaseModel):
    jellyfin_url: str | None = Field(default=None, max_length=512)
    jellyfin_hosts: list[str] | None = None
    series_sources: dict[str, SeriesPlaybackSource] | None = None
