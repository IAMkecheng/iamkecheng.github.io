// 图表管理器
class ChartManager {
    constructor() {
        this.charts = new Map();
        this.originalData = new Map();
    }

    initChart(containerId, chartType = 'line') {
        const chart = echarts.init(document.getElementById(containerId));
        this.charts.set(containerId, chart);
        return chart;
    }

    getChart(containerId) {
        return this.charts.get(containerId);
    }

    resizeChart(containerId) {
        const chart = this.charts.get(containerId);
        if (chart && chart.resize) {
            chart.resize();
        }
    }

    disposeChart(containerId) {
        const chart = this.charts.get(containerId);
        if (chart && chart.dispose) {
            chart.dispose();
        }
        this.charts.delete(containerId);
    }

    setOriginalData(key, data) {
        this.originalData.set(key, JSON.parse(JSON.stringify(data)));
    }

    getOriginalData(key) {
        return this.originalData.get(key);
    }

    clearAll() {
        this.charts.forEach(chart => {
            if (chart && chart.dispose) {
                chart.dispose();
            }
        });
        this.charts.clear();
        this.originalData.clear();
    }
}

// 数据加载器
class DataLoader {
    constructor(chartManager) {
        this.chartManager = chartManager;
    }

    async loadData(dataType, params) {
        const { startTime, endTime, deviceId, granularity, chartInstance, context = 'single', columnId = null, predictionPoints, year } = params;

        try {
            const query = Object.fromEntries(new URLSearchParams(
                this.buildQueryParams({ startTime, endTime, deviceId, granularity, dataType, predictionPoints, year })
            ).entries());

            const data = await DataAPI.request(dataType, query);

            if (data.error) {
                if (chartInstance) {
                    this.showErrorChart(chartInstance, data.error);
                } else if (dataType === 'anomaly') {
                    this.displayAnomalyData(data, null, context, columnId);
                }
                return;
            }

            let option = null;
            // 特殊处理相关性分析、异常检测和密度图
            if (dataType === 'correlation') {
                if (chartInstance) {
                    this.drawCorrelationMatrix(data, chartInstance);
                }
            } else if (dataType === 'anomaly') {
                this.displayAnomalyData(data, chartInstance, context, columnId);
            } else if (dataType === 'density') {
                if (chartInstance) {
                    this.drawDensityChart(data, chartInstance, context, columnId);
                }
            } else {
                if (chartInstance) {
                    option = this.createChartOption(dataType, data, context);
                    chartInstance.clear();
                    chartInstance.setOption(option, true);
                }
            }

            // 保存原始数据用于图表类型切换
            const dataKey = this.getDataKey(dataType, context, columnId);
            if (dataType !== 'correlation' && dataType !== 'anomaly' && option) {
                this.chartManager.setOriginalData(dataKey, option);
            }

            // 检查并应用当前图表类型（如果是非折线图）
            if (chartInstance && option) {
                this.applyCurrentChartType(dataType, chartInstance, context, columnId);
            }

            // 设置图表后调整大小
            setTimeout(() => {
                if (chartInstance && chartInstance.resize) {
                    chartInstance.resize();
                }
            }, 100);

        } catch (error) {
            console.error(`加载${dataType}数据失败:`, error);
            if (chartInstance) {
                this.showErrorChart(chartInstance, '加载数据失败');
            } else if (dataType === 'anomaly') {
                this.displayAnomalyData({ error: '加载数据失败' }, null, context, columnId);
            }
        }
    }

    buildQueryParams(params) {
        const { startTime, endTime, deviceId, granularity, dataType, predictionPoints, year } = params;
        const queryParams = new URLSearchParams();

        if (deviceId) queryParams.append('device_id', deviceId);
        if (granularity) queryParams.append('granularity', granularity);
        if (startTime) queryParams.append('start_time', startTime);
        if (endTime) queryParams.append('end_time', endTime);

        // 优先使用调用方传入的年份，其次年份选择器；避免回落到系统当前年（数据可能不含该年）
        let resolvedYear = year || document.getElementById('yearSelect')?.value || '';
        if (!resolvedYear && startTime) {
            const parsedYear = new Date(startTime).getFullYear();
            if (!Number.isNaN(parsedYear)) {
                resolvedYear = String(parsedYear);
            }
        }
        queryParams.append('year', resolvedYear || '2024');

        if (dataType === 'prediction') {
            const predictionType = document.getElementById('predictionTypeSelect')?.value || 'oil_temp';
            queryParams.append('type', predictionType);
            if (predictionPoints) queryParams.append('points', predictionPoints);
        }

        return queryParams.toString();
    }

    getDataKey(dataType, context, columnId) {
        if (context === 'current') {
            return `current_${dataType}`;
        } else if (context === 'column' && columnId) {
            return `column_${columnId}_${dataType}`;
        } else {
            return dataType;
        }
    }

    // 应用当前图表类型
    applyCurrentChartType(dataType, chartInstance, context, columnId) {
        // 获取当前图表类型选择器的值
        let selectorId = '';
        if (context === 'single') {
            selectorId = `${dataType}ChartType`;
        } else if (context === 'current') {
            selectorId = `current${dataType.charAt(0).toUpperCase() + dataType.slice(1)}ChartType`;
        } else if (context === 'column' && columnId) {
            selectorId = `${dataType}ChartType_${columnId}`;
        }

        const selector = document.getElementById(selectorId);
        if (selector) {
            const currentType = selector.value;
            const currentOption = chartInstance.getOption();

            // 如果当前图表类型不是折线图，立即应用该类型
            if (currentType && currentType !== 'line' && currentOption && currentOption.series) {
                // console.log(`立即应用 ${dataType} 图表类型: ${currentType}`);

                // 使用图表类型切换器应用正确的类型
                if (dataType === 'operation') {
                    chartTypeSwitcher.switchOperationChartType(chartInstance, currentOption, currentType, dataType, columnId, context);
                } else if (dataType === 'status') {
                    chartTypeSwitcher.switchStatusChartType(chartInstance, currentOption, currentType, dataType, columnId, context);
                } else if (dataType === 'chromatography') {
                    chartTypeSwitcher.switchChromatographyChartType(chartInstance, currentOption, currentType, dataType, columnId, context);
                } else if (dataType === 'density') {
                    chartTypeSwitcher.switchDensityChartType(chartInstance, currentOption, currentType, dataType, columnId, context);
                }
            }
        }
    }

    showErrorChart(chartInstance, errorMessage) {
        if (!chartInstance) return;

        chartInstance.clear();
        chartInstance.setOption({
            title: {
                text: errorMessage || '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: { color: '#e74c3c', fontSize: 16, fontWeight: 'normal' }
            }
        }, true);
    }

    createChartOption(dataType, data, context) {
        const baseConfig = this.getBaseChartConfig(dataType);
        const dataConfig = this.getDataSpecificConfig(dataType, data);

        return { ...baseConfig, ...dataConfig };
    }

    getBaseChartConfig(dataType) {
        // 面板 header 已有名称，图内不再重复标题，避免与错误态 title 合并残留
        return {
            title: { show: false },
            tooltip: {
                trigger: 'item',
                axisPointer: { type: 'cross' }
            },
            legend: {
                top: 10,
                type: 'scroll'
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                top: '15%',
                containLabel: true
            }
        };
    }

    getDataSpecificConfig(dataType, data) {
        switch (dataType) {
            case 'operation':
                return this.createOperationConfig(data);
            case 'status':
                return this.createStatusConfig(data);
            case 'chromatography':
                return this.createChromatographyConfig(data);
            case 'weather':
                return this.createWeatherConfig(data);
            case 'correlation':
                return this.createCorrelationConfig(data);
            case 'prediction':
                return this.createPredictionConfig(data);
            case 'anomaly':
                return this.createAnomalyConfig(data);
            default:
                return {};
        }
    }

    createOperationConfig(data) {
        if (!data.time || data.time.length === 0 || !data.series) {
            return { graphic: { type: 'text', left: 'center', top: 'middle', style: { text: '无可用数据', fontSize: 16, fill: '#7f8c8d' } } };
        }

        const option = {
            tooltip: {
                formatter: function (params) {
                    // 安全检查params对象
                    if (!params || !params.seriesName) return '';

                    const time = params.dataIndex < data.time.length ? data.time[params.dataIndex] : '';
                    let unit = '';
                    if (params.seriesName.includes('电流')) unit = 'A';
                    else if (params.seriesName.includes('功率')) unit = 'MW';
                    return `${params.seriesName}<br/>时间: ${time}<br/>数值: ${params.data} ${unit}`;
                }
            },
            legend: {
                data: ['A相电流', 'B相电流', 'C相电流', 'A相功率', 'B相功率', 'C相功率'],
                top: 30
            },
            toolbox: {
                feature: {
                    dataZoom: {
                        yAxisIndex: 'none',
                        title: {
                            zoom: '区域缩放',
                            back: '区域缩放还原'
                        }
                    },
                    dataView: {
                        show: true,
                        title: '数据视图',
                        readOnly: false,
                        lang: ['数据视图', '关闭', '刷新'],
                        optionToContent: function (opt) {
                            let result = '<div style="padding: 10px; font-family: monospace; font-size: 12px;">';
                            result += '<h4>运行数据表</h4>';
                            result += '<table border="1" style="border-collapse: collapse; width: 100%;">';

                            // 表头
                            result += '<tr><th>时间</th>';
                            result += '<th>A相电流(A)</th><th>B相电流(A)</th><th>C相电流(A)</th>';
                            result += '<th>A相功率(MW)</th><th>B相功率(MW)</th><th>C相功率(MW)</th>';
                            result += '</tr>';

                            // 数据行
                            const timeData = data.time || [];
                            const seriesData = data.series || {};

                            timeData.forEach((time, index) => {
                                result += `<tr><td>${time}</td>`;

                                // 电流数据
                                ['A', 'B', 'C'].forEach(phase => {
                                    const currentData = seriesData[phase]?.current || [];
                                    result += `<td>${(currentData[index] || 0).toFixed(2)}</td>`;
                                });

                                // 功率数据
                                ['A', 'B', 'C'].forEach(phase => {
                                    const powerData = seriesData[phase]?.active_power || [];
                                    result += `<td>${(powerData[index] || 0).toFixed(2)}</td>`;
                                });

                                result += '</tr>';
                            });

                            result += '</table></div>';
                            return result;
                        }
                    },
                    restore: {
                        title: '还原'
                    },
                    saveAsImage: {
                        title: '保存为图片'
                    }
                },
                right: 20,
                top: 0
            },
            dataZoom: [
                {
                    type: 'slider',
                    show: true,
                    xAxisIndex: [0],
                    start: 0,
                    end: 100,
                    bottom: 20,
                    height: 20,
                    handleStyle: {
                        color: '#1890ff'
                    },
                    textStyle: {
                        color: '#666'
                    }
                },
                {
                    type: 'inside',
                    xAxisIndex: [0],
                    start: 0,
                    end: 100
                },
                {
                    type: 'slider',
                    show: true,
                    yAxisIndex: [0],
                    start: 0,
                    end: 100,
                    left: 0,
                    width: 20,
                    handleStyle: {
                        color: '#1890ff'
                    },
                    textStyle: {
                        color: '#666'
                    }
                },
                {
                    type: 'inside',
                    yAxisIndex: [0],
                    start: 0,
                    end: 100
                },
                {
                    type: 'slider',
                    show: true,
                    yAxisIndex: [1],
                    start: 0,
                    end: 100,
                    right: 0,
                    width: 20,
                    handleStyle: {
                        color: '#1890ff'
                    },
                    textStyle: {
                        color: '#666'
                    }
                },
                {
                    type: 'inside',
                    yAxisIndex: [1],
                    start: 0,
                    end: 100
                }
            ],
            xAxis: {
                type: 'category',
                data: data.time,
                axisLabel: { rotate: 45, fontSize: 10 }
            },
            yAxis: [
                {
                    type: 'value',
                    name: '电流 (A)',
                    position: 'left',
                    scale: true
                },
                {
                    type: 'value',
                    name: '功率 (MW)',
                    position: 'right',
                    scale: true
                }
            ],
            series: []
        };

        const colorScheme = {
            A: { current: operationColorScheme['A相电流'], power: operationColorScheme['A相功率'] },
            B: { current: operationColorScheme['B相电流'], power: operationColorScheme['B相功率'] },
            C: { current: operationColorScheme['C相电流'], power: operationColorScheme['C相功率'] }
        };

        for (const phase of ['A', 'B', 'C']) {
            if (data.series[phase]) {
                option.series.push({
                    name: `${phase}相电流`,
                    type: 'line',
                    yAxisIndex: 0,
                    data: data.series[phase].current || [],
                    smooth: true,
                    lineStyle: { color: colorScheme[phase].current, width: 2 },
                    itemStyle: { color: colorScheme[phase].current }
                });
                option.series.push({
                    name: `${phase}相功率`,
                    type: 'line',
                    yAxisIndex: 1,
                    data: data.series[phase].active_power || [],
                    smooth: true,
                    lineStyle: { color: colorScheme[phase].power, type: 'dashed', width: 2 },
                    itemStyle: { color: colorScheme[phase].power }
                });
            }
        }

        return option;
    }

    createStatusConfig(data) {
        if (!data || Object.keys(data).length === 0) {
            return { graphic: { type: 'text', left: 'center', top: 'middle', style: { text: '无可用数据', fontSize: 16, fill: '#7f8c8d' } } };
        }

        // 获取时间数据，优先使用oil_temperature的时间
        const timeData = data.oil_temperature ? data.oil_temperature.time :
            data.oil_level ? data.oil_level.time :
                data.winding_temperature ? data.winding_temperature.time : [];

        const option = {
            tooltip: {
                formatter: function (params) {
                    // 安全检查params对象
                    if (!params || !params.seriesName) return '';

                    const time = params.dataIndex < timeData.length ? timeData[params.dataIndex] : '';
                    let unit = '';
                    if (params.seriesName.includes('温度')) unit = '℃';
                    else if (params.seriesName.includes('油位')) unit = 'm';
                    return `${params.seriesName}<br/>时间: ${time}<br/>数值: ${params.data} ${unit}`;
                }
            },
            legend: {
                data: ['油温点位1', '油温点位2', '油位', '绕组温度'],
                top: 30
            },
            toolbox: {
                feature: {
                    dataZoom: {
                        yAxisIndex: 'none',
                        title: {
                            zoom: '区域缩放',
                            back: '区域缩放还原'
                        }
                    },
                    dataView: {
                        show: true,
                        title: '数据视图',
                        readOnly: false,
                        lang: ['数据视图', '关闭', '刷新'],
                        optionToContent: function (opt) {
                            let result = '<div style="padding: 10px; font-family: monospace; font-size: 12px;">';
                            result += '<h4>状态数据表</h4>';
                            result += '<table border="1" style="border-collapse: collapse; width: 100%;">';

                            // 表头
                            result += '<tr><th>时间</th>';
                            result += '<th>油温点位1(℃)</th><th>油温点位2(℃)</th>';
                            result += '<th>油位(m)</th><th>绕组温度(℃)</th>';
                            result += '</tr>';

                            // 数据行
                            timeData.forEach((time, index) => {
                                result += `<tr><td>${time}</td>`;

                                // 油温点位1
                                const oilTemp1Data = data.oil_temperature?.point1 || [];
                                result += `<td>${(oilTemp1Data[index] || 0).toFixed(2)}</td>`;

                                // 油温点位2
                                const oilTemp2Data = data.oil_temperature?.point2 || [];
                                result += `<td>${(oilTemp2Data[index] || 0).toFixed(2)}</td>`;

                                // 油位
                                const oilLevelData = data.oil_level?.level || [];
                                result += `<td>${(oilLevelData[index] || 0).toFixed(2)}</td>`;

                                // 绕组温度
                                const windingTempData = data.winding_temperature?.temperature || [];
                                result += `<td>${(windingTempData[index] || 0).toFixed(2)}</td>`;

                                result += '</tr>';
                            });

                            result += '</table></div>';
                            return result;
                        }
                    },
                    restore: {
                        title: '还原'
                    },
                    saveAsImage: {
                        title: '保存为图片'
                    }
                },
                right: 20,
                top: 0
            },
            dataZoom: [
                {
                    type: 'slider',
                    show: true,
                    xAxisIndex: [0],
                    start: 0,
                    end: 100,
                    bottom: 20,
                    height: 20,
                    handleStyle: {
                        color: '#1890ff'
                    },
                    textStyle: {
                        color: '#666'
                    }
                },
                {
                    type: 'inside',
                    xAxisIndex: [0],
                    start: 0,
                    end: 100
                },
                {
                    type: 'slider',
                    show: true,
                    yAxisIndex: [0],
                    start: 0,
                    end: 100,
                    left: 0,
                    width: 20,
                    handleStyle: {
                        color: '#1890ff'
                    },
                    textStyle: {
                        color: '#666'
                    }
                },
                {
                    type: 'inside',
                    yAxisIndex: [0],
                    start: 0,
                    end: 100
                },
                {
                    type: 'slider',
                    show: true,
                    yAxisIndex: [1],
                    start: 0,
                    end: 100,
                    right: 0,
                    width: 20,
                    handleStyle: {
                        color: '#1890ff'
                    },
                    textStyle: {
                        color: '#666'
                    }
                },
                {
                    type: 'inside',
                    yAxisIndex: [1],
                    start: 0,
                    end: 100
                }
            ],
            xAxis: {
                type: 'category',
                data: timeData,
                axisLabel: { rotate: 45, fontSize: 10 }
            },
            yAxis: [
                {
                    type: 'value',
                    name: '温度 (℃)',
                    position: 'left',
                    scale: true
                },
                {
                    type: 'value',
                    name: '油位',
                    position: 'right',
                    scale: true
                }
            ],
            series: []
        };

        const statusColors = {
            oilTemp1: '#e74c3c',
            oilTemp2: '#f39c12',
            oilLevel: '#27ae60',
            windingTemp: '#8e44ad'
        };

        if (data.oil_temperature) {
            option.series.push({
                name: '油温点位1',
                type: 'line',
                yAxisIndex: 0,
                data: data.oil_temperature.point1 || [],
                smooth: true,
                lineStyle: { color: statusColors.oilTemp1, width: 2 },
                itemStyle: { color: statusColors.oilTemp1 }
            });
            option.series.push({
                name: '油温点位2',
                type: 'line',
                yAxisIndex: 0,
                data: data.oil_temperature.point2 || [],
                smooth: true,
                lineStyle: { color: statusColors.oilTemp2, width: 2 },
                itemStyle: { color: statusColors.oilTemp2 }
            });
        }

        if (data.oil_level) {
            option.series.push({
                name: '油位',
                type: 'line',
                yAxisIndex: 1,
                data: data.oil_level.level || [],
                smooth: true,
                lineStyle: { color: statusColors.oilLevel, width: 2 },
                itemStyle: { color: statusColors.oilLevel }
            });
        }

        if (data.winding_temperature) {
            option.series.push({
                name: '绕组温度',
                type: 'line',
                yAxisIndex: 0,
                data: data.winding_temperature.temperature || [],
                smooth: true,
                lineStyle: { color: statusColors.windingTemp, width: 2 },
                itemStyle: { color: statusColors.windingTemp }
            });
        }

        return option;
    }

    createChromatographyConfig(data) {
        if (!data.time || data.time.length === 0) {
            return { graphic: { type: 'text', left: 'center', top: 'middle', style: { text: '无可用数据', fontSize: 16, fill: '#7f8c8d' } } };
        }

        const legendData = [];
        const series = [];
        const selectedData = [];

        const phases = ['A相', 'B相', 'C相'];
        const gases = ['氢气', '甲烷', '乙烷', '乙烯', '乙炔', '一氧化碳', '二氧化碳', '总烃'];

        phases.forEach((phase, phaseIndex) => {
            gases.forEach((gas, gasIndex) => {
                const key = `${phase}_${gas}`;
                const maxKey = `${phase}_${gas}_max`;

                if (data[key] && data[key].length > 0) {
                    const maxConcentration = data[maxKey] || 0;
                    const isSelected = maxConcentration < 100;

                    legendData.push(`${phase}${gas}`);

                    const color = chromatographyColorScheme[phase][gasIndex];

                    series.push({
                        name: `${phase}${gas}`,
                        type: 'line',
                        data: data[key],
                        smooth: true,
                        lineStyle: { color: color, width: 2, opacity: 1.0 },
                        itemStyle: { color: color }
                    });

                    selectedData.push({
                        name: `${phase}${gas}`,
                        selected: isSelected
                    });
                }
            });
        });

        return {
            tooltip: {
                formatter: function (params) {
                    // 安全检查params对象
                    if (!params || !params.seriesName) return '';

                    const time = params.dataIndex < data.time.length ? data.time[params.dataIndex] : '';
                    return `${params.seriesName}<br/>时间: ${time}<br/>浓度: ${params.data} μL/L`;
                }
            },
            legend: {
                data: legendData,
                top: 30,
                type: 'scroll',
                orient: 'horizontal',
                selected: selectedData.reduce((acc, item) => {
                    acc[item.name] = item.selected;
                    return acc;
                }, {})
            },
            toolbox: {
                feature: {
                    dataZoom: {
                        yAxisIndex: 'none',
                        title: {
                            zoom: '区域缩放',
                            back: '区域缩放还原'
                        }
                    },
                    dataView: {
                        show: true,
                        title: '数据视图',
                        readOnly: false,
                        lang: ['数据视图', '关闭', '刷新'],
                        optionToContent: function (opt) {
                            let result = '<div style="padding: 10px; font-family: monospace; font-size: 12px;">';
                            result += '<h4>油色谱数据表 (μL/L)</h4>';
                            result += '<table border="1" style="border-collapse: collapse; width: 100%;">';

                            // 表头
                            result += '<tr><th>时间</th>';
                            const phases = ['A相', 'B相', 'C相'];
                            const gases = ['氢气', '甲烷', '乙烷', '乙烯', '乙炔', '一氧化碳', '二氧化碳', '总烃'];

                            phases.forEach(phase => {
                                gases.forEach(gas => {
                                    result += `<th>${phase}${gas}</th>`;
                                });
                            });
                            result += '</tr>';

                            // 数据行
                            const timeData = data.time || [];
                            timeData.forEach((time, index) => {
                                result += `<tr><td>${time}</td>`;

                                phases.forEach(phase => {
                                    gases.forEach(gas => {
                                        const key = `${phase}_${gas}`;
                                        const gasData = data[key] || [];
                                        result += `<td>${(gasData[index] || 0).toFixed(2)}</td>`;
                                    });
                                });

                                result += '</tr>';
                            });

                            result += '</table></div>';
                            return result;
                        }
                    },
                    restore: {
                        title: '还原'
                    },
                    saveAsImage: {
                        title: '保存为图片'
                    }
                },
                right: 20,
                top: 0
            },
            dataZoom: [
                {
                    type: 'slider',
                    show: true,
                    xAxisIndex: [0],
                    start: 0,
                    end: 100,
                    bottom: 20,
                    height: 20,
                    handleStyle: {
                        color: '#1890ff'
                    },
                    textStyle: {
                        color: '#666'
                    }
                },
                {
                    type: 'inside',
                    xAxisIndex: [0],
                    start: 0,
                    end: 100
                },
                {
                    type: 'slider',
                    show: true,
                    yAxisIndex: [0],
                    start: 0,
                    end: 100,
                    right: 0,
                    width: 20,
                    handleStyle: {
                        color: '#1890ff'
                    },
                    textStyle: {
                        color: '#666'
                    }
                },
                {
                    type: 'inside',
                    yAxisIndex: [0],
                    start: 0,
                    end: 100
                }
            ],
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: data.time,
                axisLabel: { rotate: 45, fontSize: 10 }
            },
            yAxis: {
                type: 'value',
                name: '浓度 (μL/L)',
                scale: true
            },
            series: series
        };
    }

    createWeatherConfig(data) {
        if (!data.time || data.time.length === 0) {
            return { graphic: { type: 'text', left: 'center', top: 'middle', style: { text: '无可用数据', fontSize: 16, fill: '#7f8c8d' } } };
        }

        return {
            tooltip: {
                formatter: function (params) {
                    // 安全检查params对象
                    if (!params || !params.seriesName) return '';

                    const time = params.dataIndex < data.time.length ? data.time[params.dataIndex] : '';
                    let unit = '';
                    if (params.seriesName.includes('气温')) unit = '℃';
                    else if (params.seriesName.includes('风速')) unit = 'm/s';
                    return `${params.seriesName}<br/>时间: ${time}<br/>数值: ${params.data} ${unit}`;
                }
            },
            legend: {
                data: ['气温', '风速'],
                top: 30
            },
            toolbox: {
                feature: {
                    dataZoom: {
                        yAxisIndex: 'none',
                        title: {
                            zoom: '区域缩放',
                            back: '区域缩放还原'
                        }
                    },
                    dataView: {
                        show: true,
                        title: '数据视图',
                        readOnly: false,
                        lang: ['数据视图', '关闭', '刷新'],
                        optionToContent: function (opt) {
                            let result = '<div style="padding: 10px; font-family: monospace; font-size: 12px;">';
                            result += '<h4>天气环境数据表</h4>';
                            result += '<table border="1" style="border-collapse: collapse; width: 100%;">';

                            // 表头
                            result += '<tr><th>时间</th>';
                            result += '<th>气温(℃)</th><th>风速(m/s)</th>';
                            result += '</tr>';

                            // 数据行
                            const timeData = data.time || [];
                            timeData.forEach((time, index) => {
                                result += `<tr><td>${time}</td>`;

                                // 气温
                                const tempData = data.temperature || [];
                                result += `<td>${(tempData[index] || 0).toFixed(2)}</td>`;

                                // 风速
                                const windData = data.wind_speed || [];
                                result += `<td>${(windData[index] || 0).toFixed(2)}</td>`;

                                result += '</tr>';
                            });

                            result += '</table></div>';
                            return result;
                        }
                    },
                    restore: {
                        title: '还原'
                    },
                    saveAsImage: {
                        title: '保存为图片'
                    }
                },
                right: 20,
                top: 0
            },
            dataZoom: [
                {
                    type: 'slider',
                    show: true,
                    xAxisIndex: [0],
                    start: 0,
                    end: 100,
                    bottom: 20,
                    height: 20,
                    handleStyle: {
                        color: '#1890ff'
                    },
                    textStyle: {
                        color: '#666'
                    }
                },
                {
                    type: 'inside',
                    xAxisIndex: [0],
                    start: 0,
                    end: 100
                },
                {
                    type: 'slider',
                    show: true,
                    yAxisIndex: [0],
                    start: 0,
                    end: 100,
                    left: 0,
                    width: 20,
                    handleStyle: {
                        color: '#1890ff'
                    },
                    textStyle: {
                        color: '#666'
                    }
                },
                {
                    type: 'inside',
                    yAxisIndex: [0],
                    start: 0,
                    end: 100
                },
                {
                    type: 'slider',
                    show: true,
                    yAxisIndex: [1],
                    start: 0,
                    end: 100,
                    right: 0,
                    width: 20,
                    handleStyle: {
                        color: '#1890ff'
                    },
                    textStyle: {
                        color: '#666'
                    }
                },
                {
                    type: 'inside',
                    yAxisIndex: [1],
                    start: 0,
                    end: 100
                }
            ],
            xAxis: {
                type: 'category',
                data: data.time,
                axisLabel: { rotate: 45, fontSize: 10 }
            },
            yAxis: [
                {
                    type: 'value',
                    name: '气温 (℃)',
                    position: 'left',
                    scale: true
                },
                {
                    type: 'value',
                    name: '风速 (m/s)',
                    position: 'right',
                    scale: true
                }
            ],
            series: [
                {
                    name: '气温',
                    type: 'line',
                    yAxisIndex: 0,
                    data: data.temperature || [],
                    smooth: true,
                    lineStyle: { color: '#e74c3c', width: 2 },
                    itemStyle: { color: '#e74c3c' }
                },
                {
                    name: '风速',
                    type: 'line',
                    yAxisIndex: 1,
                    data: data.wind_speed || [],
                    smooth: true,
                    lineStyle: { color: '#27ae60', width: 2 },
                    itemStyle: { color: '#27ae60' }
                }
            ]
        };
    }

    createCorrelationConfig(data) {
        // 相关性数据使用特殊的热力图显示
        return this.createCorrelationHeatmap(data);
    }

    createPredictionConfig(data) {
        const typeNames = {
            'oil_temp': '油温',
            'oil_level': '油位',
            'winding_temp': '绕组温度',
            'power': '功率',
            'current': '电流'
        };

        const typeName = typeNames[data.prediction_type] || '数据';
        const unit = data.unit || '';

        return {
            tooltip: {
                formatter: function (params) {
                    // 安全检查params对象
                    if (!params || !params.seriesName) return '';

                    const allTimes = [...data.historical.time, ...data.predictions.time];
                    const time = params.dataIndex < allTimes.length ? allTimes[params.dataIndex] : '';
                    return `${params.seriesName}<br/>时间: ${time}<br/>数值: ${params.data} ${unit}`;
                }
            },
            legend: {
                data: ['历史数据', '预测数据', '置信区间'],
                top: 30
            },
            toolbox: {
                feature: {
                    dataZoom: {
                        yAxisIndex: 'none',
                        title: {
                            zoom: '区域缩放',
                            back: '区域缩放还原'
                        }
                    },
                    dataView: {
                        show: true,
                        title: '数据视图',
                        readOnly: false,
                        lang: ['数据视图', '关闭', '刷新'],
                        optionToContent: function (opt) {
                            let result = '<div style="padding: 10px; font-family: monospace; font-size: 12px;">';
                            result += `<h4>时序预测数据表 (${unit})</h4>`;
                            result += '<table border="1" style="border-collapse: collapse; width: 100%;">';

                            // 表头
                            result += '<tr><th>时间</th>';
                            result += '<th>历史数据</th><th>预测数据</th>';
                            result += '</tr>';

                            // 数据行
                            const allTimes = [...data.historical.time, ...data.predictions.time];
                            const historicalValues = data.historical.values || [];
                            const predictionValues = data.predictions.values || [];

                            allTimes.forEach((time, index) => {
                                result += `<tr><td>${time}</td>`;

                                // 历史数据
                                const histValue = index < historicalValues.length ? historicalValues[index] : '';
                                result += `<td>${histValue !== '' ? histValue.toFixed(2) : '-'}</td>`;

                                // 预测数据
                                const predIndex = index - historicalValues.length;
                                const predValue = predIndex >= 0 && predIndex < predictionValues.length ? predictionValues[predIndex] : '';
                                result += `<td>${predValue !== '' ? predValue.toFixed(2) : '-'}</td>`;

                                result += '</tr>';
                            });

                            result += '</table>';

                            // 添加预测质量指标
                            if (data.prediction_quality) {
                                result += '<br/><h4>预测质量指标</h4>';
                                result += '<table border="1" style="border-collapse: collapse; width: 100%;">';
                                result += '<tr><th>指标</th><th>评分</th><th>说明</th></tr>';

                                const quality = data.prediction_quality;
                                result += `<tr><td>准确性评分</td><td>${(quality.accuracy_score * 100).toFixed(1)}%</td><td>基于历史数据稳定性评估</td></tr>`;
                                result += `<tr><td>趋势一致性</td><td>${(quality.trend_consistency * 100).toFixed(1)}%</td><td>预测趋势与历史趋势的匹配度</td></tr>`;
                                result += `<tr><td>波动性匹配</td><td>${(quality.volatility_match * 100).toFixed(1)}%</td><td>预测波动性与历史波动性的匹配度</td></tr>`;

                                const overallScore = (quality.accuracy_score + quality.trend_consistency + quality.volatility_match) / 3;
                                result += `<tr><td><strong>综合评分</strong></td><td><strong>${(overallScore * 100).toFixed(1)}%</strong></td><td>预测质量综合评估</td></tr>`;

                                result += '</table>';
                            }

                            result += '</div>';
                            return result;
                        }
                    },
                    restore: {
                        title: '还原'
                    },
                    saveAsImage: {
                        title: '保存为图片'
                    }
                },
                right: 20,
                top: 0
            },
            dataZoom: [
                {
                    type: 'slider',
                    show: true,
                    xAxisIndex: [0],
                    start: 0,
                    end: 100,
                    bottom: 20,
                    height: 20,
                    handleStyle: {
                        color: '#1890ff'
                    },
                    textStyle: {
                        color: '#666'
                    }
                },
                {
                    type: 'inside',
                    xAxisIndex: [0],
                    start: 0,
                    end: 100
                },
                {
                    type: 'slider',
                    show: true,
                    yAxisIndex: [0],
                    start: 0,
                    end: 100,
                    left: 0,
                    width: 20,
                    handleStyle: {
                        color: '#1890ff'
                    },
                    textStyle: {
                        color: '#666'
                    }
                },
                {
                    type: 'inside',
                    yAxisIndex: [0],
                    start: 0,
                    end: 100
                }
            ],
            xAxis: {
                type: 'category',
                data: [...data.historical.time, ...data.predictions.time],
                axisLabel: { rotate: 45, fontSize: 10 }
            },
            yAxis: {
                type: 'value',
                name: `${typeName} (${unit})`,
                scale: true
            },
            series: [
                {
                    name: '历史数据',
                    type: 'line',
                    data: [...data.historical.values, ...new Array(data.predictions.values.length).fill(null)],
                    smooth: true,
                    lineStyle: { color: '#3498db', width: 2 },
                    itemStyle: { color: '#3498db' }
                },
                // 黄线连接：从最后一个历史数据点到第一个预测数据点
                {
                    name: '连接线',
                    type: 'line',
                    data: (() => {
                        const historicalValues = data.historical.values || [];
                        const predictionValues = data.predictions.values || [];
                        if (historicalValues.length === 0 || predictionValues.length === 0) return [];

                        const lastHistoricalValue = historicalValues[historicalValues.length - 1];
                        const firstPredictionValue = predictionValues[0];

                        const connectionData = new Array(historicalValues.length + predictionValues.length).fill(null);
                        connectionData[historicalValues.length - 1] = lastHistoricalValue;
                        connectionData[historicalValues.length] = firstPredictionValue;

                        return connectionData;
                    })(),
                    lineStyle: { color: '#e67e22', width: 2, type: 'solid' },
                    itemStyle: { color: '#e67e22' },
                    showSymbol: false,
                    silent: true,
                    z: 1
                },
                {
                    name: '预测数据',
                    type: 'line',
                    data: [...new Array(data.historical.values.length).fill(null), ...data.predictions.values],
                    smooth: true,
                    lineStyle: { color: '#e67e22', type: 'dashed', width: 2 },
                    itemStyle: { color: '#e67e22' }
                },
                // 置信区间上界
                {
                    name: '置信区间上界',
                    type: 'line',
                    data: [...new Array(data.historical.values.length).fill(null), ...(data.predictions.confidence_upper || [])],
                    lineStyle: { color: '#e67e22', type: 'dotted', width: 1, opacity: 0.5 },
                    itemStyle: { color: '#e67e22', opacity: 0.5 },
                    showSymbol: false,
                    silent: true
                },
                // 置信区间下界
                {
                    name: '置信区间下界',
                    type: 'line',
                    data: [...new Array(data.historical.values.length).fill(null), ...(data.predictions.confidence_lower || [])],
                    lineStyle: { color: '#e67e22', type: 'dotted', width: 1, opacity: 0.5 },
                    itemStyle: { color: '#e67e22', opacity: 0.5 },
                    showSymbol: false,
                    silent: true,
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(230, 126, 34, 0.1)' },
                                { offset: 1, color: 'rgba(230, 126, 34, 0.05)' }
                            ]
                        }
                    }
                }
            ]
        };
    }

    createAnomalyConfig(data) {
        // 异常检测数据不显示图表，而是显示列表
        return null;
    }

    displayAnomalyData(data, chartInstance, context, columnId) {
        // 获取异常检测容器
        let containerId;
        if (context === 'current') {
            containerId = 'currentAnomalyList';
        } else if (context === 'column' && columnId) {
            containerId = `anomalyList_${columnId}`;
        } else {
            containerId = 'anomalyList';
        }

        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`异常检测容器未找到: ${containerId}`);
            return;
        }

        if (data.error) {
            container.innerHTML = `<div class="error">${data.error}</div>`;
            return;
        }

        let html = '';
        if (data.anomalies && data.anomalies.length > 0) {
            // 添加异常统计信息
            html += `
                <div style="background: #f8f9fa; padding: 10px; margin-bottom: 10px; border-radius: 4px; border-left: 4px solid #667eea;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: bold; color: #333;">异常统计</span>
                        <span style="color: #666;">总计: ${data.total_count} 个异常</span>
                    </div>
                    <div style="margin-top: 5px; color: #e74c3c; font-weight: bold;">
                        高严重性: ${data.high_severity_count} 个
                    </div>
                </div>
            `;

            data.anomalies.forEach(anomaly => {
                html += `
                    <div class="anomaly-item ${anomaly.severity}">
                        <div class="anomaly-header">
                            <span class="anomaly-type">${anomaly.type}</span>
                            <span class="anomaly-severity ${anomaly.severity}">${anomaly.severity === 'high' ? '高' : '中'}</span>
                        </div>
                        <div class="anomaly-time">${anomaly.time}</div>
                        <div class="anomaly-description">${anomaly.description}</div>
                    </div>
                `;
            });
        } else {
            html = '<div style="text-align: center; color: #27ae60; padding: 20px;">未检测到异常</div>';
        }

        container.innerHTML = html;
    }

    createCorrelationHeatmap(data) {
        const variables = data.variables || [];
        const matrix = data.matrix || [];

        if (variables.length === 0 || matrix.length === 0) {
            return { graphic: { type: 'text', left: 'center', top: 'middle', style: { text: '无可用数据', fontSize: 16, fill: '#7f8c8d' } } };
        }

        const heatmapData = [];
        for (let i = 0; i < variables.length; i++) {
            for (let j = 0; j < variables.length; j++) {
                heatmapData.push([j, i, matrix[i][j]]);
            }
        }

        return {
            title: {
                text: '相关性系数矩阵',
                left: 'center',
                top: '1%',
                textStyle: { fontSize: 16 }
            },
            tooltip: {
                position: 'top',
                formatter: function (params) {
                    const x = variables[params.data[0]];
                    const y = variables[params.data[1]];
                    const value = params.data[2];
                    return `${x} vs ${y}<br/>相关性: ${value.toFixed(3)}`;
                }
            },
            grid: {
                height: '70%',
                top: '15%',
                left: '10%',
                right: '5%'
            },
            xAxis: {
                type: 'category',
                data: variables,
                splitArea: { show: true },
                axisLabel: { rotate: 45, fontSize: 14, interval: 0, margin: 8 }
            },
            yAxis: {
                type: 'category',
                data: variables,
                splitArea: { show: true },
                axisLabel: { fontSize: 14, interval: 0, margin: 8 }
            },
            visualMap: {
                min: -1,
                max: 1,
                calculable: true,
                orient: 'horizontal',
                left: 'center',
                top: '5%',
                width: '90%',
                height: 20,
                inRange: {
                    color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffcc', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']
                },
                text: ['高', '低'],
                textStyle: { color: '#333', fontSize: 14 }
            },
            series: [{
                name: '相关性',
                type: 'heatmap',
                data: heatmapData,
                label: {
                    show: true,
                    formatter: function (params) {
                        return params.data[2].toFixed(2);
                    },
                    fontSize: 10
                },
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }]
        };
    }

    drawCorrelationMatrix(data, chartInstance) {
        if (!chartInstance) return;

        chartInstance.clear();
        const option = this.createCorrelationHeatmap(data);
        chartInstance.setOption(option, true);
    }

    drawDensityChart(data, chartInstance, context, columnId) {
        if (!chartInstance) return;

        chartInstance.clear();

        // 获取当前选择的图表类型和数据类型
        let chartTypeSelector = '';
        let dataTypeSelector = '';

        if (context === 'single') {
            chartTypeSelector = 'densityChartType';
            dataTypeSelector = 'densityDataType';
        } else if (context === 'current') {
            chartTypeSelector = 'currentDensityChartType';
            dataTypeSelector = 'currentDensityDataType';
        } else if (context === 'column' && columnId) {
            chartTypeSelector = `densityChartType_${columnId}`;
            dataTypeSelector = `densityDataType_${columnId}`;
        }

        const chartType = document.getElementById(chartTypeSelector)?.value || 'line';
        const dataType = document.getElementById(dataTypeSelector)?.value || 'current';

        const option = this.createDensityChartOption(data, chartType, dataType);
        chartInstance.setOption(option);
    }

    createDensityChartOption(data, chartType, dataType) {
        if (!data.phases || Object.keys(data.phases).length === 0) {
            return {
                title: {
                    text: '运行数据密度分析',
                    left: 'center',
                    textStyle: { fontSize: 14 }
                },
                graphic: {
                    type: 'text',
                    left: 'center',
                    top: 'middle',
                    style: {
                        text: '无可用数据',
                        fontSize: 16,
                        fill: '#7f8c8d'
                    }
                }
            };
        }

        const phases = ['A', 'B', 'C'];
        const colors = ['#5470c6', '#91cc75', '#fac858'];
        const series = [];
        const legendData = [];

        phases.forEach((phase, index) => {
            if (data.phases[phase] && data.phases[phase][dataType]) {
                const phaseData = data.phases[phase][dataType];
                const color = colors[index];

                if (chartType === 'line') {
                    // 折线图：显示原始数据的时间序列
                    series.push({
                        name: `${phase}相${dataType === 'current' ? '电流' : '功率'}`,
                        type: 'line',
                        data: phaseData.values,
                        smooth: true,
                        lineStyle: { color: color },
                        itemStyle: { color: color },
                        symbol: 'none'
                    });
                    legendData.push(`${phase}相${dataType === 'current' ? '电流' : '功率'}`);
                } else if (chartType === 'density') {
                    // 密度图：显示密度分布
                    if (phaseData.density && phaseData.density.x && phaseData.density.y) {
                        series.push({
                            name: `${phase}相${dataType === 'current' ? '电流' : '功率'}密度`,
                            type: 'line',
                            data: phaseData.density.y,
                            smooth: true,
                            lineStyle: { color: color, width: 2 },
                            itemStyle: { color: color },
                            symbol: 'none',
                            areaStyle: {
                                color: {
                                    type: 'linear',
                                    x: 0, y: 0, x2: 0, y2: 1,
                                    colorStops: [
                                        { offset: 0, color: color + '40' },
                                        { offset: 1, color: color + '10' }
                                    ]
                                }
                            }
                        });
                        legendData.push(`${phase}相${dataType === 'current' ? '电流' : '功率'}密度`);
                    }
                } else if (chartType === 'histogram') {
                    // 直方图：显示数据分布
                    if (phaseData.density && phaseData.density.bin_edges) {
                        const binEdges = phaseData.density.bin_edges;
                        const histogramData = [];

                        for (let i = 0; i < binEdges.length - 1; i++) {
                            histogramData.push([
                                binEdges[i],
                                binEdges[i + 1],
                                phaseData.density.y[i] || 0
                            ]);
                        }

                        series.push({
                            name: `${phase}相${dataType === 'current' ? '电流' : '功率'}分布`,
                            type: 'bar',
                            data: histogramData,
                            itemStyle: { color: color },
                            barWidth: '80%'
                        });
                        legendData.push(`${phase}相${dataType === 'current' ? '电流' : '功率'}分布`);
                    }
                }
            }
        });

        const option = {
            title: {
                text: `运行数据${dataType === 'current' ? '电流' : '功率'}${chartType === 'line' ? '时序' : chartType === 'density' ? '密度' : '分布'}分析`,
                left: 'center',
                textStyle: { fontSize: 14 }
            },
            tooltip: {
                trigger: 'item',
                formatter: function (params) {
                    if (chartType === 'line') {
                        return `${params.seriesName}<br/>数值: ${params.data}${dataType === 'current' ? 'A' : 'MW'}`;
                    } else if (chartType === 'density') {
                        const xIndex = params.dataIndex;
                        const xValue = data.phases[params.seriesName.charAt(0)][dataType].density.x[xIndex];
                        return `${params.seriesName}<br/>数值: ${xValue.toFixed(2)}${dataType === 'current' ? 'A' : 'MW'}<br/>密度: ${params.data.toFixed(4)}`;
                    } else if (chartType === 'histogram') {
                        return `${params.seriesName}<br/>区间: [${params.data[0].toFixed(2)}, ${params.data[1].toFixed(2)})${dataType === 'current' ? 'A' : 'MW'}<br/>频次: ${params.data[2].toFixed(4)}`;
                    }
                    return '';
                }
            },
            legend: {
                data: legendData,
                top: 30,
                type: 'scroll'
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                top: '15%',
                containLabel: true
            },
            xAxis: {
                type: 'value',
                name: dataType === 'current' ? '电流 (A)' : '功率 (MW)',
                nameLocation: 'middle',
                nameGap: 30
            },
            yAxis: {
                type: 'value',
                name: chartType === 'line' ? (dataType === 'current' ? '电流 (A)' : '功率 (MW)') : '密度',
                nameLocation: 'middle',
                nameGap: 50
            },
            series: series
        };

        return option;
    }
}

// 图表类型切换器
class ChartTypeSwitcher {
    constructor(chartManager) {
        this.chartManager = chartManager;
    }

    switchChartType(chartName, chartType, context = 'single', columnId = null, dataMode = 'relative') {
        const chartKey = this.getChartKey(chartName, context, columnId);
        const chart = this.chartManager.getChart(chartKey);

        if (!chart) return;

        const currentOption = chart.getOption();
        if (!currentOption || !currentOption.series) return;

        // 特殊处理运行数据的图表类型
        if (chartName === 'operation') {
            return this.switchOperationChartType(chart, currentOption, chartType, chartName, columnId, context, dataMode);
        }

        // 特殊处理状态数据的图表类型
        if (chartName === 'status') {
            return this.switchStatusChartType(chart, currentOption, chartType, chartName, columnId, context);
        }

        // 特殊处理油色谱数据的图表类型
        if (chartName === 'chromatography') {
            return this.switchChromatographyChartType(chart, currentOption, chartType, chartName, columnId, context, dataMode);
        }

        // 通用处理
        return this.applyGenericChartType(chart, currentOption, chartType);
    }

    getChartKey(chartName, context, columnId) {
        if (context === 'current') {
            return `current${chartName.charAt(0).toUpperCase() + chartName.slice(1)}Chart`;
        } else if (context === 'column' && columnId) {
            return `${chartName}Chart_${columnId}`;
        } else {
            return `${chartName}Chart`;
        }
    }

    switchOperationChartType(chart, currentOption, chartType, chartName, columnId, context = 'single', dataMode = 'relative') {
        const dataKey = this.getDataKey(chartName, columnId, context);
        let originalData = this.chartManager.getOriginalData(dataKey);

        if (chartType === 'line') {
            chart.setOption(originalData, true);
        } else if (chartType === 'bar') {
            this.switchToOperationBar(chart, originalData);
        } else if (chartType === 'area') {
            this.switchToOperationArea(chart, originalData, dataMode);
        } else if (chartType === 'pie') {
            this.switchToOperationPie(chart, originalData);
        }
    }

    switchStatusChartType(chart, currentOption, chartType, chartName, columnId, context = 'single') {
        const dataKey = this.getDataKey(chartName, columnId, context);
        let originalData = this.chartManager.getOriginalData(dataKey);

        if (chartType === 'line') {
            // 恢复到原始折线图
            chart.setOption(originalData, true);
        } else if (chartType === 'histogram') {
            // 切换到直方图
            this.switchToHistogram(chart, originalData, chartName);
        }
    }

    switchChromatographyChartType(chart, currentOption, chartType, chartName, columnId, context = 'single', dataMode = 'relative') {
        const dataKey = this.getDataKey(chartName, columnId, context);
        let originalData = this.chartManager.getOriginalData(dataKey);

        if (chartType === 'line') {
            // 恢复到原始折线图
            chart.setOption(originalData, true);
        } else if (chartType === 'bar') {
            // 切换到柱状图
            this.switchToChromatographyBar(chart, originalData);
        } else if (chartType === 'area') {
            // 切换到河流图
            this.switchToChromatographyArea(chart, originalData, dataMode);
        } else if (chartType === 'pie') {
            // 切换到饼图（A、B、C三相）
            this.switchToChromatographyPie(chart, originalData);
        }
    }

    switchDensityChartType(chart, currentOption, chartType, chartName, columnId, context = 'single') {
        // 密度图需要重新加载数据，因为需要根据图表类型和数据类型重新计算
        const dataLoader = new DataLoader(this.chartManager);

        // 获取当前参数
        const params = this.getCurrentParams(context, columnId);

        // 重新加载密度图数据
        dataLoader.loadData('density', {
            ...params,
            chartInstance: chart,
            context: context,
            columnId: columnId
        });
    }

    getDataKey(chartName, columnId, context = 'single') {
        if (context === 'current') {
            return `current_${chartName}`;
        } else if (context === 'column' && columnId) {
            return `column_${columnId}_${chartName}`;
        } else {
            return chartName;
        }
    }

    getCurrentParams(context, columnId) {
        // 获取当前的控制参数
        const deviceId = document.getElementById('deviceSelect')?.value || '';
        const granularity = document.getElementById('timeGranularity')?.value || 'hour';

        let startTime = null;
        let endTime = null;

        if (context === 'current') {
            startTime = document.getElementById('currentStartTime')?.value || null;
            endTime = document.getElementById('currentEndTime')?.value || null;
        } else if (context === 'column' && columnId) {
            // 对于对比列，需要从对应的时间选择器获取
            const startTimeId = `startTime_${columnId}`;
            const endTimeId = `endTime_${columnId}`;
            startTime = document.getElementById(startTimeId)?.value || null;
            endTime = document.getElementById(endTimeId)?.value || null;
        } else {
            // 单时间分析模式
            const year = document.getElementById('yearSelect')?.value || '2024';
            startTime = `${year}-01-01T00:00:00`;
            endTime = `${year}-12-31T23:59:59`;
        }

        return {
            deviceId: deviceId,
            granularity: granularity,
            startTime: startTime,
            endTime: endTime
        };
    }

    switchToBarChart(chart, currentOption, chartName) {
        if (!currentOption.series || currentOption.series.length === 0) return;

        const barData = currentOption.series.map(series => {
            const values = series.data || [];
            const avgValue = values.length > 0 ?
                values.reduce((sum, val) => sum + (val || 0), 0) / values.length : 0;
            return {
                name: series.name,
                value: avgValue,
                color: series.itemStyle ? series.itemStyle.color : series.lineStyle ? series.lineStyle.color : '#5470c6'
            };
        }).filter(item => item.value > 0);

        const barOption = {
            title: {
                text: '数据平均值对比',
                left: 'center',
                textStyle: { fontSize: 14 }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: function (params) {
                    return `${params[0].name}<br/>平均值: ${params[0].value}`;
                }
            },
            legend: {
                data: barData.map(item => item.name),
                top: 30
            },
            xAxis: {
                type: 'category',
                data: barData.map(item => item.name),
                axisLabel: {
                    rotate: barData.length > 6 ? 45 : 0,
                    fontSize: 10
                }
            },
            yAxis: {
                type: 'value',
                scale: true
            },
            series: [{
                name: '平均值',
                type: 'bar',
                data: barData.map(item => ({
                    value: item.value,
                    itemStyle: { color: item.color }
                })),
                barWidth: '60%',
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }]
        };

        chart.setOption(barOption, true);
    }

    switchToChromatographyBar(chart, originalData) {
        if (!originalData.series || originalData.series.length === 0) return;

        const barData = originalData.series.map(series => {
            const values = series.data || [];
            const avgValue = values.length > 0 ?
                values.reduce((sum, val) => sum + (val || 0), 0) / values.length : 0;
            return {
                name: series.name,
                value: avgValue,
                color: series.itemStyle ? series.itemStyle.color : series.lineStyle ? series.lineStyle.color : '#5470c6'
            };
        }).filter(item => item.value > 0);

        const barOption = {
            title: {
                text: '油色谱数据平均值对比',
                left: 'center',
                textStyle: { fontSize: 14 }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: function (params) {
                    // 安全检查params数组
                    if (!params || params.length === 0) return '';

                    const time = params[0] && params[0].axisValue ? params[0].axisValue : '';
                    let result = `时间: ${time}<br/>`;
                    params.forEach(param => {
                        if (param && param.seriesName) {
                            result += `${param.seriesName}: ${param.value || 0} ppm<br/>`;
                        }
                    });
                    return result;
                }
            },
            legend: {
                data: barData.map(item => item.name),
                top: '5%'
            },
            xAxis: {
                type: 'category',
                data: barData.map(item => item.name),
                axisLabel: { rotate: 45, fontSize: 10 }
            },
            yAxis: {
                type: 'value',
                name: '浓度 (ppm)',
                scale: true
            },
            series: [{
                name: '平均值',
                type: 'bar',
                data: barData.map(item => ({
                    value: item.value,
                    itemStyle: { color: item.color }
                })),
                barWidth: '60%',
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }]
        };

        chart.setOption(barOption, true);
    }

    switchToOperationBar(chart, originalData) {
        // 数据验证
        if (!originalData || !originalData.series || !Array.isArray(originalData.series)) {
            console.error('柱状图数据无效:', originalData);
            this.showErrorChart(chart, '数据格式错误');
            return;
        }

        const currentSeries = originalData.series.filter(series => series.name && series.name.includes('电流'));
        const powerSeries = originalData.series.filter(series => series.name && series.name.includes('功率'));

        const currentData = currentSeries.map(series => {
            const values = series.data || [];
            const avgValue = values.length > 0 ?
                values.reduce((sum, val) => sum + (val || 0), 0) / values.length : 0;
            return {
                name: series.name,
                value: avgValue,
                color: operationColorScheme[series.name] || '#5470c6'
            };
        }).filter(item => item.value > 0);

        const powerData = powerSeries.map(series => {
            const values = series.data || [];
            const avgValue = values.length > 0 ?
                values.reduce((sum, val) => sum + (val || 0), 0) / values.length : 0;
            return {
                name: series.name,
                value: avgValue,
                color: operationColorScheme[series.name] || '#5470c6'
            };
        }).filter(item => item.value > 0);

        // 检查是否有有效数据
        if (currentData.length === 0 && powerData.length === 0) {
            console.warn('柱状图没有有效数据');
            this.showErrorChart(chart, '没有可显示的数据');
            return;
        }

        const option = {
            title: {
                text: '运行数据平均值对比',
                left: 'center',
                textStyle: { fontSize: 14 }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' }
            },
            legend: {
                data: [...currentData.map(item => item.name), ...powerData.map(item => item.name)],
                top: 30
            },
            grid: [
                {
                    left: '3%',
                    right: '52%',
                    top: '15%',
                    bottom: '3%',
                    containLabel: true
                },
                {
                    left: '52%',
                    right: '3%',
                    top: '15%',
                    bottom: '3%',
                    containLabel: true
                }
            ],
            xAxis: [
                {
                    type: 'category',
                    data: currentData.map(item => item.name),
                    axisLabel: { rotate: 45, fontSize: 10 },
                    gridIndex: 0
                },
                {
                    type: 'category',
                    data: powerData.map(item => item.name),
                    axisLabel: { rotate: 45, fontSize: 10 },
                    gridIndex: 1
                }
            ],
            yAxis: [
                {
                    type: 'value',
                    name: '电流 (A)',
                    gridIndex: 0,
                    scale: true
                },
                {
                    type: 'value',
                    name: '功率 (MW)',
                    gridIndex: 1,
                    scale: true
                }
            ],
            series: [
                {
                    name: '电流平均值',
                    type: 'bar',
                    data: currentData.map(item => ({
                        value: item.value,
                        itemStyle: { color: item.color }
                    })),
                    barWidth: '60%',
                    xAxisIndex: 0,
                    yAxisIndex: 0
                },
                {
                    name: '功率平均值',
                    type: 'bar',
                    data: powerData.map(item => ({
                        value: item.value,
                        itemStyle: { color: item.color }
                    })),
                    barWidth: '60%',
                    xAxisIndex: 1,
                    yAxisIndex: 1
                }
            ]
        };

        chart.setOption(option, true);
    }

    switchToOperationArea(chart, originalData, dataMode = 'relative') {
        const originalSeries = originalData.series || [];
        const currentSeries = originalSeries.filter(series => series.name.includes('电流'));
        const powerSeries = originalSeries.filter(series => series.name.includes('功率'));

        // 修复时间数据获取 - 从xAxis.data获取时间数据
        const rawTimeData = originalData.xAxis && originalData.xAxis.data ? originalData.xAxis.data : [];
        const timeData = rawTimeData;

        // 数据变换函数
        const transformData = (data, mode = 'relative') => {
            if (mode === 'original') return data;

            if (mode === 'relative') {
                // 计算相对变化率（相对于平均值）
                const validData = data.filter(val => val !== null && val !== undefined && !isNaN(val));
                if (validData.length === 0) return data;

                const average = validData.reduce((sum, val) => sum + val, 0) / validData.length;
                if (average === 0) return data; // 避免除零

                return data.map(val => {
                    if (val === null || val === undefined || isNaN(val)) return 0;
                    return ((val - average) / average) * 100;
                });
            }

            return data;
        };

        const prepareStreamData = (series, transformMode = 'relative') => {
            const sortedSeries = series.sort((a, b) => {
                const order = { 'A相': 0, 'B相': 1, 'C相': 2 };
                const aPhase = a.name.includes('A相') ? 'A相' : a.name.includes('B相') ? 'B相' : 'C相';
                const bPhase = b.name.includes('A相') ? 'A相' : b.name.includes('B相') ? 'B相' : 'C相';
                return order[aPhase] - order[bPhase];
            });

            const data = sortedSeries.map((s, index) => {
                const originalData = s.data || [];
                const transformedData = transformData(originalData, transformMode);
                return {
                    original: originalData,
                    transformed: transformedData
                };
            });

            return { data: data, series: sortedSeries };
        };

        const currentStreamResult = prepareStreamData(currentSeries, dataMode);
        const powerStreamResult = prepareStreamData(powerSeries, dataMode);
        const currentStreamData = currentStreamResult.data;
        const powerStreamData = powerStreamResult.data;
        const sortedCurrentSeries = currentStreamResult.series;
        const sortedPowerSeries = powerStreamResult.series;

        // 存储原始数据供toolbox使用
        const originalDataForToolbox = {
            current: currentStreamData.map(item => item.original),
            power: powerStreamData.map(item => item.original),
            series: sortedCurrentSeries.concat(sortedPowerSeries)
        };

        const option = {
            title: {
                text: `运行数据河流图 (${dataMode === 'relative' ? '相对变化率' : '原始数据'})`,
                left: 'center',
                textStyle: { fontSize: 14 }
            },
            toolbox: {
                show: true,
                right: 20,
                top: 0,
                feature: {
                    dataZoom: {
                        yAxisIndex: 'none',
                        title: {
                            zoom: '区域缩放',
                            back: '区域缩放还原'
                        }
                    },
                    dataView: {
                        show: true,
                        title: '数据视图',
                        readOnly: false,
                        lang: ['数据视图', '关闭', '刷新'],
                        optionToContent: function (opt) {
                            let result = '<div style="padding: 10px; font-family: monospace; font-size: 12px;">';
                            result += '<h4>原始数据表</h4>';
                            result += '<table border="1" style="border-collapse: collapse; width: 100%;">';

                            // 表头
                            result += '<tr><th>时间</th>';
                            sortedCurrentSeries.forEach(series => {
                                result += `<th>${series.name}</th>`;
                            });
                            sortedPowerSeries.forEach(series => {
                                result += `<th>${series.name}</th>`;
                            });
                            result += '</tr>';

                            // 数据行
                            timeData.forEach((time, index) => {
                                result += `<tr><td>${time}</td>`;
                                originalDataForToolbox.current.forEach(data => {
                                    result += `<td>${(data[index] || 0).toFixed(2)}</td>`;
                                });
                                originalDataForToolbox.power.forEach(data => {
                                    result += `<td>${(data[index] || 0).toFixed(2)}</td>`;
                                });
                                result += '</tr>';
                            });

                            result += '</table></div>';
                            return result;
                        }
                    },
                    restore: {
                        show: true,
                        title: '还原'
                    },
                    saveAsImage: {
                        show: true,
                        title: '保存为图片'
                    }
                }
            },
            dataZoom: [
                {
                    type: 'slider',
                    show: true,
                    xAxisIndex: [0, 1],
                    start: 0,
                    end: 100,
                    bottom: 20,
                    height: 20,
                    handleStyle: {
                        color: '#1890ff'
                    },
                    textStyle: {
                        color: '#666'
                    }
                },
                {
                    type: 'inside',
                    xAxisIndex: [0, 1],
                    start: 0,
                    end: 100
                },
                {
                    type: 'slider',
                    show: true,
                    yAxisIndex: [0],
                    start: 0,
                    end: 100,
                    left: 0,
                    width: 20,
                    handleStyle: {
                        color: '#1890ff'
                    },
                    textStyle: {
                        color: '#666'
                    }
                },
                {
                    type: 'inside',
                    yAxisIndex: [0],
                    start: 0,
                    end: 100
                },
                {
                    type: 'slider',
                    show: true,
                    yAxisIndex: [1],
                    start: 0,
                    end: 100,
                    right: 0,
                    width: 20,
                    handleStyle: {
                        color: '#1890ff'
                    },
                    textStyle: {
                        color: '#666'
                    }
                },
                {
                    type: 'inside',
                    yAxisIndex: [1],
                    start: 0,
                    end: 100
                }
            ],
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
                formatter: function (params) {
                    // 安全检查params数组
                    if (!params || params.length === 0) return '';

                    const time = params[0] && params[0].axisValue ? params[0].axisValue : '';
                    const timeIndex = timeData.indexOf(time);
                    let result = `时间: ${time}<br/>`;
                    if (dataMode === 'relative') {
                        result += '<div style="border-top: 1px solid #ccc; margin-top: 5px; padding-top: 5px;">';
                        result += '<strong>相对变化率 (%)</strong><br/>';

                        params.forEach(param => {
                            if (param && param.seriesName) {
                                const seriesIndex = sortedCurrentSeries.findIndex(s => s.name === param.seriesName);
                                let originalValue = 0;
                                let unit = '';

                                if (seriesIndex >= 0) {
                                    originalValue = originalDataForToolbox.current[seriesIndex][timeIndex] || 0;
                                    unit = 'A';
                                } else {
                                    const powerIndex = sortedPowerSeries.findIndex(s => s.name === param.seriesName);
                                    if (powerIndex >= 0) {
                                        originalValue = originalDataForToolbox.power[powerIndex][timeIndex] || 0;
                                        unit = 'MW';
                                    }
                                }

                                result += `${param.seriesName}: ${(param.data || 0).toFixed(2)}% (原始值: ${originalValue.toFixed(2)} ${unit})<br/>`;
                            }
                        });
                    } else {
                        params.forEach(param => {
                            if (param && param.seriesName) {
                                let unit = '';
                                if (param.seriesName.includes('电流')) unit = 'A';
                                else if (param.seriesName.includes('功率')) unit = 'MW';
                                result += `${param.seriesName}: ${(param.data || 0).toFixed(2)} ${unit}<br/>`;
                            }
                        });
                    }

                    result += '</div>';
                    return result;
                }
            },
            legend: {
                data: [...sortedCurrentSeries.map(s => s.name), ...sortedPowerSeries.map(s => s.name)],
                top: 30
            },
            grid: [
                {
                    left: '3%',
                    right: '4%',
                    top: '15%',
                    bottom: '55%',
                    containLabel: true
                },
                {
                    left: '3%',
                    right: '4%',
                    top: '55%',
                    bottom: '8%',
                    containLabel: true
                }
            ],
            xAxis: [
                {
                    type: 'category',
                    data: timeData,
                    gridIndex: 0,
                    axisLabel: {
                        rotate: 45,
                        fontSize: 10,
                        show: false
                    },
                    axisLine: { show: false },
                    axisTick: { show: false }
                },
                {
                    type: 'category',
                    data: timeData,
                    gridIndex: 1,
                    axisLabel: {
                        rotate: 45,
                        fontSize: 10
                    },
                    position: 'bottom'
                }
            ],
            yAxis: [
                {
                    type: 'value',
                    name: dataMode === 'relative' ? '电流相对变化率 (%)' : '电流 (A)',
                    gridIndex: 0,
                    position: 'left',
                    axisLabel: {
                        formatter: dataMode === 'relative' ? '{value}%' : '{value}'
                    }
                },
                {
                    type: 'value',
                    name: dataMode === 'relative' ? '功率相对变化率 (%)' : '功率 (MW)',
                    gridIndex: 1,
                    position: 'left',
                    axisLabel: {
                        formatter: dataMode === 'relative' ? '{value}%' : '{value}'
                    }
                }
            ],
            series: [
                // 电流系列 - 使用堆叠面积图实现河流效果
                ...sortedCurrentSeries.map((series, index) => ({
                    name: series.name,
                    type: 'line',
                    stack: '电流堆叠',
                    data: currentStreamData[index] ? (dataMode === 'relative' ? currentStreamData[index].transformed : currentStreamData[index].original) : [],
                    smooth: true,
                    areaStyle: {
                        opacity: 0.6,
                        color: operationColorScheme[series.name] || '#5470c6'
                    },
                    lineStyle: {
                        width: 1,
                        color: operationColorScheme[series.name] || '#5470c6'
                    },
                    itemStyle: {
                        color: operationColorScheme[series.name] || '#5470c6'
                    },
                    xAxisIndex: 0,
                    yAxisIndex: 0,
                    z: index
                })),
                // 功率系列 - 使用堆叠面积图实现河流效果
                ...sortedPowerSeries.map((series, index) => ({
                    name: series.name,
                    type: 'line',
                    stack: '功率堆叠',
                    data: powerStreamData[index] ? (dataMode === 'relative' ? powerStreamData[index].transformed : powerStreamData[index].original) : [],
                    smooth: true,
                    areaStyle: {
                        opacity: 0.6,
                        color: operationColorScheme[series.name] || '#5470c6'
                    },
                    lineStyle: {
                        width: 1,
                        color: operationColorScheme[series.name] || '#5470c6'
                    },
                    itemStyle: {
                        color: operationColorScheme[series.name] || '#5470c6'
                    },
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    z: index
                }))
            ]
        };

        chart.setOption(option, true);
    }

    switchToOperationPie(chart, originalData) {
        const currentSeries = originalData.series.filter(series => series.name.includes('电流'));
        const powerSeries = originalData.series.filter(series => series.name.includes('功率'));

        const currentData = currentSeries.map(series => {
            const values = series.data || [];
            const totalValue = values.reduce((sum, val) => sum + (val || 0), 0);
            return {
                name: series.name,
                value: totalValue,
                color: operationColorScheme[series.name] || '#5470c6'
            };
        }).filter(item => item.value > 0);

        const powerData = powerSeries.map(series => {
            const values = series.data || [];
            const totalValue = values.reduce((sum, val) => sum + (val || 0), 0);
            return {
                name: series.name,
                value: totalValue,
                color: operationColorScheme[series.name] || '#5470c6'
            };
        }).filter(item => item.value > 0);

        const option = {
            title: {
                text: '运行数据分布（总和）',
                left: 'center',
                textStyle: { fontSize: 14 }
            },
            tooltip: {
                trigger: 'item',
                formatter: '{a} <br/>{b}: {c} ({d}%)'
            },
            legend: {
                data: [...currentData.map(item => item.name), ...powerData.map(item => item.name)],
                top: 30
            },
            series: [
                {
                    name: '电流分布（总和）',
                    type: 'pie',
                    radius: '30%',
                    center: ['25%', '60%'],
                    data: currentData.map(item => ({
                        name: item.name,
                        value: item.value,
                        itemStyle: { color: item.color }
                    })),
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowOffsetX: 0,
                            shadowColor: 'rgba(0, 0, 0, 0.5)'
                        }
                    }
                },
                {
                    name: '功率分布（总和）',
                    type: 'pie',
                    radius: '30%',
                    center: ['75%', '60%'],
                    data: powerData.map(item => ({
                        name: item.name,
                        value: item.value,
                        itemStyle: { color: item.color }
                    })),
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowOffsetX: 0,
                            shadowColor: 'rgba(0, 0, 0, 0.5)'
                        }
                    }
                }
            ]
        };

        chart.setOption(option, true);
    }

    switchToChromatographyArea(chart, originalData, dataMode = 'relative') {
        if (!originalData.series || originalData.series.length === 0) return;

        // 按A、B、C相分组
        const phaseASeries = originalData.series.filter(series => series.name.includes('A相'));
        const phaseBSeries = originalData.series.filter(series => series.name.includes('B相'));
        const phaseCSeries = originalData.series.filter(series => series.name.includes('C相'));

        // 获取时间数据
        const timeData = originalData.xAxis ? originalData.xAxis.data : [];

        // 数据变换函数
        const transformData = (data, mode = 'relative') => {
            if (mode === 'original') return data;

            if (mode === 'relative') {
                // 计算相对变化率（相对于平均值）
                const validData = data.filter(val => val !== null && val !== undefined && !isNaN(val));
                if (validData.length === 0) return data;

                const average = validData.reduce((sum, val) => sum + val, 0) / validData.length;
                if (average === 0) return data; // 避免除零

                return data.map(val => {
                    if (val === null || val === undefined || isNaN(val)) return 0;
                    return ((val - average) / average) * 100;
                });
            }

            return data;
        };

        // 为每个相创建河流图数据
        const createStreamData = (seriesList, transformMode = 'relative') => {
            return seriesList.map(series => {
                const values = series.data || [];
                const originalValues = values.map(val => val || 0);
                const transformedValues = transformData(originalValues, transformMode);
                return {
                    original: originalValues,
                    transformed: transformedValues
                };
            });
        };

        const phaseAStreamData = createStreamData(phaseASeries, dataMode);
        const phaseBStreamData = createStreamData(phaseBSeries, dataMode);
        const phaseCStreamData = createStreamData(phaseCSeries, dataMode);

        // 存储原始数据供toolbox使用
        const originalDataForToolbox = {
            phaseA: phaseAStreamData.map(item => item.original),
            phaseB: phaseBStreamData.map(item => item.original),
            phaseC: phaseCStreamData.map(item => item.original),
            series: phaseASeries.concat(phaseBSeries, phaseCSeries)
        };

        const option = {
            title: {
                text: `油色谱数据河流图 (${dataMode === 'relative' ? '相对变化率' : '原始数据'})`,
                left: 'center',
                textStyle: { fontSize: 14 }
            },
            toolbox: {
                show: true,
                right: 20,
                top: 0,
                feature: {
                    dataZoom: {
                        yAxisIndex: 'none',
                        title: {
                            zoom: '区域缩放',
                            back: '区域缩放还原'
                        }
                    },
                    dataView: {
                        show: true,
                        title: '数据视图',
                        readOnly: false,
                        lang: ['数据视图', '关闭', '刷新'],
                        optionToContent: function (opt) {
                            let result = '<div style="padding: 10px; font-family: monospace; font-size: 12px;">';
                            result += '<h4>原始数据表 (ppm)</h4>';
                            result += '<table border="1" style="border-collapse: collapse; width: 100%;">';

                            // 表头
                            result += '<tr><th>时间</th>';
                            phaseASeries.forEach(series => {
                                result += `<th>${series.name}</th>`;
                            });
                            phaseBSeries.forEach(series => {
                                result += `<th>${series.name}</th>`;
                            });
                            phaseCSeries.forEach(series => {
                                result += `<th>${series.name}</th>`;
                            });
                            result += '</tr>';

                            // 数据行
                            timeData.forEach((time, index) => {
                                result += `<tr><td>${time}</td>`;
                                originalDataForToolbox.phaseA.forEach(data => {
                                    result += `<td>${(data[index] || 0).toFixed(2)}</td>`;
                                });
                                originalDataForToolbox.phaseB.forEach(data => {
                                    result += `<td>${(data[index] || 0).toFixed(2)}</td>`;
                                });
                                originalDataForToolbox.phaseC.forEach(data => {
                                    result += `<td>${(data[index] || 0).toFixed(2)}</td>`;
                                });
                                result += '</tr>';
                            });

                            result += '</table></div>';
                            return result;
                        }
                    },
                    restore: {
                        show: true,
                        title: '还原'
                    },
                    saveAsImage: {
                        show: true,
                        title: '保存为图片'
                    }
                }
            },
            dataZoom: [
                {
                    type: 'slider',
                    show: true,
                    xAxisIndex: [0, 1, 2],
                    start: 0,
                    end: 100,
                    bottom: 20,
                    height: 20,
                    handleStyle: {
                        color: '#1890ff'
                    },
                    textStyle: {
                        color: '#666'
                    }
                },
                {
                    type: 'inside',
                    xAxisIndex: [0, 1, 2],
                    start: 0,
                    end: 100
                },
                {
                    type: 'slider',
                    show: true,
                    yAxisIndex: [0],
                    start: 0,
                    end: 100,
                    left: 0,
                    width: 20,
                    handleStyle: {
                        color: '#1890ff'
                    },
                    textStyle: {
                        color: '#666'
                    }
                },
                {
                    type: 'inside',
                    yAxisIndex: [0],
                    start: 0,
                    end: 100
                },
                {
                    type: 'slider',
                    show: true,
                    yAxisIndex: [1],
                    start: 0,
                    end: 100,
                    left: 0,
                    width: 20,
                    handleStyle: {
                        color: '#1890ff'
                    },
                    textStyle: {
                        color: '#666'
                    }
                },
                {
                    type: 'inside',
                    yAxisIndex: [1],
                    start: 0,
                    end: 100
                },
                {
                    type: 'slider',
                    show: true,
                    yAxisIndex: [2],
                    start: 0,
                    end: 100,
                    left: 0,
                    width: 20,
                    handleStyle: {
                        color: '#1890ff'
                    },
                    textStyle: {
                        color: '#666'
                    }
                },
                {
                    type: 'inside',
                    yAxisIndex: [2],
                    start: 0,
                    end: 100
                }
            ],
            tooltip: {
                trigger: 'axis',
                formatter: function (params) {
                    // 安全检查params数组
                    if (!params || params.length === 0) return '';

                    const time = params[0] && params[0].axisValue ? params[0].axisValue : '';
                    const timeIndex = timeData.indexOf(time);
                    let result = `时间: ${time}<br/>`;
                    if (dataMode === 'relative') {
                        result += '<div style="border-top: 1px solid #ccc; margin-top: 5px; padding-top: 5px;">';
                        result += '<strong>相对变化率 (%)</strong><br/>';

                        params.forEach(param => {
                            if (param && param.seriesName) {
                                let originalValue = 0;
                                let seriesIndex = -1;

                                // 查找对应的原始数据
                                if (param.seriesName.includes('A相')) {
                                    seriesIndex = phaseASeries.findIndex(s => s.name === param.seriesName);
                                    if (seriesIndex >= 0) {
                                        originalValue = originalDataForToolbox.phaseA[seriesIndex][timeIndex] || 0;
                                    }
                                } else if (param.seriesName.includes('B相')) {
                                    seriesIndex = phaseBSeries.findIndex(s => s.name === param.seriesName);
                                    if (seriesIndex >= 0) {
                                        originalValue = originalDataForToolbox.phaseB[seriesIndex][timeIndex] || 0;
                                    }
                                } else if (param.seriesName.includes('C相')) {
                                    seriesIndex = phaseCSeries.findIndex(s => s.name === param.seriesName);
                                    if (seriesIndex >= 0) {
                                        originalValue = originalDataForToolbox.phaseC[seriesIndex][timeIndex] || 0;
                                    }
                                }

                                result += `${param.seriesName}: ${(param.value || 0).toFixed(2)}% (原始值: ${originalValue.toFixed(2)} ppm)<br/>`;
                            }
                        });
                    } else {
                        params.forEach(param => {
                            if (param && param.seriesName) {
                                result += `${param.seriesName}: ${(param.value || 0).toFixed(2)} ppm<br/>`;
                            }
                        });
                    }

                    result += '</div>';
                    return result;
                }
            },
            legend: {
                data: [...phaseASeries.map(s => s.name), ...phaseBSeries.map(s => s.name), ...phaseCSeries.map(s => s.name)],
                top: 30,
                type: 'scroll',
                orient: 'horizontal',
                selected: [...phaseASeries, ...phaseBSeries, ...phaseCSeries].reduce((acc, series) => {
                    acc[series.name] = true;
                    return acc;
                }, {})
            },
            grid: [
                { left: '5%', right: '5%', top: '15%', height: '25%' },
                { left: '5%', right: '5%', top: '45%', height: '25%' },
                { left: '5%', right: '5%', top: '75%', height: '25%' }
            ],
            xAxis: [
                {
                    type: 'category',
                    data: timeData,
                    gridIndex: 0,
                    axisLabel: { rotate: 45, fontSize: 10, show: false },
                    axisLine: { show: false },
                    axisTick: { show: false }
                },
                {
                    type: 'category',
                    data: timeData,
                    gridIndex: 1,
                    axisLabel: { rotate: 45, fontSize: 10, show: false },
                    axisLine: { show: false },
                    axisTick: { show: false }
                },
                {
                    type: 'category',
                    data: timeData,
                    gridIndex: 2,
                    axisLabel: { rotate: 45, fontSize: 10 }
                }
            ],
            yAxis: [
                {
                    type: 'value',
                    name: dataMode === 'relative' ? 'A相相对变化率 (%)' : 'A相浓度 (ppm)',
                    gridIndex: 0,
                    position: 'left',
                    axisLabel: {
                        formatter: dataMode === 'relative' ? '{value}%' : '{value}'
                    }
                },
                {
                    type: 'value',
                    name: dataMode === 'relative' ? 'B相相对变化率 (%)' : 'B相浓度 (ppm)',
                    gridIndex: 1,
                    position: 'left',
                    axisLabel: {
                        formatter: dataMode === 'relative' ? '{value}%' : '{value}'
                    }
                },
                {
                    type: 'value',
                    name: dataMode === 'relative' ? 'C相相对变化率 (%)' : 'C相浓度 (ppm)',
                    gridIndex: 2,
                    position: 'left',
                    axisLabel: {
                        formatter: dataMode === 'relative' ? '{value}%' : '{value}'
                    }
                }
            ],
            series: [
                // A相系列
                ...phaseASeries.map((series, index) => ({
                    name: series.name,
                    type: 'line',
                    stack: 'A相堆叠',
                    data: phaseAStreamData[index] ? (dataMode === 'relative' ? phaseAStreamData[index].transformed : phaseAStreamData[index].original) : [],
                    smooth: true,
                    areaStyle: {
                        opacity: 0.6,
                        color: series.itemStyle?.color || series.lineStyle?.color || '#e74c3c'
                    },
                    lineStyle: {
                        width: 1,
                        color: series.itemStyle?.color || series.lineStyle?.color || '#e74c3c'
                    },
                    xAxisIndex: 0,
                    yAxisIndex: 0,
                    z: index
                })),
                // B相系列
                ...phaseBSeries.map((series, index) => ({
                    name: series.name,
                    type: 'line',
                    stack: 'B相堆叠',
                    data: phaseBStreamData[index] ? (dataMode === 'relative' ? phaseBStreamData[index].transformed : phaseBStreamData[index].original) : [],
                    smooth: true,
                    areaStyle: {
                        opacity: 0.6,
                        color: series.itemStyle?.color || series.lineStyle?.color || '#f39c12'
                    },
                    lineStyle: {
                        width: 1,
                        color: series.itemStyle?.color || series.lineStyle?.color || '#f39c12'
                    },
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    z: index
                })),
                // C相系列
                ...phaseCSeries.map((series, index) => ({
                    name: series.name,
                    type: 'line',
                    stack: 'C相堆叠',
                    data: phaseCStreamData[index] ? (dataMode === 'relative' ? phaseCStreamData[index].transformed : phaseCStreamData[index].original) : [],
                    smooth: true,
                    areaStyle: {
                        opacity: 0.6,
                        color: series.itemStyle?.color || series.lineStyle?.color || '#27ae60'
                    },
                    lineStyle: {
                        width: 1,
                        color: series.itemStyle?.color || series.lineStyle?.color || '#27ae60'
                    },
                    xAxisIndex: 2,
                    yAxisIndex: 2,
                    z: index
                }))
            ]
        };

        chart.setOption(option, true);
    }

    switchToChromatographyPie(chart, originalData) {
        if (!originalData.series || originalData.series.length === 0) return;

        // 按A、B、C相分组
        const phaseASeries = originalData.series.filter(series => series.name.includes('A相'));
        const phaseBSeries = originalData.series.filter(series => series.name.includes('B相'));
        const phaseCSeries = originalData.series.filter(series => series.name.includes('C相'));

        // 计算每个相的总和
        const createPhaseData = (seriesList, phaseName) => {
            return seriesList.map(series => {
                const values = series.data || [];
                const totalValue = values.reduce((sum, val) => sum + (val || 0), 0);
                return {
                    name: series.name,
                    value: totalValue,
                    color: series.itemStyle?.color || series.lineStyle?.color || this.getChromatographyColor(series.name)
                };
            }).filter(item => item.value > 0);
        };

        const phaseAData = createPhaseData(phaseASeries, 'A相');
        const phaseBData = createPhaseData(phaseBSeries, 'B相');
        const phaseCData = createPhaseData(phaseCSeries, 'C相');

        const option = {
            title: {
                text: '油色谱数据分布（总和）',
                left: 'center',
                textStyle: { fontSize: 14 }
            },
            tooltip: {
                trigger: 'item',
                formatter: '{a} <br/>{b}: {c} ppm ({d}%)'
            },
            legend: {
                data: [...phaseAData.map(item => item.name), ...phaseBData.map(item => item.name), ...phaseCData.map(item => item.name)],
                top: 30
            },
            series: [
                {
                    name: 'A相分布（总和）',
                    type: 'pie',
                    radius: '25%',
                    center: ['20%', '50%'],
                    data: phaseAData.map(item => ({
                        name: item.name,
                        value: item.value,
                        itemStyle: { color: item.color }
                    })),
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowOffsetX: 0,
                            shadowColor: 'rgba(0, 0, 0, 0.5)'
                        }
                    }
                },
                {
                    name: 'B相分布（总和）',
                    type: 'pie',
                    radius: '25%',
                    center: ['50%', '50%'],
                    data: phaseBData.map(item => ({
                        name: item.name,
                        value: item.value,
                        itemStyle: { color: item.color }
                    })),
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowOffsetX: 0,
                            shadowColor: 'rgba(0, 0, 0, 0.5)'
                        }
                    }
                },
                {
                    name: 'C相分布（总和）',
                    type: 'pie',
                    radius: '25%',
                    center: ['80%', '50%'],
                    data: phaseCData.map(item => ({
                        name: item.name,
                        value: item.value,
                        itemStyle: { color: item.color }
                    })),
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowOffsetX: 0,
                            shadowColor: 'rgba(0, 0, 0, 0.5)'
                        }
                    }
                }
            ]
        };

        chart.setOption(option, true);
    }

    getChromatographyColor(seriesName) {
        const chromatographyColors = {
            'A相': '#e74c3c',
            'B相': '#f39c12',
            'C相': '#27ae60',
            'H2': '#e74c3c',
            'CH4': '#f39c12',
            'C2H6': '#27ae60',
            'C2H4': '#3498db',
            'C2H2': '#9b59b6',
            'CO': '#1abc9c',
            'CO2': '#34495e'
        };

        // 根据系列名称返回对应颜色
        for (const [key, color] of Object.entries(chromatographyColors)) {
            if (seriesName.includes(key)) {
                return color;
            }
        }

        // 默认颜色数组
        const defaultColors = ['#e74c3c', '#f39c12', '#27ae60', '#3498db', '#9b59b6', '#1abc9c', '#34495e'];
        return defaultColors[seriesName.length % defaultColors.length];
    }

    switchToHistogram(chart, originalData, chartName) {
        if (!originalData.series || originalData.series.length === 0) return;

        // 为状态数据创建基于时间轴的柱状图
        if (chartName === 'status') {
            // 保持原有的时间轴和数据结构，只改变图表类型
            const option = {
                ...originalData,
                title: {
                    ...originalData.title,
                    text: '状态数据直方图'
                },
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'shadow'
                    },
                    formatter: function (params) {
                        // 安全检查params数组
                        if (!params || params.length === 0) return '';

                        const time = params[0] && params[0].axisValue ? params[0].axisValue : '';
                        let result = `时间: ${time}<br/>`;
                        params.forEach(param => {
                            if (param && param.seriesName) {
                                let unit = '';
                                if (param.seriesName.includes('温度')) unit = '℃';
                                else if (param.seriesName.includes('油位')) unit = 'm';
                                result += `${param.seriesName}: ${param.value || 0}${unit}<br/>`;
                            }
                        });
                        return result;
                    }
                },
                legend: {
                    data: originalData.series.map(s => s.name),
                    top: '5%'
                },
                xAxis: {
                    ...originalData.xAxis,
                    // 保持原始x轴配置，不强制改为category
                    axisLabel: {
                        ...originalData.xAxis.axisLabel,
                        rotate: 45,
                        fontSize: 10
                    }
                },
                yAxis: originalData.yAxis || [{
                    type: 'value',
                    name: '温度(℃)',
                    position: 'left',
                    scale: true
                }, {
                    type: 'value',
                    name: '油位',
                    position: 'right',
                    scale: true
                }],
                series: originalData.series.map(series => ({
                    ...series,
                    type: 'bar',
                    barWidth: '40%',
                    itemStyle: {
                        ...series.itemStyle,
                        color: series.itemStyle?.color || series.lineStyle?.color || this.getStatusColor(series.name)
                    }
                }))
            };

            chart.setOption(option, true);
        } else {
            // 对于其他数据类型，使用通用柱状图处理
            this.switchToBarChart(chart, originalData, chartName);
        }
    }

    getStatusColor(seriesName) {
        const statusColors = {
            '油温点位1': '#e74c3c',
            '油温点位2': '#f39c12',
            '油位': '#27ae60',
            '绕组温度': '#8e44ad'
        };

        // 如果是索引数字，使用默认颜色数组
        if (typeof seriesName === 'number') {
            const colors = ['#e74c3c', '#f39c12', '#27ae60', '#8e44ad', '#3498db'];
            return colors[seriesName % colors.length];
        }

        // 根据系列名称返回对应颜色
        return statusColors[seriesName] || '#3498db';
    }

    applyGenericChartType(chart, currentOption, chartType) {
        const newOption = { ...currentOption };
        newOption.series = newOption.series.map(series => ({
            ...series,
            type: chartType === 'bar' ? 'bar' : chartType,
            areaStyle: chartType === 'area' ? {} : undefined,
            barWidth: chartType === 'bar' ? '60%' : undefined
        }));

        chart.setOption(newOption, true);
    }

    // 显示错误图表
    showErrorChart(chart, errorMessage) {
        if (!chart) return;

        chart.clear();
        chart.setOption({
            title: {
                text: errorMessage || '数据加载失败',
                left: 'center',
                top: 'middle',
                textStyle: { color: '#e74c3c', fontSize: 16, fontWeight: 'normal' }
            }
        }, true);
    }
}

// 全局实例
const chartManager = new ChartManager();
const dataLoader = new DataLoader(chartManager);
const chartTypeSwitcher = new ChartTypeSwitcher(chartManager);

// 兼容性变量
let operationChart, statusChart, chromatographyChart, weatherChart, predictionChart, correlationChart, densityChart;
let comparisonCharts = {}; // 存储对比图表实例
let currentDataCharts = {}; // 存储当前数据列图表实例
let columnCounter = 0; // 列计数器


// 运行数据统一颜色方案
const operationColorScheme = {
    'A相电流': '#e74c3c',
    'B相电流': '#27ae60',
    'C相电流': '#3498db',
    'A相功率': '#f1948a',
    'B相功率': '#82e0aa',
    'C相功率': '#85c1e9'
};

// 油色谱数据统一颜色方案
const chromatographyColorScheme = {
    'A相': ['#ffebee', '#ffcdd2', '#ef9a9a', '#e57373', '#ef5350', '#f44336', '#e53935', '#d32f2f', '#c62828'],
    'B相': ['#e8f5e8', '#c8e6c9', '#a5d6a7', '#81c784', '#66bb6a', '#4caf50', '#43a047', '#388e3c', '#2e7d32'],
    'C相': ['#e3f2fd', '#bbdefb', '#90caf9', '#64b5f6', '#42a5f5', '#2196f3', '#1e88e5', '#1976d2', '#1565c0'],
};

// 初始化图表
function initCharts() {
    // 初始化单时间分析图表
    operationChart = chartManager.initChart('operationChart');
    statusChart = chartManager.initChart('statusChart');
    chromatographyChart = chartManager.initChart('chromatographyChart');
    weatherChart = chartManager.initChart('weatherChart');
    predictionChart = chartManager.initChart('predictionChart');
    correlationChart = chartManager.initChart('correlationMatrix');
    // densityChart = chartManager.initChart('densityChart');

    // 初始化当前数据列图表
    initCurrentDataCharts();

    // 初始化图表类型切换器
    initChartTypeSwitchers();

    // 监听窗口大小变化
    window.addEventListener('resize', function () {
        resizeAllCharts();
    });
}

// 初始化当前数据列图表
function initCurrentDataCharts() {
    // 延迟初始化，确保容器已经渲染
    setTimeout(() => {
        currentDataCharts.operation = chartManager.initChart('currentOperationChart');
        currentDataCharts.status = chartManager.initChart('currentStatusChart');
        currentDataCharts.chromatography = chartManager.initChart('currentChromatographyChart');
        currentDataCharts.weather = chartManager.initChart('currentWeatherChart');
        currentDataCharts.correlation = chartManager.initChart('currentCorrelationChart');
        currentDataCharts.prediction = chartManager.initChart('currentPredictionChart');
        // currentDataCharts.density = chartManager.initChart('currentDensityChart');
        // 异常检测不需要图表实例，设置为null
        currentDataCharts.anomaly = null;

        // 初始化后立即调整大小
        setTimeout(() => {
            Object.values(currentDataCharts).forEach(chart => {
                if (chart && chart.resize) {
                    chart.resize();
                }
            });
        }, 100);
    }, 100);
}

// 初始化图表类型切换器
function initChartTypeSwitchers() {
    // 单时间分析模式的图表类型切换器
    const chartTypeSelectors = [
        'operationChartType',
        'statusChartType',
        'chromatographyChartType'
    ];

    chartTypeSelectors.forEach(selectorId => {
        const selector = document.getElementById(selectorId);
        if (selector) {
            selector.addEventListener('change', function () {
                const chartType = this.value;
                const chartName = selectorId.replace('ChartType', '');

                // 显示/隐藏数据模式选择器
                const dataModeSelector = document.getElementById(chartName + 'DataMode');
                if (dataModeSelector) {
                    if (chartType === 'area') {
                        dataModeSelector.style.display = 'block';
                    } else {
                        dataModeSelector.style.display = 'none';
                    }
                }

                // 获取当前数据模式
                const dataMode = dataModeSelector ? dataModeSelector.value : 'relative';
                switchChartType(chartName, chartType, dataMode);
            });
        }
    });

    // 初始化数据模式切换器
    const dataModeSelectors = [
        'operationDataMode',
        'chromatographyDataMode'
    ];

    dataModeSelectors.forEach(selectorId => {
        const selector = document.getElementById(selectorId);
        if (selector) {
            selector.addEventListener('change', function () {
                const dataMode = this.value;
                const chartName = selectorId.replace('DataMode', '');

                // 重新绘制河流图
                const chartTypeSelector = document.getElementById(chartName + 'ChartType');
                if (chartTypeSelector && chartTypeSelector.value === 'area') {
                    switchChartType(chartName, 'area', dataMode);
                }
            });
        }
    });

    // 当前数据列的图表类型切换器
    const currentChartTypeSelectors = [
        'currentOperationChartType',
        'currentStatusChartType',
        'currentChromatographyChartType'
    ];

    currentChartTypeSelectors.forEach(selectorId => {
        const selector = document.getElementById(selectorId);
        if (selector) {
            selector.addEventListener('change', function () {
                const chartType = this.value;
                const chartName = selectorId.replace('current', '').replace('ChartType', '').toLowerCase();

                // 显示/隐藏数据模式选择器
                const dataModeSelector = document.getElementById('current' + chartName.charAt(0).toUpperCase() + chartName.slice(1) + 'DataMode');
                if (dataModeSelector) {
                    if (chartType === 'area') {
                        dataModeSelector.style.display = 'block';
                    } else {
                        dataModeSelector.style.display = 'none';
                    }
                }

                // 获取当前数据模式
                const dataMode = dataModeSelector ? dataModeSelector.value : 'relative';
                switchCurrentChartType(chartName, chartType, dataMode);
            });
        }
    });

    // 初始化对比分析面板的数据模式切换器
    const currentDataModeSelectors = [
        'currentOperationDataMode',
        'currentChromatographyDataMode'
    ];

    currentDataModeSelectors.forEach(selectorId => {
        const selector = document.getElementById(selectorId);
        if (selector) {
            selector.addEventListener('change', function () {
                const dataMode = this.value;
                const chartName = selectorId.replace('current', '').replace('DataMode', '').toLowerCase();

                // 重新绘制河流图
                const chartTypeSelector = document.getElementById('current' + chartName.charAt(0).toUpperCase() + chartName.slice(1) + 'ChartType');
                if (chartTypeSelector && chartTypeSelector.value === 'area') {
                    switchCurrentChartType(chartName, 'area', dataMode);
                }
            });
        }
    });
}

// 切换分析模式
function toggleAnalysisMode() {
    const singleMode = document.querySelector('input[name="analysisMode"][value="single"]').checked;
    const singlePanels = document.getElementById('singleAnalysisPanels');
    const comparisonPanels = document.getElementById('comparisonAnalysisPanels');
    const singleControls = document.getElementById('singleTimeControls');
    const comparisonControls = document.getElementById('comparisonControls');

    if (singleMode) {
        singlePanels.style.display = 'grid';
        comparisonPanels.style.display = 'none';
        singleControls.style.display = 'flex';
        comparisonControls.style.display = 'none';

        // 强制调整单时间分析图表大小
        setTimeout(() => {
            resizeAllCharts();
        }, 100);
    } else {
        // 保存当前设置
        const deviceId = document.getElementById('deviceSelect').value;
        const granularity = document.getElementById('timeGranularity').value;

        singlePanels.style.display = 'none';
        comparisonPanels.style.display = 'block';
        singleControls.style.display = 'none';
        comparisonControls.style.display = 'flex';
        // 延迟加载当前数据列，确保DOM已更新
        setTimeout(async () => {
            await setCurrentDataTimeRange();
            loadCurrentData();
            // 调整对比模式图表大小
            setTimeout(() => {
                resizeAllCharts();
            }, 200);
        }, 200);
    }
}

// 加载当前数据列
async function loadCurrentData() {
    const startTime = document.getElementById('currentStartTime').value;
    const endTime = document.getElementById('currentEndTime').value;
    const deviceId = document.getElementById('deviceSelect').value;
    const granularity = document.getElementById('timeGranularity').value;

    const dataTypes = ['operation', 'status', 'chromatography', 'weather', 'correlation', 'prediction', 'anomaly', 'density'];

    for (const dataType of dataTypes) {
        const chartInstance = currentDataCharts[dataType];
        await dataLoader.loadData(dataType, {
            startTime,
            endTime,
            deviceId,
            granularity,
            chartInstance,
            context: 'current'
        });
    }
}

// 更新当前数据
function updateCurrentData() {
    loadCurrentData();
}

// 更新时间范围选择器
function updateTimeRangeSelectors(columnType, startTime, endTime) {
    try {
        const startDate = new Date(startTime);
        const endDate = new Date(endTime);

        // 确保时间格式包含秒
        const startFormatted = startDate.toISOString().slice(0, 19);
        const endFormatted = endDate.toISOString().slice(0, 19);


        if (columnType === 'current') {
            const startElement = document.getElementById('currentStartTime');
            const endElement = document.getElementById('currentEndTime');

            if (startElement) {
                startElement.value = startFormatted;
                startElement.setAttribute('step', '1');
            }
            if (endElement) {
                endElement.value = endFormatted;
                endElement.setAttribute('step', '1');
            }
        } else {
            // 对于对比列，只更新指定列的时间范围
            const columnId = columnType;
            const startElement = document.getElementById(`columnStartTime_${columnId}`);
            const endElement = document.getElementById(`columnEndTime_${columnId}`);

            if (startElement) {
                startElement.value = startFormatted;
                startElement.setAttribute('step', '1');
            }
            if (endElement) {
                endElement.value = endFormatted;
                endElement.setAttribute('step', '1');
            }
        }
    } catch (error) {
        console.error('更新时间范围选择器失败:', error);
    }
}

// 获取当前数据的时间范围并设置默认时间
async function setCurrentDataTimeRange() {
    try {
        const deviceId = document.getElementById('deviceSelect').value;
        const granularity = document.getElementById('timeGranularity').value;
        const year = document.getElementById('yearSelect').value;

        // 获取当前年的数据范围
        const data = await DataAPI.request('operation', {
            device_id: deviceId,
            granularity,
            year,
        });

        if (data.time && data.time.length > 0) {
            // 设置默认时间范围为第一个和最后一个数据点
            const firstTime = data.time[0];
            const lastTime = data.time[data.time.length - 1];

            const startDate = new Date(firstTime);
            const endDate = new Date(lastTime);

            const startFormatted = startDate.toISOString().slice(0, 19);
            const endFormatted = endDate.toISOString().slice(0, 19);

            document.getElementById('currentStartTime').value = startFormatted;
            document.getElementById('currentEndTime').value = endFormatted;
        }
    } catch (error) {
        console.error('获取时间范围失败:', error);
    }
}

// 添加对比列
function addComparisonColumn() {
    columnCounter++;
    const layout = document.getElementById('comparisonLayout');
    const addBtn = document.querySelector('.add-column-btn');

    // 创建新列
    const columnDiv = document.createElement('div');
    columnDiv.className = 'comparison-column';
    columnDiv.id = `comparisonColumn_${columnCounter}`;

    // 获取当前时间范围，默认选择不同年份但保持相同的月日时分秒
    const currentStartTime = document.getElementById('currentStartTime').value;
    const currentEndTime = document.getElementById('currentEndTime').value;
    const currentYear = new Date(currentStartTime).getFullYear();
    // 从年份选择里的候选year中选择不是current year的一个year
    const yearSelect = document.getElementById('yearSelect');
    let defaultYear = 2024;
    for (let i = 0; i < yearSelect.options.length; i++) {
        const y = parseInt(yearSelect.options[i].value);
        if (y !== currentYear) {
            defaultYear = y;
            break;
        }
    }

    // 保持相同的月日时分秒，只改变年份
    const currentStartDate = new Date(currentStartTime);
    const currentEndDate = new Date(currentEndTime);

    const defaultStartDate = new Date(currentStartDate);
    defaultStartDate.setFullYear(defaultYear);

    const defaultEndDate = new Date(currentEndDate);
    defaultEndDate.setFullYear(defaultYear);

    const defaultStartTime = defaultStartDate.toISOString().slice(0, 19);
    const defaultEndTime = defaultEndDate.toISOString().slice(0, 19);

    columnDiv.innerHTML = `
                <div class="comparison-column-header">
                    <div class="column-title">对比数据 ${columnCounter}</div>
                    <div class="time-range-selector">
                        <div class="time-range-item">
                            <label>开始时间:</label>
                            <input type="datetime-local" id="columnStartTime_${columnCounter}" onchange="updateColumnData(${columnCounter})" 
                                   value="${defaultStartTime}" step="1">
                        </div>
                        <div class="time-range-item">
                            <label>结束时间:</label>
                            <input type="datetime-local" id="columnEndTime_${columnCounter}" onchange="updateColumnData(${columnCounter})" 
                                   value="${defaultEndTime}" step="1">
                        </div>
                    </div>
                    <button class="column-remove-btn" onclick="removeComparisonColumn(${columnCounter})" title="删除此列">×</button>
                </div>
                <div class="comparison-panels">
                    <!-- 运行数据面板 -->
                    <div class="comparison-panel">
                        <div class="panel-header">
                            运行数据
                            <div class="chart-type-switcher">
                                <select id="operationChartType_${columnCounter}" class="chart-type-select">
                                    <option value="line">折线图</option>
                                    <option value="bar">柱状图</option>
                                    <option value="area">河流图</option>
                                    <option value="pie">饼图</option>
                                </select>
                            </div>
                        </div>
                        <div class="panel-content">
                            <div class="chart-container" id="operationChart_${columnCounter}">
                                <div class="loading">加载中...</div>
                            </div>
                        </div>
                    </div>
                    <!-- 状态数据面板 -->
                    <div class="comparison-panel">
                        <div class="panel-header">
                            状态数据
                            <div class="chart-type-switcher">
                                <select id="statusChartType_${columnCounter}" class="chart-type-select">
                                    <option value="line">折线图</option>
                                    <option value="histogram">直方图</option>
                                </select>
                            </div>
                        </div>
                        <div class="panel-content">
                            <div class="chart-container" id="statusChart_${columnCounter}">
                                <div class="loading">加载中...</div>
                            </div>
                        </div>
                    </div>
                    <!-- 油色谱数据面板 -->
                    <div class="comparison-panel">
                        <div class="panel-header">
                            油色谱数据
                            <div class="chart-type-switcher">
                                <select id="chromatographyChartType_${columnCounter}" class="chart-type-select">
                                    <option value="line">折线图</option>
                                    <option value="bar">柱状图</option>
                                    <option value="area">河流图</option>
                                    <option value="pie">饼图</option>
                                </select>
                            </div>
                        </div>
                        <div class="panel-content">
                            <div class="chart-container" id="chromatographyChart_${columnCounter}">
                                <div class="loading">暂无数据</div>
                            </div>
                        </div>
                    </div>
                    <!-- 天气和环境数据面板 -->
                    <div class="comparison-panel">
                        <div class="panel-header">天气和环境数据</div>
                        <div class="panel-content">
                            <div class="chart-container" id="weatherChart_${columnCounter}">
                                <div class="loading">加载中...</div>
                            </div>
                        </div>
                    </div>
                    <!-- 相关性分析面板 -->
                    <div class="comparison-panel correlation-panel">
                        <div class="panel-header">相关性分析</div>
                        <div class="panel-content">
                            <div class="chart-container" id="correlationChart_${columnCounter}">
                                <div class="loading">加载中...</div>
                            </div>
                        </div>
                    </div>
                    <!-- 时序预测分析面板 -->
                    <div class="comparison-panel prediction-panel">
                        <div class="panel-header">时序预测分析</div>
                        <div class="panel-content">
                            <div class="chart-container" id="predictionChart_${columnCounter}">
                                <div class="loading">加载中...</div>
                            </div>
                        </div>
                    </div>
                    <!-- 异常检测面板 -->
                    <div class="comparison-panel anomaly-panel">
                        <div class="panel-header">异常检测</div>
                        <div class="panel-content">
                            <div class="anomaly-container" id="anomalyList_${columnCounter}">
                                <div class="loading">加载中...</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

    // 在添加按钮前插入新列
    layout.insertBefore(columnDiv, addBtn);

    // 初始化新列的图表
    initColumnCharts(columnCounter);

    // 确保新添加的时间选择器支持秒级精度并加载数据
    setTimeout(() => {
        const newStartInput = document.getElementById(`columnStartTime_${columnCounter}`);
        const newEndInput = document.getElementById(`columnEndTime_${columnCounter}`);
        if (newStartInput) {
            newStartInput.setAttribute('step', '1');
        }
        if (newEndInput) {
            newEndInput.setAttribute('step', '1');
        }

        // 加载新列数据
        loadColumnData(columnCounter, defaultStartTime, defaultEndTime);
    }, 200);
}

// 初始化列图表
function initColumnCharts(columnId) {
    // 延迟初始化，确保DOM已渲染
    setTimeout(() => {
        comparisonCharts[`operation_${columnId}`] = echarts.init(document.getElementById(`operationChart_${columnId}`));
        comparisonCharts[`status_${columnId}`] = echarts.init(document.getElementById(`statusChart_${columnId}`));
        comparisonCharts[`chromatography_${columnId}`] = echarts.init(document.getElementById(`chromatographyChart_${columnId}`));
        comparisonCharts[`weather_${columnId}`] = echarts.init(document.getElementById(`weatherChart_${columnId}`));
        comparisonCharts[`correlation_${columnId}`] = echarts.init(document.getElementById(`correlationChart_${columnId}`));
        comparisonCharts[`prediction_${columnId}`] = echarts.init(document.getElementById(`predictionChart_${columnId}`));

        // 为动态生成的列添加图表类型切换器事件监听器
        initColumnChartTypeSwitchers(columnId);

        // 初始化后立即调整大小
        setTimeout(() => {
            const chartTypes = ['operation', 'status', 'chromatography', 'weather', 'correlation', 'prediction'];
            chartTypes.forEach(type => {
                const chart = comparisonCharts[`${type}_${columnId}`];
                if (chart && chart.resize) {
                    chart.resize();
                }
            });
        }, 100);
    }, 100);
}

// 初始化列图表类型切换器
function initColumnChartTypeSwitchers(columnId) {
    const chartTypeSelectors = [
        `operationChartType_${columnId}`,
        `statusChartType_${columnId}`,
        `chromatographyChartType_${columnId}`
    ];

    chartTypeSelectors.forEach(selectorId => {
        const selector = document.getElementById(selectorId);
        if (selector) {
            selector.addEventListener('change', function () {
                const chartType = this.value;
                const chartName = selectorId.replace(`ChartType_${columnId}`, '');
                switchColumnChartType(columnId, chartName, chartType);
            });
        }
    });
}

// 更新列数据
function updateColumnData(columnId) {
    const startTime = document.getElementById(`columnStartTime_${columnId}`).value;
    const endTime = document.getElementById(`columnEndTime_${columnId}`).value;
    loadColumnData(columnId, startTime, endTime);
}

// 删除对比列
function removeComparisonColumn(columnId) {
    const column = document.getElementById(`comparisonColumn_${columnId}`);
    if (column) {
        // 销毁图表实例
        const chartTypes = ['operation', 'status', 'chromatography', 'weather', 'correlation', 'prediction'];
        chartTypes.forEach(type => {
            const chartKey = `${type}_${columnId}`;
            if (comparisonCharts[chartKey]) {
                comparisonCharts[chartKey].dispose();
                delete comparisonCharts[chartKey];
            }
        });

        // 删除DOM元素
        column.remove();
    }
}

// 加载列数据
async function loadColumnData(columnId, startTime, endTime) {
    const deviceIdElement = document.getElementById('deviceSelect');
    const granularityElement = document.getElementById('timeGranularity');

    let deviceId = '';
    let granularity = 'day';

    if (deviceIdElement) {
        deviceId = deviceIdElement.value || '';
    }
    if (granularityElement) {
        granularity = granularityElement.value || 'day';
    }

    const dataTypes = ['operation', 'status', 'chromatography', 'weather', 'correlation', 'prediction', 'anomaly'];

    for (const dataType of dataTypes) {
        const chartInstance = comparisonCharts[`${dataType}_${columnId}`];
        await dataLoader.loadData(dataType, {
            startTime,
            endTime,
            deviceId,
            granularity,
            chartInstance,
            context: 'column',
            columnId
        });
    }
}

// 加载设备列表
async function loadDevices() {
    try {
        const devices = await DataAPI.request('devices');

        const select = document.getElementById('deviceSelect');
        select.innerHTML = '<option value="">全部设备</option>';

        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device;
            option.textContent = device;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('加载设备列表失败:', error);
    }
}

// 加载可用年份
async function loadYears() {
    try {
        const years = await DataAPI.request('available_years');

        const select = document.getElementById('yearSelect');
        select.innerHTML = '';

        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year + '年';
            select.appendChild(option);
        });
    } catch (error) {
        console.error('加载年份列表失败:', error);
    }
}

// 加载运行数据
async function loadOperationData() {
    const deviceId = document.getElementById('deviceSelect').value;
    const granularity = document.getElementById('timeGranularity').value;
    const year = document.getElementById('yearSelect').value;

    await dataLoader.loadData('operation', {
        deviceId,
        granularity,
        year,
        chartInstance: operationChart,
        context: 'single'
    });
}

// 加载状态数据
async function loadStatusData() {
    const deviceId = document.getElementById('deviceSelect').value;
    const granularity = document.getElementById('timeGranularity').value;
    const year = document.getElementById('yearSelect').value;

    await dataLoader.loadData('status', {
        deviceId,
        granularity,
        year,
        chartInstance: statusChart,
        context: 'single'
    });
}

// 加载油色谱数据
async function loadChromatographyData() {
    const deviceId = document.getElementById('deviceSelect').value;
    const granularity = document.getElementById('timeGranularity').value;
    const year = document.getElementById('yearSelect').value;

    await dataLoader.loadData('chromatography', {
        deviceId,
        granularity,
        year,
        chartInstance: chromatographyChart,
        context: 'single'
    });
}

// 加载相关性数据
async function loadCorrelationData() {
    const deviceId = document.getElementById('deviceSelect').value;
    const granularity = document.getElementById('timeGranularity').value;
    const year = document.getElementById('yearSelect').value;

    await dataLoader.loadData('correlation', {
        deviceId,
        granularity,
        year,
        chartInstance: correlationChart,
        context: 'single'
    });
}

// 绘制相关性系数矩阵
function drawCorrelationMatrix(data, chart) {
    const targetChart = chart || correlationChart;
    if (!targetChart) return;

    targetChart.clear();

    // 创建DataLoader实例来使用统一的配置生成函数
    const dataLoader = new DataLoader();
    const option = dataLoader.createCorrelationHeatmap(data);
    targetChart.setOption(option);
}

// 加载预测数据
async function loadPredictionData() {
    const deviceId = document.getElementById('deviceSelect').value;
    const granularity = document.getElementById('timeGranularity').value;
    const year = document.getElementById('yearSelect').value;
    const predictionPoints = document.getElementById('predictionPoints').value;

    await dataLoader.loadData('prediction', {
        deviceId,
        granularity,
        year,
        predictionPoints,
        chartInstance: predictionChart,
        context: 'single'
    });
}

// 加载密度图数据
async function loadDensityData() {
    return
    const deviceId = document.getElementById('deviceSelect').value;
    const granularity = document.getElementById('timeGranularity').value;
    const year = document.getElementById('yearSelect').value;

    await dataLoader.loadData('density', {
        deviceId,
        granularity,
        year,
        chartInstance: densityChart,
        context: 'single'
    });
}

// 加载当前密度图数据
async function loadCurrentDensityData() {
    const deviceId = document.getElementById('deviceSelect').value;
    const granularity = document.getElementById('timeGranularity').value;
    const startTime = document.getElementById('currentStartTime').value;
    const endTime = document.getElementById('currentEndTime').value;

    await dataLoader.loadData('density', {
        deviceId,
        granularity,
        startTime,
        endTime,
        chartInstance: currentDataCharts.density,
        context: 'current'
    });
}

// 加载异常检测数据
async function loadAnomalyData() {
    const deviceId = document.getElementById('deviceSelect').value;
    const granularity = document.getElementById('timeGranularity').value;
    const year = document.getElementById('yearSelect').value;

    await dataLoader.loadData('anomaly', {
        deviceId,
        granularity,
        year,
        chartInstance: null, // 异常检测不使用图表
        context: 'single'
    });
}

// 加载天气数据
async function loadWeatherData() {
    const deviceId = document.getElementById('deviceSelect').value;
    const granularity = document.getElementById('timeGranularity').value;
    const year = document.getElementById('yearSelect').value;

    await dataLoader.loadData('weather', {
        deviceId,
        granularity,
        year,
        chartInstance: weatherChart,
        context: 'single'
    });
}

// 刷新所有数据
async function refreshData() {
    const singleMode = document.querySelector('input[name="analysisMode"][value="single"]').checked;

    // 清除原始数据缓存，确保使用最新数据
    chartManager.originalData.clear();

    if (singleMode) {
        await loadOperationData();
        await loadStatusData();
        await loadChromatographyData();
        await loadWeatherData();
        await loadCorrelationData();
        await loadPredictionData();
        await loadAnomalyData();
        await loadDensityData();
    } else {
        // 刷新当前数据列
        await loadCurrentData();

        // 刷新所有对比列
        for (let i = 1; i <= columnCounter; i++) {
            const column = document.getElementById(`comparisonColumn_${i}`);
            if (column) {
                const startTime = document.getElementById(`columnStartTime_${i}`).value;
                const endTime = document.getElementById(`columnEndTime_${i}`).value;
                await loadColumnData(i, startTime, endTime);
            }
        }
    }
}

// 图表类型切换函数
function switchChartType(chartName, chartType, dataMode = 'relative') {
    chartTypeSwitcher.switchChartType(chartName, chartType, 'single', null, dataMode);
}

// 当前数据列图表类型切换函数
function switchCurrentChartType(chartName, chartType, dataMode = 'relative') {
    const chart = currentDataCharts[chartName];
    if (!chart) return;

    const currentOption = chart.getOption();
    if (!currentOption || !currentOption.series) return;

    // 特殊处理运行数据的图表类型
    if (chartName === 'operation') {
        return chartTypeSwitcher.switchOperationChartType(chart, currentOption, chartType, chartName, null, 'current', dataMode);
    }

    // 特殊处理状态数据的图表类型
    if (chartName === 'status') {
        return chartTypeSwitcher.switchStatusChartType(chart, currentOption, chartType, chartName, null, 'current');
    }

    // 特殊处理油色谱数据的图表类型
    if (chartName === 'chromatography') {
        return chartTypeSwitcher.switchChromatographyChartType(chart, currentOption, chartType, chartName, null, 'current', dataMode);
    }

    // 特殊处理密度图
    if (chartName === 'density') {
        return chartTypeSwitcher.switchDensityChartType(chart, currentOption, chartType, chartName, null, 'current');
    }

    // 特殊处理直方图
    if (chartType === 'histogram') {
        // 对于非状态数据，需要先保存原始数据
        const dataKey = chartTypeSwitcher.getDataKey(chartName, null, 'current');
        let originalData = chartManager.getOriginalData(dataKey);
        return chartTypeSwitcher.switchToHistogram(chart, originalData, chartName);
    }

    // 特殊处理柱状图
    if (chartType === 'bar') {
        return chartTypeSwitcher.switchToBarChart(chart, currentOption, chartName);
    }

    // 通用处理
    return chartTypeSwitcher.applyGenericChartType(chart, currentOption, chartType);
}

// 对比列图表类型切换函数
function switchColumnChartType(columnId, chartName, chartType) {
    const chart = comparisonCharts[`${chartName}_${columnId}`];
    if (!chart) return;

    const currentOption = chart.getOption();
    if (!currentOption || !currentOption.series) return;

    // 特殊处理运行数据的图表类型
    if (chartName === 'operation') {
        return chartTypeSwitcher.switchOperationChartType(chart, currentOption, chartType, chartName, columnId, 'column');
    }

    // 特殊处理状态数据的图表类型
    if (chartName === 'status') {
        return chartTypeSwitcher.switchStatusChartType(chart, currentOption, chartType, chartName, columnId, 'column');
    }

    // 特殊处理油色谱数据的图表类型
    if (chartName === 'chromatography') {
        return chartTypeSwitcher.switchChromatographyChartType(chart, currentOption, chartType, chartName, columnId, 'column');
    }

    // 特殊处理直方图
    if (chartType === 'histogram') {
        // 对于非状态数据，需要先保存原始数据
        const dataKey = chartTypeSwitcher.getDataKey(chartName, columnId, 'column');
        let originalData = chartManager.getOriginalData(dataKey);
        return chartTypeSwitcher.switchToHistogram(chart, originalData, chartName);
    }

    // 特殊处理柱状图
    if (chartType === 'bar') {
        return chartTypeSwitcher.switchToBarChart(chart, currentOption, chartName);
    }

    // 通用处理
    return chartTypeSwitcher.applyGenericChartType(chart, currentOption, chartType);
}


// 初始化时间选择器
function initTimeSelectors() {
    // 为所有现有的时间选择器设置秒级精度
    const timeInputs = document.querySelectorAll('input[type="datetime-local"]');
    timeInputs.forEach(input => {
        // 设置秒级精度
        input.setAttribute('step', '1');

        // 确保默认值包含秒
        if (input.value) {
            // 如果时间格式不包含秒，添加秒
            if (!input.value.includes(':') || input.value.split(':').length < 3) {
                if (input.value.includes('T')) {
                    input.value = input.value + ':00';
                } else {
                    input.value = input.value + 'T00:00:00';
                }
            }
        }

        // 添加事件监听器，确保用户输入时也保持秒级精度
        input.addEventListener('change', function () {
            if (this.value && !this.value.includes(':')) {
                this.value = this.value + ':00';
            }
        });
    });

}

// 页面加载完成后初始化
// 调整所有图表大小
function resizeAllCharts() {
    // 调整单时间分析图表
    chartManager.resizeChart('operationChart');
    chartManager.resizeChart('statusChart');
    chartManager.resizeChart('chromatographyChart');
    chartManager.resizeChart('weatherChart');
    chartManager.resizeChart('predictionChart');
    chartManager.resizeChart('correlationMatrix');

    // 调整当前数据列图表
    Object.values(currentDataCharts).forEach(chart => {
        if (chart && chart.resize) {
            chart.resize();
        }
    });

    // 调整对比列图表
    Object.values(comparisonCharts).forEach(chart => {
        if (chart && chart.resize) {
            chart.resize();
        }
    });
}

document.addEventListener('DOMContentLoaded', async function () {
    try {
        await DataAPI.init();
    } catch (e) {
        console.error('数据初始化失败:', e);
        alert('数据加载失败，请通过本地静态服务器打开本目录（例如: npx serve .），不要直接用 file:// 打开。');
        return;
    }

    initTimeSelectors();
    initCharts();
    await loadDevices();
    await loadYears();
    await refreshData();

    setTimeout(() => {
        resizeAllCharts();
    }, 500);

    document.getElementById('deviceSelect').addEventListener('change', refreshData);
    document.getElementById('timeGranularity').addEventListener('change', refreshData);
    document.getElementById('yearSelect').addEventListener('change', refreshData);

    const onPredictionChange = function () {
        const singleMode = document.querySelector('input[name="analysisMode"][value="single"]').checked;
        if (singleMode) {
            loadPredictionData();
        } else {
            refreshData();
        }
    };
    document.getElementById('predictionTypeSelect').addEventListener('change', onPredictionChange);
    document.getElementById('predictionPoints').addEventListener('change', onPredictionChange);

    const bindIfExists = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };

    bindIfExists('densityChartType', 'change', function () {
        switchChartType('density', this.value);
    });
    bindIfExists('densityDataType', 'change', function () {
        const singleMode = document.querySelector('input[name="analysisMode"][value="single"]').checked;
        if (singleMode) loadDensityData();
        else loadCurrentDensityData();
    });
    bindIfExists('currentDensityChartType', 'change', function () {
        switchCurrentChartType('density', this.value);
    });
    bindIfExists('currentDensityDataType', 'change', function () {
        loadCurrentDensityData();
    });
});
