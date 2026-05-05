/**
 * imageGallery.js - 右パネルギャラリーの描画・選択管理
 */

class ImageGallery {
    #gridEl;
    #countEl;
    #frames = [];
    #onSelectionChangeCallback = null;

    constructor(gridEl, countEl) {
        this.#gridEl = gridEl;
        this.#countEl = countEl;
    }

    addFrame(frame) {
        const frameObj = { ...frame, selected: true };
        const index = this.#frames.length;
        this.#frames.push(frameObj);

        const placeholder = this.#gridEl.querySelector('.gallery-placeholder');
        if (placeholder) placeholder.remove();

        const card = this.#createCard(frameObj, index);
        this.#gridEl.appendChild(card);
        this.#updateCount();
    }

    #createCard(frame, index) {
        const card = document.createElement('div');
        card.className = 'gallery-card selected';
        card.dataset.index = index;

        const img = document.createElement('img');
        img.src = frame.dataUrl;
        img.alt = frame.timestamp;
        img.loading = 'lazy';

        const check = document.createElement('div');
        check.className = 'card-check';
        check.textContent = '✓';

        const ts = document.createElement('div');
        ts.className = 'card-timestamp';
        ts.textContent = frame.timestamp;

        card.appendChild(img);
        card.appendChild(check);
        card.appendChild(ts);

        card.addEventListener('click', () => this.#toggleCard(index, card));
        img.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.#showModal(frame);
        });

        return card;
    }

    #toggleCard(index, card) {
        this.#frames[index].selected = !this.#frames[index].selected;
        card.classList.toggle('selected', this.#frames[index].selected);
        this.#updateCount();
    }

    selectAll() {
        this.#frames.forEach((f, i) => {
            f.selected = true;
            const card = this.#gridEl.querySelector(`[data-index="${i}"]`);
            if (card) card.classList.add('selected');
        });
        this.#updateCount();
    }

    deselectAll() {
        this.#frames.forEach((f, i) => {
            f.selected = false;
            const card = this.#gridEl.querySelector(`[data-index="${i}"]`);
            if (card) card.classList.remove('selected');
        });
        this.#updateCount();
    }

    getSelectedFrames() {
        return this.#frames.filter(f => f.selected);
    }

    getCounts() {
        const selected = this.#frames.filter(f => f.selected).length;
        return { total: this.#frames.length, selected };
    }

    hasFrames() {
        return this.#frames.length > 0;
    }

    clear() {
        this.#frames = [];
        this.#gridEl.innerHTML = '<div class="gallery-placeholder">動画を選択して<br>抽出してください</div>';
        this.#updateCount();
    }

    onSelectionChange(callback) {
        this.#onSelectionChangeCallback = callback;
    }

    #updateCount() {
        const { total, selected } = this.getCounts();
        if (this.#countEl) {
            this.#countEl.textContent = `${selected}/${total}枚選択中`;
        }
        if (this.#onSelectionChangeCallback) {
            this.#onSelectionChangeCallback({ total, selected });
        }
    }

    #showModal(frame) {
        const modal = document.getElementById('imageModal');
        const modalImg = document.getElementById('modalImage');
        const modalTs = document.getElementById('modalTimestamp');
        if (!modal || !modalImg) return;

        modalImg.src = frame.dataUrl;
        if (modalTs) modalTs.textContent = frame.timestamp;
        modal.classList.remove('hidden');
    }
}

console.log('✅ imageGallery.js: 読み込み完了');
