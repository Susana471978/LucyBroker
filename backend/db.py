"""Conexion unica a MongoDB.

Vivia en server.py, pero los servicios que necesitan la base de datos no
pueden importarla de ahi sin crear un ciclo (server -> servicio -> server).
Aqui la comparten todos sin ese problema.
"""
from motor.motor_asyncio import AsyncIOMotorClient

from backend.config import settings

client = AsyncIOMotorClient(settings.mongo_url)
db = client[settings.db_name]
