"""Scoring service placeholder for future AI scoring logic."""


class ScoringService:
    def __init__(self):
        self.version = "0.1"

    def health(self) -> dict:
        return {"status": "ok", "version": self.version}