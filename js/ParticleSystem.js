/**
 * ParticleSystem - Система частиц для визуальных эффектов
 * Управляет созданием, обновлением и рендером частиц
 */

/**
 * Particle - Отдельная частица
 */
class Particle {
    constructor(options = {}) {
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.vx = options.vx || 0;
        this.vy = options.vy || 0;
        this.ax = options.ax || 0;
        this.ay = options.ay || 0;
        this.life = options.life || 1;
        this.maxLife = options.life || 1;
        this.size = options.size || 4;
        this.sizeDecay = options.sizeDecay !== undefined ? options.sizeDecay : 0.5;
        this.color = options.color || '#ffffff';
        this.colors = options.colors || null; // Массив цветов для градиента по времени
        this.alpha = options.alpha !== undefined ? options.alpha : 1;
        this.alphaDecay = options.alphaDecay !== undefined ? options.alphaDecay : true;
        this.rotation = options.rotation || 0;
        this.rotationSpeed = options.rotationSpeed || 0;
        this.shape = options.shape || 'circle'; // 'circle', 'square', 'star', 'line'
        this.gravity = options.gravity || 0;
        this.friction = options.friction || 1;
        this.active = true;
    }

    update(dt) {
        if (!this.active) return;

        // Физика
        this.vx += this.ax * dt;
        this.vy += (this.ay + this.gravity) * dt;
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.rotation += this.rotationSpeed * dt;

        // Время жизни
        this.life -= dt;
        if (this.life <= 0) {
            this.active = false;
        }
    }

    render(ctx, camera) {
        if (!this.active) return;

        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;
        const lifePercent = this.life / this.maxLife;

        // Размер с затуханием
        const currentSize = this.size * (1 - (1 - lifePercent) * this.sizeDecay);
        if (currentSize <= 0) return;

        // Прозрачность
        let currentAlpha = this.alpha;
        if (this.alphaDecay) {
            currentAlpha *= lifePercent;
        }

        // Цвет
        let currentColor = this.color;
        if (this.colors && this.colors.length > 1) {
            const colorIndex = Math.floor((1 - lifePercent) * (this.colors.length - 1));
            currentColor = this.colors[Math.min(colorIndex, this.colors.length - 1)];
        }

        ctx.save();
        ctx.globalAlpha = currentAlpha;
        ctx.translate(screenX, screenY);
        ctx.rotate(this.rotation);

        ctx.fillStyle = currentColor;

        switch (this.shape) {
            case 'square':
                ctx.fillRect(-currentSize / 2, -currentSize / 2, currentSize, currentSize);
                break;
            case 'star':
                this.drawStar(ctx, 0, 0, 5, currentSize, currentSize / 2);
                break;
            case 'line':
                ctx.strokeStyle = currentColor;
                ctx.lineWidth = currentSize / 4;
                ctx.beginPath();
                ctx.moveTo(-currentSize, 0);
                ctx.lineTo(currentSize, 0);
                ctx.stroke();
                break;
            default: // circle
                ctx.beginPath();
                ctx.arc(0, 0, currentSize, 0, Math.PI * 2);
                ctx.fill();
        }

        ctx.restore();
    }

    drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        const step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);

        for (let i = 0; i < spikes; i++) {
            ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
            rot += step;
            ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
            rot += step;
        }

        ctx.closePath();
        ctx.fill();
    }
}

/**
 * ParticleEmitter - Источник частиц
 */
class ParticleEmitter {
    constructor(options = {}) {
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.active = true;
        this.particles = [];
        
        // Настройки эмиттера
        this.emitRate = options.emitRate || 10; // частиц в секунду
        this.duration = options.duration || -1; // -1 = бесконечно
        this.burstCount = options.burstCount || 0; // для мгновенного выброса
        this.age = 0;
        this.emitTimer = 0;

        // Шаблон частиц
        this.particleTemplate = {
            life: options.particleLife || 1,
            lifeVariance: options.lifeVariance || 0.3,
            size: options.particleSize || 4,
            sizeVariance: options.sizeVariance || 2,
            speed: options.speed || 100,
            speedVariance: options.speedVariance || 50,
            angle: options.angle || 0,
            angleSpread: options.angleSpread || Math.PI * 2,
            color: options.color || '#ffffff',
            colors: options.colors || null,
            gravity: options.gravity || 0,
            friction: options.friction || 1,
            shape: options.shape || 'circle',
            alphaDecay: options.alphaDecay !== undefined ? options.alphaDecay : true,
            sizeDecay: options.sizeDecay !== undefined ? options.sizeDecay : 0.5,
            rotationSpeed: options.rotationSpeed || 0
        };
    }

    emit(count = 1) {
        const t = this.particleTemplate;
        
        for (let i = 0; i < count; i++) {
            const angle = t.angle + (Math.random() - 0.5) * t.angleSpread;
            const speed = t.speed + (Math.random() - 0.5) * t.speedVariance;
            const life = t.life + (Math.random() - 0.5) * t.lifeVariance;
            const size = t.size + (Math.random() - 0.5) * t.sizeVariance;

            const particle = new Particle({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: Math.max(0.1, life),
                size: Math.max(1, size),
                color: t.color,
                colors: t.colors,
                gravity: t.gravity,
                friction: t.friction,
                shape: t.shape,
                alphaDecay: t.alphaDecay,
                sizeDecay: t.sizeDecay,
                rotationSpeed: t.rotationSpeed + (Math.random() - 0.5) * 2
            });

            this.particles.push(particle);
        }
    }

    update(dt) {
        if (!this.active && this.particles.length === 0) return;

        // Обновляем возраст
        if (this.active) {
            this.age += dt;

            // Проверяем длительность
            if (this.duration > 0 && this.age >= this.duration) {
                this.active = false;
            }

            // Непрерывная эмиссия
            if (this.emitRate > 0) {
                this.emitTimer += dt;
                const interval = 1 / this.emitRate;
                while (this.emitTimer >= interval) {
                    this.emit(1);
                    this.emitTimer -= interval;
                }
            }
        }

        // Обновляем частицы
        for (const particle of this.particles) {
            particle.update(dt);
        }

        // Удаляем неактивные
        this.particles = this.particles.filter(p => p.active);
    }

    render(ctx, camera) {
        for (const particle of this.particles) {
            particle.render(ctx, camera);
        }
    }

    burst(count) {
        this.emit(count || this.burstCount || 10);
    }

    stop() {
        this.active = false;
    }

    isFinished() {
        return !this.active && this.particles.length === 0;
    }
}

/**
 * ParticleSystem - Глобальный менеджер частиц
 */
class ParticleSystem {
    constructor() {
        this.emitters = [];
    }

    /**
     * Создаёт эффект смерти врага
     */
    createDeathEffect(x, y, color = '#ff0000') {
        const emitter = new ParticleEmitter({
            x, y,
            duration: 0.1,
            burstCount: 12,
            particleLife: 0.6,
            particleSize: 6,
            speed: 150,
            speedVariance: 80,
            colors: [color, '#ffffff', 'rgba(0,0,0,0)'],
            gravity: 200,
            friction: 0.95,
            shape: 'circle',
            sizeDecay: 0.8
        });
        emitter.burst();
        this.emitters.push(emitter);
        return emitter;
    }

    /**
     * Создаёт эффект подбора предмета
     */
    createPickupEffect(x, y, color = '#ffff00') {
        const emitter = new ParticleEmitter({
            x, y,
            duration: 0.1,
            burstCount: 8,
            particleLife: 0.4,
            particleSize: 4,
            speed: 80,
            speedVariance: 40,
            angle: -Math.PI / 2, // вверх
            angleSpread: Math.PI / 2,
            colors: [color, '#ffffff'],
            gravity: -100,
            shape: 'star',
            sizeDecay: 0.5
        });
        emitter.burst();
        this.emitters.push(emitter);
        return emitter;
    }

    /**
     * Создаёт эффект каста заклинания
     */
    createCastEffect(x, y, color = '#7cf7ff') {
        const emitter = new ParticleEmitter({
            x, y,
            duration: 0.15,
            burstCount: 6,
            particleLife: 0.3,
            particleSize: 5,
            speed: 60,
            speedVariance: 30,
            colors: ['#ffffff', color],
            gravity: 0,
            friction: 0.9,
            shape: 'circle',
            sizeDecay: 0.7
        });
        emitter.burst();
        this.emitters.push(emitter);
        return emitter;
    }

    /**
     * Создаёт эффект попадания
     */
    createHitEffect(x, y, color = '#ffffff') {
        const emitter = new ParticleEmitter({
            x, y,
            duration: 0.05,
            burstCount: 5,
            particleLife: 0.25,
            particleSize: 3,
            speed: 100,
            speedVariance: 50,
            color: color,
            gravity: 50,
            friction: 0.95,
            shape: 'circle'
        });
        emitter.burst();
        this.emitters.push(emitter);
        return emitter;
    }

    /**
     * Создаёт эффект взрыва
     */
    createExplosionEffect(x, y, radius = 50, colors = ['#ff6600', '#ffcc00', '#ff3300']) {
        const count = Math.floor(radius / 4);
        const emitter = new ParticleEmitter({
            x, y,
            duration: 0.1,
            burstCount: count,
            particleLife: 0.5,
            lifeVariance: 0.2,
            particleSize: 8,
            sizeVariance: 4,
            speed: radius * 2,
            speedVariance: radius,
            colors: colors,
            gravity: 100,
            friction: 0.92,
            shape: 'circle',
            sizeDecay: 0.9
        });
        emitter.burst();
        this.emitters.push(emitter);
        return emitter;
    }

    /**
     * Создаёт след за снарядом
     */
    createTrailEmitter(options = {}) {
        const emitter = new ParticleEmitter({
            x: options.x || 0,
            y: options.y || 0,
            duration: -1, // бесконечно, пока не остановим
            emitRate: options.rate || 30,
            particleLife: 0.3,
            lifeVariance: 0.1,
            particleSize: options.size || 4,
            sizeVariance: 2,
            speed: 20,
            speedVariance: 10,
            colors: options.colors || ['#7cf7ff', '#ffffff'],
            gravity: 0,
            friction: 0.95,
            shape: 'circle',
            alphaDecay: true,
            sizeDecay: 0.8
        });
        this.emitters.push(emitter);
        return emitter;
    }

    update(dt) {
        for (const emitter of this.emitters) {
            emitter.update(dt);
        }
        // Удаляем завершённые эмиттеры
        this.emitters = this.emitters.filter(e => !e.isFinished());
    }

    render(ctx, camera) {
        for (const emitter of this.emitters) {
            emitter.render(ctx, camera);
        }
    }

    clear() {
        this.emitters = [];
    }
}
