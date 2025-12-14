/**
 * ScoreManager - простое хранение результатов в JSON-структуре.
 * Загружаем и сохраняем данные в `localStorage`.
 */
class ScoreManager {
    constructor() {
        this.storageKey = 'terraria_arena_scores';
        this.scores = [];
    }

    async load() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (!saved) {
                this.scores = [];
                return this.scores;
            }

            this.scores = JSON.parse(saved) || [];
        } catch (err) {
            console.warn('ScoreManager: повреждённые данные в localStorage, стартуем с пустым списком', err);
            this.scores = [];
        }

        return this.scores;
    }

    addResult(entry) {
        const safeEntry = {
            name: (entry.name || 'Игрок').toString().substring(0, 18) || 'Игрок',
            score: Math.max(0, Math.floor(entry.score || 0)),
            kills: Math.max(0, Math.floor(entry.kills || 0)),
            time: Math.max(0, Math.round(entry.time || 0))
        };

        this.scores.push(safeEntry);
        this.scores.sort((a, b) => b.score - a.score || b.kills - a.kills || a.time - b.time);
        this.scores = this.scores.slice(0, 10);
        this.save();
        return this.scores;
    }

    getTop(limit = 5) {
        return this.scores.slice(0, limit);
    }

    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.scores));
        } catch (e) {
            console.warn('ScoreManager: не удалось сохранить результаты в localStorage', e);
        }
    }
}
