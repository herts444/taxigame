// orders.js

// Объект для хранения маршрутов или других данных, связанных с заказами
const orders = {};

// Пример функции, вызываемой при изменении маршрута автомобиля
window.changeCarRoute = function() {
    // Получение выбранного автомобиля
    const carSelect = document.getElementById("carSelect");
    if (!carSelect) {
        console.warn("Элемент carSelect не найден на странице.");
        return;
    }
    const selectedCarId = carSelect.value;

    if (selectedCarId === "") {
        // Если выбрана опция "Выберите автомобиль"
        return;
    }

    // Получение карты для выбранного автомобиля
    const mapId = `map${selectedCarId}`;
    const map = maps[mapId];
    if (!map) {
        console.error(`Карта для автомобиля с id "${selectedCarId}" не инициализирована.`);
        return;
    }

    // Создание нового маршрута
    createRouteForCar(map, selectedCarId);
};
