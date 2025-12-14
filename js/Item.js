/**
 * Item - Базовый носитель данных для заклинаний/свитков
 * Лежит на земле, может быть подобран и помещён в слот заклинаний
 */
class Item {
    /**
     * @param {Object} config - Конфигурация предмета
     */
    constructor(config = {}) {
        // Идентификатор типа предмета
        this.id = config.id || 'unknown';
        this.name = config.name || 'Предмет';
        this.type = config.type || 'spell'; // 'spell', 'consumable', 'misc'
        
        // Позиция в мире (если лежит на земле)
        this.x = config.x || 0;
        this.y = config.y || 0;
        // Отображаемый размер предмета (может задаваться в ItemTypes)
        this.width = config.displayWidth || config.width || 16;
        this.height = config.displayHeight || config.height || 16;
        
        // Физика для предметов на земле
        this.velocityY = 0;
        this.velocityX = 0;
        this.onGround = false;
        this.hasPhysics = true;
        
        // Путь к изображению (иконка спелла)
        this.imagePath = config.imagePath || '';
        this.image = null;
        this.imageLoaded = false;

        // Цвет и свечение иконки, если нет картинки
        this.iconColor = config.iconColor || '#7cf7ff';

        // Качество отрисовки (некоторые предметы — высококачественные спрайты)
        this.smooth = !!config.smooth;
        // Для пиксель-арта по умолчанию отключаем сглаживание, чтобы избежать мыла
        this.pixelPerfect = config.pixelPerfect !== undefined ? config.pixelPerfect : true;

        // Магические параметры
        this.damage = config.damage || 12;
        this.manaCost = config.manaCost || 6;
        this.cooldown = config.cooldown || 0.35;
        this.projectileSpeed = config.projectileSpeed || 360;
        this.projectileRadius = config.projectileRadius || 6;
        this.projectileLife = config.projectileLife || 2.2;
        this.trailColors = config.trailColors || ['#7cf7ff', '#b9f3ff'];
        this.pierce = config.pierce || 0; // сколько целей можно пронзить дополнительно
        this.explosionRadius = config.explosionRadius || 0; // при >0 наносит АоЕ взрыв
        this.slow = config.slow || 0; // замедление цели (0-1)
        this.element = config.element || 'arcane';
        this.onKillMana = config.onKillMana || 0; // моментальный бонус маны за килл этой школой
        
        // Активен ли предмет (лежит на земле)
        this.active = true;
        // Hitbox used by PhysicsManager
        this.hitboxHeight = this.height;
        this.hitboxOffsetY = 0;
        
        // Анимация подпрыгивания
        this.bobTimer = Math.random() * Math.PI * 2;
        this.bobSpeed = 3;
        this.bobHeight = 3;
    }

    /**
     * Загружает изображение предмета
     * @returns {Promise<void>}
     */
    async loadImage() {
        if (!this.imagePath) return;
        
        return new Promise((resolve) => {
            this.image = new Image();
            this.image.onload = () => {
                this.imageLoaded = true;
                resolve();
            };
            this.image.onerror = () => {
                console.warn(`Item: Не удалось загрузить ${this.imagePath}`);
                resolve();
            };
            this.image.src = this.imagePath;
        });
    }

    /**
     * Обновление предмета на земле
     * @param {number} dt - Delta time
     */
    update(dt) {
        if (!this.active) return;
        // Если предмет лежит на земле — подпрыгиваем (боб)
        if (this.onGround) {
            this.bobTimer += this.bobSpeed * dt;
            // Немного гасим горизонтальную скорость на земле
            this.velocityX *= 0.85;
            if (Math.abs(this.velocityX) < 1) this.velocityX = 0;
        } else {
            // Во время падения не бобим
            this.bobTimer = 0;
        }
    }

    /**
     * Получить границы для коллизии
     * @returns {Object}
     */
    getBounds() {
        return {
            left: this.x,
            top: this.y,
            right: this.x + this.width,
            bottom: this.y + this.height,
            width: this.width,
            height: this.height
        };
    }

    /**
     * Отрисовка предмета на земле
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    render(ctx, camera) {
        if (!this.active) return;
        
        const bobOffset = Math.sin(this.bobTimer) * this.bobHeight;
        // Выравниваем по пиксельной сетке, чтобы не было смаза на увеличении
        const screenX = Math.round(this.x - camera.x);
        const screenY = Math.round(this.y - camera.y + bobOffset);
        
        if (this.imageLoaded) {
            // Сохраняем старые параметры сглаживания и временно включаем при необходимости
            const prevSmoothing = ctx.imageSmoothingEnabled;
            const prevQuality = ctx.imageSmoothingQuality || 'low';
            try {
                // Если предмет пиксельный — выключаем сглаживание для чётких краёв
                if (this.pixelPerfect) {
                    ctx.imageSmoothingEnabled = false;
                } else {
                    ctx.imageSmoothingEnabled = !!this.smooth;
                    if (this.smooth) ctx.imageSmoothingQuality = 'high';
                }
            } catch (e) {}

            const drawW = Math.round(this.width);
            const drawH = Math.round(this.height);
            ctx.drawImage(this.image, screenX, screenY, drawW, drawH);

            // Восстанавливаем сглаживание
            try {
                ctx.imageSmoothingEnabled = prevSmoothing;
                ctx.imageSmoothingQuality = prevQuality;
            } catch (e) {}
        } else {
            // Заглушка
            ctx.fillStyle = '#ffaa00';
            ctx.fillRect(screenX, screenY, this.width, this.height);
        }
        
        // Свечение
        ctx.save();
        ctx.globalAlpha = 0.3 + Math.sin(this.bobTimer) * 0.2;
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(screenX + this.width / 2, screenY + this.height / 2, this.width, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /**
     * Создаёт копию предмета (для инвентаря)
     * @returns {Item}
     */
    clone() {
        const item = new Item({
            id: this.id,
            name: this.name,
            type: this.type,
            imagePath: this.imagePath,
            iconColor: this.iconColor,
            damage: this.damage,
            manaCost: this.manaCost,
            cooldown: this.cooldown,
            projectileSpeed: this.projectileSpeed,
            projectileRadius: this.projectileRadius,
            projectileLife: this.projectileLife,
            trailColors: this.trailColors,
            pierce: this.pierce,
            explosionRadius: this.explosionRadius,
            slow: this.slow,
            element: this.element,
            onKillMana: this.onKillMana,
            displayWidth: this.width,
            displayHeight: this.height,
            smooth: this.smooth,
            pixelPerfect: this.pixelPerfect
        });
        item.image = this.image;
        item.imageLoaded = this.imageLoaded;
        return item;
    }
}

/**
 * Регистр типов предметов
 */
const ItemTypes = {
    ARCANE_BOLT: {
        id: 'arcane_bolt',
        name: 'Аркановый заряд',
        type: 'spell',
        imagePath: '',
        iconColor: '#7cf7ff',
        damage: 18,
        manaCost: 6,
        cooldown: 0.25,
        projectileSpeed: 420,
        projectileRadius: 7,
        projectileLife: 2.6,
        trailColors: ['#7cf7ff', '#b9f3ff'],
        pierce: 0,
        explosionRadius: 0,
        element: 'arcane'
    },
    FROST_LANCE: {
        id: 'frost_lance',
        name: 'Ледяная пика',
        type: 'spell',
        imagePath: '',
        iconColor: '#7fd0ff',
        damage: 26,
        manaCost: 12,
        cooldown: 0.55,
        projectileSpeed: 480,
        projectileRadius: 8,
        projectileLife: 2.2,
        trailColors: ['#dff5ff', '#7fb6ff'],
        pierce: 1,
        explosionRadius: 0,
        slow: 0.25,
        element: 'frost'
    },
    SOLAR_ORB: {
        id: 'solar_orb',
        name: 'Солнечная сфера',
        type: 'spell',
        imagePath: '',
        iconColor: '#ffb347',
        damage: 20,
        manaCost: 18,
        cooldown: 0.8,
        projectileSpeed: 260,
        projectileRadius: 10,
        projectileLife: 2.0,
        trailColors: ['#ffedb0', '#ff934f'],
        pierce: 0,
        explosionRadius: 60,
        element: 'solar',
        onKillMana: 6
    }
};

/**
 * Создаёт предмет по типу
 * @param {string} typeId - ID типа из ItemTypes
 * @param {number} x - Позиция X
 * @param {number} y - Позиция Y
 * @returns {Item}
 */
function createItem(typeId, x = 0, y = 0) {
    const typeKey = Object.keys(ItemTypes).find(k => ItemTypes[k].id === typeId);
    const type = typeKey ? ItemTypes[typeKey] : ItemTypes.ARCANE_BOLT;
    return new Item({ ...type, x, y });
}
