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

        // Расширенные стили каста
        this.castStyle = config.castStyle || 'projectile'; // projectile | beam | zone | spray
        this.projectileCount = config.projectileCount || 1;
        this.spread = config.spread || 0; // в градусах для веера

        // Зоны/новы
        this.zoneRadius = config.zoneRadius || 0;
        this.zoneDuration = config.zoneDuration || 0;
        this.zoneTickDamage = config.zoneTickDamage || 0;
        this.zoneTickRate = config.zoneTickRate || 0.25;

        // Лучи
        this.beamLength = config.beamLength || 0;
        this.beamWidth = config.beamWidth || 0;
        this.beamDuration = config.beamDuration || 0;
        
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
            castStyle: this.castStyle,
            projectileCount: this.projectileCount,
            spread: this.spread,
            zoneRadius: this.zoneRadius,
            zoneDuration: this.zoneDuration,
            zoneTickDamage: this.zoneTickDamage,
            zoneTickRate: this.zoneTickRate,
            beamLength: this.beamLength,
            beamWidth: this.beamWidth,
            beamDuration: this.beamDuration,
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
    // === БАЗОВЫЕ ЗАКЛИНАНИЯ ===
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
        element: 'arcane',
        rarity: 'common',
        dropWeight: 30
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
        element: 'frost',
        rarity: 'uncommon',
        dropWeight: 20
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
        onKillMana: 6,
        rarity: 'uncommon',
        dropWeight: 15
    },
    
    // === НОВЫЕ ЗАКЛИНАНИЯ ===
    FLAME_BURST: {
        id: 'flame_burst',
        name: 'Огненная вспышка',
        type: 'spell',
        imagePath: '',
        iconColor: '#ff4400',
        damage: 35,
        manaCost: 15,
        cooldown: 0.6,
        projectileSpeed: 350,
        projectileRadius: 9,
        projectileLife: 1.8,
        trailColors: ['#ff6600', '#ffcc00', '#ff3300'],
        pierce: 0,
        explosionRadius: 45,
        element: 'fire',
        rarity: 'uncommon',
        dropWeight: 18
    },
    LIGHTNING_BOLT: {
        id: 'lightning_bolt',
        name: 'Молния',
        type: 'spell',
        imagePath: '',
        iconColor: '#ffff00',
        damage: 45,
        manaCost: 20,
        cooldown: 0.9,
        projectileSpeed: 700,
        projectileRadius: 5,
        projectileLife: 1.0,
        trailColors: ['#ffffff', '#ffff00', '#aaccff'],
        pierce: 3,
        explosionRadius: 0,
        element: 'lightning',
        rarity: 'rare',
        dropWeight: 10
    },
    VOID_SPHERE: {
        id: 'void_sphere',
        name: 'Сфера Пустоты',
        type: 'spell',
        imagePath: '',
        iconColor: '#6600cc',
        damage: 55,
        manaCost: 30,
        cooldown: 1.5,
        projectileSpeed: 180,
        projectileRadius: 14,
        projectileLife: 3.0,
        trailColors: ['#330066', '#6600cc', '#9933ff'],
        pierce: 2,
        explosionRadius: 80,
        slow: 0.4,
        element: 'void',
        onKillMana: 10,
        rarity: 'rare',
        dropWeight: 8
    },
    POISON_CLOUD: {
        id: 'poison_cloud',
        name: 'Ядовитое облако',
        type: 'spell',
        imagePath: '',
        iconColor: '#00ff00',
        damage: 15,
        manaCost: 10,
        cooldown: 0.4,
        projectileSpeed: 280,
        projectileRadius: 12,
        projectileLife: 2.5,
        trailColors: ['#00ff00', '#88ff00', '#ccff00'],
        pierce: 5,
        explosionRadius: 0,
        slow: 0.15,
        element: 'poison',
        rarity: 'common',
        dropWeight: 25
    },
    CRYSTAL_SHARD: {
        id: 'crystal_shard',
        name: 'Кристальный осколок',
        type: 'spell',
        imagePath: '',
        iconColor: '#ff88ff',
        damage: 22,
        manaCost: 8,
        cooldown: 0.3,
        projectileSpeed: 500,
        projectileRadius: 6,
        projectileLife: 2.0,
        trailColors: ['#ff88ff', '#ffaaff', '#ffccff'],
        pierce: 1,
        explosionRadius: 0,
        element: 'crystal',
        rarity: 'common',
        dropWeight: 28
    },
    METEOR_STRIKE: {
        id: 'meteor_strike',
        name: 'Удар метеора',
        type: 'spell',
        imagePath: '',
        iconColor: '#ff6600',
        damage: 80,
        manaCost: 45,
        cooldown: 2.5,
        projectileSpeed: 400,
        projectileRadius: 16,
        projectileLife: 2.0,
        trailColors: ['#ff3300', '#ff6600', '#ffcc00'],
        pierce: 0,
        explosionRadius: 120,
        element: 'fire',
        onKillMana: 15,
        rarity: 'epic',
        dropWeight: 3
    },
    CHAIN_LIGHTNING: {
        id: 'chain_lightning',
        name: 'Цепная молния',
        type: 'spell',
        imagePath: '',
        iconColor: '#88ffff',
        damage: 30,
        manaCost: 25,
        cooldown: 1.0,
        projectileSpeed: 600,
        projectileRadius: 7,
        projectileLife: 1.5,
        trailColors: ['#88ffff', '#aaffff', '#ffffff'],
        pierce: 6,
        explosionRadius: 25,
        element: 'lightning',
        rarity: 'rare',
        dropWeight: 7
    },
    SHADOW_BOLT: {
        id: 'shadow_bolt',
        name: 'Теневой снаряд',
        type: 'spell',
        imagePath: '',
        iconColor: '#333366',
        damage: 40,
        manaCost: 18,
        cooldown: 0.7,
        projectileSpeed: 380,
        projectileRadius: 8,
        projectileLife: 2.2,
        trailColors: ['#111133', '#333366', '#555599'],
        pierce: 0,
        explosionRadius: 35,
        slow: 0.3,
        element: 'shadow',
        onKillMana: 8,
        rarity: 'uncommon',
        dropWeight: 15
    },
    HOLY_LIGHT: {
        id: 'holy_light',
        name: 'Святой свет',
        type: 'spell',
        imagePath: '',
        iconColor: '#ffffcc',
        damage: 50,
        manaCost: 22,
        cooldown: 0.8,
        projectileSpeed: 450,
        projectileRadius: 10,
        projectileLife: 2.0,
        trailColors: ['#ffffcc', '#ffffff', '#ffff88'],
        pierce: 2,
        explosionRadius: 50,
        element: 'holy',
        onKillMana: 5,
        rarity: 'rare',
        dropWeight: 9
    },
    WATER_WAVE: {
        id: 'water_wave',
        name: 'Водяная волна',
        type: 'spell',
        imagePath: '',
        iconColor: '#0088ff',
        damage: 25,
        manaCost: 14,
        cooldown: 0.5,
        projectileSpeed: 320,
        projectileRadius: 11,
        projectileLife: 2.3,
        trailColors: ['#0066cc', '#0088ff', '#66ccff'],
        pierce: 3,
        explosionRadius: 0,
        slow: 0.35,
        element: 'water',
        rarity: 'uncommon',
        dropWeight: 18
    },
    EARTH_SPIKE: {
        id: 'earth_spike',
        name: 'Земляной шип',
        type: 'spell',
        imagePath: '',
        iconColor: '#885522',
        damage: 60,
        manaCost: 28,
        cooldown: 1.2,
        projectileSpeed: 250,
        projectileRadius: 13,
        projectileLife: 1.8,
        trailColors: ['#664411', '#885522', '#aa7744'],
        pierce: 0,
        explosionRadius: 70,
        slow: 0.5,
        element: 'earth',
        rarity: 'rare',
        dropWeight: 8
    },

    // === НОВЫЕ ФОРМЫ КАСТА ===
    ARCANE_BEAM: {
        id: 'arcane_beam',
        name: 'Аркановый луч',
        type: 'spell',
        imagePath: '',
        iconColor: '#a2f0ff',
        damage: 32,
        manaCost: 16,
        cooldown: 0.7,
        castStyle: 'beam',
        beamLength: 420,
        beamWidth: 18,
        beamDuration: 0.25,
        element: 'arcane',
        rarity: 'uncommon',
        dropWeight: 18
    },
    FROST_NOVA: {
        id: 'frost_nova',
        name: 'Ледяная нова',
        type: 'spell',
        imagePath: '',
        iconColor: '#c2f6ff',
        damage: 0,
        manaCost: 18,
        cooldown: 1.2,
        castStyle: 'zone',
        zoneRadius: 110,
        zoneDuration: 1.2,
        zoneTickDamage: 12,
        zoneTickRate: 0.2,
        slow: 0.4,
        element: 'frost',
        rarity: 'rare',
        dropWeight: 10
    },
    THORN_BURST: {
        id: 'thorn_burst',
        name: 'Шиповой веер',
        type: 'spell',
        imagePath: '',
        iconColor: '#7fb25c',
        damage: 18,
        manaCost: 10,
        cooldown: 0.6,
        castStyle: 'spray',
        projectileCount: 7,
        spread: 60,
        projectileSpeed: 380,
        projectileRadius: 6,
        projectileLife: 1.6,
        element: 'earth',
        rarity: 'uncommon',
        dropWeight: 16
    }
};

/**
 * Таблица редкости для цвета свечения
 */
const RarityColors = {
    common: '#ffffff',
    uncommon: '#00ff00',
    rare: '#0088ff',
    epic: '#aa00ff',
    legendary: '#ff8800'
};

/**
 * Получить случайный тип заклинания на основе веса дропа
 * @returns {string} ID типа предмета
 */
function getRandomSpellType() {
    const spells = Object.values(ItemTypes).filter(item => item.type === 'spell');
    
    // Вычисляем общий вес
    let totalWeight = 0;
    for (const spell of spells) {
        totalWeight += spell.dropWeight || 10;
    }
    
    // Выбираем случайный
    let random = Math.random() * totalWeight;
    for (const spell of spells) {
        random -= spell.dropWeight || 10;
        if (random <= 0) {
            return spell.id;
        }
    }
    
    return 'arcane_bolt';
}

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
