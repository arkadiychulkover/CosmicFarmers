import { writable, get } from 'svelte/store';


export const PRESETS = {
    'Влажные тропики': {
        previousCrop: 'rice',
        params: { N: 80, P: 45, K: 40, ph: 6.3, T2M: 27, T2M_MAX: 32, T2M_MIN: 23, RH2M: 85, PRECTOTCORR: 220, ALLSKY_SFC_SW_DWN: 17, GDD: 2500, WS2M: 2.5 },
    },
    'Сухая степь': {
        previousCrop: 'maize',
        params: { N: 40, P: 60, K: 20, ph: 7.5, T2M: 15, T2M_MAX: 24, T2M_MIN: 6, RH2M: 45, PRECTOTCORR: 60, ALLSKY_SFC_SW_DWN: 19, GDD: 1400, WS2M: 3.5 },
    },
    'Умеренный сад': {
        previousCrop: null,
        params: { N: 20, P: 130, K: 200, ph: 6.0, T2M: 18, T2M_MAX: 25, T2M_MIN: 10, RH2M: 92, PRECTOTCORR: 110, ALLSKY_SFC_SW_DWN: 16, GDD: 1500, WS2M: 1.8 },
    },
    'Жаркий полузасушливый': {
        previousCrop: 'lentil',
        params: { N: 20, P: 60, K: 20, ph: 7.0, T2M: 28, T2M_MAX: 36, T2M_MIN: 20, RH2M: 50, PRECTOTCORR: 35, ALLSKY_SFC_SW_DWN: 21, GDD: 2300, WS2M: 3.0 },
    },
};


export const lastRequest = writable(null);


export const mockRepository = {
    loadLast: () => get(lastRequest),
    saveLast: (record) => lastRequest.set(record),
};
