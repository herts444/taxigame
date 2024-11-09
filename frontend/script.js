// script.js

const carData = {};
const maps = {};
let carSpecs = []; // Данные из cars.json

// Функция для получения данных из cars.json
async function loadCarSpecs() {
    try {
        const response = await fetch('http://127.0.0.1:8000/car_info/all');
        carSpecs = await response.json();
        console.log("Характеристики автомобилей успешно загружены:", carSpecs);
    } catch (error) {
        console.error("Ошибка при загрузке характеристик автомобилей:", error);
    }
}


// Функция для получения характеристик конкретного автомобиля
function getCarSpecsByName(carName) {
    return carSpecs.find(car => car.name === carName);
}

// Функция для получения случайных координат в городе
function getRandomCoordinatesInCity() {
    const latMin = 36.0;
    const latMax = 36.3;
    const lngMin = -115.3;
    const lngMax = -114.9;

    const latitude = Math.random() * (latMax - latMin) + latMin;
    const longitude = Math.random() * (lngMax - lngMin) + lngMin;
    return L.latLng(latitude, longitude);
}

// Инициализация карты
function initializeMap(mapId) {
    console.log(`Создание карты с ID: ${mapId}`);
    const map = L.map(mapId, {
        zoomControl: false,
        dragging: false,
        attributionControl: false // Убираем атрибуцию Leaflet
    }).setView([36.1699, -115.1398], 13); // Лас-Вегас
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        // Убираем атрибуцию OpenStreetMap
        // attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    maps[mapId] = map;
    console.log(`Карта ${mapId} успешно инициализирована`);
}

// Обновление списка автомобилей
async function updateCarSelect() {
    await loadCarSpecs(); // Загружаем характеристики автомобилей

    const carSelect = document.getElementById("carSelect");
    carSelect.innerHTML = "";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Выберите автомобиль";
    carSelect.appendChild(defaultOption);

    const telegram_id = 123456; // Замените на реальный ID пользователя

    try {
        const response = await fetch(`http://127.0.0.1:8000/user_cars/${telegram_id}`);
        const data = await response.json();

        if (data.cars && data.cars.length > 0) {
            data.cars.forEach(car => {
                console.log(`Полученные данные автомобиля:`, car);

                if (!car.name) {
                    console.error(`Автомобиль ${car.id} имеет некорректное имя: ${car.name}`);
                    return;
                }

                let currentPosition;
                if (typeof car.current_lat === 'number' && typeof car.current_lng === 'number') {
                    currentPosition = L.latLng(car.current_lat, car.current_lng);
                    console.log(`Установлена позиция для автомобиля ${car.id}:`, currentPosition);
                } else {
                    console.warn(`Автомобиль ${car.id} имеет некорректные координаты. Устанавливаем случайные координаты внутри города.`);
                    currentPosition = getRandomCoordinatesInCity();
                    console.log(`Случайная позиция для автомобиля ${car.id}:`, currentPosition);
                }

                const option = document.createElement("option");
                option.value = car.id;
                option.textContent = car.name;
                carSelect.appendChild(option);

                const carSpecsData = getCarSpecsByName(car.name);

                if (!carData[car.id]) {
                    carData[car.id] = {
                        id: car.id,
                        name: car.name,
                        orderCount: car.order_count,
                        profit: car.profit,
                        currentPosition: currentPosition,
                        marker: null,
                        routePolyline: null,
                        progressPolyline: null,
                        routeCoordinates: null,
                        animationFrame: null,
                        animationState: null,
                        lastEndPosition: null,
                        delayTimeout: null,
                        endMarker: null,
                        logs: [],
                        status: 'waiting',
                        routeProgress: 0,
                        specs: carSpecsData
                    };
                    console.log(`Данные автомобиля ${car.id} инициализированы.`);
                } else {
                    // Обновляем только необходимые поля, не перезаписывая currentPosition
                    carData[car.id].orderCount = car.order_count;
                    carData[car.id].profit = car.profit;
                    carData[car.id].specs = carSpecsData;
                    console.log(`Данные автомобиля ${car.id} уже существуют. currentPosition не изменяется.`);
                }
            });
        } else {
            console.log("У пользователя нет приобретённых автомобилей.");
        }
    } catch (error) {
        console.error("Ошибка при получении списка автомобилей:", error);
    }
}

// Функция для обработки изменения выбора автомобиля
function handleCarSelectChange() {
    const carSelect = document.getElementById("carSelect");
    const selectedCarId = carSelect.value;

    // Скрываем все карты
    Object.keys(maps).forEach(mapId => {
        const mapDiv = document.getElementById(mapId);
        if (mapDiv) {
            console.log(`Скрытие карты с ID: ${mapId}`);
            mapDiv.classList.add('hidden');
        }
    });

    if (selectedCarId === "") {
        // Скрываем блок информации
        document.getElementById("infoContainer").style.display = 'none';
        // Показываем статичную карту
        showStaticMap();

        // Показать сообщение по умолчанию в логах
        showDefaultLogMessage();
    } else {
        // Скрываем статичную карту
        hideStaticMap();

        const mapId = `map${selectedCarId}`;
        const mapDiv = document.getElementById(mapId);
        if (mapDiv) {
            console.log(`Показ карты для автомобиля: ${selectedCarId}`);
            mapDiv.classList.remove('hidden');
            maps[mapId].invalidateSize();

            const car = carData[selectedCarId];

            // Добавляем элементы автомобиля на карту
            addCarElementsToMap(car, maps[mapId]);

            // Центрируем карту на маршруте
            fitMapToRoute(car, maps[mapId]);
            console.log(`Карта ${mapId} центрирована на маршруте автомобиля ${selectedCarId}`);

            // Получаем и отображаем логи
            updateLogDisplay(selectedCarId);

            // Обновляем отображение прибыли и заказов
            updateInfoDisplay(selectedCarId);
            document.getElementById("infoContainer").style.display = 'block';
        }
    }
}

// Функция для добавления элементов автомобиля на карту
function addCarElementsToMap(car, map) {
    console.log(`Добавление элементов автомобиля ${car.id} на карту. currentPosition:`, car.currentPosition);

    // Проверяем, что currentPosition валидна
    if (!car.currentPosition || typeof car.currentPosition.lat !== 'number' || typeof car.currentPosition.lng !== 'number') {
        console.error(`Неверные координаты для автомобиля ${car.id}:`, car.currentPosition);
        return;
    }

    // Добавляем маркер автомобиля
    if (!car.marker) {
        const carIcon = L.icon({
            iconUrl: 'img/car.png',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
        });
        car.marker = L.marker(car.currentPosition, { icon: carIcon }).addTo(map);
        console.log(`Маркер для автомобиля ${car.id} добавлен на карту.`);
    } else if (!map.hasLayer(car.marker)) {
        car.marker.addTo(map);
        console.log(`Маркер для автомобиля ${car.id} добавлен на карту.`);
    }

    // Добавляем полилинии маршрута
    if (car.routePolyline && !map.hasLayer(car.routePolyline)) {
        car.routePolyline.addTo(map);
        console.log(`Полилиния маршрута для автомобиля ${car.id} добавлена на карту.`);
    }
    if (car.progressPolyline && !map.hasLayer(car.progressPolyline)) {
        car.progressPolyline.addTo(map);
        console.log(`Полилиния пройденной части маршрута для автомобиля ${car.id} добавлена на карту.`);
    }

    // Добавляем флажок конечной точки
    if (car.endMarker && !map.hasLayer(car.endMarker)) {
        car.endMarker.addTo(map);
        console.log(`Флажок конечной точки для автомобиля ${car.id} добавлен на карту.`);
    }
}

// Функция инициализации страницы
async function initializePage() {
    console.log("Инициализация страницы");
    await updateCarSelect();

    const carSelect = document.getElementById("carSelect");
    carSelect.addEventListener("change", handleCarSelectChange);

    // Изначально скрываем блок информации
    document.getElementById("infoContainer").style.display = 'none';

    // Показываем статичную карту при загрузке страницы
    showStaticMap();

    // Показываем сообщение по умолчанию в логах
    showDefaultLogMessage();

    const telegram_id = 123456; // Замените на реальный ID пользователя
    try {
        const response = await fetch(`http://127.0.0.1:8000/user_cars/${telegram_id}`);
        const data = await response.json();

        if (data.cars && data.cars.length > 0) {
            for (const car of data.cars) {
                const carId = car.id;
                const carName = car.name;
                const mapId = `map${carId}`;
                let mapDiv = document.getElementById(mapId);

                if (!mapDiv) {
                    mapDiv = document.createElement('div');
                    mapDiv.id = mapId;
                    mapDiv.classList.add('map', 'hidden');
                    document.getElementById("mapContainer").appendChild(mapDiv);
                    initializeMap(mapId);
                }

                const map = maps[mapId];
                const carDataEntry = carData[carId];

                if (!carDataEntry.currentPosition || typeof carDataEntry.currentPosition.lat !== 'number' || typeof carDataEntry.currentPosition.lng !== 'number') {
                    console.warn(`currentPosition для автомобиля ${carId} не определена или некорректна. Устанавливаем случайные координаты.`);
                    carDataEntry.currentPosition = getRandomCoordinatesInCity();
                }

                if (!carDataEntry.marker) {
                    const carIcon = L.icon({
                        iconUrl: 'img/car.png',
                        iconSize: [32, 32],
                        iconAnchor: [16, 16],
                    });

                    const startCoords = carDataEntry.currentPosition;
                    if (!startCoords || typeof startCoords.lat !== 'number' || typeof startCoords.lng !== 'number') {
                        console.error(`Неверные координаты для автомобиля ${carId}:`, startCoords);
                        return;
                    }

                    carDataEntry.marker = L.marker(startCoords, { icon: carIcon }).addTo(map);
                    console.log(`Маркер для автомобиля ${carId} инициализирован.`);

                    // Загружаем логи с сервера
                    try {
                        const logsResponse = await fetch(`http://127.0.0.1:8000/logs/${carId}`);
                        const logsData = await logsResponse.json();
                        // Извлекаем только время из метки времени
                        carDataEntry.logs = logsData.logs.map(log => {
                            const timestamp = log.timestamp.slice(-8); // Получаем последние 8 символов HH:MM:SS
                            return `[${timestamp}] ${log.message}`;
                        });
                    } catch (error) {
                        console.error(`Ошибка при получении логов для автомобиля ${carId}:`, error);
                        carDataEntry.logs = [];
                    }

                    // Загружаем состояние автомобиля с сервера
                    try {
                        const stateResponse = await fetch(`http://127.0.0.1:8000/car_state/${carId}`);
                        const stateData = await stateResponse.json();

                        carDataEntry.status = stateData.status;

                        if (stateData.status === 'on_trip' && stateData.route_coordinates) {
                            carDataEntry.routeCoordinates = stateData.route_coordinates;
                            carDataEntry.routeProgress = stateData.route_progress || 0;
                            carDataEntry.endPosition = L.latLng(
                                stateData.route_coordinates[stateData.route_coordinates.length - 1][0],
                                stateData.route_coordinates[stateData.route_coordinates.length - 1][1]
                            );

                            // Восстанавливаем маршрут на карте
                            carDataEntry.routePolyline = L.polyline(carDataEntry.routeCoordinates, { color: 'blue' }).addTo(map);

                            // Восстанавливаем маркер конечной точки
                            carDataEntry.endMarker = L.marker(carDataEntry.endPosition, { icon: L.icon({ iconUrl: 'img/flag.png', iconSize: [32, 32], iconAnchor: [16, 32] }) }).addTo(map);

                            // Начинаем анимацию с сохраненного прогресса
                            animateMarkerAlongRoute(carId, carDataEntry.routeProgress);
                        } else {
                            // Если автомобиль ожидает заказ, добавляем соответствующий лог
                            if (carDataEntry.logs.length === 0 || !carDataEntry.logs[carDataEntry.logs.length - 1].includes('ожидает новый заказ')) {
                                addLogMessage(carId, `Автомобиль ${carName} ожидает новый заказ`);
                            }

                            // Устанавливаем начальную задержку перед первой поездкой
                            const delayRange = carDataEntry.specs.delay_before_new_route;
                            const initialDelay = Math.random() * (delayRange.max - delayRange.min) + delayRange.min;
                            console.log(`Автомобиль ${carId} начнёт первую поездку через ${(initialDelay / 1000).toFixed(0)} секунд`);

                            carDataEntry.delayTimeout = setTimeout(() => {
                                createRouteForCar(carId, 1, true);
                            }, initialDelay);
                        }
                    } catch (error) {
                        console.error(`Ошибка при получении состояния автомобиля ${carId}:`, error);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Ошибка при инициализации автомобилей:", error);
    }
}

// Функция для создания маршрута для автомобиля
function createRouteForCar(carId, attempt = 1, isFirstRoute = false) {
    console.log(`Попытка создания маршрута для автомобиля с ID: ${carId}, попытка №${attempt}`);

    const car = carData[carId];

    if (!car) {
        console.error(`Данные автомобиля с ID ${carId} не найдены.`);
        return;
    }

    // Проверяем и инициализируем currentPosition, если она не определена
    if (!car.currentPosition || typeof car.currentPosition.lat !== 'number' || typeof car.currentPosition.lng !== 'number') {
        console.warn(`currentPosition для автомобиля ${carId} не определена или некорректна. Устанавливаем случайные координаты.`);
        car.currentPosition = getRandomCoordinatesInCity();
    }

    const startLatLng = car.lastEndPosition || car.currentPosition;

    if (!startLatLng || typeof startLatLng.lat !== 'number' || typeof startLatLng.lng !== 'number') {
        console.error(`Неверные координаты начала маршрута для автомобиля ${carId}:`, startLatLng);
        return;
    }

    const endLatLng = getRandomCoordinatesInCity();

    // Формируем данные для запроса к серверу
    const routeRequestData = {
        start_lat: startLatLng.lat,
        start_lng: startLatLng.lng,
        end_lat: endLatLng.lat,
        end_lng: endLatLng.lng
    };

    fetch('http://127.0.0.1:8000/get_route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeRequestData)
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(async data => {
            if (data.features && data.features.length > 0) {
                const routeCoordinates = data.features[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
                car.routeCoordinates = routeCoordinates;
                car.endPosition = L.latLng(routeCoordinates[routeCoordinates.length - 1]);

                // Добавляем полилинию маршрута
                if (car.routePolyline) {
                    car.routePolyline.setLatLngs(routeCoordinates);
                } else {
                    car.routePolyline = L.polyline(routeCoordinates, { color: 'blue' });
                }

                // Добавляем на карту
                const map = maps[`map${carId}`];
                car.routePolyline.addTo(map);

                // Добавляем маркер конечной точки
                if (car.endMarker) {
                    car.endMarker.setLatLng(car.endPosition);
                } else {
                    car.endMarker = L.marker(car.endPosition, { icon: L.icon({ iconUrl: 'img/flag.png', iconSize: [32, 32], iconAnchor: [16, 32] }) });
                }
                car.endMarker.addTo(map);

                // Центрируем карту на маршруте
                fitMapToRoute(car, map);

                // Обновляем состояние автомобиля на сервере
                car.status = 'on_trip';
                car.routeProgress = 0;
                await updateCarStateOnServer(carId, car.status, car.routeCoordinates, car.routeProgress);

                // Добавляем лог о начале поездки
                addLogMessage(carId, `Появился новый заказ, начинаю выполнение`);

                // Ждем перед началом движения
                const delayRange = car.specs.delay_before_start_moving;
                const startDelay = Math.random() * (delayRange.max - delayRange.min) + delayRange.min;
                console.log(`Автомобиль ${carId} начнёт движение через ${(startDelay / 1000).toFixed(0)} секунд`);

                setTimeout(() => {
                    // Начинаем анимацию движения
                    animateMarkerAlongRoute(carId);
                }, startDelay);

            } else {
                console.error(`Не удалось построить маршрут для автомобиля ${carId}. Попытка ${attempt}`);
                if (attempt < 3) {
                    setTimeout(() => createRouteForCar(carId, attempt + 1, isFirstRoute), 5000);
                } else {
                    console.error(`Не удалось построить маршрут для автомобиля ${carId} после ${attempt} попыток.`);
                }
            }
        })
        .catch(error => {
            console.error(`Ошибка при получении маршрута для автомобиля ${carId}:`, error);
            if (attempt < 3) {
                setTimeout(() => createRouteForCar(carId, attempt + 1, isFirstRoute), 5000);
            } else {
                console.error(`Не удалось получить маршрут для автомобиля ${carId} после ${attempt} попыток.`);
            }
        });
}

// Функция для анимации движения маркера вдоль маршрута
function animateMarkerAlongRoute(carId, startProgress = 0) {
    const car = carData[carId];
    const map = maps[`map${carId}`];

    if (!car || !car.routeCoordinates) {
        console.error(`Нет данных для анимации автомобиля ${carId}`);
        return;
    }

    const routeCoordinates = car.routeCoordinates;
    let progress = startProgress;
    const totalSteps = routeCoordinates.length * 100; // Регулируйте для более плавной анимации
    const delay = 20; // Задержка между кадрами в миллисекундах

    if (car.animationState) {
        clearInterval(car.animationState);
    }

    car.animationState = setInterval(async () => {
        if (progress >= totalSteps) {
            // Поездка завершена
            clearInterval(car.animationState);
            car.animationState = null;

            car.lastEndPosition = car.endPosition;
            car.currentPosition = car.endPosition;

            // Обновляем позицию автомобиля на сервере
            await updateCarPositionOnServer(carId, car.currentPosition.lat, car.currentPosition.lng);

            // Удаляем старые элементы маршрута
            if (car.routePolyline) {
                map.removeLayer(car.routePolyline);
                car.routePolyline = null;
            }
            if (car.progressPolyline) {
                map.removeLayer(car.progressPolyline);
                car.progressPolyline = null;
            }
            if (car.endMarker) {
                map.removeLayer(car.endMarker);
                car.endMarker = null;
            }

            // Генерируем прибыль за поездку
            const profitRange = car.specs.profit_per_trip;
            const tripProfit = parseFloat((Math.random() * (profitRange.max - profitRange.min) + profitRange.min).toFixed(2));

            // Обновляем прибыль и количество заказов на сервере
            fetch('http://127.0.0.1:8000/complete_trip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    car_id: carId,
                    profit: tripProfit
                })
            })
            .then(response => response.json())
            .then(async data => {
                if (data.message) {
                    car.profit = data.new_profit;
                    car.orderCount = data.new_order_count;

                    // Обновляем отображение информации, если этот автомобиль выбран
                    const carSelect = document.getElementById("carSelect");
                    if (carSelect.value == carId) {
                        updateInfoDisplay(carId);
                    }

                    // Добавляем лог о завершении поездки
                    addLogMessage(carId, `Закончил заказ, заработано ${tripProfit} USDT, ожидаю новые заказы`);

                    // Обновляем состояние автомобиля на сервере
                    car.status = 'waiting';
                    car.routeCoordinates = null;
                    car.routeProgress = 0;
                    await updateCarStateOnServer(carId, car.status, null, 0);

                } else {
                    console.error(`Ошибка при обновлении прибыли на сервере для автомобиля ${carId}`);
                }
            })
            .catch(error => {
                console.error(`Ошибка при обновлении прибыли на сервере для автомобиля ${carId}:`, error);
            });

            // Ждем перед началом нового маршрута
            const delayRange = car.specs.delay_before_new_route;
            const newRouteDelay = Math.random() * (delayRange.max - delayRange.min) + delayRange.min;
            car.delayTimeout = setTimeout(() => {
                createRouteForCar(carId);
            }, newRouteDelay);

            return;
        }

        const routeProgress = (progress / totalSteps) * (routeCoordinates.length - 1);
        const index = Math.floor(routeProgress);
        const t = routeProgress - index;

        const startPoint = routeCoordinates[index];
        const endPoint = routeCoordinates[index + 1];

        if (startPoint && endPoint) {
            const lat = startPoint[0] + (endPoint[0] - startPoint[0]) * t;
            const lng = startPoint[1] + (endPoint[1] - startPoint[1]) * t;
            const position = [lat, lng];

            car.marker.setLatLng(position);
            car.currentPosition = L.latLng(lat, lng);

            // Обновляем пройденную часть маршрута
            if (car.progressPolyline) {
                const completedRoute = routeCoordinates.slice(0, index + 1);
                car.progressPolyline.setLatLngs(completedRoute);
            } else {
                car.progressPolyline = L.polyline(routeCoordinates.slice(0, index + 1), { color: 'green' }).addTo(map);
            }

            // Обновляем позицию автомобиля на сервере
            if (progress % 50 === 0) { // Каждые 50 шагов
                await updateCarPositionOnServer(carId, lat, lng);
                car.routeProgress = progress;
                await updateCarStateOnServer(carId, car.status, car.routeCoordinates, car.routeProgress);
            }
        }

        progress++;
    }, delay);
}

// Функция для обновления позиции автомобиля на сервере
async function updateCarPositionOnServer(carId, latitude, longitude) {
    try {
        const response = await fetch(`http://127.0.0.1:8000/update_car_position`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "car_id": carId,
                "current_lat": latitude,
                "current_lng": longitude
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`Позиция автомобиля ${carId} обновлена на сервере.`);
        } else {
            console.error(`Ошибка при обновлении позиции автомобиля на сервере: ${data.detail || "Unknown error"}`);
        }
    } catch (error) {
        console.error("Ошибка при обновлении позиции автомобиля на сервере:", error);
    }
}

// Функция для обновления состояния автомобиля на сервере
async function updateCarStateOnServer(carId, status, routeCoordinates, routeProgress) {
    try {
        const response = await fetch(`http://127.0.0.1:8000/update_car_state`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "car_id": carId,
                "status": status,
                "route_coordinates": routeCoordinates,
                "route_progress": routeProgress
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`Состояние автомобиля ${carId} обновлено на сервере.`);
        } else {
            console.error(`Ошибка при обновлении состояния автомобиля на сервере: ${data.detail || "Unknown error"}`);
        }
    } catch (error) {
        console.error("Ошибка при обновлении состояния автомобиля на сервере:", error);
    }
}

// Функция для добавления лога сообщения
function addLogMessage(carId, message) {
    // Изменено: получаем только время
    const timestamp = new Date().toLocaleTimeString('ru-RU', { hour12: false });
    const logMessage = `[${timestamp}] ${message}`;

    const car = carData[carId];
    car.logs.push(logMessage);

    // Ограничиваем количество логов до 50
    if (car.logs.length > 50) {
        car.logs.shift(); // Удаляем самое старое сообщение
    }

    // Отправляем лог на сервер
    fetch('http://127.0.0.1:8000/add_log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            car_id: carId,
            message: message // Отправляем оригинальное сообщение, сервер добавит метку времени
        })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.message) {
            console.error(`Ошибка при сохранении лога на сервере для автомобиля ${carId}`);
        }
    })
    .catch(error => {
        console.error(`Ошибка при отправке лога на сервер для автомобиля ${carId}:`, error);
    });

    // Если этот автомобиль выбран, обновляем отображение логов
    const carSelect = document.getElementById("carSelect");
    if (carSelect.value == carId) {
        updateLogDisplay(carId);
    }
}

// Функция для обновления отображения логов
function updateLogDisplay(carId) {
    const logContainer = document.getElementById("logContainer");
    logContainer.innerHTML = "";

    const car = carData[carId];

    if (car.logs.length === 0) {
        // Если нет логов, показываем сообщение по умолчанию
        const defaultMessage = document.createElement("div");
        defaultMessage.textContent = "Здесь будут сообщения о работе выбранного автомобиля";
        defaultMessage.classList.add('log-message');
        logContainer.appendChild(defaultMessage);
    } else {
        car.logs.forEach(log => {
            const logEntry = document.createElement("div");
            logEntry.textContent = log;
            logEntry.classList.add('log-message'); // Применяем стиль выравнивания
            logContainer.appendChild(logEntry);
        });
    }

    // Прокручиваем к последнему сообщению
    logContainer.scrollTop = logContainer.scrollHeight;
}

// Функция для обновления отображения информации
function updateInfoDisplay(carId) {
    const profitElement = document.getElementById("profitAmount");
    const orderCountElement = document.getElementById("orderCount");

    const car = carData[carId];

    profitElement.textContent = car.profit.toFixed(2);
    orderCountElement.textContent = car.orderCount;
}

// Функция для вывода прибыли на баланс
async function withdrawProfit() {
    const carSelect = document.getElementById("carSelect");
    const selectedCarId = carSelect.value;

    if (selectedCarId === "") {
        alert("Выберите автомобиль для вывода прибыли.");
        return;
    }

    const car = carData[selectedCarId];
    const telegram_id = 123456; // Замените на реальный ID пользователя

    try {
        const response = await fetch('http://127.0.0.1:8000/withdraw_profit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegram_id: telegram_id,
                amount: car.profit
            })
        });

        const data = await response.json();

        if (data.success) {
            alert(`Прибыль ${car.profit.toFixed(2)} USDT успешно выведена на ваш баланс.`);
            car.profit = 0;
            car.orderCount = 0; // Обнуляем количество заказов
            updateInfoDisplay(selectedCarId);
            updateBalance(); // Функция из balance.js для обновления отображения баланса
        } else {
            alert("Ошибка при выводе прибыли.");
        }
    } catch (error) {
        console.error("Ошибка при выводе прибыли:", error);
    }
}

// Функция для подгонки карты под маршрут
function fitMapToRoute(car, map) {
    const group = L.featureGroup();

    if (car.routePolyline) {
        group.addLayer(car.routePolyline);
    }

    if (car.marker) {
        group.addLayer(car.marker);
    }

    if (car.endMarker) {
        group.addLayer(car.endMarker);
    }

    if (group.getLayers().length > 0) {
        map.fitBounds(group.getBounds(), { padding: [20, 20] });
    }
}

// Функции для отображения/скрытия статичной карты
function showStaticMap() {
    const staticMapId = "staticMap";
    let existingStaticMap = document.getElementById(staticMapId);
    if (!existingStaticMap) {
        const mapContainer = document.getElementById("mapContainer");
        existingStaticMap = document.createElement('div');
        existingStaticMap.id = staticMapId;
        existingStaticMap.classList.add('map');
        mapContainer.appendChild(existingStaticMap);
        initializeMap(staticMapId);
    } else {
        existingStaticMap.classList.remove('hidden');
    }
    console.log("Отображена статичная карта");
}

function hideStaticMap() {
    const staticMapId = "staticMap";
    const existingStaticMap = document.getElementById(staticMapId);
    if (existingStaticMap) {
        existingStaticMap.classList.add('hidden');
        console.log("Скрытие статичной карты");
    }
}

// Функция для отображения сообщения по умолчанию в логах
function showDefaultLogMessage() {
    const logContainer = document.getElementById("logContainer");
    logContainer.innerHTML = ""; // Очищаем контейнер
    const defaultMessage = document.createElement("div");
    defaultMessage.textContent = "Здесь будут сообщения о работе выбранного автомобиля";
    defaultMessage.classList.add('log-message');
    logContainer.appendChild(defaultMessage);
}

// Запуск инициализации страницы
document.addEventListener("DOMContentLoaded", initializePage);
