# main.py

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from typing import List, Optional
import json
import sqlite3
from datetime import datetime, timedelta, timezone
import random
import requests
import os
from fastapi.staticfiles import StaticFiles

# Функция для создания подключения к базе данных
def create_connection():
    db_path = os.path.abspath('taxigame.db')  # Убедитесь, что путь к базе данных корректен
    conn = sqlite3.connect(db_path)
    return conn

# Загрузка данных из cars.json
with open('cars.json', 'r', encoding='utf-8') as f:
    car_specs = json.load(f)

# Функция для инициализации базы данных
def initialize_database():
    conn = create_connection()
    cursor = conn.cursor()
    
    # Создание таблиц, если они не существуют
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            telegram_id INTEGER PRIMARY KEY,
            telegram_name TEXT NOT NULL,
            balance REAL DEFAULT 0.0,
            referral_link TEXT,
            cars TEXT DEFAULT '[]'
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cars (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            order_count INTEGER DEFAULT 0,
            profit REAL DEFAULT 0.0,
            current_lat REAL,
            current_lng REAL,
            status TEXT DEFAULT 'waiting',
            route_coordinates TEXT,
            route_progress INTEGER DEFAULT 0,
            FOREIGN KEY (telegram_id) REFERENCES users (telegram_id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            car_id INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            message TEXT NOT NULL,
            FOREIGN KEY (car_id) REFERENCES cars (id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            message TEXT NOT NULL,
            FOREIGN KEY (telegram_id) REFERENCES users (telegram_id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS routes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            car_id INTEGER NOT NULL,
            start_latitude REAL NOT NULL,
            start_longitude REAL NOT NULL,
            end_latitude REAL NOT NULL,
            end_longitude REAL NOT NULL,
            route_coordinates TEXT NOT NULL,
            FOREIGN KEY (car_id) REFERENCES cars (id)
        )
    ''')
    
    conn.commit()
    conn.close()

# Функция для добавления логов пользователя
def add_user_log(telegram_id: int, message: str):
    conn = create_connection()
    cursor = conn.cursor()

    timestamp = datetime.now(timezone.utc).strftime('%d.%m.%Y | %H:%M')

    cursor.execute("INSERT INTO user_logs (telegram_id, timestamp, message) VALUES (?, ?, ?)", 
                   (telegram_id, timestamp, message))
    
    # Ограничиваем количество логов до 50, удаляя самые старые
    cursor.execute("""
        DELETE FROM user_logs 
        WHERE telegram_id = ? AND id NOT IN (
            SELECT id FROM user_logs WHERE telegram_id = ? ORDER BY id DESC LIMIT 50
        )
    """, (telegram_id, telegram_id))
    
    conn.commit()
    conn.close()

# Инициализация базы данных
initialize_database()

app = FastAPI()

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Разрешаем запросы с любых источников
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение статических файлов (изображения)
app.mount("/img", StaticFiles(directory="img"), name="img")

# Pydantic модели
class User(BaseModel):
    telegram_id: int
    telegram_name: str
    balance: float = 0.0
    referral_link: Optional[str] = None

class PurchaseCar(BaseModel):
    telegram_id: int
    car_price: float
    car_name: str

class ProfitData(BaseModel):
    telegram_id: int
    amount: float

class LogEntry(BaseModel):
    car_id: int
    message: str

class RouteData(BaseModel):
    car_id: int
    start_latitude: float
    start_longitude: float
    end_latitude: float
    end_longitude: float
    route_coordinates: List[List[float]]  # Список координат [[lat, lng], ...]

class CarPositionUpdate(BaseModel):
    car_id: int
    current_lat: float
    current_lng: float

class RouteRequest(BaseModel):
    start_lat: float
    start_lng: float
    end_lat: float
    end_lng: float

class TripCompletionData(BaseModel):
    car_id: int
    profit: float

class SellCar(BaseModel):
    telegram_id: int
    car_id: int

class CarStateUpdate(BaseModel):
    car_id: int
    status: str
    route_coordinates: Optional[List[List[float]]] = None
    route_progress: Optional[int] = None

# Инициализация времени окончания конкурса
contest_end_time = datetime.now(timezone.utc) + timedelta(hours=48)

# Функция для получения случайных координат в пределах города (пример для Лас-Вегаса)
def get_random_coordinates_in_city():
    # Пределы центральной части Лас-Вегаса
    lat_min = 36.0
    lat_max = 36.3
    lng_min = -115.3
    lng_max = -114.9

    latitude = random.uniform(lat_min, lat_max)
    longitude = random.uniform(lng_min, lng_max)
    return latitude, longitude

# Эндпоинт для получения времени окончания конкурса
@app.get("/contest_end_time")
async def get_contest_end_time():
    return {"contest_end_time": contest_end_time.isoformat()}

# Эндпоинт для получения всех характеристик автомобилей
@app.get("/car_info/all")
async def get_all_car_info():
    return car_specs

# Эндпоинт для получения характеристик автомобиля по его имени
@app.get("/car_info/{car_name}")
async def get_car_info(car_name: str):
    for car in car_specs:
        if car['name'] == car_name:
            return car
    raise HTTPException(status_code=404, detail="Car not found")

# Регистрация пользователя
@app.post("/register/")
async def register_user(user: User):
    conn = create_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO users (telegram_id, telegram_name, balance, referral_link, cars) 
            VALUES (?, ?, ?, ?, ?)
        ''', (user.telegram_id, user.telegram_name, user.balance, user.referral_link, json.dumps([])))
        conn.commit()
        # Добавляем лог регистрации пользователя
        add_user_log(user.telegram_id, f"Регистрация пользователя: {user.telegram_name}")
        return {"message": "User registered successfully"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="User already exists")
    finally:
        conn.close()

# Пополнение баланса
@app.post("/topup")
async def topup_balance(data: ProfitData):
    telegram_id = data.telegram_id
    amount = data.amount

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Сумма должна быть положительной.")

    conn = create_connection()
    cursor = conn.cursor()

    # Проверка, существует ли пользователь
    cursor.execute("SELECT balance FROM users WHERE telegram_id = ?", (telegram_id,))
    user = cursor.fetchone()

    if user is None:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    # Обновление баланса
    new_balance = round(user[0] + amount, 2)
    cursor.execute("UPDATE users SET balance = ? WHERE telegram_id = ?", (new_balance, telegram_id))
    conn.commit()
    conn.close()

    # Добавляем лог операции пополнения баланса
    add_user_log(telegram_id, f"Пополнение баланса: {amount} USDT")

    return {"new_balance": new_balance}

# Получение баланса
@app.get("/balance/{telegram_id}")
async def get_balance(telegram_id: int):
    conn = create_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT balance FROM users WHERE telegram_id = ?", (telegram_id,))
    user = cursor.fetchone()
    conn.close()
    if user:
        balance = round(user[0], 2)
        return {"balance": balance}
    else:
        raise HTTPException(status_code=404, detail="User not found")

# Покупка автомобиля
@app.post("/purchase_car")
async def purchase_car(purchase: PurchaseCar):
    telegram_id = purchase.telegram_id
    car_price = purchase.car_price
    car_name = purchase.car_name

    if car_price <= 0:
        raise HTTPException(status_code=400, detail="Цена автомобиля должна быть положительной.")

    conn = create_connection()
    cursor = conn.cursor()

    # Проверка баланса пользователя
    cursor.execute("SELECT balance, cars FROM users WHERE telegram_id = ?", (telegram_id,))
    user = cursor.fetchone()

    if user is None:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    balance = user[0]
    cars = json.loads(user[1]) if user[1] else []

    if balance < car_price:
        conn.close()
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # Обновляем баланс и добавляем автомобиль в список
    new_balance = round(balance - car_price, 2)
    cars.append(car_name)
    cursor.execute("UPDATE users SET balance = ?, cars = ? WHERE telegram_id = ?", 
                   (new_balance, json.dumps(cars), telegram_id))
    conn.commit()

    # Генерируем случайные начальные координаты
    current_lat, current_lng = get_random_coordinates_in_city()

    # Добавляем запись в таблицу cars с текущими координатами
    cursor.execute("""
        INSERT INTO cars (telegram_id, name, order_count, profit, current_lat, current_lng)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (telegram_id, car_name, 0, 0.0, current_lat, current_lng))
    conn.commit()

    # Получаем ID нового автомобиля
    car_id = cursor.lastrowid

    conn.close()

    # Добавляем лог операции покупки автомобиля
    add_user_log(telegram_id, f"Покупка автомобиля: {car_name}")

    return {"message": "Car purchased successfully", "new_balance": new_balance, "car_id": car_id}

# Получение списка автомобилей пользователя
@app.get("/user_cars/{telegram_id}")
async def get_user_cars(telegram_id: int):
    conn = create_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id, name, order_count, profit, current_lat, current_lng FROM cars WHERE telegram_id = ?", (telegram_id,))
    cars = cursor.fetchall()
    conn.close()

    if cars:
        cars_list = []
        for car in cars:
            cars_list.append({
                "id": car[0],
                "name": car[1],
                "order_count": car[2],
                "profit": round(car[3], 2),
                "current_lat": car[4],
                "current_lng": car[5]
            })
        return {"cars": cars_list}
    else:
        return {"cars": []}

# Вывод прибыли на баланс пользователя
@app.post("/withdraw_profit")
async def withdraw_profit(data: ProfitData):
    telegram_id = data.telegram_id
    amount = data.amount

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Сумма должна быть положительной.")

    conn = create_connection()
    cursor = conn.cursor()

    # Проверка существования пользователя и достаточности средств
    cursor.execute("SELECT balance FROM users WHERE telegram_id = ?", (telegram_id,))
    user = cursor.fetchone()

    if user is None:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    current_balance = user[0]
    if current_balance < amount:
        conn.close()
        raise HTTPException(status_code=400, detail="Недостаточно средств на балансе.")

    # Списание средств
    new_balance = round(current_balance - amount, 2)
    cursor.execute("UPDATE users SET balance = ? WHERE telegram_id = ?", (new_balance, telegram_id))

    # Обнуляем прибыль и количество заказов всех автомобилей пользователя
    cursor.execute("UPDATE cars SET profit = 0.0, order_count = 0 WHERE telegram_id = ?", (telegram_id,))
    conn.commit()
    conn.close()

    # Добавляем лог операции вывода средств
    add_user_log(telegram_id, f"Вывод средств: {amount} USDT")

    return {"success": True, "new_balance": new_balance}

# Добавление лога (для операций, связанных с автомобилями)
@app.post("/add_log")
async def add_log(log_entry: LogEntry):
    car_id = log_entry.car_id
    message = log_entry.message

    conn = create_connection()
    cursor = conn.cursor()

    # Проверка, существует ли автомобиль
    cursor.execute("SELECT id FROM cars WHERE id = ?", (car_id,))
    car = cursor.fetchone()

    if car is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Car not found")

    # Добавляем лог
    timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    cursor.execute("INSERT INTO logs (car_id, timestamp, message) VALUES (?, ?, ?)", 
                   (car_id, timestamp, message))
    
    # Ограничиваем количество логов до 50, удаляя самые старые
    cursor.execute("""
        DELETE FROM logs 
        WHERE car_id = ? AND id NOT IN (
            SELECT id FROM logs WHERE car_id = ? ORDER BY id DESC LIMIT 50
        )
    """, (car_id, car_id))
    
    conn.commit()
    conn.close()

    return {"message": "Log added successfully"}

# Получение логов автомобиля
@app.get("/logs/{car_id}")
async def get_logs(car_id: int):
    conn = create_connection()
    cursor = conn.cursor()

    # Проверка, существует ли автомобиль
    cursor.execute("SELECT id FROM cars WHERE id = ?", (car_id,))
    car = cursor.fetchone()

    if car is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Car not found")

    # Получаем последние 50 логов, отсортированные по времени в порядке убывания
    cursor.execute("""
        SELECT timestamp, message 
        FROM logs 
        WHERE car_id = ? 
        ORDER BY id DESC 
        LIMIT 50
    """, (car_id,))
    logs = cursor.fetchall()
    conn.close()

    # Переворачиваем логи, чтобы они были в порядке возрастания
    logs = logs[::-1]

    logs_list = []
    for log in logs:
        logs_list.append({
            "timestamp": log[0],
            "message": log[1]
        })

    return {"logs": logs_list}

# Получение логов пользователя
@app.get("/user_logs/{telegram_id}")
async def get_user_logs(telegram_id: int):
    conn = create_connection()
    cursor = conn.cursor()

    # Проверка, существует ли пользователь
    cursor.execute("SELECT telegram_id FROM users WHERE telegram_id = ?", (telegram_id,))
    user = cursor.fetchone()

    if user is None:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    # Получаем последние 50 логов пользователя, отсортированные по времени в порядке убывания
    cursor.execute("""
        SELECT timestamp, message 
        FROM user_logs 
        WHERE telegram_id = ? 
        ORDER BY id DESC 
        LIMIT 50
    """, (telegram_id,))
    logs = cursor.fetchall()
    conn.close()

    # Переворачиваем логи, чтобы они были в порядке возрастания
    logs = logs[::-1]

    logs_list = []
    for log in logs:
        logs_list.append({
            "timestamp": log[0],
            "message": log[1]
        })

    return {"logs": logs_list}

# Эндпоинт для обновления текущей позиции автомобиля
@app.post("/update_car_position")
async def update_car_position(position_update: CarPositionUpdate):
    car_id = position_update.car_id
    current_lat = position_update.current_lat
    current_lng = position_update.current_lng

    conn = create_connection()
    cursor = conn.cursor()

    # Проверка, существует ли автомобиль
    cursor.execute("SELECT id FROM cars WHERE id = ?", (car_id,))
    car = cursor.fetchone()

    if car is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Car not found")

    # Обновляем текущие координаты автомобиля
    cursor.execute("UPDATE cars SET current_lat = ?, current_lng = ? WHERE id = ?", (current_lat, current_lng, car_id))
    conn.commit()
    conn.close()

    return {"message": "Car position updated successfully"}

# Эндпоинт для получения маршрута
@app.post("/get_route")
async def get_route(route_request: RouteRequest):
    # Замените на ваш действительный API-ключ
    api_key = "YOUR_OPENROUTESERVICE_API_KEY"  # Вставьте ваш API-ключ здесь

    start_coords = f"{route_request.start_lng},{route_request.start_lat}"
    end_coords = f"{route_request.end_lng},{route_request.end_lat}"

    url = f"https://api.openrouteservice.org/v2/directions/driving-car?api_key={api_key}&start={start_coords}&end={end_coords}"

    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        return data
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при получении маршрута: {str(e)}")

# Эндпоинт для завершения поездки и обновления прибыли
@app.post("/complete_trip")
async def complete_trip(data: TripCompletionData):
    car_id = data.car_id
    profit = data.profit

    conn = create_connection()
    cursor = conn.cursor()

    # Проверка, существует ли автомобиль
    cursor.execute("SELECT profit, order_count, telegram_id FROM cars WHERE id = ?", (car_id,))
    car = cursor.fetchone()

    if car is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Car not found")

    current_profit = car[0]
    current_order_count = car[1]
    telegram_id = car[2]

    new_profit = round(current_profit + profit, 2)
    new_order_count = current_order_count + 1

    # Обновляем прибыль и количество заказов
    cursor.execute("UPDATE cars SET profit = ?, order_count = ? WHERE id = ?", (new_profit, new_order_count, car_id))

    # Добавляем лог о завершении поездки
    timestamp = datetime.now(timezone.utc).strftime('%d.%m.%Y | %H:%M')
    message = f"Завершена поездка с прибылью {profit} USDT."
    cursor.execute("INSERT INTO logs (car_id, timestamp, message) VALUES (?, ?, ?)", (car_id, timestamp, message))
    
    # Ограничиваем количество логов до 50, удаляя самые старые
    cursor.execute("""
        DELETE FROM logs 
        WHERE car_id = ? AND id NOT IN (
            SELECT id FROM logs WHERE car_id = ? ORDER BY id DESC LIMIT 50
        )
    """, (car_id, car_id))

    # Добавляем лог о прибыли в пользовательские логи
    add_user_log(telegram_id, f"Получена прибыль: {profit} USDT от поездки.")

    conn.commit()
    conn.close()

    return {"message": "Trip completed successfully", "new_profit": new_profit, "new_order_count": new_order_count}

# Эндпоинт для обновления состояния автомобиля
@app.post("/update_car_state")
async def update_car_state(state_update: CarStateUpdate):
    conn = create_connection()
    cursor = conn.cursor()

    # Проверка, существует ли автомобиль
    cursor.execute("SELECT id FROM cars WHERE id = ?", (state_update.car_id,))
    car = cursor.fetchone()

    if car is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Car not found")

    # Обновляем состояние автомобиля
    cursor.execute("""
        UPDATE cars SET
            status = ?,
            route_coordinates = ?,
            route_progress = ?
        WHERE id = ?
    """, (
        state_update.status,
        json.dumps(state_update.route_coordinates) if state_update.route_coordinates else None,
        state_update.route_progress,
        state_update.car_id
    ))
    conn.commit()
    conn.close()

    return {"message": "Car state updated successfully"}

@app.get("/available_cars")
async def get_available_cars():
    return car_specs

# Эндпоинт для получения данных пользователя, включая автомобили
@app.get("/user/{telegram_id}")
async def get_user(telegram_id: int):
    conn = create_connection()
    cursor = conn.cursor()

    # Получаем информацию о пользователе
    cursor.execute("SELECT telegram_id, telegram_name, balance, referral_link FROM users WHERE telegram_id = ?", (telegram_id,))
    user = cursor.fetchone()

    if user is None:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    user_dict = {
        "telegram_id": user[0],
        "telegram_name": user[1],
        "balance": round(user[2], 2),
        "referral_link": user[3],
    }

    # Получаем автомобили пользователя
    cursor.execute("SELECT id, name, order_count, profit, current_lat, current_lng FROM cars WHERE telegram_id = ?", (telegram_id,))
    cars = cursor.fetchall()
    conn.close()

    if cars:
        cars_list = []
        for car in cars:
            # Найти спецификацию автомобиля по имени
            car_spec = next((item for item in car_specs if item["name"] == car[1]), None)
            if car_spec:
                car_dict = {
                    "id": car[0],
                    "name": car[1],
                    "order_count": car[2],
                    "profit": round(car[3], 2),
                    "current_lat": car[4],
                    "current_lng": car[5],
                    "price": car_spec.get("price", 0.0),
                    "image": car_spec.get("image", "img/default_car.png"),
                    # Добавьте другие необходимые поля из car_specs
                }
                cars_list.append(car_dict)
            else:
                # Если спецификация не найдена, добавить без price и image
                car_dict = {
                    "id": car[0],
                    "name": car[1],
                    "order_count": car[2],
                    "profit": round(car[3], 2),
                    "current_lat": car[4],
                    "current_lng": car[5],
                    "price": 0.0,
                    "image": "img/default_car.png",
                }
                cars_list.append(car_dict)
        user_dict["cars"] = cars_list
    else:
        user_dict["cars"] = []

    return user_dict

# Эндпоинт для продажи автомобиля
@app.post("/sell_car")
async def sell_car(data: SellCar):
    telegram_id = data.telegram_id
    car_id = data.car_id

    conn = create_connection()
    cursor = conn.cursor()

    # Проверка, существует ли автомобиль и принадлежит ли он пользователю
    cursor.execute("SELECT name FROM cars WHERE id = ? AND telegram_id = ?", (car_id, telegram_id))
    car = cursor.fetchone()
    if car is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Car not found or does not belong to user")

    car_name = car[0]

    # Получаем спецификацию автомобиля из car_specs по имени
    car_spec = next((item for item in car_specs if item["name"] == car_name), None)
    if car_spec is None:
        conn.close()
        raise HTTPException(status_code=400, detail="Car specification not found")
    car_price = car_spec.get("price", 0.0)
    car_image = car_spec.get("image", "img/default_car.png")

    # Вычисляем цену продажи, например, 50% от исходной цены
    sell_price = round(car_price / 2, 2)

    # Удаляем автомобиль из таблицы cars
    cursor.execute("DELETE FROM cars WHERE id = ?", (car_id,))

    # Обновляем баланс пользователя
    cursor.execute("SELECT balance FROM users WHERE telegram_id = ?", (telegram_id,))
    user = cursor.fetchone()
    if user is None:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    new_balance = round(user[0] + sell_price, 2)
    cursor.execute("UPDATE users SET balance = ? WHERE telegram_id = ?", (new_balance, telegram_id))

    conn.commit()
    conn.close()

    # Добавляем лог операции продажи автомобиля
    add_user_log(telegram_id, f"Продажа автомобиля: {car_name}")

    return {"message": "Car sold successfully", "sell_price": sell_price, "new_balance": new_balance} 
