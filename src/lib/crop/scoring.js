export function topIndices(scores, k, allowed) {
    const top = [];
    for (let i = 0; i < scores.length; i++) {
        if (allowed && !allowed(i)) continue;
        let pos = top.length;
        while (pos > 0 && scores[top[pos - 1]] < scores[i]) pos--;
        if (pos < k) {
            top.splice(pos, 0, i);
            if (top.length > k) top.pop();
        }
    }
    return top;
}

export function toPercents(scores, probabilities = null) {
    let entropyPenalty = 1.0;
    if (Array.isArray(probabilities) && probabilities.length > 0) {
        const n = probabilities.length;
        const maxEntropy = Math.log(n);
        let entropy = 0;
        for (const p of probabilities) {
            if (p > 1e-6) entropy -= p * Math.log(p);
        }
        entropyPenalty = Math.max(0.15, 1 - Math.pow(entropy / maxEntropy, 3.0));
    }

    return scores.map((score) => {
        if (score <= 0) return 5;
        const suitability = Math.min(1.0, Math.max(0, Math.sqrt(score) * entropyPenalty));
        return Math.min(98, Math.max(5, Math.round(suitability * 100)));
    });
}
