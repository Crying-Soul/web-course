/**
 * MagicProjectile - энергетический снаряд для заклинаний
 * Держим простую физику и столкновения с тайлами/врагами
 */
class MagicProjectile {
    constructor(options = {}) {
        this.x = options.x || 0;
        this.y = options.y || 0;
        const dirX = options.dirX || 1;
        const dirY = options.dirY || 0;
        const length = Math.max(Math.hypot(dirX, dirY), 0.0001);
        this.dirX = dirX / length;
        this.dirY = dirY / length;

        this.speed = options.speed || 360;
        this.damage = options.damage || 10;
        this.radius = options.radius || 6;
        this.lifeTime = options.lifeTime || 2.5;
        this.age = 0;
        this.pierce = options.pierce || 0;
        this.explosionRadius = options.explosionRadius || 0;
        this.element = options.element || 'arcane';
        this.trailColors = options.trailColors || ['#7cf7ff', '#b9f3ff'];
        this.owner = options.owner || null;
        this.slowAmount = options.slowAmount || 0;
        this.onKillMana = options.onKillMana || 0;
        this.spellId = options.spellId || 'unknown_spell';
        this.game = options.game || null;

        this.trail = [];
        this.maxTrail = 14;
        this.active = true;
        this.hitSet = new Set();
    }

    update(dt, game) {
        if (!this.active) return;
        if (game) this.game = game;
        this.age += dt;
        if (this.age >= this.lifeTime) {
            this.active = false;
            return;
        }

        // Движение
        this.x += this.dirX * this.speed * dt;
        this.y += this.dirY * this.speed * dt;

        // Запоминаем след
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.maxTrail) {
            this.trail.shift();
        }

        // Столкновение с картой
        const mapForCollision = this.game || game;
        if (mapForCollision && mapForCollision.physicsManager && mapForCollision.physicsManager.isSolidAt(this.x, this.y)) {
            this.explode(mapForCollision);
            this.active = false;
            return;
        }

        // Столкновение с врагами
        const entities = (this.game || game)?.gameManager?.entities || [];
        for (const enemy of entities) {
            if (!(enemy instanceof Enemy) || !enemy.active) continue;
            if (this.hitSet.has(enemy)) continue;
            if (this.intersectsEnemy(enemy)) {
                this.hitEnemy(enemy);
                if (!this.active) break;
            }
        }
    }

    hitEnemy(enemy) {
        this.hitSet.add(enemy);
        if (typeof enemy.takeDamage === 'function') {
            enemy.takeDamage(this.damage, this.owner, { 
                spellId: this.spellId, 
                onKillMana: this.onKillMana,
                element: this.element 
            });
        }

        if (this.slowAmount > 0 && typeof enemy.applySlow === 'function') {
            enemy.applySlow(this.slowAmount, 1.8);
        }

        // Взрывной снаряд останавливается на контакте
        if (this.explosionRadius > 0) {
            this.explode(this.game);
            this.active = false;
            return;
        }

        // Пронзание нескольких целей
        if (this.pierce > 0) {
            this.pierce -= 1;
            return;
        }

        this.active = false;
    }

    explode(game) {
        if (!game || this.explosionRadius <= 0) return;
        const entities = game.gameManager?.entities || [];
        for (const enemy of entities) {
            if (!(enemy instanceof Enemy) || !enemy.active) continue;
            if (this.hitSet.has(enemy)) continue;
            const dx = enemy.x + enemy.displayWidth / 2 - this.x;
            const dy = enemy.y + enemy.displayHeight / 2 - this.y;
            if (Math.hypot(dx, dy) <= this.explosionRadius) {
                enemy.takeDamage(this.damage * 0.75, this.owner, { 
                    spellId: this.spellId, 
                    onKillMana: this.onKillMana,
                    element: this.element 
                });
            }
        }
    }

    intersectsEnemy(enemy) {
        const bounds = enemy.getBounds();
        const nearestX = Math.max(bounds.left, Math.min(this.x, bounds.right));
        const nearestY = Math.max(bounds.top, Math.min(this.y, bounds.bottom));
        const dx = this.x - nearestX;
        const dy = this.y - nearestY;
        return dx * dx + dy * dy <= this.radius * this.radius;
    }

    render(ctx, camera) {
        if (!this.active) return;
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        ctx.save();

        // Внешнее свечение (glow)
        const glowRadius = this.radius * 2.5;
        const glowGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, glowRadius);
        const c0 = this.trailColors[0] || '#7cf7ff';
        glowGradient.addColorStop(0, this.hexToRgba(c0, 0.4));
        glowGradient.addColorStop(0.5, this.hexToRgba(c0, 0.15));
        glowGradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // След с градиентом
        for (let i = 0; i < this.trail.length; i++) {
            const p = this.trail[i];
            const t = i / this.trail.length;
            const alpha = 0.1 + 0.5 * t * t; // Квадратичное нарастание
            const r = this.radius * (0.3 + 0.7 * t);
            
            const trailGrad = ctx.createRadialGradient(
                p.x - camera.x, p.y - camera.y, 0,
                p.x - camera.x, p.y - camera.y, r
            );
            trailGrad.addColorStop(0, this.hexToRgba(c0, alpha));
            trailGrad.addColorStop(1, this.hexToRgba(c0, 0));
            ctx.fillStyle = trailGrad;
            ctx.beginPath();
            ctx.arc(p.x - camera.x, p.y - camera.y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Основное ядро с многослойным градиентом
        const c1 = this.trailColors[1] || '#b9f3ff';
        const gradient = ctx.createRadialGradient(
            screenX, screenY, 0,
            screenX, screenY, this.radius
        );
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.2, '#ffffff');
        gradient.addColorStop(0.4, c0);
        gradient.addColorStop(0.8, c1);
        gradient.addColorStop(1, this.hexToRgba(c1, 0.3));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Яркое ядро
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /**
     * Вспомогательная функция для конвертации HEX в RGBA
     */
    hexToRgba(hex, alpha) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
        }
        return `rgba(255, 255, 255, ${alpha})`;
    }
}

/**
 * MagicBeam - мгновенный луч, который пробивает линию
 */
class MagicBeam {
    constructor(options = {}) {
        this.x = options.x || 0;
        this.y = options.y || 0;
        const tx = options.targetX || this.x + 1;
        const ty = options.targetY || this.y;
        const dx = tx - this.x;
        const dy = ty - this.y;
        const len = Math.max(Math.hypot(dx, dy), 0.0001);
        this.dirX = dx / len;
        this.dirY = dy / len;

        this.length = options.length || 300;
        this.width = options.width || 14;
        this.damage = options.damage || 20;
        this.element = options.element || 'arcane';
        this.duration = options.duration || 0.25;
        this.age = 0;
        this.owner = options.owner || null;
        this.game = options.game || null;
        this.active = true;
        this.hitSet = new Set();
    }

    update(dt, game) {
        if (!this.active) return;
        this.age += dt;
        const g = this.game || game;
        if (g) this.applyHits(g);
        if (this.age >= this.duration) {
            this.active = false;
        }
    }

    applyHits(game) {
        const entities = game.gameManager?.entities || [];
        const sx = this.x;
        const sy = this.y;
        const ex = sx + this.dirX * this.length;
        const ey = sy + this.dirY * this.length;

        for (const enemy of entities) {
            if (!(enemy instanceof Enemy) || !enemy.active) continue;
            if (this.hitSet.has(enemy)) continue;

            const exCenter = enemy.x + enemy.displayWidth / 2;
            const eyCenter = enemy.y + enemy.displayHeight / 2;
            const dist = this.pointToSegmentDistance(exCenter, eyCenter, sx, sy, ex, ey);
            if (dist <= this.width) {
                this.hitSet.add(enemy);
                enemy.takeDamage(this.damage, this.owner, { spellId: 'beam', element: this.element });
            }
        }
    }

    pointToSegmentDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSq = dx * dx + dy * dy;
        let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
        t = Math.max(0, Math.min(1, t));
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        const ddx = px - projX;
        const ddy = py - projY;
        return Math.hypot(ddx, ddy);
    }

    render(ctx, camera) {
        if (!this.active) return;
        const sx = this.x - camera.x;
        const sy = this.y - camera.y;
        const ex = sx + this.dirX * this.length;
        const ey = sy + this.dirY * this.length;
        const fadeProgress = this.age / this.duration;

        ctx.save();

        // Внешнее свечение (широкое)
        const glowWidth = this.width * 3;
        ctx.strokeStyle = `rgba(162, 240, 255, ${0.3 * (1 - fadeProgress)})`;
        ctx.lineWidth = glowWidth;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Среднее свечение
        ctx.strokeStyle = `rgba(200, 250, 255, ${0.5 * (1 - fadeProgress)})`;
        ctx.lineWidth = this.width * 1.8;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Основной луч с градиентом
        const grad = ctx.createLinearGradient(sx, sy, ex, ey);
        grad.addColorStop(0, `rgba(255, 255, 255, ${0.95 * (1 - fadeProgress * 0.5)})`);
        grad.addColorStop(0.3, `rgba(162, 240, 255, ${0.9 * (1 - fadeProgress * 0.5)})`);
        grad.addColorStop(0.7, `rgba(124, 200, 255, ${0.85 * (1 - fadeProgress * 0.5)})`);
        grad.addColorStop(1, `rgba(100, 150, 255, ${0.7 * (1 - fadeProgress * 0.5)})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = this.width;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Яркое ядро (тонкая линия по центру)
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * (1 - fadeProgress)})`;
        ctx.lineWidth = this.width * 0.3;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Точка начала (вспышка)
        const startGlow = ctx.createRadialGradient(sx, sy, 0, sx, sy, this.width * 1.5);
        startGlow.addColorStop(0, `rgba(255, 255, 255, ${0.9 * (1 - fadeProgress)})`);
        startGlow.addColorStop(0.5, `rgba(162, 240, 255, ${0.5 * (1 - fadeProgress)})`);
        startGlow.addColorStop(1, 'rgba(162, 240, 255, 0)');
        ctx.fillStyle = startGlow;
        ctx.beginPath();
        ctx.arc(sx, sy, this.width * 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

/**
 * MagicZone - стационарная зона урона/замедления
 */
class MagicZone {
    constructor(options = {}) {
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.radius = options.radius || 80;
        this.duration = options.duration || 1.2;
        this.tickDamage = options.tickDamage || 8;
        this.tickRate = options.tickRate || 0.3;
        this.element = options.element || 'frost';
        this.slowAmount = options.slowAmount || 0;
        this.owner = options.owner || null;
        this.game = options.game || null;
        this.age = 0;
        this.tickTimer = 0;
        this.active = true;
    }

    update(dt, game) {
        if (!this.active) return;
        this.age += dt;
        this.tickTimer -= dt;
        const g = this.game || game;

        if (this.tickTimer <= 0 && g) {
            this.applyTick(g);
            this.tickTimer = this.tickRate;
        }

        if (this.age >= this.duration) {
            this.active = false;
        }
    }

    applyTick(game) {
        const enemies = game.gameManager?.entities || [];
        for (const enemy of enemies) {
            if (!(enemy instanceof Enemy) || !enemy.active) continue;
            const dx = enemy.x + enemy.displayWidth / 2 - this.x;
            const dy = enemy.y + enemy.displayHeight / 2 - this.y;
            if (Math.hypot(dx, dy) <= this.radius) {
                enemy.takeDamage(this.tickDamage, this.owner, { spellId: 'zone', element: this.element });
                if (this.slowAmount > 0 && enemy.applySlow) {
                    enemy.applySlow(this.slowAmount, 1.0);
                }
            }
        }
    }

    render(ctx, camera) {
        if (!this.active) return;
        const sx = this.x - camera.x;
        const sy = this.y - camera.y;
        const lifePercent = 1 - this.age / this.duration;
        const pulsePhase = Math.sin(this.age * 8) * 0.15 + 0.85;

        ctx.save();

        // Внешнее пульсирующее кольцо
        ctx.strokeStyle = `rgba(194, 246, 255, ${0.3 * lifePercent * pulsePhase})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius * pulsePhase, 0, Math.PI * 2);
        ctx.stroke();

        // Вторичное кольцо (меньше)
        ctx.strokeStyle = `rgba(150, 220, 255, ${0.4 * lifePercent})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius * 0.7, 0, Math.PI * 2);
        ctx.stroke();

        // Основной градиент зоны
        const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, this.radius);
        grd.addColorStop(0, `rgba(220, 250, 255, ${0.45 * lifePercent})`);
        grd.addColorStop(0.3, `rgba(194, 246, 255, ${0.35 * lifePercent * pulsePhase})`);
        grd.addColorStop(0.6, `rgba(150, 220, 255, ${0.2 * lifePercent})`);
        grd.addColorStop(1, 'rgba(107, 170, 255, 0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Анимированные внутренние круги (волны)
        const waveCount = 3;
        for (let i = 0; i < waveCount; i++) {
            const wavePhase = ((this.age * 2 + i / waveCount) % 1);
            const waveRadius = this.radius * wavePhase;
            const waveAlpha = (1 - wavePhase) * 0.3 * lifePercent;
            
            ctx.strokeStyle = `rgba(200, 240, 255, ${waveAlpha})`;
            ctx.lineWidth = 2 * (1 - wavePhase);
            ctx.beginPath();
            ctx.arc(sx, sy, waveRadius, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Центральная точка
        const centerGrd = ctx.createRadialGradient(sx, sy, 0, sx, sy, 15);
        centerGrd.addColorStop(0, `rgba(255, 255, 255, ${0.6 * lifePercent})`);
        centerGrd.addColorStop(1, 'rgba(194, 246, 255, 0)');
        ctx.fillStyle = centerGrd;
        ctx.beginPath();
        ctx.arc(sx, sy, 15, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
