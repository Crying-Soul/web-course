/**
 * SpriteManager - Управление загрузкой и хранением спрайтов
 * Загружает изображения тайлов и предоставляет доступ к ним по ID
 */
class SpriteManager {
    constructor() {
        // Хранилище загруженных изображений: id -> Image
        this.sprites = new Map();
        // Данные тайлсета
        this.tilesetData = null;
        // Флаг готовности
        this.ready = false;
    }

    /**
     * Загружает тайлсет и все его изображения
     * @param {string} tilesetPath - Путь к JSON файлу тайлсета
     * @returns {Promise<void>}
     */
    async loadTileset(tilesetPath) {
        try {
            // Загружаем JSON тайлсета
            const response = await fetch(tilesetPath);
            this.tilesetData = await response.json();

            // Загружаем все изображения тайлов
            const loadPromises = this.tilesetData.tiles.map(tile => this.loadTile(tile));
            await Promise.all(loadPromises);

            this.ready = true;
            console.log(`SpriteManager: Загружено ${this.sprites.size} спрайтов`);
        } catch (error) {
            console.error('SpriteManager: Ошибка загрузки тайлсета:', error);
            throw error;
        }
    }

    /**
     * Загружает отдельный тайл
     * @param {Object} tileData - Данные тайла из тайлсета
     * @returns {Promise<void>}
     */
    loadTile(tileData) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                // Tiled использует id тайла, но в данных карты id + 1 (0 = пустой тайл)
                // Сохраняем по оригинальному id из тайлсета
                this.sprites.set(tileData.id, {
                    image: img,
                    width: tileData.imagewidth,
                    height: tileData.imageheight
                });
                resolve();
            };

            img.onerror = () => {
                console.warn(`SpriteManager: Не удалось загрузить ${tileData.image}`);
                resolve(); // Продолжаем даже при ошибке
            };

            img.src = tileData.image;
        });
    }

    /**
     * Получает спрайт по ID тайла из карты
     * @param {number} mapTileId - ID тайла из данных карты (1-based, 0 = пустой)
     * @returns {Object|null} - Объект со спрайтом или null
     */
    getSprite(mapTileId) {
        if (mapTileId === 0) return null;
        // В Tiled данные карты используют 1-based индексы
        // id в тайлсете 0-based, поэтому вычитаем 1
        return this.sprites.get(mapTileId - 1) || null;
    }

    /**
     * Проверяет готовность менеджера
     * @returns {boolean}
     */
    isReady() {
        return this.ready;
    }

    /**
     * Возвращает размер тайла
     * @returns {Object} - {width, height}
     */
    getTileSize() {
        if (!this.tilesetData) return { width: 16, height: 16 };
        return {
            width: this.tilesetData.tilewidth,
            height: this.tilesetData.tileheight
        };
    }
}
