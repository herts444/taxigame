// rating.js

document.addEventListener("DOMContentLoaded", function () {
    const otherRankingContainer = document.getElementById('otherRanking');
    const telegram_id = 123456; // Замените на реальный ID пользователя

    // Получаем список рейтинга с сервера
    fetch(`http://127.0.0.1:8000/rankings?telegram_id=${telegram_id}`)
        .then(response => response.json())
        .then(data => {
            const rankings = data.rankings; // Список игроков
            const userRank = data.user_rank; // Позиция текущего пользователя
            const userPoints = data.user_points; // Очки текущего пользователя

            // Отображаем топ-50 игроков
            const topPlayers = rankings.slice(0, 50);
            topPlayers.forEach((player, index) => {
                const rankRow = document.createElement('div');
                rankRow.className = 'rank-row';
                rankRow.innerHTML = `${index + 1}. ${player.name} <span>${player.points} pts</span>`;
                // Подсвечиваем пользователя, если он в топ-50
                if (player.telegram_id === telegram_id) {
                    rankRow.classList.add('highlighted');
                }
                otherRankingContainer.appendChild(rankRow);
            });

            // Если пользователь не в топ-50, добавляем его в конец списка
            if (userRank > 50) {
                const spacer = document.createElement('div');
                spacer.className = 'rank-spacer';
                spacer.innerHTML = '...';
                otherRankingContainer.appendChild(spacer);

                const userRankRow = document.createElement('div');
                userRankRow.className = 'rank-row highlighted fixed-bottom';
                userRankRow.innerHTML = `${userRank}. Вы <span>${userPoints} pts</span>`;
                otherRankingContainer.appendChild(userRankRow);
            }
        })
        .catch(error => {
            console.error('Ошибка получения рейтинга:', error);
            otherRankingContainer.innerHTML = '<p>Ошибка загрузки рейтинга</p>';
        });
});
