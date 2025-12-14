/**
 * GameManager - Центральный менеджер игровой логики
 * Управляет состоянием игры, сущностями и координирует менеджеры
 */
class GameManager {
    constructor() {
        // Игрок
        this.player = null;
        
        // Массив всех сущностей (враги, NPC и т.д.)
        this.entities = [];
        
        // Состояние игры
        this.state = 'playing'; // 'playing', 'paused', 'gameover', 'victory'
        
        // Игровая статистика
        this.stats = {
            score: 0,
            wave: 0,
            kills: 0,
            time: 0
        };
        
        // Ссылки на другие менеджеры (устанавливаются при инициализации)
        this.physicsManager = null;
        this.eventManager = null;
        this.mapManager = null;
        
        // Режим отладки (по умолчанию включен для тестирования)
        this.debug = true;
    }

    /**
     * Инициализация GameManager
     * @param {Object} managers - Объект с менеджерами
     */
    init(managers) {
        this.physicsManager = managers.physicsManager;
        this.eventManager = managers.eventManager;
        this.mapManager = managers.mapManager;
        
        console.log('GameManager: Инициализирован');
    }

    /**
     * Создаёт игрока в указанной позиции
     * @param {number} x - X координата
     * @param {number} y - Y координата
     * @returns {Promise<Player>}
     */
    async createPlayer(x, y) {
        this.player = new Player({ x, y });
        await this.player.loadSprite();
        
        console.log(`GameManager: Игрок создан на позиции (${x}, ${y})`);
        return this.player;
    }

    /**
     * Спавнит игрока в центре карты
     * @returns {Promise<Player>}
     */
    async spawnPlayerAtCenter() {
        if (!this.mapManager || !this.mapManager.ready) {
            throw new Error('GameManager: MapManager не готов');
        }
        
        const mapSize = this.mapManager.getPixelSize();
        const centerX = mapSize.width / 2;
        
        // Ищем позицию земли в центре карты
        const spawnY = this.findGroundLevel(centerX);
        
        return await this.createPlayer(centerX - 18, spawnY - 52); // Смещаем с учётом размера игрока
    }

    /**
     * Находит уровень земли в указанной X координате
     * @param {number} x - X координата в пикселях
     * @returns {number} - Y координата верхнего края земли
     */
    findGroundLevel(x) {
        const tileX = Math.floor(x / this.mapManager.tileWidth);
        const mapHeight = this.mapManager.height;
        
        // Начинаем сверху и ищем первый твёрдый тайл
        for (let tileY = 0; tileY < mapHeight; tileY++) {
            // Проверяем все слои
            for (let layerIndex = 0; layerIndex < this.mapManager.layers.length; layerIndex++) {
                const tileId = this.mapManager.getTileAt(layerIndex, tileX, tileY);
                if (tileId !== 0) {
                    // Нашли первый непустой тайл - это земля
                    return tileY * this.mapManager.tileHeight;
                }
            }
        }
        
        // Если земля не найдена, возвращаем середину карты
        return this.mapManager.getPixelSize().height / 2;
    }

    /**
     * Добавляет сущность в игру
     * @param {Entity} entity - Сущность для добавления
     */
    addEntity(entity) {
        this.entities.push(entity);
    }

    /**
     * Удаляет сущность из игры
     * @param {Entity} entity - Сущность для удаления
     */
    removeEntity(entity) {
        const index = this.entities.indexOf(entity);
        if (index !== -1) {
            this.entities.splice(index, 1);
        }
    }

    /**
     * Обновление всей игровой логики
     * @param {number} dt - Delta time
     * @param {Game} game - Ссылка на игру
     */
    update(dt, game) {
        if (this.state !== 'playing') return;
        
        // Обновляем статистику времени
        this.stats.time += dt;
        
        // Обновляем игрока
        if (this.player && this.player.active) {
            this.player.update(dt, game);
        }
        
        // Обновляем всех сущностей
        for (const entity of this.entities) {
            if (entity.active) {
                entity.update(dt, game);
            }
        }
        
        // Физика
        if (this.physicsManager) {
            // Применяем физику к игроку
            if (this.player) {
                this.physicsManager.applyPhysics(this.player, dt);
            }
            
            // Применяем физику к сущностям
            this.physicsManager.update(this.entities, dt);
        }
        
        // Убираем неактивные сущности
        this.entities = this.entities.filter(entity => entity.active);
        
        // Переключение режима отладки
        if (this.eventManager && this.eventManager.isKeyJustPressed('F3')) {
            this.debug = !this.debug;
            console.log(`GameManager: Debug mode ${this.debug ? 'ON' : 'OFF'}`);
        }
    }

    /**
     * Отрисовка всех игровых объектов
     * @param {CanvasRenderingContext2D} ctx - Контекст canvas
     * @param {Camera} camera - Камера
     */
    render(ctx, camera) {
        // Отрисовываем игрока
        if (this.player && this.player.active) {
            this.player.render(ctx, camera);
            
            if (this.debug) {
                this.player.renderDebug(ctx, camera);
            }
        }
        
        // Отрисовываем сущности
        for (const entity of this.entities) {
            if (entity.active) {
                entity.render(ctx, camera);
                
                if (this.debug) {
                    entity.renderDebug(ctx, camera);
                }
            }
        }
    }

    /**
     * Отрисовка отладочной информации
     * @param {CanvasRenderingContext2D} ctx - Контекст canvas
     */
    renderDebugInfo(ctx) {
        if (!this.debug) return;
        
        // Фон для текста
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(2, 2, 180, 130);
        
        ctx.fillStyle = '#00ff00';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        
        const info = [
            `State: ${this.state}`,
            `Entities: ${this.entities.length}`,
            `Time: ${this.stats.time.toFixed(1)}s`,
        ];
        
        if (this.player) {
            info.push(
                `Player: (${this.player.x.toFixed(0)}, ${this.player.y.toFixed(0)})`,
                `Velocity: (${this.player.velocityX.toFixed(0)}, ${this.player.velocityY.toFixed(0)})`,
                `OnGround: ${this.player.onGround}`,
                `Animation: ${this.player.currentAnimation}`,
                `SpriteLoaded: ${this.player.imageLoaded}`,
                `Direction: ${this.player.direction}`
            );
        }
        
        info.forEach((text, i) => {
            ctx.fillText(text, 5, 15 + i * 12);
        });
    }

    /**
     * Пауза игры
     */
    pause() {
        if (this.state === 'playing') {
            this.state = 'paused';
            console.log('GameManager: Игра на паузе');
        }
    }

    /**
     * Возобновление игры
     */
    resume() {
        if (this.state === 'paused') {
            this.state = 'playing';
            console.log('GameManager: Игра возобновлена');
        }
    }

    /**
     * Конец игры
     */
    gameOver() {
        this.state = 'gameover';
        console.log('GameManager: Game Over');
    }
}
