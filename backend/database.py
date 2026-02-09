# backend/database.py

from pymongo import MongoClient
from backend.config import settings


def get_client():
    return MongoClient(settings.mongo_url)


client = get_client()

db = client[settings.db_name]
