// topup.js

// Функции для управления модальным окном пополнения счета
function openTopUpModal() {
    const topUpModal = document.getElementById("topUpModal");
    if (topUpModal) {
        topUpModal.style.display = "block";
    }
}

function closeTopUpModal() {
    const topUpModal = document.getElementById("topUpModal");
    if (topUpModal) {
        topUpModal.style.display = "none";
    }
}

// Функция для подтверждения пополнения счета
async function confirmTopUp() {
    const topUpAmountInput = document.getElementById("topUpAmount");
    const amount = parseFloat(topUpAmountInput.value);

    if (isNaN(amount) || amount <= 0) {
        alert("Пожалуйста, введите корректную сумму для пополнения.");
        return;
    }

    const telegram_id = 123456; // Замените на реальный ID пользователя

    try {
        const response = await fetch(`http://127.0.0.1:8000/topup`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "telegram_id": telegram_id,
                "amount": amount
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert(`Счет успешно пополнен на ${amount.toFixed(2)} USDT.`);
            // Обновляем баланс
            if (typeof updateBalance === "function") {
                updateBalance();
            }
            // Закрываем модальное окно
            closeTopUpModal();
            // Очистка поля ввода
            topUpAmountInput.value = '';
        } else {
            alert(data.detail || "Произошла ошибка при пополнении счета.");
        }
    } catch (error) {
        console.error("Ошибка при пополнении счета:", error);
        alert("Ошибка соединения с сервером.");
    }
}

// Делаем функции глобальными, если необходимо
window.openTopUpModal = openTopUpModal;
window.closeTopUpModal = closeTopUpModal;
window.confirmTopUp = confirmTopUp;
