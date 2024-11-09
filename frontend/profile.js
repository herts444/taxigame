// profile.js

const currentUserTelegramId = 123456; // Замените на реальный способ получения telegram_id

// Функция для загрузки автомобилей пользователя
// Функция для загрузки автомобилей пользователя
function loadUserCars() {
    fetch(`http://127.0.0.1:8000/user/${currentUserTelegramId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(userData => {
            console.log('Данные пользователя:', userData);
            const carsListElement = document.querySelector('.cars-list');
            if (!carsListElement) {
                console.error('Элемент с классом "cars-list" не найден в DOM.');
                return;
            }

            // Обновление информации в секции profile-info
            document.querySelector('.earnings').textContent = `${userData.balance.toFixed(2)} USDT`;
            document.querySelector('.cars-count').textContent = userData.cars.length;
            
            // Подсчет общего количества поездок
            let totalTrips = 0;
            userData.cars.forEach(car => {
                totalTrips += car.order_count;
            });
            document.querySelector('.trips-count').textContent = totalTrips;

            // Очистка списка перед загрузкой
            carsListElement.innerHTML = '';

            const userCars = userData.cars;

            if (!Array.isArray(userCars) || userCars.length === 0) {
                carsListElement.innerHTML = '<p>У вас нет автомобилей.</p>';
                return;
            }

            userCars.forEach(car => {
                const carItem = document.createElement('div');
                carItem.className = 'car-item';

                // Подгружаем изображение автомобиля или заглушку, если изображения нет
                carItem.innerHTML = `
                    <div style="display: flex; align-items: center;">
                        <img src="${car.image ? `http://127.0.0.1:8000/${car.image}` : 'http://127.0.0.1:8000/img/default_car.png'}" class="car-image" alt="${car.name}" style="height: 70px; width: 70px; object-fit: cover; margin-right: 15px;">
                        <div style="flex-grow: 1;">
                            <h3 style="font-weight: bold;">${car.name || 'Без названия'}</h3>
                            <button class="info-button" data-car-id="${car.id}" data-car-price="${car.price || 0}">Управлять</button>
                        </div>
                    </div>
                `;

                carsListElement.appendChild(carItem);
            });

            // Добавляем обработчики событий для кнопок "Посмотреть информацию"
            const infoButtons = document.querySelectorAll('.info-button');
            infoButtons.forEach(button => {
                button.addEventListener('click', event => {
                    console.log('Нажата кнопка "Посмотреть информацию" для автомобиля ID:', button.dataset.carId);
                    const carId = button.dataset.carId;
                    const carPrice = button.dataset.carPrice;
                    const car = userCars.find(c => c.id == carId);  // Находим объект автомобиля по его ID

                    if (car) {
                        showCarInfoModal(car);
                    } else {
                        console.error('Автомобиль не найден');
                    }
                });
            });

            // Загрузка логов пользователя после загрузки автомобилей
            loadUserLogs();
        })
        .catch(error => console.error('Ошибка загрузки автомобилей пользователя:', error));
}


// Функция для загрузки логов пользователя
function loadUserLogs() {
    fetch(`http://127.0.0.1:8000/user_logs/${currentUserTelegramId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Логи пользователя:', data);
            const recentActivityList = document.querySelector('.recent-activity .activity-list');
            if (!recentActivityList) {
                console.error('Элемент с классом "activity-list" не найден в DOM.');
                return;
            }

            // Очистка списка перед загрузкой
            recentActivityList.innerHTML = '';

            if (!Array.isArray(data.logs) || data.logs.length === 0) {
                recentActivityList.innerHTML = '<li>Нет последних операций.</li>';
                return;
            }

            // Добавляем новые логи сверху
            // В функции loadUserLogs()

            data.logs.forEach(log => {
                const logItem = document.createElement('li');

                // Определяем тип лога для добавления соответствующего класса
                let logTypeClass = '';
                if (log.message.includes('Пополнение баланса')) {
                    logTypeClass = 'log-deposit';
                } else if (log.message.includes('Вывод средств')) {
                    logTypeClass = 'log-withdraw';
                } else if (log.message.includes('Покупка автомобиля')) {
                    logTypeClass = 'log-purchase';
                } else if (log.message.includes('Продажа автомобиля')) {
                    logTypeClass = 'log-sell';
                }

                logItem.classList.add(logTypeClass);

                // Создаем контейнеры для даты/времени и сообщения
                const timestampDiv = document.createElement('div');
                timestampDiv.className = 'log-timestamp';
                timestampDiv.textContent = log.timestamp;

                const messageDiv = document.createElement('div');
                messageDiv.className = 'log-message';
                messageDiv.textContent = log.message;

                // Добавляем их в список
                logItem.appendChild(timestampDiv);
                logItem.appendChild(messageDiv);

                // Вставляем лог в начало списка
                recentActivityList.insertBefore(logItem, recentActivityList.firstChild);
            });

        })
        .catch(error => console.error('Ошибка загрузки логов пользователя:', error));
}

// Функция для отображения модального окна с информацией об автомобиле
function showCarInfoModal(car) {
    console.log('Показать информацию об автомобиле:', car);
    const carInfoModal = document.getElementById('carInfoModal');
    const carInfoContent = document.getElementById('carInfoContent');
    
    if (!carInfoModal || !carInfoContent) {
        console.error('Модальное окно для информации об автомобиле не найдено в DOM.');
        return;
    }

    // Форматируем информацию об автомобиле, корректно рассчитывая цену продажи
    const sellPrice = car.price ? (car.price / 2).toFixed(2) : "0.00";

    carInfoContent.innerHTML = `
        <span class="close-button" onclick="closeCarInfoModal()">&#10006;</span>
        <h2>${car.name}</h2>
        <img src="${car.image ? `http://127.0.0.1:8000/${car.image}` : 'http://127.0.0.1:8000/img/default_car.png'}" alt="${car.name}" style="width: 100%; height: auto; border-radius: 10px; margin-bottom: 15px;">
        <p><strong>Количество поездок:</strong> ${car.order_count}</p>
        <p><strong>Общий доход:</strong> ${car.profit.toFixed(2)} USDT</p>
        <p><strong>Цена продажи:</strong> ${sellPrice} USDT</p>
        <button id="sellCarButton" data-car-id="${car.id}" data-car-name="${car.name}" data-car-price="${sellPrice}">Продать автомобиль за ${sellPrice} USDT</button>
    `;

    console.log('Содержимое модального окна обновлено.');

    // Показать модальное окно
    carInfoModal.style.display = 'block';
    console.log('Модальное окно отображено.');

    // Добавляем обработчик для кнопки продажи автомобиля
    const sellCarButton = document.getElementById('sellCarButton');
    if (sellCarButton) {
        console.log('Кнопка продажи автомобиля найдена.');
        sellCarButton.addEventListener('click', () => {
            console.log('Начало продажи автомобиля ID:', car.id);
            sellCar(car.id, sellPrice);
        });
    } else {
        console.error('Кнопка продажи автомобиля не найдена.');
    }
}

// Функция для продажи автомобиля
function sellCar(carId, sellPrice) {
    console.log('Запрос на продажу автомобиля ID:', carId, 'за', sellPrice, 'USDT');
    fetch('http://127.0.0.1:8000/sell_car', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            telegram_id: currentUserTelegramId,
            car_id: carId
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.detail || 'Произошла ошибка при продаже автомобиля.');
            });
        }
        return response.json();
    })
    .then(result => {
        alert(`Автомобиль успешно продан за ${sellPrice} USDT!`);
        console.log('Автомобиль продан, обновляем список автомобилей.');
        closeCarInfoModal();
        loadUserCars();  // Обновляем список автомобилей после продажи
    })
    .catch(error => {
        console.error('Ошибка при продаже автомобиля:', error);
        alert(error.message);
    });
}

// Функция для закрытия модального окна с информацией об автомобиле
function closeCarInfoModal() {
    console.log('Закрыть модальное окно информации об автомобиле');
    const carInfoModal = document.getElementById('carInfoModal');
    if (carInfoModal) {
        carInfoModal.style.display = 'none';
    }
}

// Делать функции глобальными, если нужно вызывать из HTML
window.closeCarInfoModal = closeCarInfoModal;

// Событие для закрытия модального окна при клике вне его содержимого
window.onclick = function(event) {
    const carInfoModal = document.getElementById('carInfoModal');
    const copyModal = document.getElementById('copyModal');
    const sellModal = document.getElementById('sellModal');

    if (carInfoModal && event.target == carInfoModal) {
        carInfoModal.style.display = 'none';
    }
    if (copyModal && event.target == copyModal) {
        copyModal.style.display = 'none';
    }
    if (sellModal && event.target == sellModal) {
        sellModal.style.display = 'none';
    }
};

// Запуск инициализации страницы
document.addEventListener("DOMContentLoaded", initializePage);  

// Обновление страницы и загрузка логов
function initializePage() {
    console.log("Инициализация страницы");
    loadUserCars();
}
