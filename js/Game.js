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
        await this.mapManager.loadMap('map.json');
        
        console.log('Game: Ресурсы загружены');
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
