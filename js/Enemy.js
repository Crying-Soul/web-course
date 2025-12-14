/**
 * Enemy - Класс врага
 * Наследуется от Entity, добавляет ИИ и атаку
 */
class Enemy extends Entity {
    constructor(config = {}) {
        // Конфигурация спрайта врага (пока используем тот же что и игрок)
        const enemySpriteConfig = {
            imagePath: config.spritePath || 'images/npc/BestiaryGirl_Default.png',
            frameWidth: 40,
            frameHeight: 55,
            offsetX: 0,
            offsetY: 0,
            spacingX: 0,
            spacingY: 3,
            framesPerRow: 1,
            animations: {
                idle: {
                    frames: [0],
                    speed: 0.2,
                    loop: true
                },
                walk: {
                    frames: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
                    speed: 0.08,
                    loop: true
                },
                attack: {
                    frames: [19, 20, 21, 22],
                    speed: 0.1,
                    loop: false
                }
            }
        };
        
        super({
            ...config,
            spriteConfig: { ...enemySpriteConfig, ...config.spriteConfig },
            hitboxWidth: 20,
            hitboxHeight: 42,
            hitboxOffsetX: 8,
            hitboxOffsetY: 10,
            displayWidth: 36,
            displayHeight: 52
        });
        
        // Параметры врага
        this.health = config.health || 50;
        this.maxHealth = config.maxHealth || 50;
        this.damage = config.damage || 10;
        this.moveSpeed = config.moveSpeed || 60;
        this.attackRange = config.attackRange || 35;
        this.detectionRange = config.detectionRange || 200;
        this.attackCooldown = config.attackCooldown || 1.0;

        // Замедление/дебаффы
        this.slowFactor = 1;
        this.slowTimer = 0;

        // Отслеживание убийств
        this.lastAttacker = null;
        this.lastHitMeta = {};
        
        // Состояние ИИ
        this.aiState = 'idle'; // 'idle', 'chase', 'attack'
        this.target = null;
        this.attackTimer = 0;
        this.isAttacking = false;
        
        // Эффект урона
        this.damageFlashTimer = 0;
        this.damageFlashDuration = 0.15;
        this.isDamaged = false;
        
        // Визуальные эффекты
        this.tint = config.tint || null; // Цвет для отличия врагов
    }

    /**
     * Устанавливает цель для преследования
     * @param {Entity} target
     */
    setTarget(target) {
        this.target = target;
    }

    /**
     * Обновление врага
     * @param {number} dt - Delta time
     * @param {Game} game - Ссылка на игру
     */
    update(dt, game) {
        if (!this.active) return;
        
        // Обновляем таймер урона
        if (this.isDamaged) {
            this.damageFlashTimer -= dt;
            if (this.damageFlashTimer <= 0) {
                this.isDamaged = false;
            }
        }
        
        // Обновляем таймер атаки
        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
        }

        // Сбрасываем замедление
        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
            if (this.slowTimer <= 0) {
                this.slowFactor = 1;
            }
        }
        
        // ИИ
        this.updateAI(dt, game);
        
        // Базовое обновление (анимация)
        super.update(dt, game);
    }

    /**
     * Обновление ИИ
     * @param {number} dt
     * @param {Game} game
     */
    updateAI(dt, game) {
        if (!this.target || !this.target.active) {
            this.aiState = 'idle';
            this.velocityX = 0;
            this.setAnimation('idle');
            return;
        }
        
        // Расстояние до цели
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Определяем направление к цели
        this.direction = dx > 0 ? 1 : -1;
        
        // Проверка анимации атаки
        if (this.isAttacking) {
            const anim = this.spriteConfig.animations['attack'];
            if (this.animationFrame >= anim.frames.length - 1) {
                this.isAttacking = false;
            }
            this.velocityX = 0;
            return;
        }
        
        // Логика ИИ
        if (distance <= this.attackRange) {
            // Атака
            this.aiState = 'attack';
            this.velocityX = 0;
            
            if (this.attackTimer <= 0) {
                this.performAttack(game);
            }
            this.setAnimation('idle');
            
        } else if (distance <= this.detectionRange) {
            // Преследование
            this.aiState = 'chase';
            this.velocityX = this.direction * this.moveSpeed * this.slowFactor;
            this.setAnimation('walk');
            
        } else {
            // Бездействие
            this.aiState = 'idle';
            this.velocityX = 0;
            this.setAnimation('idle');
        }
    }

    /**
     * Выполняет атаку
     * @param {Game} game
     */
    performAttack(game) {
        this.attackTimer = this.attackCooldown;
        this.isAttacking = true;
        this.setAnimation('attack', true);
        
        // Наносим урон цели
        if (this.target && typeof this.target.takeDamage === 'function') {
            const dx = this.target.x - this.x;
            const distance = Math.abs(dx);
            
            if (distance <= this.attackRange + 20) {
                this.target.takeDamage(this.damage);
            }
        }
    }

    /**
     * Получает урон
     * @param {number} amount - Количество урона
     * @param {Entity} attacker - Атакующий
     * @param {Object} context - Доп. сведения об источнике
     */
    takeDamage(amount, attacker = null, context = {}) {
        this.health -= amount;
        this.isDamaged = true;
        this.damageFlashTimer = this.damageFlashDuration;
        this.lastAttacker = attacker;
        this.lastHitMeta = context || {};
        
        // Отброс от атакующего
        if (attacker) {
            const knockbackDir = this.x > attacker.x ? 1 : -1;
            this.velocityX = knockbackDir * 100;
            this.velocityY = -50;
        }
        
        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
    }

    /**
     * Смерть врага
     */
    die() {
        this.active = false;
        console.log('Enemy: Враг уничтожен');

        if (this.gameManager && typeof this.gameManager.handleEnemyKilled === 'function') {
            this.gameManager.handleEnemyKilled(this, this.lastAttacker, this.lastHitMeta);
        }
    }

    /**
     * Применяет замедление к врагу
     * @param {number} amount - 0..1 сила замедления
     * @param {number} duration - длительность эффекта
     */
    applySlow(amount = 0.2, duration = 1.5) {
        this.slowFactor = Math.min(this.slowFactor, 1 - amount);
        this.slowTimer = Math.max(this.slowTimer, duration);
    }

    /**
     * Отрисовка врага
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    render(ctx, camera) {
        if (!this.active) return;
        
        ctx.save();
        
        // Эффект получения урона - красная вспышка
        if (this.isDamaged) {
            ctx.globalCompositeOperation = 'source-over';
        }
        
        // Базовая отрисовка
        super.render(ctx, camera);
        
        // Если получил урон - красный оверлей
        if (this.isDamaged && this.imageLoaded) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            const screenX = Math.floor(this.x - camera.x);
            const screenY = Math.floor(this.y - camera.y);
            ctx.fillRect(screenX, screenY, this.displayWidth, this.displayHeight);
        }
        
        ctx.restore();
        
        // Полоска HP
        this.renderHealthBar(ctx, camera);
    }

    /**
     * Отрисовка полоски здоровья
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    renderHealthBar(ctx, camera) {
        const barWidth = 30;
        const barHeight = 4;
        const screenX = Math.floor(this.x - camera.x) + (this.displayWidth - barWidth) / 2;
        const screenY = Math.floor(this.y - camera.y) - 8;
        
        // Фон
        ctx.fillStyle = '#333333';
        ctx.fillRect(screenX, screenY, barWidth, barHeight);
        
        // HP
        const hpPercent = this.health / this.maxHealth;
        const hpColor = hpPercent > 0.5 ? '#00ff00' : hpPercent > 0.25 ? '#ffff00' : '#ff0000';
        ctx.fillStyle = hpColor;
        ctx.fillRect(screenX, screenY, barWidth * hpPercent, barHeight);
        
        // Рамка
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(screenX, screenY, barWidth, barHeight);
    }
}
