"""Declarative metadata shared by all production database models."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for every Dinner, Dice & Dragons ORM model."""

    pass
