/**
 * MapManager - Управление загрузкой и рендером карты
 * Загружает карту Tiled и отрисовывает её на canvas
 */
class MapManager {
    constructor(spriteManager) {
        this.spriteManager = spriteManager;
        // Данные карты
        this.mapData = null;
        // Слои карты
        this.layers = [];
        // Паттерны слоев, которые не участвуют в коллизиях (например, небо/декор)
        this.nonCollidablePatterns = [/sky/i, /flora/i, /background/i];
        // Размеры карты в тайлах
        this.width = 0;
        this.height = 0;
        // Размер тайла
        this.tileWidth = 16;
        this.tileHeight = 16;
        // Флаг готовности
        this.ready = false;
    }

    /**
     * Загружает карту из JSON файла
     * @param {string} mapPath - Путь к JSON файлу карты
     * @returns {Promise<void>}
     */
    async loadMap(mapPath) {
        try {
            const response = await fetch(mapPath);
            this.mapData = await response.json();

            this.width = this.mapData.width;
            this.height = this.mapData.height;
            this.tileWidth = this.mapData.tilewidth;
            this.tileHeight = this.mapData.tileheight;

            // Извлекаем слои тайлов
            this.layers = this.mapData.layers.filter(layer => layer.type === 'tilelayer');

            this.ready = true;
            console.log(`MapManager: Карта загружена (${this.width}x${this.height} тайлов)`);
        } catch (error) {
            console.error('MapManager: Ошибка загрузки карты:', error);
            throw error;
        }
    }

    /**
     * Получает ID тайла по координатам на слое
     * @param {number} layerIndex - Индекс слоя
     * @param {number} x - X координата в тайлах
     * @param {number} y - Y координата в тайлах
     * @returns {number} - ID тайла (0 = пустой)
     */
    getTileAt(layerIndex, x, y) {
        if (!this.ready || layerIndex >= this.layers.length) return 0;
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
        
        const layer = this.layers[layerIndex];
        const index = y * this.width + x;
        return layer.data[index] || 0;
    }

    /**
     * Отрисовывает карту на canvas с учётом камеры
     * @param {CanvasRenderingContext2D} ctx - Контекст canvas
     * @param {Object} camera - Объект камеры {x, y, width, height}
     */
    render(ctx, camera) {
        if (!this.ready || !this.spriteManager.isReady()) return;

        // Вычисляем диапазон видимых тайлов
        const startX = Math.floor(camera.x / this.tileWidth);
        const startY = Math.floor(camera.y / this.tileHeight);
        const endX = Math.ceil((camera.x + camera.width) / this.tileWidth);
        const endY = Math.ceil((camera.y + camera.height) / this.tileHeight);

        // Ограничиваем диапазон размерами карты
        const minX = Math.max(0, startX);
        const minY = Math.max(0, startY);
        const maxX = Math.min(this.width, endX);
        const maxY = Math.min(this.height, endY);

        // Отрисовываем каждый слой
        for (let layerIndex = 0; layerIndex < this.layers.length; layerIndex++) {
            this.renderLayer(ctx, camera, layerIndex, minX, minY, maxX, maxY);
        }
    }

    /**
     * Отрисовывает отдельный слой
     * @param {CanvasRenderingContext2D} ctx - Контекст canvas
     * @param {Object} camera - Объект камеры
     * @param {number} layerIndex - Индекс слоя
     * @param {number} minX - Минимальный X в тайлах
     * @param {number} minY - Минимальный Y в тайлах
     * @param {number} maxX - Максимальный X в тайлах
     * @param {number} maxY - Максимальный Y в тайлах
     */
    renderLayer(ctx, camera, layerIndex, minX, minY, maxX, maxY) {
        const layer = this.layers[layerIndex];
        if (!layer.visible) return;

        for (let y = minY; y < maxY; y++) {
            for (let x = minX; x < maxX; x++) {
                const tileId = this.getTileAt(layerIndex, x, y);
                if (tileId === 0) continue;

                const sprite = this.spriteManager.getSprite(tileId);
                if (!sprite) continue;

                // Вычисляем позицию на экране
                const screenX = x * this.tileWidth - camera.x;
                const screenY = y * this.tileHeight - camera.y;

                // Отрисовываем тайл
                ctx.drawImage(
                    sprite.image,
                    Math.floor(screenX),
                    Math.floor(screenY),
                    this.tileWidth,
                    this.tileHeight
                );
            }
        }
    }

    /**
     * Возвращает размеры карты в пикселях
     * @returns {Object} - {width, height}
     */
    getPixelSize() {
        return {
            width: this.width * this.tileWidth,
            height: this.height * this.tileHeight
        };
    }

    /**
     * Проверяет, участвует ли слой в коллизиях
     * @param {number} layerIndex
     * @returns {boolean}
     */
    isCollidableLayer(layerIndex) {
        const layer = this.layers[layerIndex];
        if (!layer) return false;

        // Если есть свойство collidable в Tiled
        if (layer.properties) {
            const collProp = layer.properties.find(p => p.name === 'collidable');
            if (collProp !== undefined) {
                return Boolean(collProp.value);
            }
        }

        // По умолчанию слои, совпадающие с паттернами sky/decor/background, не коллизят
        return !this.nonCollidablePatterns.some((re) => re.test(layer.name || ''));
    }

    /**
     * Возвращает type тайла по ID из карты (1-based)
     * @param {number} mapTileId
     * @returns {string|null}
     */
    getTileTypeById(mapTileId) {
        if (!this.spriteManager || !mapTileId) return null;
        return this.spriteManager.getTileType(mapTileId);
    }

    /**
     * Определяет тип тайла в мировых координатах
     * @param {number} worldX
     * @param {number} worldY
     * @returns {string|null}
     */
    getTileTypeAtWorld(worldX, worldY) {
        const tileX = Math.floor(worldX / this.tileWidth);
        const tileY = Math.floor(worldY / this.tileHeight);
        if (tileX < 0 || tileY < 0 || tileX >= this.width || tileY >= this.height) return null;

        // Берём первый непустой тайл с учётом коллизии
        for (let i = 0; i < this.layers.length; i++) {
            if (!this.isCollidableLayer(i)) continue;
            const tileId = this.getTileAt(i, tileX, tileY);
            if (tileId !== 0) {
                return this.getTileTypeById(tileId) || null;
            }
        }
        return null;
    }

    /**
     * Проверяет готовность менеджера
     * @returns {boolean}
     */
    isReady() {
        return this.ready;
    }
}
