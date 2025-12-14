/**
 * Player - Класс игрока
 * Наследуется от Entity, добавляет управление и специфичную логику
 */
class Player extends Entity {
    constructor(config = {}) {
        // Конфигурация спрайта игрока (BestiaryGirl)
        const playerSpriteConfig = {
            imagePath: 'images/npc/BestiaryGirl_Default.png',
            frameWidth: 40,       // Ширина одного кадра
            frameHeight: 55,      // Высота одного кадра
            offsetX: 0,           // Отступ слева
            offsetY: 0,           // Отступ сверху
            spacingX: 0,          // Промежуток по X
            spacingY: 3,          // Промежуток по Y
            framesPerRow: 1,      // Вертикальный спрайт (1 кадр в строке)
            animations: {
                idle: {
                    frames: [0],  // Кадры для анимации (индексы)
                    speed: 0.2,
                    loop: true
                },
                walk: {
                    frames: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
                    speed: 0.06,
                    loop: true
                },
                jump: {
                    frames: [1],
                    speed: 0.1,
                    loop: false
                },
                fall: {
                    frames: [1],
                    speed: 0.1,
                    loop: false
                }, 
                attack: {
                    frames: [19, 20, 21, 22],
                    speed: 0.08,
                    loop: false
                }
            }
            ,
            smooth: true // улучшить качество отрисовки спрайта игрока
        };
        
        // Объединяем с переданной конфигурацией
        super({
            ...config,
            spriteConfig: { ...playerSpriteConfig, ...config.spriteConfig },
            hitboxWidth: 20,
            hitboxHeight: 42,
            hitboxOffsetX: 8,
            hitboxOffsetY: 10,
            displayWidth: 36,
            displayHeight: 52
        });
        
        // Параметры движения игрока
        this.moveSpeed = 150;      // Скорость ходьбы
        this.jumpForce = 350;      // Сила прыжка
        this.airControl = 0.7;     // Контроль в воздухе (множитель)
        
        // Состояния
        this.isJumping = false;
        this.canJump = true;
        
        // Количество прыжков (для двойного прыжка в будущем)
        this.maxJumps = 1;
        this.jumpsLeft = this.maxJumps;
        
        // Инвентарь
        this.inventory = new Inventory(6);
        
        // Магия
        this.isCasting = false;
        this.castTimer = 0;
        this.castWindup = 0.18; // короткая задержка для анимации
        this.spellCooldowns = new Map();
        this.globalCastLock = 0;

        // Ресурс маны
        this.maxMana = 120;
        this.mana = this.maxMana;
        this.manaRegen = 18; // в секунду
        this.manaRegenDelay = 0.6;
        this.manaRegenCooldown = 0;

        // Баффы
        this.buffs = [];
        
        // Эффект урона
        this.damageFlashTimer = 0;
        this.damageFlashDuration = 0.2;
        this.isDamaged = false;
        this.invincibleTimer = 0; // Неуязвимость после получения урона
        this.invincibleDuration = 0.5;
    }
    
    /**
     * Обновление маны (реген с задержкой)
     */
    updateMana(dt) {
        if (this.manaRegenCooldown > 0) {
            this.manaRegenCooldown -= dt;
            return;
        }

        const regen = this.manaRegen * this.getManaRegenMultiplier();
        this.mana = Math.min(this.maxMana, this.mana + regen * dt);
    }

    /**
     * Обновление и очистка баффов
     */
    updateBuffs(dt) {
        this.buffs = this.buffs.filter(buff => {
            buff.timeLeft -= dt;
            return buff.timeLeft > 0;
        });
    }

    addBuff(id, config) {
        const existing = this.buffs.find(b => b.id === id);
        if (existing) {
            existing.stacks = Math.min(existing.stacks + (config.stacks || 1), existing.maxStacks || existing.stacks);
            const newDuration = config.duration || existing.duration || 0;
            existing.duration = Math.max(existing.duration || 0, newDuration);
            existing.timeLeft = Math.max(existing.timeLeft, newDuration);
        } else {
            this.buffs.push({
                id,
                stacks: config.stacks || 1,
                maxStacks: config.maxStacks || 10,
                timeLeft: config.duration || 5,
                duration: config.duration || 5,
                bonuses: config.bonuses || {}
            });
        }
    }

    getBuffValue(key) {
        let value = 0;
        for (const buff of this.buffs) {
            if (buff.bonuses && buff.bonuses[key]) {
                value += buff.bonuses[key] * buff.stacks;
            }
        }
        return value;
    }

    getDamageMultiplier() {
        return 1 + this.getBuffValue('damage');
    }

    getProjectileSpeedMultiplier() {
        return 1 + this.getBuffValue('projectileSpeed');
    }

    getManaRegenMultiplier() {
        return 1 + this.getBuffValue('manaRegen');
    }

    /**
     * Реакция на убийство врага
     */
    onKill(enemy, context = {}) {
        this.addBuff('arcane_fury', {
            stacks: 1,
            maxStacks: 12,
            duration: 8,
            bonuses: {
                damage: 0.05,
                projectileSpeed: 0.04,
                manaRegen: 0.04
            }
        });

        const manaBonus = 10 + (context.onKillMana || 0);
        this.mana = Math.min(this.maxMana, this.mana + manaBonus);
    }

    /**
     * Обработка ввода игрока
    * @param {EventManager} eventManager - Менеджер событий
    * @param {Game} game - Игра
     */
    handleInput(eventManager, game) {
        // Не двигаемся во время атаки
        // if (this.isAttacking) {
        //     this.velocityX = 0;
        //     return;
        // }
        
        // Горизонтальное движение
        let moveX = 0;
        
        if (eventManager.isKeyDown('KeyA') || eventManager.isKeyDown('ArrowLeft')) {
            moveX = -1;
            this.direction = -1;
        }
        if (eventManager.isKeyDown('KeyD') || eventManager.isKeyDown('ArrowRight')) {
            moveX = 1;
            this.direction = 1;
        }
        
        // Применяем скорость с учётом контроля в воздухе
        const control = this.onGround ? 1 : this.airControl;
        this.velocityX = moveX * this.moveSpeed * control;
        
        // Прыжок
        if ((eventManager.isKeyJustPressed('Space') || eventManager.isKeyJustPressed('KeyW') || eventManager.isKeyJustPressed('ArrowUp'))) {
            this.jump();
        }
        
        // Каст (ЛКМ или E)
        if (eventManager.mouse.leftButton || eventManager.isKeyJustPressed('KeyE')) {
            this.tryCastSpell(game);
        }
        
        // Переключение слотов инвентаря (1-6)
        for (let i = 1; i <= 6; i++) {
            if (eventManager.isKeyJustPressed(`Digit${i}`)) {
                this.inventory.selectSlot(i - 1);
            }
        }
        
        // Колёсико мыши для переключения слотов
        // (реализуется через EventManager если нужно)
    }
    
    /**
     * Попытка атаки
     */
    tryCastSpell(game) {
        if (this.isCasting || this.globalCastLock > 0) return;

        const spell = this.inventory.getSelectedItem();
        if (!spell || spell.type !== 'spell') return;

        const cooldown = this.spellCooldowns.get(spell.id) || 0;
        if (cooldown > 0) return;

        if (this.mana < spell.manaCost) return;

        // Расходуем ресурсы и ставим кулдауны
        this.mana -= spell.manaCost;
        this.manaRegenCooldown = this.manaRegenDelay;
        this.spellCooldowns.set(spell.id, spell.cooldown);
        this.globalCastLock = 0.08;

        this.isCasting = true;
        this.castTimer = this.castWindup;
        this.setAnimation('attack', true);

        this.castSpell(spell, game);
    }

    /**
     * Создаёт магический снаряд
     * @param {Item} spell
     * @param {Game} game
     */
    castSpell(spell, game) {
        const centerX = this.x + this.displayWidth / 2;
        const centerY = this.y + this.displayHeight / 2 - 6;
        const targetX = game.eventManager.mouse.worldX || centerX + this.direction;
        const targetY = game.eventManager.mouse.worldY || centerY;
        const dirX = targetX - centerX;
        const dirY = targetY - centerY;

        const projectile = new MagicProjectile({
            x: centerX,
            y: centerY,
            dirX,
            dirY,
            speed: spell.projectileSpeed * this.getProjectileSpeedMultiplier(),
            damage: spell.damage * this.getDamageMultiplier(),
            radius: spell.projectileRadius,
            lifeTime: spell.projectileLife,
            trailColors: spell.trailColors,
            pierce: spell.pierce,
            explosionRadius: spell.explosionRadius,
            element: spell.element,
            slowAmount: spell.slow,
            owner: this,
            onKillMana: spell.onKillMana,
            spellId: spell.id,
            game
        });

        // Направление персонажа смотрит туда же
        this.direction = dirX >= 0 ? 1 : -1;

        if (game && game.gameManager) {
            game.gameManager.addProjectile(projectile);
        }
    }

    /**
     * Выполняет прыжок
     */
    jump() {
        if (this.onGround && this.jumpsLeft > 0) {
            this.velocityY = -this.jumpForce;
            this.isJumping = true;
            this.onGround = false;
            this.jumpsLeft--;
        }
    }

    /**
     * Обновление состояния игрока
     * @param {number} dt - Delta time
     * @param {Game} game - Ссылка на игру
     */
    update(dt, game) {
        // Обновляем таймеры
        if (this.invincibleTimer > 0) {
            this.invincibleTimer -= dt;
        }
        
        if (this.isDamaged) {
            this.damageFlashTimer -= dt;
            if (this.damageFlashTimer <= 0) {
                this.isDamaged = false;
            }
        }

        if (this.globalCastLock > 0) {
            this.globalCastLock -= dt;
        }

        if (this.isCasting) {
            this.castTimer -= dt;
            if (this.castTimer <= 0) {
                this.isCasting = false;
            }
        }

        // Персональные кулдауны заклинаний
        for (const [spellId, value] of this.spellCooldowns.entries()) {
            const next = value - dt;
            if (next <= 0) {
                this.spellCooldowns.delete(spellId);
            } else {
                this.spellCooldowns.set(spellId, next);
            }
        }

        // Манареген и баффы
        this.updateMana(dt);
        this.updateBuffs(dt);
        
        // Обработка ввода
        this.handleInput(game.eventManager, game);
        
        // Восстановление прыжков при приземлении
        if (this.onGround) {
            this.jumpsLeft = this.maxJumps;
            this.isJumping = false;
        }
        
        // Подбор предметов
        this.pickupItems(game);
        
        // Обновление анимации на основе состояния
        this.updateAnimationState();
        
        // Базовое обновление (анимация)
        super.update(dt, game);
    }
    
    /**
     * Подбирает предметы рядом
     * @param {Game} game
     */
    pickupItems(game) {
        const bounds = this.getBounds();
        
        for (let i = game.gameManager.items.length - 1; i >= 0; i--) {
            const item = game.gameManager.items[i];
            if (!item.active) continue;
            
            const itemBounds = item.getBounds();
            
            // Простая проверка пересечения
            if (bounds.left < itemBounds.right &&
                bounds.right > itemBounds.left &&
                bounds.top < itemBounds.bottom &&
                bounds.bottom > itemBounds.top) {
                
                // Пробуем добавить в инвентарь
                if (this.inventory.addItem(item)) {
                    item.active = false;
                    console.log(`Player: Подобран ${item.name}`);
                }
            }
        }
    }

    /**
     * Определяет текущую анимацию на основе состояния
     */
    updateAnimationState() {
        // Не меняем анимацию во время каста
        if (this.isCasting) {
            this.setAnimation('attack');
            return;
        }
        
        if (!this.onGround) {
            if (this.velocityY < 0) {
                this.setAnimation('jump');
            } else {
                this.setAnimation('fall');
            }
        } else if (Math.abs(this.velocityX) > 10) {
            this.setAnimation('walk');
        } else {
            this.setAnimation('idle');
        }
    }

    /**
     * Получает урон
     * @param {number} amount - Количество урона
     */
    takeDamage(amount) {
        // Неуязвимость после удара
        if (this.invincibleTimer > 0) return;
        
        this.health -= amount;
        this.isDamaged = true;
        this.damageFlashTimer = this.damageFlashDuration;
        this.invincibleTimer = this.invincibleDuration;
        
        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
    }

    /**
     * Смерть игрока
     */
    die() {
        console.log('Player: Игрок погиб!');
        // В будущем - респаун, game over экран и т.д.
    }
    
    /**
     * Отрисовка игрока
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    render(ctx, camera) {
        if (!this.active) return;
        
        ctx.save();
        
        // Мигание при неуязвимости
        if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer * 10) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }
        
        // Базовая отрисовка
        super.render(ctx, camera);
        
        ctx.restore();

        // Светящийся шар в руке при касте
        if (this.isCasting) {
            const handX = Math.floor(this.x - camera.x + (this.direction === 1 ? this.displayWidth - 10 : 10));
            const handY = Math.floor(this.y - camera.y + this.displayHeight / 2);
            const r = 10;
            const g = ctx.createRadialGradient(handX, handY, 2, handX, handY, r);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(0.4, '#7cf7ff');
            g.addColorStop(1, 'rgba(124,247,255,0)');
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(handX, handY, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
    }
    
    
    /**
     * Отрисовка UI игрока (HP бар)
     * @param {CanvasRenderingContext2D} ctx
     */
    renderUI(ctx) {
        // HP бар в верхней части экрана справа
        const barWidth = 150;
        const barHeight = 16;
        const x = ctx.canvas.width - barWidth - 50;
        const y = 15;
        
        // Фон
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x - 5, y - 5, barWidth + 10, barHeight + 10);
        
        // Фон полоски
        ctx.fillStyle = '#333333';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // HP
        const hpPercent = this.health / this.maxHealth;
        const hpColor = hpPercent > 0.5 ? '#ff3333' : hpPercent > 0.25 ? '#ff6633' : '#ff0000';
        ctx.fillStyle = hpColor;
        ctx.fillRect(x, y, barWidth * hpPercent, barHeight);
        
        // Текст
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(this.health)} / ${this.maxHealth}`, x + barWidth / 2, y + 12);
        
        // Иконка сердца
        ctx.fillStyle = '#ff0000';
        ctx.font = '14px Arial';
        ctx.textAlign = 'right';
        ctx.fillText('❤', x - 8, y + 13);
        
        // Рамка
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, barWidth, barHeight);

        // Мана под HP
        const manaY = y + barHeight + 12;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x - 5, manaY - 5, barWidth + 10, barHeight + 10);

        ctx.fillStyle = '#1c2d5c';
        ctx.fillRect(x, manaY, barWidth, barHeight);

        const manaPercent = this.mana / this.maxMana;
        const manaColor = '#4bc8ff';
        ctx.fillStyle = manaColor;
        ctx.fillRect(x, manaY, barWidth * manaPercent, barHeight);

        ctx.fillStyle = '#e0f6ff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.floor(this.mana)} / ${this.maxMana}`, x + barWidth / 2, manaY + 12);
        ctx.strokeStyle = '#4bc8ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, manaY, barWidth, barHeight);

        // Активные баффы (слева сверху)
        const buffSize = 26;
        const buffStartX = 12;
        const buffStartY = 12;
        for (let i = 0; i < this.buffs.length; i++) {
            const buff = this.buffs[i];
            const bx = buffStartX;
            const by = buffStartY + i * (buffSize + 6);
            ctx.fillStyle = 'rgba(20, 26, 52, 0.75)';
            ctx.fillRect(bx, by, buffSize * 2.8, buffSize);
            ctx.strokeStyle = '#6cf0ff';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, buffSize * 2.8, buffSize);

            ctx.fillStyle = '#6cf0ff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`${buff.id.toUpperCase()} x${buff.stacks}`, bx + 6, by + 16);

            ctx.fillStyle = 'rgba(108, 240, 255, 0.35)';
            const pct = Math.min(buff.timeLeft / (buff.duration || buff.timeLeft), 1);
            ctx.fillRect(bx, by + buffSize - 6, (buffSize * 2.8) * pct, 4);
        }
    }
}
