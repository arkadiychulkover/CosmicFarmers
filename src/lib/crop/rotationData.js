import { CROP_CLASSES } from './features.js';

/**
 * Данные матрицы севооборота: ROTATION_MATRIX[предшественник][следующая культура] = коэффициент.
 * Диапазоны (см. План.txt): 0.15-0.30 монокультура, 0.40-0.60 одна группа/общие патогены,
 * 1.0 нейтрально, 1.20-1.40 симбиоз (зерновые после бобовых и наоборот).
 *
 * Полную 22x22 матрицу руками не пишем: она собирается один раз при загрузке модуля
 * из групп + правил + точечных правок (OVERRIDES). Любую пару можно поправить в OVERRIDES.
 */

const GROUPS = {
    legume: ['blackgram', 'chickpea', 'kidneybeans', 'lentil', 'mothbeans', 'mungbean', 'pigeonpeas'],
    cereal: ['maize', 'rice'],
    fibre: ['cotton', 'jute'],
    cucurbit: ['muskmelon', 'watermelon'],
    perennial: ['apple', 'banana', 'coconut', 'coffee', 'grapes', 'mango', 'orange', 'papaya', 'pomegranate'],
};

/** Повтор той же культуры подряд. */
const SELF = { legume: 0.15, cereal: 0.3, fibre: 0.25, cucurbit: 0.2, perennial: 0.3 };
/** Разные культуры одной группы (общие патогены). Многолетники между собой нейтральны. */
const SAME_GROUP = { legume: 0.4, cereal: 0.9, fibre: 0.5, cucurbit: 0.4, perennial: 1.0 };
/** Предшественник-группа -> следующая группа. Всё, чего здесь нет, нейтрально (1.0). */
const CROSS_GROUP = {
    legume: { cereal: 1.25, fibre: 1.2, cucurbit: 1.2 }, // бобовые обогащают почву азотом
    cereal: { legume: 1.2 },
    fibre: { legume: 1.2 },
    cucurbit: { legume: 1.2 },
};

/** Точечные значения из примеров в План.txt (строки lentil и maize). */
const OVERRIDES = {
    lentil: { maize: 1.25, rice: 1.0, chickpea: 0.4, lentil: 0.15 },
    maize: { lentil: 1.3, chickpea: 1.2, rice: 0.9, maize: 0.3 },
};

const groupOf = Object.fromEntries(
    Object.entries(GROUPS).flatMap(([group, crops]) => crops.map((c) => [c, group])),
);

function coefficient(prev, next) {
    const gp = groupOf[prev];
    const gn = groupOf[next];
    if (prev === next) return SELF[gp];
    if (gp === gn) return SAME_GROUP[gp];
    return CROSS_GROUP[gp]?.[gn] ?? 1.0;
}

/** @type {Record<string, Record<string, number>>} */
export const ROTATION_MATRIX = Object.fromEntries(
    CROP_CLASSES.map((prev) => [
        prev,
        Object.fromEntries(CROP_CLASSES.map((next) => [next, OVERRIDES[prev]?.[next] ?? coefficient(prev, next)])),
    ]),
);
