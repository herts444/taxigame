# set_balance_zero.py

import sqlite3
import sys
import os

def set_balance_zero(telegram_id, db_path='taxigame.db'):
    """
    Устанавливает баланс пользователя с заданным telegram_id на 0.
    
    :param telegram_id: ID пользователя Telegram.
    :param db_path: Путь к файлу базы данных SQLite.
    """
    # Проверка существования базы данных
    if not os.path.exists(db_path):
        print(f"База данных по пути '{db_path}' не найдена.")
        sys.exit(1)
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Проверка существования пользователя
        cursor.execute("SELECT balance FROM users WHERE telegram_id = ?", (telegram_id,))
        user = cursor.fetchone()
        
        if user is None:
            print(f"Пользователь с telegram_id {telegram_id} не найден.")
            return
        
        current_balance = user[0]
        print(f"Текущий баланс пользователя {telegram_id}: {current_balance} USDT")
        
        # Установка баланса на 0
        cursor.execute("UPDATE users SET balance = 0 WHERE telegram_id = ?", (telegram_id,))
        conn.commit()
        
        print(f"Баланс пользователя {telegram_id} успешно установлен на 0 USDT.")
    
    except sqlite3.Error as e:
        print(f"Произошла ошибка при работе с базой данных: {e}")
    
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Использование: python set_balance_zero.py <telegram_id>")
        sys.exit(1)
    
    try:
        telegram_id = int(sys.argv[1])
    except ValueError:
        print("telegram_id должен быть целым числом.")
        sys.exit(1)
    
    set_balance_zero(telegram_id)
