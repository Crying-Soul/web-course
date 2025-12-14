/**
 * Game - Основной класс игры
 * Управляет игровым циклом, камерой и координирует менеджеры
 */
class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Менеджеры
        this.spriteManager = new SpriteManager();
        this.mapManager = new MapManager(this.spriteManager);
        
        // Камера
        this.camera = {
            x: 0,
            y: 0,
            width: 800,
            height: 600
        };
        
        // Скорость перемещения камеры (для тестирования)
        this.cameraSpeed = 200; // пикселей в секунду
        
        // Состояние клавиш
        this.keys = {
            left: false,
            right: false,
            up: false,
            down: false
        };
        
        // Время последнего кадра
        this.lastTime = 0;
        
        // Флаг работы игры
        this.running = false;

        // Масштаб отображения (для pixel art)
        this.scale = 2;
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
        
        // Настраиваем обработку ввода
        this.setupInput();
        
        // Загружаем ресурсы
        await this.loadResources();
        
        // Центрируем камеру на карте (примерно на уровне земли)
        const mapSize = this.mapManager.getPixelSize();
        this.camera.x = 0;
        this.camera.y = mapSize.height - this.camera.height - 200; // Чуть выше нижнего края
        
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
        // Размер окна
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // Устанавливаем размер canvas
        this.canvas.width = Math.floor(windowWidth / this.scale);
        this.canvas.height = Math.floor(windowHeight / this.scale);
        
        // Масштабируем canvas через CSS
        this.canvas.style.width = `${this.canvas.width * this.scale}px`;
        this.canvas.style.height = `${this.canvas.height * this.scale}px`;
        
        // Обновляем размер камеры
        this.camera.width = this.canvas.width;
        this.camera.height = this.canvas.height;
        
        // Отключаем сглаживание для чёткого pixel art
        this.ctx.imageSmoothingEnabled = false;
    }

    /**
     * Настройка обработки ввода
     */
    setupInput() {
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    /**
     * Обработка нажатия клавиши
     * @param {KeyboardEvent} e
     */
    handleKeyDown(e) {
        switch (e.code) {
            case 'ArrowLeft':
            case 'KeyA':
                this.keys.left = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.keys.right = true;
                break;
            case 'ArrowUp':
            case 'KeyW':
                this.keys.up = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.keys.down = true;
                break;
        }
    }

    /**
     * Обработка отпускания клавиши
     * @param {KeyboardEvent} e
     */
    handleKeyUp(e) {
        switch (e.code) {
            case 'ArrowLeft':
            case 'KeyA':
                this.keys.left = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.keys.right = false;
                break;
            case 'ArrowUp':
            case 'KeyW':
                this.keys.up = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.keys.down = false;
                break;
        }
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

        // Вычисляем delta time
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Обновление
        this.update(deltaTime);
        
        // Рендер
        this.render();

        // Следующий кадр
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    /**
     * Обновление игровой логики
     * @param {number} dt - Delta time в секундах
     */
    update(dt) {
        // Временное управление камерой для тестирования
        this.updateCamera(dt);
    }

    /**
     * Обновление позиции камеры (для тестирования)
     * @param {number} dt - Delta time
     */
    updateCamera(dt) {
        const speed = this.cameraSpeed * dt;
        
        if (this.keys.left) this.camera.x -= speed;
        if (this.keys.right) this.camera.x += speed;
        if (this.keys.up) this.camera.y -= speed;
        if (this.keys.down) this.camera.y += speed;

        // Ограничиваем камеру границами карты
        const mapSize = this.mapManager.getPixelSize();
        this.camera.x = Math.max(0, Math.min(this.camera.x, mapSize.width - this.camera.width));
        this.camera.y = Math.max(0, Math.min(this.camera.y, mapSize.height - this.camera.height));
    }

    /**
     * Рендер игры
     */
    render() {
        // Очищаем canvas
        this.ctx.fillStyle = '#87CEEB'; // Цвет неба
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Рендерим карту
        this.mapManager.render(this.ctx, this.camera);
    }
}
