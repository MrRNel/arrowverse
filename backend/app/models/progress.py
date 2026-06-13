from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class WatchedEpisode(Base):
    __tablename__ = "watched_episodes"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    row_number: Mapped[int] = mapped_column("row_number", Integer, primary_key=True, quote=True)
    watched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    source: Mapped[str] = mapped_column(String(16), default="manual")
    status: Mapped[str] = mapped_column(String(16), default="watched")

    user = relationship("User", back_populates="watched_episodes")


class UserGamificationMeta(Base):
    __tablename__ = "user_gamification_meta"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    best_streak: Mapped[int] = mapped_column(Integer, default=0)
    seen_achievement_ids: Mapped[list] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user = relationship("User", back_populates="gamification_meta")
