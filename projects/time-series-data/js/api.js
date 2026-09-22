/**
 * 纯前端数据 API：替代原 Flask 后端，从 data/json/*.json 加载并计算。
 */
var DataAPI = (() => {
    const store = {
        operation: [],
        oil_temp: [],
        oil_level: [],
        winding_temp: [],
        chromatography: [],
        weather: [],
        ready: false,
        loading: null,
    };

    const DATA_FILES = {
        operation: 'data/json/operation.json',
        oil_temp: 'data/json/oil_temp.json',
        oil_level: 'data/json/oil_level.json',
        winding_temp: 'data/json/winding_temp.json',
        chromatography: 'data/json/chromatography.json',
        weather: 'data/json/weather.json',
    };

    function parseTime(s) {
        if (!s) return null;
        const d = new Date(String(s).replace(' ', 'T'));
        return Number.isNaN(d.getTime()) ? null : d;
    }

    function fmtTime(d) {
        if (!d) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    function floorTime(d, granularity) {
        const x = new Date(d.getTime());
        if (granularity === 'hour') {
            x.setMinutes(0, 0, 0);
        } else if (granularity === 'day') {
            x.setHours(0, 0, 0, 0);
        } else if (granularity === 'week') {
            x.setHours(0, 0, 0, 0);
            const day = x.getDay(); // 0 Sun
            x.setDate(x.getDate() - day);
        } else if (granularity === 'month') {
            x.setDate(1);
            x.setHours(0, 0, 0, 0);
        } else if (granularity === 'quarter') {
            const q = Math.floor(x.getMonth() / 3) * 3;
            x.setMonth(q, 1);
            x.setHours(0, 0, 0, 0);
        } else {
            x.setMinutes(0, 0, 0);
        }
        return x;
    }

    function mean(arr) {
        const vals = arr.filter((v) => v != null && !Number.isNaN(v));
        if (!vals.length) return 0;
        return vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    function std(arr) {
        const vals = arr.filter((v) => v != null && !Number.isNaN(v));
        if (vals.length < 2) return 0;
        const m = mean(vals);
        return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length);
    }

    function filterByDevice(rows, deviceId) {
        if (!deviceId) return rows;
        return rows.filter((r) => r.d === deviceId);
    }

    function filterByYear(rows, year, timeKey = 't') {
        if (!year) return rows;
        const y = Number(year);
        return rows.filter((r) => {
            const d = parseTime(r[timeKey]);
            return d && d.getFullYear() === y;
        });
    }

    function filterByRange(rows, start, end, timeKey = 't') {
        if (!start || !end) return rows;
        const s = parseTime(start);
        const e = parseTime(end);
        if (!s || !e) return rows;
        return rows.filter((r) => {
            const d = parseTime(r[timeKey]);
            return d && d >= s && d <= e;
        });
    }

    function aggregate(rows, timeKey, valueKeys, granularity) {
        if (!rows.length) return [];
        const buckets = new Map();
        rows.forEach((r) => {
            const d = parseTime(r[timeKey]);
            if (!d) return;
            const key = floorTime(d, granularity).getTime();
            if (!buckets.has(key)) {
                buckets.set(key, { t: floorTime(d, granularity), values: {} });
                valueKeys.forEach((k) => { buckets.get(key).values[k] = []; });
            }
            const b = buckets.get(key);
            valueKeys.forEach((k) => {
                if (r[k] != null && !Number.isNaN(r[k])) b.values[k].push(r[k]);
            });
        });
        return Array.from(buckets.values())
            .sort((a, b) => a.t - b.t)
            .map((b) => {
                const out = { t: b.t };
                valueKeys.forEach((k) => { out[k] = mean(b.values[k]); });
                return out;
            });
    }

    function getCommonTimeRange(deviceId, year) {
        const ranges = [];
        const pushRange = (rows, timeKey = 't') => {
            let list = filterByDevice(rows, deviceId);
            list = filterByYear(list, year, timeKey);
            if (!list.length) return;
            let min = null;
            let max = null;
            list.forEach((r) => {
                const d = parseTime(r[timeKey]);
                if (!d) return;
                if (!min || d < min) min = d;
                if (!max || d > max) max = d;
            });
            if (min && max) ranges.push([min, max]);
        };

        pushRange(store.operation);
        pushRange(store.oil_temp);
        pushRange(store.oil_level);
        pushRange(store.winding_temp);

        if (!ranges.length) return { min: null, max: null };
        const min = new Date(Math.max(...ranges.map((r) => r[0].getTime())));
        const max = new Date(Math.min(...ranges.map((r) => r[1].getTime())));
        if (min > max) return { min: null, max: null };
        return { min, max };
    }

    async function init() {
        if (store.ready) return;
        if (store.loading) return store.loading;
        store.loading = Promise.all(
            Object.entries(DATA_FILES).map(async ([key, url]) => {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`加载失败: ${url}`);
                const json = await res.json();
                store[key] = json.records || [];
            })
        ).then(() => {
            store.ready = true;
            store.loading = null;
        });
        return store.loading;
    }

    function getDevices() {
        const set = new Set();
        ['operation', 'oil_temp', 'oil_level', 'winding_temp', 'chromatography'].forEach((k) => {
            store[k].forEach((r) => { if (r.d) set.add(r.d); });
        });
        return Array.from(set).sort();
    }

    function getAvailableYears() {
        const set = new Set();
        const collect = (rows, key = 't') => {
            rows.forEach((r) => {
                const d = parseTime(r[key]);
                if (d) set.add(d.getFullYear());
            });
        };
        collect(store.operation);
        collect(store.oil_temp);
        collect(store.oil_level);
        collect(store.winding_temp);
        collect(store.weather);
        collect(store.chromatography);
        return Array.from(set).sort();
    }

    function getOperationData(params = {}) {
        const { device_id, year = '2024', granularity = 'day', start_time, end_time } = params;
        let rows = filterByDevice(store.operation, device_id);

        if (start_time && end_time) {
            rows = filterByRange(rows, start_time, end_time);
        } else {
            rows = filterByYear(rows, year);
            if (!rows.length) {
                const years = [...new Set(store.operation.map((r) => parseTime(r.t)?.getFullYear()).filter(Boolean))].sort();
                return { error: `${year}年暂无运行数据（现有年份：${years.join('、') || '无'}）` };
            }
        }

        if (!rows.length) return { error: '没有找到匹配的数据' };

        const phases = ['A', 'B', 'C'];
        const series = {};
        let time = [];

        phases.forEach((phase) => {
            const phaseRows = rows.filter((r) => r.p === phase);
            const agg = aggregate(phaseRows, 't', ['i', 'ap', 'rp', 'lr', 'pf'], granularity);
            if (!agg.length) return;
            if (!time.length) time = agg.map((a) => fmtTime(a.t));
            series[phase] = {
                current: agg.map((a) => a.i),
                active_power: agg.map((a) => a.ap),
                reactive_power: agg.map((a) => a.rp),
                load_rate: agg.map((a) => a.lr),
                power_factor: agg.map((a) => a.pf),
            };
        });

        if (!time.length) return { error: `${year}年暂无运行数据` };
        return {
            time,
            series,
            time_range: { start_time: time[0], end_time: time[time.length - 1] },
        };
    }

    function getStatusData(params = {}) {
        const { device_id, year = '2024', granularity = 'day', start_time, end_time } = params;
        let minTime = null;
        let maxTime = null;

        if (start_time && end_time) {
            minTime = parseTime(start_time);
            maxTime = parseTime(end_time);
        } else {
            const range = getCommonTimeRange(device_id, year);
            minTime = range.min;
            maxTime = range.max;
            if (!minTime || !maxTime) {
                // 回退：仅用状态数据自身年份范围
                const all = [
                    ...filterByYear(filterByDevice(store.oil_temp, device_id), year),
                    ...filterByYear(filterByDevice(store.oil_level, device_id), year),
                    ...filterByYear(filterByDevice(store.winding_temp, device_id), year),
                ];
                if (!all.length) return { error: '没有找到匹配的时间范围' };
                all.forEach((r) => {
                    const d = parseTime(r.t);
                    if (!d) return;
                    if (!minTime || d < minTime) minTime = d;
                    if (!maxTime || d > maxTime) maxTime = d;
                });
            }
        }

        const inRange = (rows) => rows.filter((r) => {
            const d = parseTime(r.t);
            return d && d >= minTime && d <= maxTime;
        });

        const result = {};

        let oilTemp = inRange(filterByDevice(store.oil_temp, device_id));
        if (!start_time) oilTemp = filterByYear(oilTemp, year);
        const oilTempAgg = aggregate(oilTemp, 't', ['p1', 'p2'], granularity);
        if (oilTempAgg.length) {
            result.oil_temperature = {
                time: oilTempAgg.map((a) => fmtTime(a.t)),
                point1: oilTempAgg.map((a) => a.p1),
                point2: oilTempAgg.map((a) => a.p2),
            };
        }

        let oilLevel = inRange(filterByDevice(store.oil_level, device_id));
        if (!start_time) oilLevel = filterByYear(oilLevel, year);
        const oilLevelAgg = aggregate(oilLevel, 't', ['lv'], granularity);
        if (oilLevelAgg.length) {
            result.oil_level = {
                time: oilLevelAgg.map((a) => fmtTime(a.t)),
                level: oilLevelAgg.map((a) => a.lv),
            };
        }

        let winding = inRange(filterByDevice(store.winding_temp, device_id));
        if (!start_time) winding = filterByYear(winding, year);
        const windingAgg = aggregate(winding, 't', ['wt'], granularity);
        if (windingAgg.length) {
            result.winding_temperature = {
                time: windingAgg.map((a) => fmtTime(a.t)),
                temperature: windingAgg.map((a) => a.wt),
            };
        }

        if (!Object.keys(result).length) return { error: '没有找到匹配的数据' };

        let start = null;
        let end = null;
        Object.values(result).forEach((block) => {
            if (block.time?.length) {
                if (!start || block.time[0] < start) start = block.time[0];
                if (!end || block.time[block.time.length - 1] > end) end = block.time[block.time.length - 1];
            }
        });
        result.time_range = { start_time: start, end_time: end };
        return result;
    }

    function getChromatographyData(params = {}) {
        const { device_id, year = '2024', granularity = 'day', start_time, end_time } = params;
        let rows = filterByDevice(store.chromatography, device_id);

        if (start_time && end_time) {
            rows = filterByRange(rows, start_time, end_time);
        } else {
            rows = filterByYear(rows, year);
            if (!rows.length) return { error: `${year}年油色谱数据不存在` };
        }

        if (!rows.length) return { error: '没有找到匹配的油色谱数据' };

        const gasMap = [
            ['h2', '氢气'], ['ch4', '甲烷'], ['c2h6', '乙烷'], ['c2h4', '乙烯'],
            ['c2h2', '乙炔'], ['co', '一氧化碳'], ['co2', '二氧化碳'], ['thc', '总烃'],
        ];
        const result = { time: [] };

        ['A相', 'B相', 'C相'].forEach((phase) => {
            const phaseRows = rows.filter((r) => r.ph === phase);
            const keys = gasMap.map(([k]) => k);
            const agg = aggregate(phaseRows, 't', keys, granularity);
            if (!agg.length) return;
            if (!result.time.length) result.time = agg.map((a) => fmtTime(a.t));
            gasMap.forEach(([k, name]) => {
                const series = agg.map((a) => a[k] ?? 0);
                result[`${phase}_${name}`] = series;
                result[`${phase}_${name}_max`] = Math.max(...series, 0);
            });
        });

        if (!result.time.length) return { error: '没有找到匹配的油色谱数据' };
        result.time_range = {
            start_time: result.time[0],
            end_time: result.time[result.time.length - 1],
        };
        return result;
    }

    function getWeatherData(params = {}) {
        const { year = '2024', granularity = 'day', start_time, end_time, device_id } = params;
        let rows = [...store.weather];

        if (start_time && end_time) {
            rows = filterByRange(rows, start_time, end_time);
        } else {
            rows = filterByYear(rows, year);
            if (!rows.length) return { error: `${year}年天气数据不存在` };
            const range = getCommonTimeRange(device_id, year);
            if (range.min && range.max) {
                // 原后端：公共时间 + 8 小时对齐天气 UTC
                const wMin = new Date(range.min.getTime() + 8 * 3600 * 1000);
                const wMax = new Date(range.max.getTime() + 8 * 3600 * 1000);
                rows = rows.filter((r) => {
                    const d = parseTime(r.t);
                    return d && d >= wMin && d <= wMax;
                });
            }
        }

        if (!rows.length) return { error: '没有找到匹配的天气数据' };
        const agg = aggregate(rows, 't', ['temp', 'ws', 'solar'], granularity);
        if (!agg.length) return { error: '没有找到匹配的天气数据' };
        return {
            time: agg.map((a) => fmtTime(a.t)),
            temperature: agg.map((a) => a.temp),
            wind_speed: agg.map((a) => a.ws),
            solar_radiation: agg.map((a) => a.solar),
        };
    }

    function getCorrelationData(params = {}) {
        const { device_id, year = '2024', granularity = 'day', start_time, end_time } = params;
        const allData = {};

        let op = filterByDevice(store.operation, device_id);
        if (start_time && end_time) op = filterByRange(op, start_time, end_time);
        else op = filterByYear(op, year);

        if (op.length) {
            ['A', 'B', 'C'].forEach((phase) => {
                const phaseRows = op.filter((r) => r.p === phase);
                const agg = aggregate(phaseRows, 't', ['i', 'ap'], granularity);
                if (agg.length) {
                    allData[`${phase}相电流`] = agg.map((a) => a.i);
                    allData[`${phase}相功率`] = agg.map((a) => a.ap);
                }
            });
        }

        const addStatus = (rows, keys, labels) => {
            let list = filterByDevice(rows, device_id);
            if (start_time && end_time) list = filterByRange(list, start_time, end_time);
            else list = filterByYear(list, year);
            const agg = aggregate(list, 't', keys, granularity);
            if (!agg.length) return;
            keys.forEach((k, i) => { allData[labels[i]] = agg.map((a) => a[k]); });
        };
        addStatus(store.oil_temp, ['p1', 'p2'], ['油温点位1', '油温点位2']);
        addStatus(store.oil_level, ['lv'], ['油位']);
        addStatus(store.winding_temp, ['wt'], ['绕组温度']);

        let weather = [...store.weather];
        if (start_time && end_time) weather = filterByRange(weather, start_time, end_time);
        else weather = filterByYear(weather, year);
        const weatherAgg = aggregate(weather, 't', ['temp', 'ws'], granularity);
        if (weatherAgg.length) {
            allData['气温'] = weatherAgg.map((a) => a.temp);
            allData['风速'] = weatherAgg.map((a) => a.ws);
        }

        const variables = Object.keys(allData);
        if (variables.length < 2) return { error: '数据不足，无法计算相关性' };
        const minLen = Math.min(...variables.map((v) => allData[v].length));
        if (minLen < 2) return { error: '数据点太少，无法计算相关性' };

        variables.forEach((v) => { allData[v] = allData[v].slice(0, minLen); });
        const valid = variables.filter((v) => allData[v].some((x) => x != null && !Number.isNaN(x)));
        if (valid.length < 2) return { error: '有效数据不足，无法计算相关性' };

        const corr = (a, b) => {
            const n = a.length;
            const ma = mean(a);
            const mb = mean(b);
            let num = 0;
            let da = 0;
            let db = 0;
            for (let i = 0; i < n; i++) {
                const xa = a[i] - ma;
                const xb = b[i] - mb;
                num += xa * xb;
                da += xa * xa;
                db += xb * xb;
            }
            const den = Math.sqrt(da * db);
            return den ? num / den : 0;
        };

        const matrix = valid.map((v1, i) => valid.map((v2, j) => {
            if (i === j) return 1;
            const c = corr(allData[v1], allData[v2]);
            return Number.isNaN(c) ? 0 : Math.round(c * 1000) / 1000;
        }));

        return { variables: valid, matrix };
    }

    function predictSeries(series, type, points) {
        if (series.length < 3) return Array(points).fill(series[series.length - 1] || 0);
        const meanVal = mean(series);
        const stdVal = std(series);
        const recent = series.slice(-Math.min(10, Math.floor(series.length / 2) || 1));
        const diffs = [];
        for (let i = 1; i < recent.length; i++) diffs.push(recent[i] - recent[i - 1]);
        const trend = diffs.length ? mean(diffs) : 0;
        const last = series[series.length - 1];
        const preds = [];

        for (let i = 0; i < points; i++) {
            let pred;
            if (type === 'oil_level') {
                pred = last + trend * 0.1 * (i + 1);
            } else if (type === 'power' || type === 'current') {
                pred = last + trend * 0.2 * (i + 1);
            } else {
                const decay = 0.95 ** (i + 1);
                pred = last + trend * 0.3 * (i + 1) * decay;
            }
            preds.push(pred);
        }

        const minVal = meanVal - 3 * stdVal;
        const maxVal = meanVal + 3 * stdVal;
        for (let i = 0; i < preds.length; i++) {
            preds[i] = Math.min(maxVal, Math.max(minVal, preds[i]));
            if (i > 0) {
                const maxChange = stdVal * 0.5 || 1;
                const delta = preds[i] - preds[i - 1];
                if (Math.abs(delta) > maxChange) {
                    preds[i] = preds[i - 1] + Math.sign(delta) * maxChange;
                }
            }
        }
        return preds;
    }

    function addTime(d, granularity, n) {
        const x = new Date(d.getTime());
        if (granularity === 'day') x.setDate(x.getDate() + n);
        else x.setHours(x.getHours() + n);
        return x;
    }

    function getPredictionsData(params = {}) {
        const {
            device_id, year = '2024', granularity = 'hour',
            type = 'oil_temp', points = 10, start_time, end_time,
        } = params;
        const predictionPoints = Number(points) || 10;

        let rows;
        let valueKey;
        let unit = '';

        if (type === 'oil_temp') {
            rows = store.oil_temp; valueKey = 'p1'; unit = '℃';
        } else if (type === 'oil_level') {
            rows = store.oil_level; valueKey = 'lv'; unit = 'm';
        } else if (type === 'winding_temp') {
            rows = store.winding_temp; valueKey = 'wt'; unit = '℃';
        } else if (type === 'power') {
            rows = store.operation; valueKey = 'ap'; unit = 'MW';
        } else {
            rows = store.operation; valueKey = 'i'; unit = 'A';
        }

        rows = filterByDevice(rows, device_id);
        rows = filterByYear(rows, year);
        if (start_time && end_time) rows = filterByRange(rows, start_time, end_time);
        else {
            const range = getCommonTimeRange(device_id, year);
            if (range.min && range.max) {
                rows = rows.filter((r) => {
                    const d = parseTime(r.t);
                    return d && d >= range.min && d <= range.max;
                });
            } else if (!rows.length) {
                return { error: '没有找到匹配的时间范围' };
            }
        }

        if (!rows.length) return { error: '没有找到匹配的数据' };
        const agg = aggregate(rows, 't', [valueKey], granularity);
        if (agg.length < 10) return { error: '数据点太少，无法进行预测' };

        const series = agg.map((a) => a[valueKey]);
        const predictions = predictSeries(series, type, predictionPoints);
        const s = std(series) || 1;
        const last = agg[agg.length - 1].t;

        return {
            prediction_type: type,
            unit,
            historical: {
                time: agg.map((a) => fmtTime(a.t)),
                values: series,
            },
            predictions: {
                time: Array.from({ length: predictionPoints }, (_, i) => fmtTime(addTime(last, granularity, i + 1))),
                values: predictions,
                confidence_upper: predictions.map((v) => v + s),
                confidence_lower: predictions.map((v) => v - s),
            },
            prediction_quality: {
                accuracy_score: 0.5,
                trend_consistency: 0.5,
                volatility_match: 0.5,
            },
        };
    }

    function detectAnomalies(values, times, typeLabel, unit) {
        if (values.length <= 5) return [];
        const m = mean(values);
        const s = std(values) || 1;
        const out = [];
        values.forEach((v, idx) => {
            const z = Math.abs((v - m) / s);
            if (z > 2) {
                out.push({
                    type: typeLabel,
                    time: times[idx],
                    value: v,
                    severity: z > 3 ? 'high' : 'medium',
                    description: `${typeLabel}: ${v.toFixed(1)}${unit}`,
                });
            }
        });
        return out;
    }

    function getAnomalyDetectionData(params = {}) {
        const { device_id, year = '2024', granularity = 'hour', start_time, end_time } = params;
        let minTime = null;
        let maxTime = null;

        if (start_time && end_time) {
            minTime = parseTime(start_time);
            maxTime = parseTime(end_time);
        } else {
            const range = getCommonTimeRange(device_id, year);
            minTime = range.min;
            maxTime = range.max;
            if (!minTime || !maxTime) {
                // 回退到状态数据年份范围
                const status = filterByYear(filterByDevice(store.oil_temp, device_id), year);
                if (!status.length) return { error: '没有找到匹配的时间范围' };
                status.forEach((r) => {
                    const d = parseTime(r.t);
                    if (!d) return;
                    if (!minTime || d < minTime) minTime = d;
                    if (!maxTime || d > maxTime) maxTime = d;
                });
            }
        }

        const anomalies = [];
        const inRangeYear = (rows) => {
            let list = filterByDevice(rows, device_id);
            list = filterByYear(list, year);
            return list.filter((r) => {
                const d = parseTime(r.t);
                return d && d >= minTime && d <= maxTime;
            });
        };

        const oilAgg = aggregate(inRangeYear(store.oil_temp), 't', ['p1'], granularity);
        anomalies.push(...detectAnomalies(
            oilAgg.map((a) => a.p1),
            oilAgg.map((a) => fmtTime(a.t)),
            '油温异常',
            '℃'
        ));

        const opAgg = aggregate(inRangeYear(store.operation), 't', ['ap'], granularity);
        anomalies.push(...detectAnomalies(
            opAgg.map((a) => a.ap),
            opAgg.map((a) => fmtTime(a.t)),
            '功率异常',
            'MW'
        ));

        const levelAgg = aggregate(inRangeYear(store.oil_level), 't', ['lv'], granularity);
        anomalies.push(...detectAnomalies(
            levelAgg.map((a) => a.lv),
            levelAgg.map((a) => fmtTime(a.t)),
            '油位异常',
            ''
        ));

        const windAgg = aggregate(inRangeYear(store.winding_temp), 't', ['wt'], granularity);
        anomalies.push(...detectAnomalies(
            windAgg.map((a) => a.wt),
            windAgg.map((a) => fmtTime(a.t)),
            '绕组温度异常',
            '℃'
        ));

        anomalies.sort((a, b) => (a.time < b.time ? -1 : 1));
        return {
            anomalies,
            total_count: anomalies.length,
            high_severity_count: anomalies.filter((a) => a.severity === 'high').length,
        };
    }

    function getDensityData(params = {}) {
        const op = getOperationData(params);
        if (op.error) return op;
        // 简化：用序列值作为密度输入
        const phases = {};
        Object.entries(op.series || {}).forEach(([phase, s]) => {
            phases[phase] = {
                current: { values: s.current, density: { x: s.current, y: s.current.map(() => 1) } },
                power: { values: s.active_power, density: { x: s.active_power, y: s.active_power.map(() => 1) } },
            };
        });
        return { phases, time_range: op.time_range };
    }

    /**
     * 统一入口：兼容原 /api/{type}_data 调用习惯
     */
    async function request(dataType, params = {}) {
        await init();
        const map = {
            devices: () => getDevices(),
            available_years: () => getAvailableYears(),
            operation: () => getOperationData(params),
            status: () => getStatusData(params),
            chromatography: () => getChromatographyData(params),
            weather: () => getWeatherData(params),
            correlation: () => getCorrelationData(params),
            prediction: () => getPredictionsData(params),
            predictions: () => getPredictionsData(params),
            anomaly: () => getAnomalyDetectionData(params),
            anomaly_detection: () => getAnomalyDetectionData(params),
            density: () => getDensityData(params),
        };
        const fn = map[dataType];
        if (!fn) return { error: `未知数据类型: ${dataType}` };
        try {
            return fn();
        } catch (e) {
            console.error(dataType, e);
            return { error: `${dataType} 计算失败` };
        }
    }

    return {
        init,
        request,
        getDevices,
        getAvailableYears,
        getOperationData,
        getStatusData,
        getChromatographyData,
        getWeatherData,
        getCorrelationData,
        getPredictionsData,
        getAnomalyDetectionData,
    };
})();

if (typeof globalThis !== "undefined") globalThis.DataAPI = DataAPI;
