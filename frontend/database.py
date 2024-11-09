# database.py

import sqlite3
import os

def create_connection():
    db_path = os.path.abspath('taxigame.db')
    conn = sqlite3.connect(db_path)
    return conn

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
