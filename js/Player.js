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
                    speed: 0.1,
                    loop: false
                }
            }
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
    }

    /**
     * Обработка ввода игрока
     * @param {EventManager} eventManager - Менеджер событий
     */
    handleInput(eventManager) {
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
        // Обработка ввода
        this.handleInput(game.eventManager);
        
        // Восстановление прыжков при приземлении
        if (this.onGround) {
            this.jumpsLeft = this.maxJumps;
            this.isJumping = false;
        }
        
        // Обновление анимации на основе состояния
        this.updateAnimationState();
        
        // Базовое обновление (анимация)
        super.update(dt, game);
    }

    /**
     * Определяет текущую анимацию на основе состояния
     */
    updateAnimationState() {
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
        this.health -= amount;
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
}
