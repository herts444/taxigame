// balance.js

// Функция для обновления баланса
async function updateBalance() {
    const telegram_id = 123456; // Замените на реальный ID пользователя
    try {
        const response = await fetch(`http://127.0.0.1:8000/balance/${telegram_id}`);
        const data = await response.json();

        if (response.ok) {
            const balanceElement = document.getElementById("balance");
            if (balanceElement) {
                const formattedBalance = parseFloat(data.balance).toFixed(2);
                balanceElement.textContent = `${formattedBalance} USDT`;
            } else {
                console.error("Баланс элемент не найден.");
            }
        } else {
            console.error(`Ошибка при получении баланса: ${data.detail || "Unknown error"}`);
        }
    } catch (error) {
        console.error("Ошибка при обновлении баланса:", error);
    }
}
