from typing import Optional, List
from pydantic import BaseModel

class User(BaseModel):
    telegram_id: int
    telegram_name: str
    balance: float = 0.0
    referral_link: str
    cars: Optional[List[str]] = None  # Здесь указываем, что это может быть список строк или None

class PurchaseCar(BaseModel):
    telegram_id: int
    car_price: float
    car_name: str
