/**
 * Game - Основной класс игры
 * Управляет игровым циклом и координирует все менеджеры
 */
class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Базовый размер области видимости (камера)
        this.viewWidth = 800;
        this.viewHeight = 450;
        // Масштаб CSS для четкости пиксель-арта
        this.scale = 2;

        // Менеджеры
        this.eventManager = new EventManager();
        this.spriteManager = new SpriteManager();
        this.mapManager = new MapManager(this.spriteManager);
        this.physicsManager = null; // Инициализируется после загрузки карты
        this.gameManager = new GameManager();
        
        // Камера
        this.camera = new Camera(this.viewWidth, this.viewHeight);
        
        // Время последнего кадра
        this.lastTime = 0;
        
        // Флаг работы игры
        this.running = false;

    }

    /**
     * Инициализация игры
     * @returns {Promise<void>}
     */
    async init() {
        console.log('Game: Инициализация...');
        
        // Настраиваем размер canvas
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Инициализируем менеджер событий
        this.eventManager.init(this.canvas);
        
        // Загружаем ресурсы
        await this.loadResources();
        
        // Создаём менеджер физики после загрузки карты
        this.physicsManager = new PhysicsManager(this.mapManager);
        
        // Инициализируем GameManager
        this.gameManager.init({
            physicsManager: this.physicsManager,
            eventManager: this.eventManager,
            mapManager: this.mapManager
        });
        
        // Создаём игрока в центре карты
        await this.gameManager.spawnPlayerAtCenter();
        await this.gameManager.giveStarterSpells();
        
        // Настраиваем камеру
        const mapSize = this.mapManager.getPixelSize();
        this.camera.setWorldBounds(mapSize.width, mapSize.height);
        this.camera.setTarget(this.gameManager.player);
        this.camera.centerOnTarget();
        
        console.log('Game: Инициализация завершена');
    }

    /**
     * Загрузка игровых ресурсов
     * @returns {Promise<void>}
     */
    async loadResources() {
        console.log('Game: Загрузка ресурсов...');
        
        // Загружаем тайлсет
        await this.spriteManager.loadTileset('tiles.json');
        
        // Загружаем карту
        await this.loadMap('map2.json');
        
        console.log('Game: Ресурсы загружены');
    }

    /**
     * Загружает карту и объекты на ней (спавнеры, телепорты)
     * @param {string} mapPath - Путь к файлу карты
     */
    async loadMap(mapPath) {
        await this.mapManager.loadMap(mapPath);
        
        // Загружаем объекты карты (спавнеры, телепорты)
        if (this.mapManager.mapData) {
            this.gameManager.loadMapObjects(this.mapManager.mapData);
            this.gameManager.currentMapPath = mapPath;
        }
    }

    /**
     * Обрабатывает телепортацию на другую карту
     * @param {Object} teleportData - Данные телепортации
     */
    async handleTeleport(teleportData) {
        if (!teleportData || !teleportData.targetMap) {
            console.warn('Game: Нет целевой карты для телепортации');
            return;
        }
        
        console.log(`Game: Телепортация на карту ${teleportData.targetMap}`);
        
        // Сохраняем состояние игрока
        const playerState = this.savePlayerState();
        
        // Очищаем текущие сущности
        this.gameManager.entities = [];
        this.gameManager.items = [];
        this.gameManager.projectiles = [];
        this.gameManager.spawnerManager.reset();
        
        // Загружаем новую карту
        await this.loadMap(teleportData.targetMap);
        
        // Обновляем физику для новой карты
        this.physicsManager = new PhysicsManager(this.mapManager);
        this.gameManager.physicsManager = this.physicsManager;
        
        // Настраиваем камеру для новой карты
        const mapSize = this.mapManager.getPixelSize();
        this.camera.setWorldBounds(mapSize.width, mapSize.height);
        
        // Определяем позицию спавна
        let spawnX, spawnY;
        
        if (teleportData.targetTeleportId) {
            // Ищем целевой телепорт
            const targetTeleport = this.gameManager.teleportManager.getTeleportById(teleportData.targetTeleportId);
            if (targetTeleport) {
                spawnX = targetTeleport.x + targetTeleport.width / 2 - 18;
                spawnY = targetTeleport.y + targetTeleport.height - 52;
            }
        }
        
        if (spawnX === undefined && teleportData.targetX !== null) {
            spawnX = teleportData.targetX;
            spawnY = teleportData.targetY;
        }
        
        if (spawnX === undefined) {
            // По умолчанию - центр карты
            spawnX = mapSize.width / 2 - 18;
            spawnY = this.gameManager.findGroundLevel(mapSize.width / 2) - 52;
        }
        
        // Перемещаем игрока
        this.gameManager.player.x = spawnX;
        this.gameManager.player.y = spawnY;
        this.gameManager.player.velocityX = 0;
        this.gameManager.player.velocityY = 0;
        
        // Восстанавливаем состояние
        this.restorePlayerState(playerState);
        
        // Центрируем камеру
        this.camera.centerOnTarget();
        
        console.log(`Game: Телепортация завершена, позиция: (${spawnX}, ${spawnY})`);
    }

    /**
     * Сохраняет состояние игрока
     * @returns {Object}
     */
    savePlayerState() {
        const player = this.gameManager.player;
        return {
            health: player.health,
            mana: player.mana,
            buffs: [...player.buffs],
            inventory: player.inventory.slots.map(slot => slot ? slot.clone() : null)
        };
    }

    /**
     * Восстанавливает состояние игрока
     * @param {Object} state
     */
    restorePlayerState(state) {
        const player = this.gameManager.player;
        player.health = state.health;
        player.mana = state.mana;
        player.buffs = state.buffs;
        // Инвентарь уже должен быть сохранён
    }

    /**
     * Настройка размера canvas
     */
    resize() {
        // Фиксированный логический размер canvas под камеру
        this.canvas.width = this.viewWidth;
        this.canvas.height = this.viewHeight;
        
        // Масштабируем canvas через CSS
        this.canvas.style.width = `${this.canvas.width * this.scale}px`;
        this.canvas.style.height = `${this.canvas.height * this.scale}px`;
        
        // Обновляем размер камеры
        this.camera.resize(this.canvas.width, this.canvas.height);
        
        // Пересчитываем границы мира для камеры если карта загружена
        if (this.mapManager && this.mapManager.ready) {
            const mapSize = this.mapManager.getPixelSize();
            this.camera.setWorldBounds(mapSize.width, mapSize.height);
        }
        
        // Отключаем сглаживание для чёткого pixel art
        this.ctx.imageSmoothingEnabled = false;
    }

    /**
     * Запуск игрового цикла
     */
    start() {
        this.running = true;
        this.lastTime = performance.now();
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    /**
     * Остановка игрового цикла
     */
    stop() {
        this.running = false;
    }

    /**
     * Главный игровой цикл
     * @param {number} currentTime - Текущее время
     */
    gameLoop(currentTime) {
        if (!this.running) return;

        // Вычисляем delta time (ограничиваем, чтобы избежать проблем при табе)
        const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;

        // Обновление
        this.update(deltaTime);
        
        // Рендер
        this.render();

        // Очищаем состояние "только что нажатых" клавиш
        this.eventManager.update();

        // Следующий кадр
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    /**
     * Обновление игровой логики
     * @param {number} dt - Delta time в секундах
     */
    update(dt) {
        // Обновляем мировые координаты мыши
        this.eventManager.updateMouseWorld(this.camera);
        
        // Пауза на Escape
        if (this.eventManager.isKeyJustPressed('Escape')) {
            if (this.gameManager.state === 'playing') {
                this.gameManager.pause();
            } else if (this.gameManager.state === 'paused') {
                this.gameManager.resume();
            }
        }

        // Переключение режима отладки
        if (this.eventManager.isKeyJustReleased('Equal')) {
            this.gameManager.debug = !this.gameManager.debug;
            console.log(`Game: Debug mode ${this.gameManager.debug ? 'ON' : 'OFF'}`);
        }

        // Обновляем GameManager (игрока, сущности, физику)
        this.gameManager.update(dt, this);
        
        // Обновляем камеру
        this.camera.update(dt);
    }

    /**
     * Рендер игры
     */
    render() {
        // Очищаем canvas тёмным фоном (за пределами карты)
        this.ctx.fillStyle = '#0a0a15';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Вычисляем область неба (внутри карты)
        const mapSize = this.mapManager.getPixelSize();
        
        // Область отображения карты на экране
        const mapScreenLeft = Math.max(0, 0 - this.camera.x);
        const mapScreenTop = Math.max(0, 0 - this.camera.y);
        const mapScreenRight = Math.min(this.canvas.width, mapSize.width - this.camera.x);
        const mapScreenBottom = Math.min(this.canvas.height, mapSize.height - this.camera.y);
        
        const skyW = mapScreenRight - mapScreenLeft;
        const skyH = mapScreenBottom - mapScreenTop;
        
        if (skyW > 0 && skyH > 0) {
            // Градиент неба
            const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
            gradient.addColorStop(0, '#1e3a5f'); // Тёмно-синий верх
            gradient.addColorStop(0.3, '#4a90c2'); // Голубой
            gradient.addColorStop(0.7, '#87ceeb'); // Светло-голубой
            gradient.addColorStop(1, '#b8d4e8'); // Очень светлый низ
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(mapScreenLeft, mapScreenTop, skyW, skyH);
        }

        // Рендерим карту
        this.mapManager.render(this.ctx, this.camera);
        
        // Рендерим игровые объекты
        this.gameManager.render(this.ctx, this.camera);
        
        // Рендерим UI (поверх всего)
        this.gameManager.renderUI(this.ctx);
        
        // Отладочная информация
        this.gameManager.renderDebugInfo(this.ctx);
        
        // Индикатор паузы
        if (this.gameManager.state === 'paused') {
            this.renderPauseOverlay();
        }
    }

    /**
     * Отрисовка экрана паузы
     */
    renderPauseOverlay() {
        // Затемнение
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Текст
        this.ctx.fillStyle = 'white';
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('ПАУЗА', this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.font = '10px Arial';
        this.ctx.fillText('Нажмите Escape для продолжения', this.canvas.width / 2, this.canvas.height / 2 + 20);
    }
}
