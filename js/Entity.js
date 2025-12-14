/**
 * Entity - Базовый класс для всех игровых сущностей
 * Игрок, враги, NPC наследуются от этого класса
 */
class Entity {
    /**
     * @param {Object} config - Конфигурация сущности
     * @param {number} config.x - Начальная позиция X
     * @param {number} config.y - Начальная позиция Y
     * @param {Object} config.spriteConfig - Настройки спрайта
     */
    constructor(config = {}) {
        // Позиция (левый верхний угол)
        this.x = config.x || 0;
        this.y = config.y || 0;
        
        // Скорость
        this.velocityX = 0;
        this.velocityY = 0;
        
        // Физика
        this.hasPhysics = true;
        this.onGround = false;
        
        // Направление (1 = вправо, -1 = влево)
        this.direction = 1;
        
        // Конфигурация спрайта и анимаций
        this.spriteConfig = config.spriteConfig || {
            imagePath: '',
            frameWidth: 32,
            frameHeight: 32,
            offsetX: 0,           // Отступ от левого края изображения
            offsetY: 0,           // Отступ от верхнего края
            spacingX: 0,          // Промежуток между кадрами по X
            spacingY: 0,          // Промежуток между кадрами по Y
            framesPerRow: 1,      // Кадров в строке (для горизонтальных спрайтов)
            animations: {}        // Конфигурация анимаций
        };
        
        // Хитбокс (относительно позиции сущности)
        this.hitboxWidth = config.hitboxWidth || 20;
        this.hitboxHeight = config.hitboxHeight || 40;
        this.hitboxOffsetX = config.hitboxOffsetX || 6; // Смещение хитбокса от x
        this.hitboxOffsetY = config.hitboxOffsetY || 0; // Смещение хитбокса от y
        
        // Размер отображения спрайта
        this.displayWidth = config.displayWidth || this.spriteConfig.frameWidth;
        this.displayHeight = config.displayHeight || this.spriteConfig.frameHeight;
        
        // Текущая анимация
        this.currentAnimation = 'idle';
        this.animationFrame = 0;
        this.animationTimer = 0;
        this.animationSpeed = 0.1; // секунд на кадр
        
        // Загруженное изображение
        this.image = null;
        this.imageLoaded = false;
        
        // Активность сущности
        this.active = true;
        
        // Здоровье
        this.health = 100;
        this.maxHealth = 100;
    }

    /**
     * Загружает спрайт сущности
     * @returns {Promise<void>}
     */
    async loadSprite() {
        if (!this.spriteConfig.imagePath) return;
        
        return new Promise((resolve, reject) => {
            this.image = new Image();
            
            this.image.onload = () => {
                this.imageLoaded = true;
                console.log(`Entity: Спрайт загружен - ${this.spriteConfig.imagePath}`);
                resolve();
            };
            
            this.image.onerror = () => {
                console.error(`Entity: Ошибка загрузки спрайта - ${this.spriteConfig.imagePath}`);
                reject(new Error(`Failed to load sprite: ${this.spriteConfig.imagePath}`));
            };
            
            this.image.src = this.spriteConfig.imagePath;
        });
    }

    /**
     * Возвращает границы хитбокса
     * @returns {Object} - {left, top, right, bottom, width, height}
     */
    getBounds() {
        return {
            left: this.x + this.hitboxOffsetX,
            top: this.y + this.hitboxOffsetY,
            right: this.x + this.hitboxOffsetX + this.hitboxWidth,
            bottom: this.y + this.hitboxOffsetY + this.hitboxHeight,
            width: this.hitboxWidth,
            height: this.hitboxHeight
        };
    }

    /**
     * Устанавливает анимацию
     * @param {string} name - Название анимации
     * @param {boolean} reset - Сбросить на первый кадр
     */
    setAnimation(name, reset = false) {
        if (this.currentAnimation !== name || reset) {
            this.currentAnimation = name;
            if (reset) {
                this.animationFrame = 0;
                this.animationTimer = 0;
            }
        }
    }

    /**
     * Обновляет анимацию
     * @param {number} dt - Delta time
     */
    updateAnimation(dt) {
        const anim = this.spriteConfig.animations[this.currentAnimation];
        if (!anim) return;
        
        this.animationTimer += dt;
        
        const frameTime = anim.speed || this.animationSpeed;
        
        if (this.animationTimer >= frameTime) {
            this.animationTimer -= frameTime;
            this.animationFrame++;
            
            if (this.animationFrame >= anim.frames.length) {
                if (anim.loop !== false) {
                    this.animationFrame = 0;
                } else {
                    this.animationFrame = anim.frames.length - 1;
                }
            }
        }
    }

    /**
     * Обновление сущности
     * @param {number} dt - Delta time
     * @param {Game} game - Ссылка на игру
     */
    update(dt, game) {
        this.updateAnimation(dt);
    }

    /**
     * Отрисовка сущности
     * @param {CanvasRenderingContext2D} ctx - Контекст canvas
     * @param {Object} camera - Камера
     */
    render(ctx, camera) {
        if (!this.active) return;
        
        // Позиция на экране
        const screenX = Math.floor(this.x - camera.x);
        const screenY = Math.floor(this.y - camera.y);
        
        // Если спрайт не загружен - рисуем заглушку
        if (!this.imageLoaded) {
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(screenX, screenY, this.displayWidth, this.displayHeight);
            return;
        }
        
        const anim = this.spriteConfig.animations[this.currentAnimation];
        if (!anim) {
            // Нет анимации - рисуем заглушку
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(screenX, screenY, this.displayWidth, this.displayHeight);
            return;
        }
        
        // Получаем текущий кадр
        const frameIndex = anim.frames[this.animationFrame] || 0;
        
        // Вычисляем позицию кадра в спрайт-листе
        const { frameWidth, frameHeight, offsetX, offsetY, spacingX, spacingY, framesPerRow } = this.spriteConfig;
        
        let srcX, srcY;
        
        if (framesPerRow === 1) {
            // Вертикальный спрайт-лист
            srcX = offsetX;
            srcY = offsetY + frameIndex * (frameHeight + spacingY);
        } else {
            // Горизонтальный или смешанный спрайт-лист
            const col = frameIndex % framesPerRow;
            const row = Math.floor(frameIndex / framesPerRow);
            srcX = offsetX + col * (frameWidth + spacingX);
            srcY = offsetY + row * (frameHeight + spacingY);
        }
        
        ctx.save();
        
        // Отзеркаливание: спрайт в файле ориентирован влево, поэтому
        // при направлении вправо (1) нужно отзеркалить его по X
        if (this.direction === 1) {
            ctx.translate(screenX + this.displayWidth, screenY);
            ctx.scale(-1, 1);
            ctx.drawImage(
                this.image,
                srcX, srcY, frameWidth, frameHeight,
                0, 0, this.displayWidth, this.displayHeight
            );
        } else {
            ctx.drawImage(
                this.image,
                srcX, srcY, frameWidth, frameHeight,
                screenX, screenY, this.displayWidth, this.displayHeight
            );
        }
        
        ctx.restore();
    }

    /**
     * Отрисовка хитбокса (для отладки)
     * @param {CanvasRenderingContext2D} ctx - Контекст canvas
     * @param {Object} camera - Камера
     */
    renderDebug(ctx, camera) {
        const bounds = this.getBounds();
        const screenX = bounds.left - camera.x;
        const screenY = bounds.top - camera.y;
        
        ctx.strokeStyle = this.onGround ? 'lime' : 'red';
        ctx.lineWidth = 1;
        ctx.strokeRect(screenX, screenY, bounds.width, bounds.height);
    }
}
