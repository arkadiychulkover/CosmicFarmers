<script>
    import { onMount } from 'svelte';
    import { createCropService, preloadCropModel, modelStatus } from './lib/crop/index.js';
    import { CROP_CLASSES, FEATURE_ORDER } from './lib/crop/features.js';
    import { PRESETS, lastRequest, mockRepository } from './mockStore.js';

    const service = createCropService(mockRepository);

    let presetName = Object.keys(PRESETS)[0];
    let params = { ...PRESETS[presetName].params };
    let previousCrop = PRESETS[presetName].previousCrop;
    let plan = null;
    let ms = null;
    let error = '';

    onMount(() => preloadCropModel().catch((e) => (error = String(e))));

    function loadPreset() {
        params = { ...PRESETS[presetName].params };
        previousCrop = PRESETS[presetName].previousCrop;
    }

    // Выгрузить данные в store без ответа - как будто пользователь прошёл 1 экран.
    function pushToStore() {
        lastRequest.set({ params: { ...params }, previousCrop });
        plan = null; ms = null; error = '';
    }

    async function calculate() {
        error = '';
        try {
            const t = performance.now();
            plan = await service.getPlan();
            ms = (performance.now() - t).toFixed(2);
        } catch (e) { error = String(e); }
    }
</script>

<main>
    <h1>Mock model testing</h1>
    <p>Модель: <b>{$modelStatus}</b></p>

    <section>
        <h2>1. Входные данные</h2>
        <label>Пресет
            <select bind:value={presetName} on:change={loadPreset}>
                {#each Object.keys(PRESETS) as name}<option>{name}</option>{/each}
            </select>
        </label>
        <label>Предшественник
            <select bind:value={previousCrop}>
                <option value={null}>— нет —</option>
                {#each CROP_CLASSES as c}<option>{c}</option>{/each}
            </select>
        </label>
        <div class="grid">
            {#each FEATURE_ORDER as f}
                <label>{f}<input type="number" step="any" bind:value={params[f]} /></label>
            {/each}
        </div>
        <button on:click={pushToStore}>Выгрузить в store</button>
        <button on:click={calculate} disabled={!$lastRequest}>Посчитать (getPlan)</button>
    </section>

    {#if error}<p class="err">{error}</p>{/if}

    <section>
        <h2>2. Store (имитация localStorage)</h2>
        <pre>{JSON.stringify($lastRequest, null, 2) ?? 'пусто'}</pre>
    </section>

    {#if plan}
        <section>
            <h2>3. План на 3 года <small>({ms} мс)</small></h2>
            <p>Кандидаты: {plan.candidates.join(', ')}</p>
            {#each plan.years as y}
                <div class="year">
                    <b>Год {y.year}: {y.crop}</b> <small>(предшественник: {y.previousCrop ?? '—'})</small>
                    <table><tbody>
                        <tr><th>культура</th><th>P модели</th><th>коэф.</th><th>итог %</th></tr>
                        {#each y.options as o}
                            <tr><td>{o.crop}</td><td>{o.probability.toFixed(3)}</td><td>{o.coefficient.toFixed(2)}</td><td>{o.percent}%</td></tr>
                        {/each}
                    </tbody></table>
                </div>
            {/each}
            <p><small>Повторный «Посчитать» берёт ответ из store, модель не запускается.</small></p>
        </section>
    {/if}
</main>

<style>
    main { font-family: system-ui, sans-serif; max-width: 760px; margin: 2rem auto; padding: 0 1rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: .5rem; margin: 1rem 0; }
    label { display: flex; flex-direction: column; font-size: .85rem; gap: .2rem; margin-bottom: .5rem; }
    pre { background: #f4f4f4; padding: .75rem; overflow: auto; font-size: .8rem; }
    table { border-collapse: collapse; margin: .3rem 0 1rem; }
    td, th { border: 1px solid #ccc; padding: .2rem .6rem; text-align: left; }
    .err { color: #b00020; }
    button { margin-right: .5rem; }
</style>
