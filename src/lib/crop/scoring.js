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


export function toPercents(scores) {
    const sum = scores.reduce((a, b) => a + b, 0);
    const shares = sum > 0 ? scores.map((s) => (s / sum) * 100) : scores.map(() => 100 / scores.length);
    const result = shares.map(Math.floor);
    let left = 100 - result.reduce((a, b) => a + b, 0);
    shares
        .map((s, i) => [s - Math.floor(s), i])
        .sort((a, b) => b[0] - a[0])
        .forEach(([, i]) => {
            if (left-- > 0) result[i]++;
        });
    return result;
}
