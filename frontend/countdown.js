// countdown.js

document.addEventListener("DOMContentLoaded", function () {
    const timerElement = document.getElementById("timer");

    // Получаем время окончания конкурса с сервера
    fetch('http://127.0.0.1:8000/contest_end_time')
        .then(response => response.json())
        .then(data => {
            const endTime = new Date(data.contest_end_time);

            function updateTimer() {
                const now = new Date();
                const timeRemaining = endTime - now;

                if (timeRemaining <= 0) {
                    timerElement.innerHTML = "Подсчитываем результаты";
                    clearInterval(timerInterval);
                    return;
                }

                const hours = String(Math.floor((timeRemaining / (1000 * 60 * 60)))).padStart(2, '0');
                const minutes = String(Math.floor((timeRemaining / (1000 * 60)) % 60)).padStart(2, '0');
                const seconds = String(Math.floor((timeRemaining / 1000) % 60)).padStart(2, '0');

                timerElement.innerHTML = `До завершения конкурса: ${hours}:${minutes}:${seconds}`;
            }

            const timerInterval = setInterval(updateTimer, 1000);
            updateTimer(); // Обновляем таймер сразу при загрузке
        })
        .catch(error => {
            console.error('Ошибка получения времени окончания конкурса:', error);
            timerElement.innerHTML = "Ошибка загрузки таймера";
        });
});
