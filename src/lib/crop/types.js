/**
 * Контракты (порты) модуля рекомендаций. Только JSDoc - в рантайме кода нет.
 *
 * @typedef {Object} CropInput  Вход модели; ключи = имена признаков из features.json.
 * @property {number} N
 * @property {number} P
 * @property {number} K
 * @property {number} ph
 * @property {number} T2M
 * @property {number} T2M_MAX
 * @property {number} T2M_MIN
 * @property {number} RH2M
 * @property {number} PRECTOTCORR
 * @property {number} ALLSKY_SFC_SW_DWN
 * @property {number} GDD
 * @property {number} WS2M
 *
 * @typedef {Object} Recommendation
 * @property {string} crop
 * @property {number} probability  сырая вероятность модели (0..1)
 * @property {number} coefficient  коэффициент матрицы севооборота
 * @property {number} score        probability * coefficient
 * @property {number} percent      итоговый процент среди топ-3 (сумма = 100)
 *
 * @typedef {Object} RotationResult
 * @property {string|null} previousCrop
 * @property {Recommendation[]} recommendations  топ-3, по убыванию
 *
 * @typedef {Object} YearPlan
 * @property {number} year                 1..N
 * @property {string|null} previousCrop
 * @property {string} crop                 лучшая культура года
 * @property {Recommendation[]} options    те же топ-3 культуры с пересчитанными процентами
 *
 * @typedef {Object} ThreeYearPlan
 * @property {string[]} candidates  топ-3 культуры, которые стоит сажать
 * @property {YearPlan[]} years
 *
 * @typedef {Object} LastRequest  Запись, которую хранит localStorage-слой.
 * @property {CropInput} params
 * @property {string|null} [previousCrop]   предшественник на поле (история поля)
 * @property {ThreeYearPlan} [plan]         ответ; если нет - сервис посчитает
 *
 * Порт хранилища последнего запроса. Реализацию (localStorage) пишет другой разработчик,
 * сервис зависит только от этой абстракции.
 * @typedef {Object} LastRequestRepository
 * @property {() => LastRequest|null} loadLast
 * @property {(record: LastRequest) => void} saveLast
 *
 * Порт модели. Реализация - OnnxCropModel; в тестах подменяется заглушкой.
 * @typedef {Object} CropModel
 * @property {() => Promise<unknown>} load
 * @property {(features: Float32Array) => Promise<Float32Array>} predict
 */
export {};
