// autoshop.js

// Предполагается, что текущий пользовательский telegram_id доступен через глобальную переменную или другой механизм
const currentUserTelegramId = 123456; // Замените на реальный способ получения telegram_id

document.addEventListener("DOMContentLoaded", function () {
    fetchAvailableCars();
});

// Функция для получения списка доступных автомобилей для покупки
function fetchAvailableCars() {
    fetch('http://127.0.0.1:8000/available_cars')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(cars => {
            const carListElement = document.querySelector('.car-list');
            if (!carListElement) {
                console.error('Элемент с классом "car-list" не найден в DOM.');
                return;
            }

            // Очистка списка перед загрузкой
            carListElement.innerHTML = '';

            if (!Array.isArray(cars) || cars.length === 0) {
                carListElement.innerHTML = '<p>Автомобили не найдены.</p>';
                return;
            }

            cars.forEach(car => {
                const carItem = document.createElement('div');
                carItem.className = 'car-item';

                carItem.innerHTML = `
                    <img src="${car.image || 'img/default_car.png'}" class="car-image" alt="${car.name || 'Без названия'}" loading="lazy">
                    <div class="car-details">
                        <h3>${car.name || 'Без названия'}</h3>
                        <div class="car-advantages-container">
                            <div class="car-advantages">
                                <div class="badge">
                                    <img src="img/usdt.png" alt="USDT" class="usdt-badge">
                                    Доход ${car.daily_income || 0}$ в день
                                </div>
                                <div class="badge">
                                    <span class="stars">★</span> ${car.class || 'Неизвестно'}
                                </div>
                                <div class="badge">
                                    <span class="stars">𐓏</span> Окупаемость ${car.payback_period || 0} дней
                                </div>
                            </div>
                        </div>
                        <button class="buy-button" data-car-id="${car.id}" data-car-name="${car.name}" data-car-price="${car.price}">
                            <b>Купить за ${car.price || 0} USDT</b>
                            <img src="img/usdt.png" alt="USDT" class="usdt-buyButton">
                        </button>
                    </div>
                `;

                carListElement.appendChild(carItem);
            });

            // Добавляем обработчики событий для кнопок покупки
            const buyButtons = document.querySelectorAll('.buy-button');
            buyButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const carId = button.dataset.carId;
                    const carName = button.dataset.carName;
                    const carPrice = parseFloat(button.dataset.carPrice) || 1.0;

                    // Устанавливаем текст в модальном окне
                    const buyTextElement = document.getElementById('buyText');
                    if (buyTextElement) {
                        buyTextElement.textContent = `Вы хотите купить ${carName}?`;
                    } else {
                        console.error('Элемент с id "buyText" не найден.');
                    }

                    // Устанавливаем данные в модальное окно
                    const buyModal = document.getElementById('buyModal');
                    if (buyModal) {
                        buyModal.dataset.carId = carId;
                        buyModal.dataset.carName = carName;
                        buyModal.dataset.carPrice = carPrice;

                        // Открываем модальное окно
                        openBuyModal();
                    } else {
                        console.error('Элемент с id "buyModal" не найден.');
                    }
                });
            });
        })
        .catch(error => console.error('Ошибка загрузки доступных автомобилей:', error));
}

// Функции для управления модальными окнами покупки автомобиля

function openBuyModal() {
    const buyModal = document.getElementById("buyModal");
    if (buyModal) {
        buyModal.style.display = "block";
    }
}

function closeBuyModal() {
    const buyModal = document.getElementById("buyModal");
    if (buyModal) {
        buyModal.style.display = "none";
    }
}

async function confirmPurchase() {
    const buyModal = document.getElementById('buyModal');
    if (!buyModal) {
        console.error('Элемент с id "buyModal" не найден.');
        return;
    }

    const carId = buyModal.dataset.carId;
    const carName = buyModal.dataset.carName;
    const carPrice = parseFloat(buyModal.dataset.carPrice) || 0;

    try {
        const response = await fetch('http://127.0.0.1:8000/purchase_car', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                telegram_id: currentUserTelegramId,
                car_price: carPrice,
                car_name: carName
            })
        });

        const result = await response.json();

        if (response.ok) {
            alert("Покупка совершена успешно!");
            // Обновляем баланс и список автомобилей
            if (typeof updateBalance === 'function') {
                updateBalance();
            }
            fetchAvailableCars();
            // Также можно обновить список автомобилей в профиле, если нужно
        } else {
            alert(result.detail || "Произошла ошибка при покупке.");
        }
    } catch (error) {
        console.error("Ошибка:", error);
        alert("Ошибка соединения с сервером.");
    }

    // Закрываем модальное окно
    closeBuyModal();
}

// Функции для закрытия модального окна при клике вне его содержимого
window.onclick = function(event) {
    const buyModal = document.getElementById('buyModal');
    const topUpModal = document.getElementById('topUpModal');
    if (buyModal && event.target == buyModal) {
        buyModal.style.display = 'none';
    }
    if (topUpModal && event.target == topUpModal) {
        topUpModal.style.display = 'none';
    }
};

// Делать функции глобальными, если нужно вызывать из HTML
window.openBuyModal = openBuyModal;
window.closeBuyModal = closeBuyModal;
window.confirmPurchase = confirmPurchase;
