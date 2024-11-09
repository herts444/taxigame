// purchase.js

// Функции для управления модальным окном покупки
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

// Функция для выполнения покупки автомобиля
async function purchaseCar(telegram_id, car_price, car_name) {
    try {
        // Проверяем баланс пользователя перед покупкой
        const balanceResponse = await fetch(`http://127.0.0.1:8000/balance/${telegram_id}`);
        const balanceData = await balanceResponse.json();

        if (balanceResponse.ok) {
            const userBalance = balanceData.balance;

            if (userBalance < car_price) {
                // Открываем модальное окно для пополнения счета
                alert("У вас недостаточно средств для покупки этого автомобиля. Пожалуйста, пополните счет.");
                openTopUpModal();
                return;
            }
        } else {
            alert("Не удалось получить баланс пользователя.");
            return;
        }

        // Продолжаем с покупкой, если баланс достаточен
        const response = await fetch(`http://127.0.0.1:8000/purchase_car`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "telegram_id": telegram_id,
                "car_price": car_price,
                "car_name": car_name
            })
        });

        const result = await response.json();

        if (response.ok) {
            alert("Покупка совершена успешно!");
            // Обновляем баланс через balance.js
            if (typeof updateBalance === "function") {
                updateBalance();
            }

            // Обновляем список купленных автомобилей
            if (typeof updateCarSelect === "function") {
                await updateCarSelect();
            }

            alert("Автомобиль добавлен в ваш гараж. Перейдите на главную страницу, чтобы увидеть его.");
        } else {
            alert(result.detail || "Произошла ошибка при покупке.");
        }
    } catch (error) {
        console.error("Ошибка:", error);
        alert("Ошибка соединения с сервером.");
    }
}

// Функция подтверждения покупки из модального окна
async function confirmPurchase() {
    const buyModal = document.getElementById('buyModal');
    const carName = buyModal.dataset.carName || "Новый автомобиль";
    const carPrice = parseFloat(buyModal.dataset.carPrice) || 1.0;

    const telegram_id = 123456; // Замените на реальный ID пользователя

    await purchaseCar(telegram_id, carPrice, carName);

    // Закрываем модальное окно
    closeBuyModal();
}

// Делать функции глобальными, если нужно вызывать из HTML
window.openBuyModal = openBuyModal;
window.closeBuyModal = closeBuyModal;
window.confirmPurchase = confirmPurchase;
window.purchaseCar = purchaseCar;
