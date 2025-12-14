/**
 * EventManager - Управление вводом и событиями
 * Обрабатывает клавиатуру, мышь и игровые события
 */
class EventManager {
    constructor() {
        // Состояние клавиш (нажата/отпущена)
        this.keys = new Map();
        
        // Клавиши, нажатые в этом кадре
        this.keysJustPressed = new Set();
        
        // Клавиши, отпущенные в этом кадре
        this.keysJustReleased = new Set();
        
        // Позиция мыши
        this.mouse = {
            x: 0,
            y: 0,
            worldX: 0,
            worldY: 0,
            leftButton: false,
            rightButton: false
        };
        
        // Слушатели игровых событий
        this.listeners = new Map();
        
        // Привязка контекста
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
    }

    /**
     * Инициализация обработчиков событий
     * @param {HTMLCanvasElement} canvas - Canvas элемент
     */
    init(canvas) {
        this.canvas = canvas;
        
        // Клавиатура
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        
        // Мышь
        canvas.addEventListener('mousemove', this.handleMouseMove);
        canvas.addEventListener('mousedown', this.handleMouseDown);
        canvas.addEventListener('mouseup', this.handleMouseUp);
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        console.log('EventManager: Инициализирован');
    }

    /**
     * Очистка состояния "только что нажатых" клавиш
     * Вызывается в конце каждого кадра
     */
    update() {
        this.keysJustPressed.clear();
        this.keysJustReleased.clear();
    }

    /**
     * Обработчик нажатия клавиши
     * @param {KeyboardEvent} e 
     */
    handleKeyDown(e) {
        if (!this.keys.get(e.code)) {
            this.keysJustPressed.add(e.code);
        }
        this.keys.set(e.code, true);
        
        // Предотвращаем прокрутку страницы стрелками
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
            e.preventDefault();
        }
    }

    /**
     * Обработчик отпускания клавиши
     * @param {KeyboardEvent} e 
     */
    handleKeyUp(e) {
        this.keys.set(e.code, false);
        this.keysJustReleased.add(e.code);
    }

    /**
     * Обработчик движения мыши
     * @param {MouseEvent} e 
     */
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        this.mouse.x = (e.clientX - rect.left) * scaleX;
        this.mouse.y = (e.clientY - rect.top) * scaleY;
    }

    /**
     * Обработчик нажатия кнопки мыши
     * @param {MouseEvent} e 
     */
    handleMouseDown(e) {
        if (e.button === 0) this.mouse.leftButton = true;
        if (e.button === 2) this.mouse.rightButton = true;
    }

    /**
     * Обработчик отпускания кнопки мыши
     * @param {MouseEvent} e 
     */
    handleMouseUp(e) {
        if (e.button === 0) this.mouse.leftButton = false;
        if (e.button === 2) this.mouse.rightButton = false;
    }

    /**
     * Проверяет, нажата ли клавиша
     * @param {string} code - Код клавиши (например, 'KeyW', 'Space')
     * @returns {boolean}
     */
    isKeyDown(code) {
        return this.keys.get(code) || false;
    }

    /**
     * Проверяет, была ли клавиша нажата в этом кадре
     * @param {string} code - Код клавиши
     * @returns {boolean}
     */
    isKeyJustPressed(code) {
        return this.keysJustPressed.has(code);
    }

    /**
     * Проверяет, была ли клавиша отпущена в этом кадре
     * @param {string} code - Код клавиши
     * @returns {boolean}
     */
    isKeyJustReleased(code) {
        return this.keysJustReleased.has(code);
    }

    /**
     * Обновляет мировые координаты мыши
     * @param {Object} camera - Камера
     */
    updateMouseWorld(camera) {
        this.mouse.worldX = this.mouse.x + camera.x;
        this.mouse.worldY = this.mouse.y + camera.y;
    }

    /**
     * Подписка на игровое событие
     * @param {string} event - Название события
     * @param {Function} callback - Обработчик
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * Отправка игрового события
     * @param {string} event - Название события
     * @param {*} data - Данные события
     */
    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }

    /**
     * Очистка обработчиков
     */
    destroy() {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        
        if (this.canvas) {
            this.canvas.removeEventListener('mousemove', this.handleMouseMove);
            this.canvas.removeEventListener('mousedown', this.handleMouseDown);
            this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        }
    }
}
