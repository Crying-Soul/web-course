/**
 * Inventory - Класс инвентаря игрока
 * Управляет слотами и предметами
 */
class Inventory {
    constructor(slots = 6) {
        this.slots = new Array(slots).fill(null);
        this.selectedSlot = 0;
        this.maxSlots = slots;
    }

    /**
     * Добавляет предмет в инвентарь
     * @param {Item} item - Предмет для добавления
     * @returns {boolean} - Успешно ли добавлен
     */
    addItem(item) {
        // Ищем пустой слот
        for (let i = 0; i < this.maxSlots; i++) {
            if (this.slots[i] === null) {
                this.slots[i] = item.clone();
                return true;
            }
        }
        return false; // Инвентарь полон
    }

    /**
     * Удаляет предмет из слота
     * @param {number} slotIndex - Индекс слота
     * @returns {Item|null} - Удалённый предмет
     */
    removeItem(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.maxSlots) return null;
        const item = this.slots[slotIndex];
        this.slots[slotIndex] = null;
        return item;
    }

    /**
     * Получает предмет в слоте
     * @param {number} slotIndex - Индекс слота
     * @returns {Item|null}
     */
    getItem(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.maxSlots) return null;
        return this.slots[slotIndex];
    }

    /**
     * Получает выбранный предмет
     * @returns {Item|null}
     */
    getSelectedItem() {
        return this.slots[this.selectedSlot];
    }

    /**
     * Выбирает слот
     * @param {number} slotIndex - Индекс слота
     */
    selectSlot(slotIndex) {
        if (slotIndex >= 0 && slotIndex < this.maxSlots) {
            this.selectedSlot = slotIndex;
        }
    }

    /**
     * Следующий слот
     */
    nextSlot() {
        this.selectedSlot = (this.selectedSlot + 1) % this.maxSlots;
    }

    /**
     * Предыдущий слот
     */
    prevSlot() {
        this.selectedSlot = (this.selectedSlot - 1 + this.maxSlots) % this.maxSlots;
    }

    /**
     * Проверяет, есть ли оружие в выбранном слоте
     * @returns {boolean}
     */
    hasSpellSelected() {
        const item = this.getSelectedItem();
        return item && item.type === 'spell';
    }

    /**
     * Отрисовка инвентаря (UI) с улучшенным дизайном
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        const slotSize = 36;
        const padding = 5;
        const startX = 12;
        const totalHeight = this.maxSlots * slotSize + (this.maxSlots - 1) * padding;
        const startY = Math.max(10, ctx.canvas.height - totalHeight - 12);
        const cornerRadius = 4;
        
        ctx.save();
        
        for (let i = 0; i < this.maxSlots; i++) {
            const x = startX;
            const y = startY + i * (slotSize + padding);
            const isSelected = i === this.selectedSlot;
            const item = this.slots[i];
            
            // Тень слота
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            this.roundRect(ctx, x + 2, y + 2, slotSize, slotSize, cornerRadius);
            ctx.fill();
            
            // Фон слота с градиентом
            const bgGradient = ctx.createLinearGradient(x, y, x, y + slotSize);
            if (isSelected) {
                bgGradient.addColorStop(0, 'rgba(100, 100, 50, 0.9)');
                bgGradient.addColorStop(1, 'rgba(60, 60, 30, 0.9)');
            } else {
                bgGradient.addColorStop(0, 'rgba(40, 45, 60, 0.85)');
                bgGradient.addColorStop(1, 'rgba(25, 30, 40, 0.85)');
            }
            ctx.fillStyle = bgGradient;
            this.roundRect(ctx, x, y, slotSize, slotSize, cornerRadius);
            ctx.fill();
            
            // Внутреннее свечение для выбранного слота
            if (isSelected) {
                const glowGradient = ctx.createRadialGradient(
                    x + slotSize / 2, y + slotSize / 2, 0,
                    x + slotSize / 2, y + slotSize / 2, slotSize
                );
                glowGradient.addColorStop(0, 'rgba(255, 255, 100, 0.2)');
                glowGradient.addColorStop(1, 'rgba(255, 255, 100, 0)');
                ctx.fillStyle = glowGradient;
                this.roundRect(ctx, x, y, slotSize, slotSize, cornerRadius);
                ctx.fill();
            }
            
            // Предмет
            if (item) {
                const prevSmoothing = ctx.imageSmoothingEnabled;
                const prevQuality = ctx.imageSmoothingQuality || 'low';
                
                if (item.imageLoaded) {
                    try {
                        ctx.imageSmoothingEnabled = !item.pixelPerfect;
                        if (!item.pixelPerfect && item.smooth) ctx.imageSmoothingQuality = 'high';
                    } catch (e) {}

                    const targetW = slotSize - 10;
                    const targetH = slotSize - 10;
                    const scale = Math.min(targetW / item.width, targetH / item.height, 1);
                    const drawW = Math.round(item.width * scale);
                    const drawH = Math.round(item.height * scale);
                    const drawX = Math.round(x + (slotSize - drawW) / 2);
                    const drawY = Math.round(y + (slotSize - drawH) / 2);
                    ctx.drawImage(item.image, drawX, drawY, drawW, drawH);
                } else {
                    // Магическая иконка с улучшенным свечением
                    const cx = x + slotSize / 2;
                    const cy = y + slotSize / 2;
                    const r = (slotSize - 12) / 2;
                    const color = item.iconColor || '#7cf7ff';
                    
                    // Внешнее свечение
                    const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.5);
                    glowGrad.addColorStop(0, color);
                    glowGrad.addColorStop(0.5, this.hexToRgba(color, 0.3));
                    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    ctx.fillStyle = glowGrad;
                    ctx.beginPath();
                    ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Основной орб
                    const orbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
                    orbGrad.addColorStop(0, '#ffffff');
                    orbGrad.addColorStop(0.3, color);
                    orbGrad.addColorStop(1, this.hexToRgba(color, 0.5));
                    ctx.fillStyle = orbGrad;
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, 0, Math.PI * 2);
                    ctx.fill();
                }

                try {
                    ctx.imageSmoothingEnabled = prevSmoothing;
                    ctx.imageSmoothingQuality = prevQuality;
                } catch (e) {}
            }
            
            // Рамка слота
            ctx.strokeStyle = isSelected ? 'rgba(255, 220, 100, 0.9)' : 'rgba(100, 110, 130, 0.6)';
            ctx.lineWidth = isSelected ? 2 : 1;
            this.roundRect(ctx, x, y, slotSize, slotSize, cornerRadius);
            ctx.stroke();
            
            // Номер слота с тенью
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'left';
            ctx.fillText((i + 1).toString(), x + 4, y + 12);
            ctx.fillStyle = isSelected ? '#ffee88' : '#aabbcc';
            ctx.fillText((i + 1).toString(), x + 3, y + 11);
        }
        
        ctx.restore();

        // Панель характеристик выбранного заклинания
        const selected = this.getSelectedItem();
        const panelX = startX + slotSize + 14;
        const panelY = startY;
        const panelW = 180;
        const panelH = 82;

        ctx.fillStyle = 'rgba(10, 12, 24, 0.75)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        ctx.fillStyle = '#e8f0ff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';

        if (selected) {
            const styleLabel = selected.castStyle === 'beam' ? 'Луч'
                : selected.castStyle === 'zone' ? 'Нова'
                : selected.castStyle === 'spray' ? 'Веер'
                : 'Снаряд';

            ctx.fillText(`${selected.name} (${styleLabel})`, panelX + 8, panelY + 16);
            ctx.fillStyle = '#9fb2d6';
            ctx.font = '11px Arial';
            ctx.fillText(`Стихия: ${selected.element}`, panelX + 8, panelY + 32);
            ctx.fillText(`Урон: ${selected.damage}`, panelX + 8, panelY + 46);
            ctx.fillText(`Мана: ${selected.manaCost} | КД: ${selected.cooldown}s`, panelX + 8, panelY + 60);
            if (selected.spread) {
                ctx.fillText(`Веер: ${selected.projectileCount} / ${selected.spread}°`, panelX + 8, panelY + 74);
            } else if (selected.castStyle === 'beam') {
                ctx.fillText(`Длина луча: ${selected.beamLength}`, panelX + 8, panelY + 74);
            } else if (selected.castStyle === 'zone') {
                ctx.fillText(`Радиус: ${selected.zoneRadius} | тик: ${selected.zoneTickDamage}`, panelX + 8, panelY + 74);
            }
        } else {
            ctx.fillStyle = '#9fb2d6';
            ctx.font = '11px Arial';
            ctx.fillText('Пустой слот — подберите заклинание', panelX + 8, panelY + 32);
        }
    }

    /**
     * Вспомогательный метод для рисования скруглённых прямоугольников
     */
    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    /**
     * Конвертация HEX в RGBA
     */
    hexToRgba(hex, alpha) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
        }
        return `rgba(255, 255, 255, ${alpha})`;
    }
}
