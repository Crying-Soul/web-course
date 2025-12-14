/**
 * ScoreManager - простое хранение результатов в JSON-структуре.
 * Пишем в localStorage (как JSON-строку), читаем стартовые данные из scores.json.
 */
class ScoreManager {
    constructor(path = 'scores.json') {
        this.path = path;
        this.scores = [];
        this.storageKey = 'terraria_arena_scores';
    }

    async load() {
        // Загружаем из localStorage, иначе из файла.
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            try {
                this.scores = JSON.parse(saved) || [];
                return this.scores;
            } catch (e) {
                console.warn('ScoreManager: повреждённые данные, используем файл', e);
            }
        }

        try {
            const res = await fetch(this.path, { cache: 'no-cache' });
            if (!res.ok) throw new Error(res.statusText);
            const data = await res.json();
            this.scores = Array.isArray(data) ? data : [];
            this.save();
        } catch (err) {
            console.warn('ScoreManager: не удалось загрузить файл рейтинга, стартуем с пустым списком', err);
            this.scores = [];
            this.save();
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
            console.warn('ScoreManager: не удалось сохранить результаты', e);
        }
    }
}
