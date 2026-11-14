export class RotationMatrix {
    #classes;
    #index;
    #flat;


    constructor(classes, matrix) {
        const n = classes.length;
        this.#classes = classes;
        this.#index = new Map(classes.map((c, i) => [c, i]));
        this.#flat = new Float32Array(n * n).fill(1);
        for (const [prev, row] of Object.entries(matrix)) {
            const p = this.#index.get(prev);
            if (p === undefined) continue;
            for (const [next, k] of Object.entries(row)) {
                const q = this.#index.get(next);
                if (q !== undefined) this.#flat[p * n + q] = k;
            }
        }
    }

    get classes() {
        return this.#classes;
    }


    coefficient(prevCrop, nextCrop) {
        const p = prevCrop == null ? undefined : this.#index.get(prevCrop);
        const q = this.#index.get(nextCrop);
        return p === undefined || q === undefined ? 1 : this.#flat[p * this.#classes.length + q];
    }


    row(prevCrop) {
        const n = this.#classes.length;
        const p = prevCrop == null ? undefined : this.#index.get(prevCrop);
        return p === undefined ? new Float32Array(n).fill(1) : this.#flat.subarray(p * n, (p + 1) * n);
    }
}
