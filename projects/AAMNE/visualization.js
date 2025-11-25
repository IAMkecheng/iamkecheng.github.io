// AAMNE 数据可视化 - 增强版本
// 全局变量
var aamneData = null;
var mappings = null;
var mainChart = null;
var detailChart = null;
var statChart = null;
var networkChart = null;
// 右侧列图表（双时间点对比模式）
var mainChart2 = null;
var detailChart2 = null;
var statChart2 = null;
var networkChart2 = null;
var worldJsonData = null;
var countryNameMap = null;
var drillDownHistory = []; // 下钻历史记录
var currentDrillLevel = null; // 当前下钻层级

// 初始化
$(document).ready(function () {
    console.log('开始加载数据...');
    loadData();
});

// 加载数据
function loadData() {
    // 加载国家名称映射
    $.getJSON('../Bilateral/js/country-name-map-zh.json', function (nameMap) {
        countryNameMap = nameMap;
        console.log('国家名称映射加载完成');

        // 加载世界地图数据
        $.getJSON('../Bilateral/js/worldZH.json', function (worldJson) {
            worldJsonData = worldJson;
            echarts.registerMap('world', worldJson);
            console.log('世界地图数据加载完成');

            // 加载映射数据
            $.getJSON('data/aamne_mappings.json', function (mappingData) {
                mappings = mappingData;
                console.log('映射数据加载完成', mappings);

                // 加载主数据
                $.getJSON('data/aamne_data.json', function (data) {
                    aamneData = data;
                    console.log('主数据加载完成', aamneData);

                    // 初始化界面
                    initUI();
                    // 初始化图表
                    initCharts();
                    // 更新可视化
                    updateVisualization();
                }).fail(function () {
                    console.error('加载主数据失败');
                    alert('加载数据失败，请检查数据文件是否存在');
                });
            }).fail(function () {
                console.error('加载映射数据失败');
                alert('加载映射数据失败，请检查数据文件是否存在');
            });
        }).fail(function () {
            console.error('加载世界地图数据失败');
            alert('加载世界地图数据失败');
        });
    }).fail(function () {
        console.error('加载国家名称映射失败');
        alert('加载国家名称映射失败');
    });
}

// 初始化UI控件
function initUI() {
    // 填充年份选择器
    var year1Select = $('#year1');
    var year2Select = $('#year2');
    year1Select.empty();
    year2Select.empty();

    if (aamneData && aamneData.years) {
        aamneData.years.forEach(function (year) {
            year1Select.append($('<option>', { value: year, text: year }));
            year2Select.append($('<option>', { value: year, text: year }));
        });
        // 默认选择最后一年
        if (aamneData.years.length > 0) {
            year1Select.val(aamneData.years[aamneData.years.length - 1]);
        }
    }

    // 填充国家选择器
    var countrySelect = $('#countrySelect');
    var country2Select = $('#country2Select');
    countrySelect.empty();
    country2Select.empty();
    countrySelect.append($('<option>', { value: '', text: '全部' }));
    country2Select.append($('<option>', { value: '', text: '全部' }));

    if (aamneData && aamneData.countries && mappings && mappings.countries) {
        aamneData.countries.forEach(function (code) {
            var name = mappings.countries[code] || code;
            countrySelect.append($('<option>', { value: code, text: name + ' (' + code + ')' }));
            country2Select.append($('<option>', { value: code, text: name + ' (' + code + ')' }));
        });
    }

    // 初始化country2Select的值与countrySelect一致
    country2Select.val(countrySelect.val());

    // 填充行业选择器
    var industrySelect = $('#industrySelect');
    var industry2Select = $('#industry2Select');
    industrySelect.empty();
    industry2Select.empty();
    industrySelect.append($('<option>', { value: '', text: '全部' }));
    industry2Select.append($('<option>', { value: '', text: '全部' }));

    if (aamneData && aamneData.industries && mappings && mappings.industries) {
        aamneData.industries.forEach(function (code) {
            var name = mappings.industries[code] || code;
            industrySelect.append($('<option>', { value: code, text: name + ' (' + code + ')' }));
            industry2Select.append($('<option>', { value: code, text: name + ' (' + code + ')' }));
        });
    }

    // 初始化industry2Select的值与industrySelect一致
    industry2Select.val(industrySelect.val());

    // 绑定事件
    $('#viewMode').on('change', function () {
        var mode = $(this).val();
        if (mode === 'compare') {
            // 显示year2选择器
            $('#year2Group').show();
            // 显示country2SelectGroup
            $('#country2SelectGroup').show();
            // 同步country2Select的值与countrySelect一致
            $('#country2Select').val($('#countrySelect').val());
            // 如果是行业视图，显示industry2SelectGroup
            if ($('#viewLevel').val() === 'industry') {
                $('#industry2SelectGroup').show();
                // 同步industry2Select的值与industrySelect一致
                $('#industry2Select').val($('#industrySelect').val());
            }
            // 显示右侧列
            $('#rightColumn').show();
            // 添加对比模式类
            $('.main-content').addClass('compare-mode');
            // 显示容器后，需要重新调整右侧图表尺寸
            setTimeout(function () {
                if (mainChart2) mainChart2.resize();
                if (detailChart2) detailChart2.resize();
                if (statChart2) statChart2.resize();
                if (networkChart2) networkChart2.resize();
            }, 100);
            // 自动选择对比年份
            autoSelectCompareYear();
        } else {
            // 隐藏右侧列
            $('#rightColumn').hide();
            // 移除对比模式类
            $('.main-content').removeClass('compare-mode');
            $('#year2Group').hide();
            $('#country2SelectGroup').hide();
            $('#industry2SelectGroup').hide();
        }
        updateVisualization();
    });

    $('#viewLevel').on('change', function () {
        var level = $(this).val();
        var viewMode = $('#viewMode').val();
        if (level === 'industry') {
            $('#industrySelectGroup').show();
            // 如果是双时间点对比模式，也显示industry2SelectGroup
            if (viewMode === 'compare') {
                $('#industry2SelectGroup').show();
                // 同步industry2Select的值与industrySelect一致
                $('#industry2Select').val($('#industrySelect').val());
            }
        } else {
            $('#industrySelectGroup').hide();
            $('#industry2SelectGroup').hide();
        }
        updateVisualization();
    });

    $('#year1, #year2, #countrySelect, #industrySelect, #country2Select, #industry2Select, #chartType').on('change', function () {
        // 如果是对比模式且year1改变，重新自动选择对比年份
        if ($('#viewMode').val() === 'compare' && $(this).attr('id') === 'year1') {
            autoSelectCompareYear();
        }
        updateVisualization();
    });

    // 右侧列控制事件
    $('#chartType2').on('change', function () {
        updateVisualization();
    });

    $('#networkLayout2, #showBidirectional2, #edgeLimit2').on('change', function () {
        updateVisualization();
    });

    // 网络关系图控制
    $('#networkLayout, #showBidirectional, #edgeLimit').on('change', function () {
        updateVisualization();
    });

    // 两国对比模式切换
    $('#countrySelect').on('change', function () {
        // var country1 = $(this).val();
        // if (country1) {
        //     $('#country2SelectGroup').show();
        // } else {
        //     $('#country2SelectGroup').hide();
        // }
        updateVisualization();
    });

    $('#resetBtn').on('click', function () {
        $('#countrySelect').val('');
        $('#industrySelect').val('');
        $('#country2Select').val('');
        $('#industry2Select').val('');
        $('#viewLevel').val('investor');
        $('#viewMode').val('single');
        $('#chartType').val('bar');
        $('#chartType2').val('bar');
        $('#year2Group').hide();
        $('#industrySelectGroup').hide();
        $('#industry2SelectGroup').hide();
        $('#country2SelectGroup').hide();
        $('#rightColumn').hide();
        $('.main-content').removeClass('compare-mode');
        drillDownHistory = [];
        currentDrillLevel = null;
        updateVisualization();
    });
}

// 自动选择对比年份（+1年优先，如果没有则选择-1年）
function autoSelectCompareYear() {
    if (!aamneData || !aamneData.years || aamneData.years.length === 0) {
        return null;
    }

    var year1 = parseInt($('#year1').val());
    if (!year1) {
        return null;
    }

    var years = aamneData.years.map(function (y) { return parseInt(y); }).sort(function (a, b) { return a - b; });
    var currentIndex = years.indexOf(year1);

    if (currentIndex === -1) {
        return null;
    }

    // 优先选择+1年
    var compareYear = null;
    if (currentIndex < years.length - 1) {
        compareYear = years[currentIndex + 1];
    } else if (currentIndex > 0) {
        // 如果没有+1年，选择-1年
        compareYear = years[currentIndex - 1];
    }

    // 设置year2的值（虽然不显示，但用于内部逻辑）
    if (compareYear) {
        $('#year2').val(compareYear);
    }

    return compareYear;
}

// 初始化图表
function initCharts() {
    // 左侧列图表
    mainChart = echarts.init(document.getElementById('mainChart'));
    detailChart = echarts.init(document.getElementById('detailChart'));
    statChart = echarts.init(document.getElementById('statChart'));
    networkChart = echarts.init(document.getElementById('networkChart'));

    // 右侧列图表（双时间点对比模式）
    mainChart2 = echarts.init(document.getElementById('mainChart2'));
    detailChart2 = echarts.init(document.getElementById('detailChart2'));
    statChart2 = echarts.init(document.getElementById('statChart2'));
    networkChart2 = echarts.init(document.getElementById('networkChart2'));

    // 响应式调整
    window.addEventListener('resize', function () {
        mainChart && mainChart.resize();
        detailChart && detailChart.resize();
        statChart && statChart.resize();
        networkChart && networkChart.resize();
        mainChart2 && mainChart2.resize();
        detailChart2 && detailChart2.resize();
        statChart2 && statChart2.resize();
        networkChart2 && networkChart2.resize();
    });
}

// 更新可视化
function updateVisualization() {
    if (!aamneData || !mappings) {
        console.log('数据未加载完成');
        return;
    }

    var viewMode = $('#viewMode').val();
    var year1 = parseInt($('#year1').val());
    var year2 = null;
    if (viewMode === 'compare') {
        // 从year2选择器读取对比年份
        year2 = parseInt($('#year2').val());
        // 如果没有选择，自动选择对比年份
        if (!year2 || isNaN(year2)) {
            year2 = autoSelectCompareYear();
        }
    }
    var viewLevel = $('#viewLevel').val();
    var selectedCountry = $('#countrySelect').val();
    var selectedIndustry = $('#industrySelect').val();
    var country2 = $('#country2Select').val();
    var industry2 = $('#industry2Select').val() || selectedIndustry; // 如果未选择，使用左侧的行业
    var chartType = $('#chartType').val();
    var chartType2 = $('#chartType2').val() || chartType;

    console.log('更新可视化', { viewMode, year1, year2, viewLevel, selectedCountry, selectedIndustry, country2, industry2, chartType });

    // 如果有两个国家选择，进入两国对比模式
    // if (selectedCountry && country2) {
    //     updateTwoCountryCompare(year1, selectedCountry, country2, selectedIndustry);
    //     return;
    // }

    if (viewMode === 'single') {
        updateSingleTimeView(year1, viewLevel, selectedCountry, selectedIndustry, chartType);
    } else {
        updateCompareView(year1, year2, viewLevel, selectedCountry, selectedIndustry, country2, industry2, chartType, chartType2);
    }
}

// 对比视图
function updateCompareView(year1, year2, level, country, industry, country2, industry2, chartType, chartType2) {
    if (!year2) {
        console.warn('对比年份未选择');
        return;
    }

    // 确保右侧列图表尺寸正确（容器可能刚刚显示）
    if ($('#rightColumn').is(':visible')) {
        setTimeout(function () {
            if (mainChart2) mainChart2.resize();
            if (detailChart2) detailChart2.resize();
            if (statChart2) statChart2.resize();
            if (networkChart2) networkChart2.resize();
        }, 50);
    }

    // 左侧列：当前年份数据
    var data1 = getFilteredData(year1, level, country, industry);
    updateMainChart(data1, level, year1, chartType);
    var detailData1 = getDataByYearAndCountry(year1, country);
    updateDetailChart(detailData1, level);
    // 对比模式下显示趋势图而不是饼图
    updateOverallViewChart(level, country, industry, null);
    updateDataTable(data1, level, 'dataTable');
    var networkData1 = getDataByYearAndCountry(year1, country);
    updateNetworkChart(networkData1, level, year1);

    // 右侧列：对比年份数据
    var data2 = getFilteredData(year2, level, country2, industry2);
    updateMainChart2(data2, level, year2, chartType2);
    var detailData2 = getDataByYearAndCountry(year2, country2);
    updateDetailChart2(detailData2, level);
    // 对比模式下显示趋势图而不是饼图
    updateOverallViewChart2(level, country2, industry2, null);
    updateDataTable(data2, level, 'dataTable2');
    var networkData2 = getDataByYearAndCountry(year2, country2);
    updateNetworkChart2(networkData2, level, year2);
}

// 获取筛选后的数据
function getFilteredData(year, level, country, industry) {
    if (!aamneData.data[year]) {
        return { items: [], total: 0 };
    }

    var result = [];
    var total = 0;

    var yearData = aamneData.data[year];

    // 遍历所有目的地国
    for (var dest in yearData) {
        if (country && dest !== country) continue;

        var destData = yearData[dest];

        // 遍历所有行业
        for (var ind in destData) {
            if (industry && ind !== industry) continue;

            var indData = destData[ind];

            // 遍历所有投资国
            for (var inv in indData) {
                var value = indData[inv];
                if (value > 0) {
                    total += value;

                    var item = {
                        destination: dest,
                        industry: ind,
                        investor: inv,
                        value: value
                    };

                    result.push(item);
                }
            }
        }
    }

    return { items: result, total: total };
}

// 获取只按年份和国家筛选的数据（用于网络关系图和投资流向图）
function getDataByYearAndCountry(year, country) {
    if (!aamneData.data[year]) {
        return { items: [], total: 0 };
    }

    var result = [];
    var total = 0;
    var yearData = aamneData.data[year];

    // 如果指定了国家，只获取与该国家相关的数据
    if (country) {
        // 获取该国家作为目的地国的所有投资
        if (yearData[country]) {
            var destData = yearData[country];
            for (var ind in destData) {
                var indData = destData[ind];
                for (var inv in indData) {
                    var value = indData[inv];
                    if (value > 0) {
                        total += value;
                        result.push({
                            destination: country,
                            industry: ind,
                            investor: inv,
                            value: value
                        });
                    }
                }
            }
        }

        // 获取该国家作为投资国的所有投资
        for (var dest in yearData) {
            var destData = yearData[dest];
            for (var ind in destData) {
                var indData = destData[ind];
                if (indData[country]) {
                    var value = indData[country];
                    if (value > 0) {
                        total += value;
                        result.push({
                            destination: dest,
                            industry: ind,
                            investor: country,
                            value: value
                        });
                    }
                }
            }
        }
    } else {
        // 没有指定国家，获取所有数据
        for (var dest in yearData) {
            var destData = yearData[dest];
            for (var ind in destData) {
                var indData = destData[ind];
                for (var inv in indData) {
                    var value = indData[inv];
                    if (value > 0) {
                        total += value;
                        result.push({
                            destination: dest,
                            industry: ind,
                            investor: inv,
                            value: value
                        });
                    }
                }
            }
        }
    }

    return { items: result, total: total };
}

// 更新主图表
function updateMainChart(data, level, year, chartType) {
    chartType = chartType || $('#chartType').val() || 'bar';

    // 根据图表类型调用不同的更新函数
    if (chartType === 'map') {
        updateMapChart(data, level, year, $('#countrySelect').val());
        return;
    } else if (chartType === 'pie') {
        updatePieChartInMain(data, level, year);
        return;
    }
    // 检查数据是否有效
    if (!data || !data.items || data.items.length === 0) {
        var viewMode = $('#viewMode').val();
        var titlePrefix = '投资分布 - ';
        $('#mainChartTitle').text(titlePrefix + year + ' (无数据)');
        mainChart.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 16,
                    color: '#999'
                }
            }
        }, true);
        return;
    }

    // 用于存储代码到全称的映射，用于tooltip显示
    var codeToFullNameMap = {};

    // 获取选定的国家，用于更新标题
    var selectedCountry = $('#countrySelect').val() || '';
    var countryName = '';
    var viewMode = $('#viewMode').val();
    var titlePrefix = '投资分布 - ';
    if (selectedCountry && mappings && mappings.countries) {
        countryName = mappings.countries[selectedCountry] || selectedCountry;
        // 更新panel标题
        $('#mainChartTitle').text(titlePrefix + year + ' (' + countryName + ')');
    } else {
        $('#mainChartTitle').text(titlePrefix + year);
    }

    var option = {
        tooltip: {
            trigger: 'axis',
            formatter: function (params) {
                if (!params || !Array.isArray(params) || params.length === 0 || !params[0]) {
                    return '';
                }
                var code = params[0].name; // x轴显示的是代码
                var fullName = codeToFullNameMap[code] || code;
                var result = fullName + '<br/>';
                params.forEach(function (item) {
                    if (item && item.seriesName && item.value !== undefined) {
                        result += item.seriesName + ': ' + formatNumber(item.value) + '<br/>';
                    }
                });
                return result;
            }
        },
        xAxis: {
            type: 'category',
            data: [],
            axisLabel: { rotate: 45 }
        },
        yAxis: {
            type: 'log',
            name: '投资额',
            logBase: 10,
            axisLabel: {
                formatter: function (value) {
                    if (value === 0 || value < 1) {
                        return '0';
                    } else if (value >= 1000) {
                        // 统一除以1000，然后显示k
                        return (value / 1000).toFixed(0) + 'k';
                    } else {
                        return value.toString();
                    }
                }
            }
        },
        series: []
    };

    // 根据层级组织数据
    if (level === 'investor') {
        // 按投资国汇总
        var investorMap = {};
        data.items.forEach(function (item) {
            if (!investorMap[item.investor]) {
                investorMap[item.investor] = 0;
            }
            investorMap[item.investor] += item.value;
        });

        var sorted = Object.keys(investorMap).sort(function (a, b) {
            return investorMap[b] - investorMap[a];
        }).slice(0, 15); // 取前15名

        // 如果没有数据，显示空状态
        if (sorted.length === 0) {
            $('#mainChartTitle').text('投资分布 - ' + year + ' (无数据)');
            mainChart.setOption({
                title: {
                    text: '暂无数据',
                    left: 'center',
                    top: 'middle',
                    textStyle: {
                        fontSize: 16,
                        color: '#999'
                    }
                }
            }, true);
            return;
        }

        // x轴只显示代码（缩写）
        option.xAxis.data = sorted.map(function (code) {
            var fullName = (mappings.countries[code] || code) + ' (' + code + ')';
            codeToFullNameMap[code] = fullName;
            return code;
        });

        option.series.push({
            name: '投资额',
            type: 'bar',
            data: sorted.map(function (code) {
                return investorMap[code] || 0;
            }),
            itemStyle: {
                color: '#4a90e2'
            }
        });

        // 添加点击事件实现下钻
        mainChart.off('click');
        mainChart.on('click', function (params) {
            if (params.dataIndex !== undefined) {
                var code = sorted[params.dataIndex];
                drillDownToCountry(code, level, parseInt($('#year1').val()));
            }
        });
    } else if (level === 'destination') {
        // 按目的地国汇总
        var destMap = {};
        data.items.forEach(function (item) {
            if (!destMap[item.destination]) {
                destMap[item.destination] = 0;
            }
            destMap[item.destination] += item.value;
        });

        var sorted = Object.keys(destMap).sort(function (a, b) {
            return destMap[b] - destMap[a];
        }).slice(0, 15);

        // 如果没有数据，显示空状态
        if (sorted.length === 0) {
            $('#mainChartTitle').text('投资分布 - ' + year + ' (无数据)');
            mainChart.setOption({
                title: {
                    text: '暂无数据',
                    left: 'center',
                    top: 'middle',
                    textStyle: {
                        fontSize: 16,
                        color: '#999'
                    }
                }
            }, true);
            return;
        }

        // x轴只显示代码（缩写）
        option.xAxis.data = sorted.map(function (code) {
            var fullName = (mappings.countries[code] || code) + ' (' + code + ')';
            codeToFullNameMap[code] = fullName;
            return code;
        });

        option.series.push({
            name: '投资额',
            type: 'bar',
            data: sorted.map(function (code) {
                return destMap[code] || 0;
            }),
            itemStyle: {
                color: '#4a90e2'
            }
        });

        // 添加点击事件实现下钻
        mainChart.off('click');
        mainChart.on('click', function (params) {
            if (params.dataIndex !== undefined) {
                var code = sorted[params.dataIndex];
                drillDownToCountry(code, level, parseInt($('#year1').val()));
            }
        });
    } else if (level === 'industry') {
        // 按行业汇总
        var indMap = {};
        data.items.forEach(function (item) {
            if (!indMap[item.industry]) {
                indMap[item.industry] = 0;
            }
            indMap[item.industry] += item.value;
        });

        var sorted = Object.keys(indMap).sort(function (a, b) {
            return indMap[b] - indMap[a];
        }).slice(0, 15);

        // 如果没有数据，显示空状态
        if (sorted.length === 0) {
            $('#mainChartTitle').text('投资分布 - ' + year + ' (无数据)');
            mainChart.setOption({
                title: {
                    text: '暂无数据',
                    left: 'center',
                    top: 'middle',
                    textStyle: {
                        fontSize: 16,
                        color: '#999'
                    }
                }
            }, true);
            return;
        }

        // x轴只显示代码（缩写）
        option.xAxis.data = sorted.map(function (code) {
            var fullName = (mappings.industries[code] || code) + ' (' + code + ')';
            codeToFullNameMap[code] = fullName;
            return code;
        });

        option.series.push({
            name: '投资额',
            type: 'bar',
            data: sorted.map(function (code) {
                return indMap[code] || 0;
            }),
            itemStyle: {
                color: '#4a90e2'
            }
        });
    }

    // 确保有数据再设置选项
    if (option.series.length > 0 && option.xAxis.data.length > 0) {
        mainChart.setOption(option, true);
    } else {
        $('#mainChartTitle').text('投资分布 - ' + year + ' (无数据)');
        mainChart.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 16,
                    color: '#999'
                }
            }
        }, true);
    }
}

// 在主图表中显示饼图
function updatePieChartInMain(data, level, year) {
    // 更新panel标题，在对比模式下添加时间标识
    var viewMode = $('#viewMode').val();
    var titlePrefix = '投资分布 - ';
    $('#mainChartTitle').text(titlePrefix + year);

    // 检查数据是否有效
    if (!data || !data.items || data.items.length === 0) {
        $('#mainChartTitle').text(titlePrefix + year + ' (无数据)');
        mainChart.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 16,
                    color: '#999'
                }
            }
        }, true);
        return;
    }

    var option = {
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} ({d}%)'
        },
        series: [{
            name: '投资分布',
            type: 'pie',
            radius: ['40%', '70%'],
            data: [],
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowOffsetX: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }]
    };

    // 根据层级组织数据
    var map = {};
    data.items.forEach(function (item) {
        var key = '';
        if (level === 'investor') {
            key = (mappings.countries[item.investor] || item.investor) + ' (' + item.investor + ')';
        } else if (level === 'destination') {
            key = (mappings.countries[item.destination] || item.destination) + ' (' + item.destination + ')';
        } else if (level === 'industry') {
            key = (mappings.industries[item.industry] || item.industry) + ' (' + item.industry + ')';
        } else {
            key = item.investor + ' -> ' + item.destination + ' (' + item.industry + ')';
        }

        if (!map[key]) {
            map[key] = 0;
        }
        map[key] += item.value;
    });

    var sorted = Object.keys(map).sort(function (a, b) {
        return map[b] - map[a];
    }).slice(0, 15); // 取前15名

    if (sorted.length === 0) {
        var viewMode = $('#viewMode').val();
        var titlePrefix = '投资分布 - ';
        $('#mainChartTitle').text(titlePrefix + year + ' (无数据)');
        mainChart.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 16,
                    color: '#999'
                }
            }
        }, true);
        return;
    }

    // 为每个类别设置不同颜色
    option.series[0].data = sorted.map(function (key, index) {
        return {
            name: key,
            value: map[key] || 0,
            itemStyle: {
                color: getColorByName(key, index)
            }
        };
    });

    mainChart.setOption(option, true);

    // 添加点击事件实现下钻
    mainChart.off('click');
    mainChart.on('click', function (params) {
        if (params && params.data && params.data.name) {
            // 从名称中提取代码
            var name = params.data.name;
            var match = name.match(/\(([A-Z0-9]+)\)/);
            if (match && match[1]) {
                var code = match[1];
                drillDownToCountry(code, level, year);
            }
        }
    });
}

// 获取只按年份筛选的数据（不受其他筛选条件影响）
function getYearOnlyData(year) {
    // 检查数据是否已加载
    if (!aamneData || !aamneData.data) {
        console.warn('aamneData未加载或数据格式不正确');
        return { items: [], total: 0 };
    }

    // 检查年份是否存在
    if (!aamneData.data[year]) {
        console.warn('年份数据不存在:', year, '可用年份:', Object.keys(aamneData.data));
        return { items: [], total: 0 };
    }

    var result = [];
    var total = 0;
    var yearData = aamneData.data[year];

    // 遍历所有目的地国
    for (var dest in yearData) {
        if (!yearData.hasOwnProperty(dest)) continue;

        var destData = yearData[dest];
        if (!destData || typeof destData !== 'object') continue;

        // 遍历所有行业
        for (var ind in destData) {
            if (!destData.hasOwnProperty(ind)) continue;

            var indData = destData[ind];
            if (!indData || typeof indData !== 'object') continue;

            // 遍历所有投资国
            for (var inv in indData) {
                if (!indData.hasOwnProperty(inv)) continue;

                var value = indData[inv];
                // 确保值是数字且大于0
                value = Number(value);
                if (value > 0 && !isNaN(value)) {
                    total += value;

                    var item = {
                        destination: dest,
                        industry: ind,
                        investor: inv,
                        value: value
                    };

                    result.push(item);
                }
            }
        }
    }

    console.log('getYearOnlyData返回:', {
        year: year,
        itemsCount: result.length,
        total: total
    });

    return { items: result, total: total };
}

// 更新投资流向图表（使用Sankey图）
function updateDetailChart(data, level, chartInstance, titleId, yearSelectId) {
    chartInstance = chartInstance || detailChart;
    titleId = titleId || 'detailChartTitle';
    yearSelectId = yearSelectId || 'year1';

    // 获取当前年份
    var year = parseInt($('#' + yearSelectId).val());

    // 如果年份无效，尝试从传入的data中获取年份，或者使用默认值
    if (!year || isNaN(year)) {
        console.warn('无法获取年份，尝试使用默认年份');
        if (aamneData && aamneData.years && aamneData.years.length > 0) {
            year = aamneData.years[aamneData.years.length - 1];
        } else {
            console.error('无法获取年份数据');
            chartInstance.setOption({
                title: {
                    text: '暂无数据（年份无效）',
                    left: 'center',
                    top: 'middle',
                    textStyle: {
                        fontSize: 16,
                        color: '#999'
                    }
                }
            }, true);
            return;
        }
    }

    // 使用传入的数据（已经根据国家筛选）
    var yearData = data;

    // 获取选定的国家，用于更新标题
    // 根据titleId判断是左侧还是右侧
    var isRightColumn = (titleId === 'detailChartTitle2');
    var selectedCountry = isRightColumn ? ($('#country2Select').val() || '') : ($('#countrySelect').val() || '');
    var countryName = '';
    if (selectedCountry && mappings && mappings.countries) {
        countryName = mappings.countries[selectedCountry] || selectedCountry;
    }

    console.log('投资流向数据检查:', {
        year: year,
        selectedCountry: selectedCountry,
        hasData: !!yearData,
        itemsCount: yearData ? yearData.items.length : 0,
        total: yearData ? yearData.total : 0
    });

    // 更新panel标题
    if (selectedCountry && countryName) {
        $('#' + titleId).text('投资流向 - ' + year + ' (' + countryName + ')');
    } else {
        $('#' + titleId).text('投资流向 - ' + year);
    }

    // 检查数据是否有效
    if (!yearData || !yearData.items || yearData.items.length === 0) {
        console.warn('投资流向数据为空，年份:', year, '国家:', selectedCountry);
        chartInstance.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 16,
                    color: '#999'
                }
            }
        }, true);
        return;
    }

    // 准备Sankey数据
    var nodes = [];
    var links = [];
    var nodeMap = {};
    var nodeIndex = 0;

    // 限制数据量，只显示前30个最大的流向
    // 过滤掉自投资（investor === destination），因为Sankey图不支持自循环
    var flowMap = {};
    yearData.items.forEach(function (item) {
        // 跳过自投资
        if (item.investor === item.destination) {
            return;
        }

        var key = item.investor + '|' + item.destination;
        if (!flowMap[key]) {
            flowMap[key] = {
                investor: item.investor,
                destination: item.destination,
                value: 0
            };
        }
        flowMap[key].value += item.value;
    });

    console.log('flowMap创建完成，流向数量:', Object.keys(flowMap).length);

    var sortedFlows = Object.values(flowMap).sort(function (a, b) {
        return b.value - a.value;
    }).slice(0, 30); // 取前30名

    console.log('sortedFlows处理完成，数量:', sortedFlows.length);

    // 如果没有数据，显示空状态
    if (sortedFlows.length === 0) {
        console.warn('sortedFlows为空');
        chartInstance.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 16,
                    color: '#999'
                }
            }
        }, true);
        return;
    }

    // 处理双向流：计算差值，正值保持方向，负值反转方向
    // 先收集所有流向，包括双向流
    var allFlowsMap = {};
    sortedFlows.forEach(function (flow) {
        var key = flow.investor + '|' + flow.destination;
        allFlowsMap[key] = flow;
    });

    // 处理双向流并计算净差值
    var flowMapFinal = {};
    var processedPairs = new Set(); // 记录已处理的双向流对

    sortedFlows.forEach(function (flow) {
        var key1 = flow.investor + '|' + flow.destination;
        var key2 = flow.destination + '|' + flow.investor;
        var pairKey = [flow.investor, flow.destination].sort().join('|'); // 用于标识双向流对

        // 如果已经处理过这个双向流对，跳过
        if (processedPairs.has(pairKey)) {
            return;
        }

        // 检查是否存在反向流
        if (allFlowsMap[key2]) {
            // 存在双向流，计算差值
            var reverseFlow = allFlowsMap[key2];
            var netValue = flow.value - reverseFlow.value;

            processedPairs.add(pairKey);

            if (netValue > 0) {
                // 净流向为正，保持当前方向
                flowMapFinal[key1] = {
                    investor: flow.investor,
                    destination: flow.destination,
                    value: netValue,
                    netFlow: netValue  // 正数表示净流入
                };
            } else if (netValue < 0) {
                // 净流向为负，反转方向
                // 反转后，从新source（原destination）到新target（原investor）
                // 从新source的角度看，这是净流出（负数）
                // 从新target的角度看，这是净流入（正数）
                // 我们保存负数，表示从source到target是净流出
                flowMapFinal[key2] = {
                    investor: flow.destination,
                    destination: flow.investor,
                    value: Math.abs(netValue),
                    netFlow: netValue  // 负数表示从新source到新target是净流出
                };
            }
            // 如果netValue === 0，则不添加（相互抵消）
        } else {
            // 单向流，直接添加
            flowMapFinal[key1] = {
                investor: flow.investor,
                destination: flow.destination,
                value: flow.value,
                netFlow: flow.value
            };
        }
    });

    console.log('flowMapFinal处理完成，数量:', Object.keys(flowMapFinal).length);

    // 验证：确保没有双向流同时存在，如果有则移除其中一个
    var finalFlows = Object.values(flowMapFinal);
    var flowKeys = new Set();
    var flowsToRemove = [];

    finalFlows.forEach(function (flow, index) {
        var key1 = flow.investor + '|' + flow.destination;
        var key2 = flow.destination + '|' + flow.investor;

        if (flowKeys.has(key2)) {
            console.warn('发现冲突的双向流，移除:', key1);
            flowsToRemove.push(key1);
        } else {
            flowKeys.add(key1);
        }
    });

    // 移除冲突的流
    flowsToRemove.forEach(function (key) {
        delete flowMapFinal[key];
    });

    if (flowsToRemove.length > 0) {
        console.log('已移除', flowsToRemove.length, '个冲突的双向流');
    }

    // 使用拓扑排序检测间接循环
    // 构建邻接表
    var adjacencyList = {};
    var allNodeCodes = new Set();
    Object.values(flowMapFinal).forEach(function (flow) {
        allNodeCodes.add(flow.investor);
        allNodeCodes.add(flow.destination);
        if (!adjacencyList[flow.investor]) {
            adjacencyList[flow.investor] = [];
        }
        adjacencyList[flow.investor].push(flow.destination);
    });

    // 检测循环（使用DFS）
    var visited = {};
    var recStack = {};
    var cycleNodes = new Set();

    function hasCycle(node) {
        if (recStack[node]) {
            cycleNodes.add(node);
            return true;
        }
        if (visited[node]) {
            return false;
        }

        visited[node] = true;
        recStack[node] = true;

        if (adjacencyList[node]) {
            for (var i = 0; i < adjacencyList[node].length; i++) {
                var neighbor = adjacencyList[node][i];
                if (hasCycle(neighbor)) {
                    cycleNodes.add(node);
                    return true;
                }
            }
        }

        recStack[node] = false;
        return false;
    }

    // 检测所有节点的循环
    Array.from(allNodeCodes).forEach(function (node) {
        if (!visited[node]) {
            hasCycle(node);
        }
    });

    if (cycleNodes.size > 0) {
        console.warn('检测到循环节点:', Array.from(cycleNodes));
        // 移除涉及循环节点的流（保留投资额更大的）
        var flowsToRemoveForCycle = [];
        Object.keys(flowMapFinal).forEach(function (key) {
            var flow = flowMapFinal[key];
            if (cycleNodes.has(flow.investor) || cycleNodes.has(flow.destination)) {
                flowsToRemoveForCycle.push(key);
            }
        });

        // 按投资额排序，保留较大的流
        flowsToRemoveForCycle.sort(function (a, b) {
            return flowMapFinal[b].value - flowMapFinal[a].value;
        });

        // 移除一半的循环流（保留较大的）
        var removeCount = Math.ceil(flowsToRemoveForCycle.length / 2);
        for (var i = 0; i < removeCount; i++) {
            delete flowMapFinal[flowsToRemoveForCycle[i]];
        }

        console.log('已移除', removeCount, '个涉及循环的流');
    }

    console.log('flowMapFinal处理完成，数量:', Object.keys(flowMapFinal).length);

    // 先收集所有唯一的节点
    var allNodes = new Set();
    Object.values(flowMapFinal).forEach(function (flow) {
        allNodes.add(flow.investor);
        allNodes.add(flow.destination);
    });

    console.log('收集到的节点数量:', allNodes.size);
    console.log('节点列表:', Array.from(allNodes).slice(0, 10)); // 只显示前10个

    // 创建节点映射和节点数组
    // 节点显示使用缩写（国家代码），tooltip显示全称
    var nodeIndexMap = {};
    var nodeFullNameMap = {}; // 存储节点索引到全称的映射
    var allNodesArray = Array.from(allNodes);
    allNodesArray.forEach(function (code, index) {
        var fullName = (mappings.countries[code] || code) + ' (' + code + ')';
        var shortName = code; // 缩写就是国家代码
        nodeIndexMap[code] = nodeIndex;
        nodeFullNameMap[nodeIndex] = {
            code: code,
            fullName: fullName
        };
        // 为节点分配颜色
        var nodeColor = getColorByName(code, index);
        nodes.push({
            name: shortName, // 节点显示缩写
            itemStyle: {
                color: nodeColor
            }
        });
        nodeIndex++;
    });

    console.log('nodeIndexMap创建完成，映射数量:', Object.keys(nodeIndexMap).length);
    console.log('nodeIndexMap示例:', Object.keys(nodeIndexMap).slice(0, 5).reduce(function (acc, key) {
        acc[key] = nodeIndexMap[key];
        return acc;
    }, {}));

    // 创建链接（只使用处理后的单向流）
    // 同时存储链接的净流入信息，用于tooltip显示
    var linkInfoMap = {}; // 存储链接的详细信息：key为"sourceIndex-targetIndex"
    var linkCreationDebug = {
        total: 0,
        missingSource: 0,
        missingTarget: 0,
        sameIndex: 0,
        success: 0
    };

    Object.values(flowMapFinal).forEach(function (flow) {
        linkCreationDebug.total++;
        var sourceIndex = nodeIndexMap[flow.investor];
        var targetIndex = nodeIndexMap[flow.destination];

        if (sourceIndex === undefined) {
            linkCreationDebug.missingSource++;
            console.warn('缺少source节点:', flow.investor, 'flow:', flow);
            return;
        }
        if (targetIndex === undefined) {
            linkCreationDebug.missingTarget++;
            console.warn('缺少target节点:', flow.destination, 'flow:', flow);
            return;
        }
        if (sourceIndex === targetIndex) {
            linkCreationDebug.sameIndex++;
            console.warn('source和target相同:', flow.investor, flow.destination);
            return;
        }

        var linkKey = sourceIndex + '-' + targetIndex;
        links.push({
            source: sourceIndex,
            target: targetIndex,
            value: flow.value
        });

        // 存储链接信息，包括净流入值
        linkInfoMap[linkKey] = {
            sourceCode: flow.investor,
            targetCode: flow.destination,
            netFlow: flow.netFlow || flow.value
        };

        linkCreationDebug.success++;
    });

    console.log('链接创建调试信息:', linkCreationDebug);

    console.log('节点和链接创建完成:', {
        nodesCount: nodes.length,
        linksCount: links.length
    });

    // 最终验证：检查是否有循环（使用简单的双向流检测）
    var linkSet = new Set();
    var hasCycle = false;
    links.forEach(function (link) {
        var forwardKey = link.source + '->' + link.target;
        var reverseKey = link.target + '->' + link.source;

        if (linkSet.has(reverseKey)) {
            console.error('检测到循环链接:', forwardKey, reverseKey);
            hasCycle = true;
        }
        linkSet.add(forwardKey);
    });

    if (hasCycle) {
        console.warn('检测到循环，尝试移除反向链接');
        // 移除所有反向链接
        var filteredLinks = [];
        var filteredLinkInfoMap = {};
        linkSet.clear();

        links.forEach(function (link) {
            var forwardKey = link.source + '->' + link.target;
            var reverseKey = link.target + '->' + link.source;
            var linkKey = link.source + '-' + link.target;

            if (!linkSet.has(reverseKey)) {
                filteredLinks.push(link);
                if (linkInfoMap[linkKey]) {
                    filteredLinkInfoMap[linkKey] = linkInfoMap[linkKey];
                }
                linkSet.add(forwardKey);
            } else {
                console.warn('移除反向链接:', reverseKey);
            }
        });

        links = filteredLinks;
        linkInfoMap = filteredLinkInfoMap;
        console.log('移除循环后，链接数量:', links.length);
    }

    // 确保 nodes 和 links 都是有效的数组
    if (!nodes || nodes.length === 0 || !links || links.length === 0) {
        console.warn('节点或链接为空:', {
            nodes: nodes ? nodes.length : 0,
            links: links ? links.length : 0
        });
        chartInstance.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 16,
                    color: '#999'
                }
            }
        }, true);
        return;
    }

    var option = {
        tooltip: {
            trigger: 'item',
            triggerOn: 'mousemove',
            backgroundColor: 'rgba(50, 50, 50, 0.9)',
            borderColor: '#333',
            borderWidth: 1,
            textStyle: {
                color: '#fff',
                fontSize: 13
            },
            formatter: function (params) {
                if (!params) return '';

                if (params.dataType === 'edge' && params.data) {
                    // params.data.source 和 target 是节点索引
                    var sourceIndex = params.data.source;
                    var targetIndex = params.data.target;
                    var linkKey = sourceIndex + '-' + targetIndex;
                    var linkInfo = linkInfoMap[linkKey];

                    if (linkInfo) {
                        // 显示全称和净流入值
                        var sourceFullName = nodeFullNameMap[sourceIndex] ?
                            nodeFullNameMap[sourceIndex].fullName :
                            (linkInfo.sourceCode || '未知');
                        var targetFullName = nodeFullNameMap[targetIndex] ?
                            nodeFullNameMap[targetIndex].fullName :
                            (linkInfo.targetCode || '未知');
                        var netFlow = linkInfo.netFlow;

                        // 根据正负值显示不同颜色和标签
                        // netFlow > 0: target净流入（红色）
                        // netFlow < 0: target净流出（绿色）
                        var label = netFlow > 0 ? '净流入' : '净流出';
                        var color = netFlow > 0 ? '#ff4d4f' : '#52c41a'; // 正数用红色，负数用绿色
                        var displayValue = Math.abs(netFlow); // 显示绝对值

                        return '<div style="font-weight: bold; margin-bottom: 5px;">' +
                            sourceFullName + ' → ' + targetFullName + '</div>' +
                            '<div>' + targetFullName + ' ' + label + ': <span style="color: ' + color + '; font-weight: bold;">' +
                            formatNumber(displayValue) + '</span></div>';
                    } else {
                        // 如果没有链接信息，使用默认显示
                        var sourceName = nodeFullNameMap[sourceIndex] ?
                            nodeFullNameMap[sourceIndex].fullName : '未知';
                        var targetName = nodeFullNameMap[targetIndex] ?
                            nodeFullNameMap[targetIndex].fullName : '未知';
                        var value = params.data.value;
                        if (value !== undefined && value !== null) {
                            return '<div style="font-weight: bold; margin-bottom: 5px;">' +
                                sourceName + ' → ' + targetName + '</div>' +
                                '<div>投资额: <span style="color: #52c41a; font-weight: bold;">' +
                                formatNumber(value) + '</span></div>';
                        }
                    }
                }
                if (params.dataType === 'node' && params.data) {
                    // 节点tooltip显示全称
                    var nodeIndex = params.dataIndex;
                    if (nodeFullNameMap[nodeIndex]) {
                        return '<div style="font-weight: bold;">' +
                            nodeFullNameMap[nodeIndex].fullName + '</div>';
                    }
                    return params.data.name || '';
                }
                return params.name || '';
            }
        },
        series: [{
            type: 'sankey',
            layout: 'none',
            nodeAlign: 'right', // 节点右对齐，类似官方示例
            nodeGap: 8, // 节点之间的间距
            nodeWidth: 15, // 节点宽度
            draggable: true, // 允许拖拽节点
            emphasis: {
                focus: 'adjacency',
                itemStyle: {
                    borderWidth: 2,
                    borderColor: '#4a90e2'
                },
                lineStyle: {
                    opacity: 0.8,
                    curveness: 0.6
                }
            },
            data: nodes,
            links: links,
            itemStyle: {
                borderWidth: 1.5,
                borderColor: '#fff',
                shadowBlur: 5,
                shadowColor: 'rgba(0, 0, 0, 0.1)',
                opacity: 0.5
            },
            lineStyle: {
                color: 'gradient',
                curveness: 0.5,
                opacity: 0.5
            },
            label: {
                fontSize: 12,
                color: '#333',
                fontWeight: 'normal',
                position: 'right', // 标签在节点右侧
                formatter: '{b}', // 只显示节点名称
                distance: 5 // 标签与节点的距离
            },
            labelLayout: {
                hideOverlap: true // 隐藏重叠的标签
            }
        }]
    };

    chartInstance.setOption(option, true);
}

// 更新整体视图图表（显示在statChart位置）
function updateOverallViewChart(level, country, industry, year, titleId, chartInstance) {
    titleId = titleId || 'statChartTitle';
    chartInstance = chartInstance || statChart;
    year = year || null;

    if (!aamneData || !mappings) {
        console.log('数据未加载完成');
        return;
    }

    // 获取所有年份的数据
    var years = aamneData.years || [];
    if (years.length === 0) {
        $('#' + titleId).text('整体视图');
        chartInstance.setOption({}, true);
        return;
    }

    // 更新panel标题，根据是否选择了国家来显示
    // 根据titleId判断是左侧还是右侧
    var isRightColumn = (titleId === 'statChartTitle2');
    var selectedCountry = isRightColumn ? ($('#country2Select').val() || '') : ($('#countrySelect').val() || '');
    var countryName = '';
    if (selectedCountry && mappings && mappings.countries) {
        countryName = mappings.countries[selectedCountry] || selectedCountry;
    }

    if (year) {
        if (countryName) {
            $('#' + titleId).text('整体视图 - ' + year + ' (' + countryName + ')');
        } else {
            $('#' + titleId).text('整体视图 - ' + year + ' (全部)');
        }
    } else {
        if (countryName) {
            $('#' + titleId).text('整体视图 - ' + getLevelName(level) + '趋势 (' + countryName + ')');
        } else {
            $('#' + titleId).text('整体视图 - ' + getLevelName(level) + '趋势 (全部)');
        }
    }

    // 用于存储每个维度在各年份的汇总数据
    var dimensionMap = {}; // key: 维度值（投资国/目的地国/行业代码）, value: {name: 显示名称, values: [各年份的值]}
    var allDimensions = new Set();

    // 如果指定了年份，只显示该年份的数据
    if (year) {
        var yearData = getFilteredData(year, level, country, industry);
        var yearMap = {};

        yearData.items.forEach(function (item) {
            var key = '';
            var displayName = '';

            if (level === 'investor') {
                key = item.investor;
                displayName = (mappings.countries[item.investor] || item.investor) + ' (' + item.investor + ')';
            } else if (level === 'destination') {
                key = item.destination;
                displayName = (mappings.countries[item.destination] || item.destination) + ' (' + item.destination + ')';
            } else if (level === 'industry') {
                key = item.industry;
                displayName = (mappings.industries[item.industry] || item.industry) + ' (' + item.industry + ')';
            }

            if (key) {
                if (!yearMap[key]) {
                    yearMap[key] = { name: displayName, value: 0 };
                }
                yearMap[key].value += item.value;
            }
        });

        // 创建饼图显示单年份数据
        var sorted = Object.keys(yearMap).sort(function (a, b) {
            return yearMap[b].value - yearMap[a].value;
        }).slice(0, 15);

        if (sorted.length === 0) {
            var isRightColumn = (titleId === 'statChartTitle2');
            var selectedCountry = isRightColumn ? ($('#country2Select').val() || '') : ($('#countrySelect').val() || '');
            var countryName = '';
            if (selectedCountry && mappings && mappings.countries) {
                countryName = mappings.countries[selectedCountry] || selectedCountry;
                $('#' + titleId).text('整体视图 - ' + year + ' (' + countryName + ') (无数据)');
            } else {
                $('#' + titleId).text('整体视图 - ' + year + ' (全部) (无数据)');
            }
            chartInstance.setOption({
                title: {
                    text: '暂无数据',
                    left: 'center',
                    top: 'middle',
                    textStyle: {
                        fontSize: 16,
                        color: '#999'
                    }
                }
            }, true);
            return;
        }

        var option = {
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c} ({d}%)'
            },
            series: [{
                name: '投资分布',
                type: 'pie',
                radius: ['40%', '70%'],
                data: sorted.map(function (key, index) {
                    return {
                        name: yearMap[key].name,
                        value: yearMap[key].value,
                        itemStyle: {
                            color: getColorByName(key, index)
                        }
                    };
                }),
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }]
        };

        chartInstance.setOption(option, true);
        return;
    }

    // 遍历所有年份，汇总数据
    years.forEach(function (yearItem) {
        var yearData = getFilteredData(yearItem, level, country, industry);
        var yearMap = {};

        // 根据层级汇总当前年份的数据
        yearData.items.forEach(function (item) {
            var key = '';
            var displayName = '';

            if (level === 'investor') {
                key = item.investor;
                displayName = (mappings.countries[item.investor] || item.investor) + ' (' + item.investor + ')';
            } else if (level === 'destination') {
                key = item.destination;
                displayName = (mappings.countries[item.destination] || item.destination) + ' (' + item.destination + ')';
            } else if (level === 'industry') {
                key = item.industry;
                displayName = (mappings.industries[item.industry] || item.industry) + ' (' + item.industry + ')';
            }

            if (key) {
                allDimensions.add(key);
                if (!dimensionMap[key]) {
                    dimensionMap[key] = {
                        name: displayName,
                        values: new Array(years.length).fill(0)
                    };
                }
                if (!yearMap[key]) {
                    yearMap[key] = 0;
                }
                yearMap[key] += item.value;
            }
        });

        // 更新当前年份的值
        var yearIndex = years.indexOf(yearItem);
        Object.keys(yearMap).forEach(function (key) {
            dimensionMap[key].values[yearIndex] = yearMap[key];
        });
    });

    // 计算每个维度的总金额，用于排序
    var dimensionTotals = {};
    Object.keys(dimensionMap).forEach(function (key) {
        dimensionTotals[key] = dimensionMap[key].values.reduce(function (a, b) { return a + b; }, 0);
    });

    // 按总金额排序，取前15名
    var sortedDimensions = Object.keys(dimensionTotals).sort(function (a, b) {
        return dimensionTotals[b] - dimensionTotals[a];
    }).slice(0, 15);

    // 准备折线图数据，为每个类别设置不同颜色
    var series = [];
    sortedDimensions.forEach(function (key, index) {
        if (dimensionMap[key] && dimensionMap[key].values) {
            var color = getColorByName(key, index);
            series.push({
                name: dimensionMap[key].name,
                type: 'line',
                data: dimensionMap[key].values,
                smooth: true,
                itemStyle: {
                    color: color
                },
                lineStyle: {
                    color: color,
                    width: 2
                }
            });
        }
    });

    // 如果没有数据，显示空状态
    if (series.length === 0) {
        var isRightColumn = (titleId === 'statChartTitle2');
        var selectedCountry = isRightColumn ? ($('#country2Select').val() || '') : ($('#countrySelect').val() || '');
        var countryName = '';
        if (selectedCountry && mappings && mappings.countries) {
            countryName = mappings.countries[selectedCountry] || selectedCountry;
            $('#' + titleId).text('整体视图 - ' + getLevelName(level) + '趋势 (' + countryName + ') (无数据)');
        } else {
            $('#' + titleId).text('整体视图 - ' + getLevelName(level) + '趋势 (全部) (无数据)');
        }
        chartInstance.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 16,
                    color: '#999'
                }
            }
        }, true);
        return;
    }

    // 用于跟踪鼠标是否在数据点上
    var isOnDataPoint = false;
    var hoveredSeriesIndex = -1;

    // 设置图表选项
    var option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'line',
                lineStyle: {
                    type: 'dashed'
                },
                snap: true
            },
            formatter: function (params) {
                // 检查params是否有效
                if (!params || !Array.isArray(params) || params.length === 0 || !params[0]) {
                    return '';
                }

                // 如果鼠标在数据点上，只显示该点的信息
                if (isOnDataPoint && hoveredSeriesIndex >= 0 && params.length > hoveredSeriesIndex) {
                    var item = params[hoveredSeriesIndex];
                    if (item && item.value > 0) {
                        return item.seriesName + '<br/>' +
                            item.name + '年: ' + formatNumber(item.value);
                    }
                }
                // 如果鼠标在y轴上或x轴上，显示所有国家
                var result = params[0].name + '年<br/>';
                params.forEach(function (item) {
                    if (item && item.value > 0) {
                        result += item.seriesName + ': ' + formatNumber(item.value) + '<br/>';
                    }
                });
                return result;
            }
        },
        legend: {
            data: series.map(function (s) { return s.name; }),
            top: -5,
            type: 'scroll',
            orient: 'horizontal'
        },
        grid: {
            left: '3%',
            right: '4%',
            top: '15%',
            bottom: '3%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: years,
            name: '年份'
        },
        yAxis: {
            type: 'value',
            name: '投资额'
        },
        series: series
    };

    chartInstance.setOption(option, true);

    // 添加鼠标事件来检测是否在数据点上
    chartInstance.off('mousemove');
    chartInstance.off('mouseout');

    chartInstance.on('mousemove', function (params) {
        try {
            // 如果鼠标在数据点上
            if (params && params.componentType === 'series' && params.seriesType === 'line' &&
                params.seriesIndex !== undefined && params.seriesIndex !== null) {
                isOnDataPoint = true;
                hoveredSeriesIndex = params.seriesIndex;
            } else {
                isOnDataPoint = false;
                hoveredSeriesIndex = -1;
            }
        } catch (e) {
            // 忽略错误，重置状态
            isOnDataPoint = false;
            hoveredSeriesIndex = -1;
        }
    });

    chartInstance.on('mouseout', function () {
        isOnDataPoint = false;
        hoveredSeriesIndex = -1;
    });
}

// 更新对比图表
function updateCompareChart(data1, data2, level, year1, year2) {
    // 更新panel标题
    $('#compareChartTitle').text(year1 + ' vs ' + year2 + ' 对比');

    // 检查数据是否有效
    if ((!data1 || !data1.items || data1.items.length === 0) &&
        (!data2 || !data2.items || data2.items.length === 0)) {
        compareChart.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 16,
                    color: '#999'
                }
            }
        }, true);
        return;
    }

    var option = {
        tooltip: {
            trigger: 'axis'
        },
        legend: {
            data: [year1, year2],
            top: 30
        },
        xAxis: {
            type: 'category',
            data: [],
            axisLabel: { rotate: 45 }
        },
        yAxis: {
            type: 'value',
            name: '投资额'
        },
        series: [
            {
                name: year1,
                type: 'bar',
                data: []
            },
            {
                name: year2,
                type: 'bar',
                data: []
            }
        ]
    };

    // 获取两个年份的共同键
    var map1 = {};
    var map2 = {};

    data1.items.forEach(function (item) {
        var key = getKey(item, level);
        if (!map1[key]) map1[key] = 0;
        map1[key] += item.value;
    });

    data2.items.forEach(function (item) {
        var key = getKey(item, level);
        if (!map2[key]) map2[key] = 0;
        map2[key] += item.value;
    });

    var allKeys = new Set([...Object.keys(map1), ...Object.keys(map2)]);
    var sortedKeys = Array.from(allKeys).sort(function (a, b) {
        return (map1[b] || 0) + (map2[b] || 0) - (map1[a] || 0) - (map2[a] || 0);
    }).slice(0, 15);

    if (sortedKeys.length === 0) {
        compareChart.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 16,
                    color: '#999'
                }
            }
        }, true);
        return;
    }

    option.xAxis.data = sortedKeys;
    option.series[0].data = sortedKeys.map(function (key) { return map1[key] || 0; });
    option.series[1].data = sortedKeys.map(function (key) { return map2[key] || 0; });

    compareChart.setOption(option, true);
}

// 获取数据项的键
function getKey(item, level) {
    if (level === 'investor') {
        return (mappings.countries[item.investor] || item.investor) + ' (' + item.investor + ')';
    } else if (level === 'destination') {
        return (mappings.countries[item.destination] || item.destination) + ' (' + item.destination + ')';
    } else if (level === 'industry') {
        return (mappings.industries[item.industry] || item.industry) + ' (' + item.industry + ')';
    } else {
        return item.investor + ' -> ' + item.destination;
    }
}

// 更新数据表格
function updateDataTable(data, level, tableId) {
    tableId = tableId || 'dataTable';
    var table = $('<table>');
    var thead = $('<thead>');
    var tbody = $('<tbody>');

    // 表头
    var headerRow = $('<tr>');
    if (level === 'investor') {
        headerRow.append($('<th>').text('投资国'));
        headerRow.append($('<th>').text('投资总额'));
        headerRow.append($('<th>').text('占比'));
    } else if (level === 'destination') {
        headerRow.append($('<th>').text('目的地国'));
        headerRow.append($('<th>').text('投资总额'));
        headerRow.append($('<th>').text('占比'));
    } else if (level === 'industry') {
        headerRow.append($('<th>').text('行业'));
        headerRow.append($('<th>').text('投资总额'));
        headerRow.append($('<th>').text('占比'));
    } else {
        headerRow.append($('<th>').text('投资国'));
        headerRow.append($('<th>').text('目的地国'));
        headerRow.append($('<th>').text('行业'));
        headerRow.append($('<th>').text('投资额'));
    }
    thead.append(headerRow);

    // 数据行
    var map = {};
    data.items.forEach(function (item) {
        var key = '';
        var displayKey = '';

        if (level === 'investor') {
            key = item.investor;
            displayKey = (mappings.countries[item.investor] || item.investor) + ' (' + item.investor + ')';
        } else if (level === 'destination') {
            key = item.destination;
            displayKey = (mappings.countries[item.destination] || item.destination) + ' (' + item.destination + ')';
        } else if (level === 'industry') {
            key = item.industry;
            displayKey = (mappings.industries[item.industry] || item.industry) + ' (' + item.industry + ')';
        } else {
            // 显示所有详细信息
            var row = $('<tr>');
            row.append($('<td>').text((mappings.countries[item.investor] || item.investor) + ' (' + item.investor + ')'));
            row.append($('<td>').text((mappings.countries[item.destination] || item.destination) + ' (' + item.destination + ')'));
            row.append($('<td>').text((mappings.industries[item.industry] || item.industry) + ' (' + item.industry + ')'));
            row.append($('<td>').text(formatNumber(item.value)));
            tbody.append(row);
        }

        if (key) {
            if (!map[key]) {
                map[key] = { name: displayKey, value: 0 };
            }
            map[key].value += item.value;
        }
    });

    if (Object.keys(map).length > 0) {
        var sorted = Object.keys(map).sort(function (a, b) {
            return map[b].value - map[a].value;
        }).slice(0, 50); // 显示前50条

        sorted.forEach(function (key) {
            var row = $('<tr>');
            row.append($('<td>').text(map[key].name));
            row.append($('<td>').text(formatNumber(map[key].value)));
            row.append($('<td>').text((map[key].value / data.total * 100).toFixed(2) + '%'));
            tbody.append(row);
        });
    }

    table.append(thead).append(tbody);
    $('#' + tableId).empty().append(table);
}

// 颜色调色板 - 使用丰富的颜色
var colorPalette = [
    '#4a90e2', '#52c41a', '#ff7875', '#faad14', '#722ed1',
    '#13c2c2', '#eb2f96', '#2f54eb', '#fa8c16', '#52c41a',
    '#f5222d', '#1890ff', '#722ed1', '#13c2c2', '#faad14',
    '#2f54eb', '#eb2f96', '#fa8c16', '#52c41a', '#4a90e2',
    '#ff7875', '#13c2c2', '#722ed1', '#faad14', '#2f54eb',
    '#eb2f96', '#fa8c16', '#52c41a', '#4a90e2', '#ff7875'
];

// 根据名称获取颜色
function getColorByName(name, index) {
    if (index !== undefined && index !== null) {
        return colorPalette[index % colorPalette.length];
    }
    // 根据名称生成一个稳定的索引
    var hash = 0;
    if (name) {
        for (var i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
    }
    return colorPalette[Math.abs(hash) % colorPalette.length];
}

// 格式化数字
function formatNumber(num) {
    // 处理 undefined、null 或非数字的情况
    if (num === undefined || num === null || isNaN(num)) {
        return '0.00';
    }

    // 确保是数字类型
    num = Number(num);

    if (isNaN(num)) {
        return '0.00';
    }

    if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
    }
    return num.toFixed(2);
}

// 单时间点视图（增强版，支持地图和Sankey）
function updateSingleTimeView(year, level, country, industry, chartType) {
    // 根据层级和筛选条件获取数据
    var data = getFilteredData(year, level, country, industry);

    // 根据图表类型更新主图表
    if (chartType === 'map') {
        updateMapChart(data, level, year, country);
    } else if (chartType === 'sankey') {
        updateSankeyChart(data, level, year);
    } else if (chartType === 'pie') {
        updatePieChartInMain(data, level, year);
    } else {
        updateMainChart(data, level, year);
    }

    // 更新详细图表（投资流向图）- 只受年份和国家影响
    var detailData = getDataByYearAndCountry(year, country);
    updateDetailChart(detailData, level);

    // 更新整体视图图表
    updateOverallViewChart(level, country, industry);

    // 更新数据表格
    updateDataTable(data, level);

    // 更新网络关系图 - 只受年份和国家影响
    var networkData = getDataByYearAndCountry(year, country);
    updateNetworkChart(networkData, level, year);
}

// 更新地图图表
function updateMapChart(data, level, year, selectedCountry, chartInstance, titleId) {
    chartInstance = chartInstance || mainChart;
    titleId = titleId || 'mainChartTitle';
    if (!worldJsonData) {
        console.error('世界地图数据未加载');
        return;
    }

    // 检查数据是否有效
    if (!data || !data.items || data.items.length === 0) {
        $('#' + titleId).text('投资分布 - ' + year + ' (无数据)');
        chartInstance.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 16,
                    color: '#999'
                }
            }
        }, true);
        return;
    }

    // 准备地图数据
    var mapData = [];
    var maxValue = 0;

    // 根据层级组织数据
    var countryMap = {};

    if (level === 'destination') {
        // 按目的地国汇总
        data.items.forEach(function (item) {
            if (!countryMap[item.destination]) {
                countryMap[item.destination] = 0;
            }
            countryMap[item.destination] += item.value;
        });
    } else if (level === 'investor') {
        // 按投资国汇总
        data.items.forEach(function (item) {
            if (!countryMap[item.investor]) {
                countryMap[item.investor] = 0;
            }
            countryMap[item.investor] += item.value;
        });
    }

    // 转换为地图数据格式
    for (var code in countryMap) {
        var value = countryMap[code];
        if (value > 0) {
            maxValue = Math.max(maxValue, value);

            // 尝试找到对应的中文国家名
            var countryName = mappings.countries[code] || code;
            var chineseName = getChineseCountryName(countryName);

            mapData.push({
                name: chineseName || countryName,
                value: value,
                code: code
            });
        }
    }

    // 如果没有数据，显示空状态
    if (mapData.length === 0) {
        $('#' + titleId).text('投资分布 - ' + year + ' (无数据)');
        chartInstance.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 16,
                    color: '#999'
                }
            }
        }, true);
        return;
    }

    // 更新panel标题
    var countryName = '';
    if (selectedCountry && mappings && mappings.countries) {
        countryName = mappings.countries[selectedCountry] || selectedCountry;
        $('#' + titleId).text('投资分布 - ' + year + ' (' + countryName + ')');
    } else {
        $('#' + titleId).text('投资分布 - ' + year);
    }

    var option = {
        tooltip: {
            trigger: 'item',
            formatter: function (params) {
                if (params && params.data) {
                    var code = params.data.code || '';
                    var countryName = mappings.countries[code] || code;
                    var value = params.data.value;
                    return countryName + ' (' + code + ')<br/>' +
                        '投资额: ' + formatNumber(value);
                }
                var value = params && params.value !== undefined ? params.value : 0;
                var name = params && params.name ? params.name : '未知';
                return name + ': ' + formatNumber(value);
            }
        },
        visualMap: {
            min: 0,
            max: maxValue,
            left: 'left',
            top: 'bottom',
            text: ['高', '低'],
            calculable: true,
            inRange: {
                color: ['#e0f3ff', '#0066cc']
            }
        },
        series: [{
            name: '投资数据',
            type: 'map',
            map: 'world',
            roam: true,
            emphasis: {
                label: {
                    show: true
                }
            },
            data: mapData
        }]
    };

    chartInstance.setOption(option, true);

    // 添加点击事件实现下钻
    chartInstance.off('click');
    chartInstance.on('click', function (params) {
        if (params.data && params.data.code) {
            drillDownToCountry(params.data.code, level, year);
        }
    });
}

// 更新Sankey流向图
function updateSankeyChart(data, level, year) {
    // 准备Sankey数据
    var nodes = [];
    var links = [];
    var nodeMap = {};
    var nodeIndex = 0;

    // 检查数据是否有效
    if (!data || !data.items || data.items.length === 0) {
        $('#mainChartTitle').text('投资流向图 - ' + year + ' (无数据)');
        mainChart.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 16,
                    color: '#999'
                }
            }
        }, true);
        return;
    }

    // 限制数据量，只显示前20个最大的流向
    var flowMap = {};
    data.items.forEach(function (item) {
        var key = item.investor + '|' + item.destination;
        if (!flowMap[key]) {
            flowMap[key] = {
                investor: item.investor,
                destination: item.destination,
                value: 0
            };
        }
        flowMap[key].value += item.value;
    });

    var sortedFlows = Object.values(flowMap).sort(function (a, b) {
        return b.value - a.value;
    }).slice(0, 20);

    // 如果没有数据，显示空状态
    if (sortedFlows.length === 0) {
        $('#mainChartTitle').text('投资流向图 - ' + year + ' (无数据)');
        mainChart.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 16,
                    color: '#999'
                }
            }
        }, true);
        return;
    }

    // 创建节点
    sortedFlows.forEach(function (flow) {
        var invName = (mappings.countries[flow.investor] || flow.investor) + ' (' + flow.investor + ')';
        var destName = (mappings.countries[flow.destination] || flow.destination) + ' (' + flow.destination + ')';

        if (!nodeMap[flow.investor]) {
            nodeMap[flow.investor] = nodeIndex++;
            nodes.push({ name: invName });
        }
        if (!nodeMap[flow.destination]) {
            nodeMap[flow.destination] = nodeIndex++;
            nodes.push({ name: destName });
        }

        links.push({
            source: nodeMap[flow.investor],
            target: nodeMap[flow.destination],
            value: flow.value
        });
    });

    // 更新panel标题
    $('#mainChartTitle').text('投资流向图 - ' + year);

    // 创建节点名称映射，用于tooltip显示
    var nodeNameMap = {};
    nodes.forEach(function (node, index) {
        nodeNameMap[index] = node.name;
    });

    var option = {
        tooltip: {
            trigger: 'item',
            triggerOn: 'mousemove',
            formatter: function (params) {
                if (params && params.dataType === 'edge' && params.data) {
                    // params.data.source 和 target 是节点索引
                    var sourceName = nodeNameMap[params.data.source] || '未知';
                    var targetName = nodeNameMap[params.data.target] || '未知';
                    var value = params.data.value;
                    return sourceName + ' → ' + targetName + '<br/>' +
                        '投资额: ' + formatNumber(value);
                }
                return params ? (params.name || '') : '';
            }
        },
        series: [{
            type: 'sankey',
            layout: 'none',
            emphasis: {
                focus: 'adjacency'
            },
            data: nodes,
            links: links,
            lineStyle: {
                color: 'gradient',
                curveness: 0.5
            }
        }]
    };

    mainChart.setOption(option, true);
}

// 两国对比功能
function updateTwoCountryCompare(year, country1, country2, industry) {
    // 获取两国之间的投资数据
    var data1to2 = getBilateralData(year, country1, country2, industry); // 国家1到国家2
    var data2to1 = getBilateralData(year, country2, country1, industry); // 国家2到国家1

    // 更新主图表显示两国对比
    // 更新panel标题
    $('#mainChartTitle').text(mappings.countries[country1] + ' vs ' + mappings.countries[country2] + ' - ' + year);

    var option = {
        tooltip: {
            trigger: 'axis'
        },
        legend: {
            data: [country1 + ' → ' + country2, country2 + ' → ' + country1],
            top: 30
        },
        xAxis: {
            type: 'category',
            data: [],
            axisLabel: { rotate: 45 }
        },
        yAxis: {
            type: 'value',
            name: '投资额'
        },
        series: [
            {
                name: country1 + ' → ' + country2,
                type: 'bar',
                data: [],
                itemStyle: { color: '#4a90e2' }
            },
            {
                name: country2 + ' → ' + country1,
                type: 'bar',
                data: [],
                itemStyle: { color: '#52c41a' }
            }
        ]
    };

    // 按行业组织数据
    var industryMap1to2 = {};
    var industryMap2to1 = {};

    data1to2.items.forEach(function (item) {
        if (!industryMap1to2[item.industry]) {
            industryMap1to2[item.industry] = 0;
        }
        industryMap1to2[item.industry] += item.value;
    });

    data2to1.items.forEach(function (item) {
        if (!industryMap2to1[item.industry]) {
            industryMap2to1[item.industry] = 0;
        }
        industryMap2to1[item.industry] += item.value;
    });

    var allIndustries = new Set([...Object.keys(industryMap1to2), ...Object.keys(industryMap2to1)]);
    var sortedIndustries = Array.from(allIndustries).sort(function (a, b) {
        return (industryMap1to2[b] || 0) + (industryMap2to1[b] || 0) -
            (industryMap1to2[a] || 0) - (industryMap2to1[a] || 0);
    });

    if (sortedIndustries.length === 0) {
        $('#mainChartTitle').text(mappings.countries[country1] + ' vs ' + mappings.countries[country2] + ' - ' + year + ' (无数据)');
        mainChart.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 16,
                    color: '#999'
                }
            }
        }, true);
        return;
    }

    option.xAxis.data = sortedIndustries.map(function (code) {
        return (mappings.industries[code] || code) + ' (' + code + ')';
    });

    option.series[0].data = sortedIndustries.map(function (code) {
        return industryMap1to2[code] || 0;
    });

    option.series[1].data = sortedIndustries.map(function (code) {
        return industryMap2to1[code] || 0;
    });

    mainChart.setOption(option, true);

    // 更新详细图表显示行业分布
    var pieData = [];
    sortedIndustries.forEach(function (code) {
        var total = (industryMap1to2[code] || 0) + (industryMap2to1[code] || 0);
        if (total > 0) {
            pieData.push({
                name: (mappings.industries[code] || code) + ' (' + code + ')',
                value: total
            });
        }
    });

    // 更新panel标题
    $('#detailChartTitle').text('行业投资分布');

    var pieOption = {
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} ({d}%)'
        },
        series: [{
            name: '行业分布',
            type: 'pie',
            radius: ['40%', '70%'],
            data: pieData,
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowOffsetX: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }]
    };

    // 检查饼图数据是否为空
    if (pieData.length === 0) {
        detailChart.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 16,
                    color: '#999'
                }
            }
        }, true);
    } else {
        detailChart.setOption(pieOption, true);
    }

    // 更新统计信息
    var total1to2 = data1to2.total;
    var total2to1 = data2to1.total;

    // 更新panel标题
    $('#statChartTitle').text('投资统计');

    var statOption = {
        tooltip: {
            trigger: 'axis'
        },
        xAxis: {
            type: 'category',
            data: [country1 + ' → ' + country2, country2 + ' → ' + country1, '总计']
        },
        yAxis: {
            type: 'value'
        },
        series: [{
            name: '投资额',
            type: 'bar',
            data: [total1to2 || 0, total2to1 || 0, (total1to2 || 0) + (total2to1 || 0)],
            itemStyle: {
                color: function (params) {
                    if (!params || params.dataIndex === undefined || params.dataIndex === null) {
                        return '#4a90e2';
                    }
                    var colors = ['#4a90e2', '#52c41a', '#ff7875'];
                    return colors[params.dataIndex] || '#4a90e2';
                }
            }
        }]
    };

    statChart.setOption(statOption, true);

    // 更新数据表格
    var table = $('<table>');
    var thead = $('<thead>');
    var tbody = $('<tbody>');

    thead.append($('<tr>').append(
        $('<th>').text('行业'),
        $('<th>').text(country1 + ' → ' + country2),
        $('<th>').text(country2 + ' → ' + country1),
        $('<th>').text('总计')
    ));

    sortedIndustries.forEach(function (code) {
        var val1 = industryMap1to2[code] || 0;
        var val2 = industryMap2to1[code] || 0;
        var total = val1 + val2;

        if (total > 0) {
            var row = $('<tr>');
            row.append($('<td>').text((mappings.industries[code] || code) + ' (' + code + ')'));
            row.append($('<td>').text(formatNumber(val1)));
            row.append($('<td>').text(formatNumber(val2)));
            row.append($('<td>').text(formatNumber(total)));
            tbody.append(row);
        }
    });

    table.append(thead).append(tbody);
    $('#dataTable').empty().append(table);
}

// 获取两国之间的双边数据
function getBilateralData(year, investor, destination, industry) {
    if (!aamneData.data[year]) {
        return { items: [], total: 0 };
    }

    var result = [];
    var total = 0;

    var yearData = aamneData.data[year];
    if (yearData[destination]) {
        var destData = yearData[destination];

        for (var ind in destData) {
            if (industry && ind !== industry) continue;

            var indData = destData[ind];
            if (indData[investor]) {
                var value = indData[investor];
                if (value > 0) {
                    total += value;
                    result.push({
                        destination: destination,
                        industry: ind,
                        investor: investor,
                        value: value
                    });
                }
            }
        }
    }

    return { items: result, total: total };
}

// 下钻到特定国家
function drillDownToCountry(countryCode, level, year) {
    // 保存下钻历史
    drillDownHistory.push({
        country: countryCode,
        level: level,
        year: year
    });

    // 更新国家选择器
    $('#countrySelect').val(countryCode);

    // 更新视图
    if (level === 'destination') {
        $('#viewLevel').val('investor');
    } else {
        $('#viewLevel').val('destination');
    }

    updateVisualization();
}

// 获取中文国家名
function getChineseCountryName(englishName) {
    if (!countryNameMap) return null;

    // 直接查找
    if (countryNameMap[englishName]) {
        return countryNameMap[englishName];
    }

    // 尝试部分匹配
    for (var key in countryNameMap) {
        if (key.indexOf(englishName) !== -1 || englishName.indexOf(key) !== -1) {
            return countryNameMap[key];
        }
    }

    return null;
}

// 获取层级名称
function getLevelName(level) {
    var levelNames = {
        'investor': '投资国',
        'destination': '目的地国',
        'industry': '行业'
    };
    return levelNames[level] || level;
}

// 更新网络关系图
function updateNetworkChart(data, level, year, chartInstance, titleId, layoutSelectId, edgeLimitSelectId, bidirectionalCheckId) {
    chartInstance = chartInstance || networkChart;
    titleId = titleId || 'networkChartTitle';
    layoutSelectId = layoutSelectId || 'networkLayout';
    edgeLimitSelectId = edgeLimitSelectId || 'edgeLimit';
    bidirectionalCheckId = bidirectionalCheckId || 'showBidirectional';

    if (!chartInstance) {
        console.warn('网络关系图未初始化');
        return;
    }

    // 检查数据是否有效
    if (!data || !data.items || data.items.length === 0) {
        var viewMode = $('#viewMode').val();
        $('#' + titleId).text('国家间投资关系网络图 - ' + year + ' (无数据)');
        chartInstance.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 16,
                    color: '#999'
                }
            }
        }, true);
        return;
    }

    // 获取布局类型、是否显示双向和边的数量限制
    var layoutType = $('#' + layoutSelectId).val() || 'force';
    var showBidirectional = $('#' + bidirectionalCheckId).is(':checked');
    var edgeLimit = parseInt($('#' + edgeLimitSelectId).val()) || 0; // 0表示显示全部

    // 获取选择的国家，根据titleId判断是左侧还是右侧
    var isRightColumn = (titleId === 'networkChartTitle2');
    var selectedCountry = isRightColumn ? ($('#country2Select').val() || '') : ($('#countrySelect').val() || '');

    // 构建国家间的投资关系数据
    var flowMap = {}; // 存储双向流动数据
    var countrySet = new Set();

    // 如果选择了国家，只处理与该国家相关的数据项
    data.items.forEach(function (item) {
        var investor = item.investor;
        var destination = item.destination;
        var value = item.value || 0;

        if (value <= 0) return;

        // 如果选择了国家，只保留与该国家相关的流动关系
        if (selectedCountry) {
            if (investor !== selectedCountry && destination !== selectedCountry) {
                return; // 跳过不相关的数据项
            }
        }
        // 跳过自循环
        if (investor === destination) {
            return;
        }

        countrySet.add(investor);
        countrySet.add(destination);

        // 存储正向流动 (investor -> destination)
        var key1 = investor + '|' + destination;
        if (!flowMap[key1]) {
            flowMap[key1] = {
                from: investor,
                to: destination,
                value: 0
            };
        }
        flowMap[key1].value += value;
    });

    // 构建节点数据
    var nodes = [];
    var nodeMap = {};
    var nodeIndex = 0;

    countrySet.forEach(function (countryCode) {
        var countryName = (mappings && mappings.countries && mappings.countries[countryCode])
            ? mappings.countries[countryCode]
            : countryCode;

        nodeMap[countryCode] = nodeIndex;
        nodes.push({
            id: nodeIndex,
            name: countryName,
            value: 0, // 可以计算总流入或流出
            symbolSize: 30,
            category: 0,
            itemStyle: {
                color: '#4a90e2', // 节点颜色
                borderColor: '#fff',
                borderWidth: 2,
                shadowBlur: 10,
                shadowColor: 'rgba(0, 0, 0, 0.2)'
            },
            label: {
                show: true,
                fontSize: 12,
                fontWeight: 'bold',
                color: '#333',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                padding: [4, 6],
                borderRadius: 4
            }
        });
        nodeIndex++;
    });

    // 计算每个国家的总流量（用于节点大小）
    Object.values(flowMap).forEach(function (flow) {
        if (nodes[nodeMap[flow.from]]) {
            nodes[nodeMap[flow.from]].value += flow.value;
        }
        if (nodes[nodeMap[flow.to]]) {
            nodes[nodeMap[flow.to]].value += flow.value;
        }
    });

    // 根据总流量调整节点大小和颜色
    var maxNodeValue = Math.max.apply(null, nodes.map(function (n) { return n.value || 0; }));
    if (maxNodeValue === 0) maxNodeValue = 1; // 避免除零

    // 连续颜色映射函数：从浅蓝色到深蓝色
    function getContinuousColor(ratio) {
        // 限制ratio在0-1之间
        ratio = Math.max(0, Math.min(1, ratio));

        // 起始颜色（浅蓝色）：#91d5ff (RGB: 145, 213, 255)
        // 结束颜色（深蓝色）：#1890ff (RGB: 24, 144, 255)
        var r1 = 145, g1 = 213, b1 = 255; // 浅蓝色
        var r2 = 24, g2 = 144, b2 = 255;  // 深蓝色

        // 线性插值计算RGB值
        var r = Math.round(r1 + (r2 - r1) * ratio);
        var g = Math.round(g1 + (g2 - g1) * ratio);
        var b = Math.round(b1 + (b2 - b1) * ratio);

        // 转换为十六进制颜色
        return '#' +
            ('0' + r.toString(16)).slice(-2) +
            ('0' + g.toString(16)).slice(-2) +
            ('0' + b.toString(16)).slice(-2);
    }

    nodes.forEach(function (node) {
        var size = 25 + ((node.value || 0) / maxNodeValue) * 45; // 节点大小在25-70之间
        node.symbolSize = Math.max(25, Math.min(70, size));

        // 使用连续颜色映射（流量越大颜色越深）
        var ratio = (node.value || 0) / maxNodeValue;
        node.itemStyle.color = getContinuousColor(ratio);
    });

    // 计算边的最大流量（用于边的宽度）- 使用绝对值
    var maxFlowValue = 0;
    Object.values(flowMap).forEach(function (flow) {
        var absValue = Math.abs(flow.value);
        if (absValue > maxFlowValue) {
            maxFlowValue = absValue;
        }
    });
    if (maxFlowValue === 0) maxFlowValue = 1; // 避免除零

    // 构建所有边数据（先不限制数量）
    var allLinks = [];
    var processedPairs = new Set();

    Object.values(flowMap).forEach(function (flow) {
        // 如果选择了国家，只创建与该国家相关的边
        if (selectedCountry) {
            if (flow.from !== selectedCountry && flow.to !== selectedCountry) {
                return; // 跳过不相关的流动关系
            }
        }

        var fromIndex = nodeMap[flow.from];
        var toIndex = nodeMap[flow.to];

        // 验证节点索引是否有效
        if (fromIndex === undefined || toIndex === undefined) {
            console.warn('无效的节点索引:', flow.from, flow.to, fromIndex, toIndex);
            return;
        }

        // 跳过自循环
        if (fromIndex === toIndex) {
            return;
        }

        var reverseKey = flow.to + '|' + flow.from;
        var reverseFlow = flowMap[reverseKey];

        // 检查是否应该显示这条边
        if (showBidirectional) {
            // 显示双向：如果存在反向流动，用不同颜色区分
            var pairKey = [flow.from, flow.to].sort().join('|');
            if (processedPairs.has(pairKey)) {
                return; // 已经处理过这对关系
            }
            processedPairs.add(pairKey);

            if (reverseFlow && reverseFlow.value > 0) {
                // 双向流动：创建两条边，用不同颜色
                // fromIndex -> toIndex: 从fromIndex出发，指向toIndex
                allLinks.push({
                    source: fromIndex,
                    target: toIndex,
                    value: flow.value,
                    absValue: Math.abs(flow.value), // 用于排序
                    lineStyle: {
                        color: '#52c41a', // 出度用绿色
                        width: Math.max(0.5, Math.min(5, 0.5 + (Math.abs(flow.value) / maxFlowValue) * 4.5)),
                        opacity: 0.85
                    },
                    symbol: ['none', 'arrow'], // 在目标端添加箭头
                    symbolSize: [0, 10], // 箭头大小
                    label: {
                        show: false
                    }
                });
                // toIndex -> fromIndex: 从toIndex出发，指向fromIndex
                allLinks.push({
                    source: toIndex,
                    target: fromIndex,
                    value: reverseFlow.value,
                    absValue: Math.abs(reverseFlow.value), // 用于排序
                    lineStyle: {
                        color: '#52c41a', // 出度用绿色
                        width: Math.max(0.5, Math.min(5, 0.5 + (Math.abs(reverseFlow.value) / maxFlowValue) * 4.5)),
                        opacity: 0.85,
                        curveness: 0.3 // 曲线化以区分双向
                    },
                    symbol: ['none', 'arrow'], // 在目标端添加箭头
                    symbolSize: [0, 10], // 箭头大小
                    label: {
                        show: false
                    }
                });
            } else {
                // 单向流动
                allLinks.push({
                    source: fromIndex,
                    target: toIndex,
                    value: flow.value,
                    absValue: Math.abs(flow.value), // 用于排序
                    lineStyle: {
                        color: '#52c41a', // 出度用绿色
                        width: Math.max(0.5, Math.min(5, 0.5 + (Math.abs(flow.value) / maxFlowValue) * 4.5)),
                        opacity: 0.85
                    },
                    symbol: ['none', 'arrow'], // 在目标端添加箭头
                    symbolSize: [0, 10], // 箭头大小
                    label: {
                        show: false
                    }
                });
            }
        } else {
            // 只显示净流向：如果存在反向流动，计算净流量
            var pairKey = [flow.from, flow.to].sort().join('|');
            if (processedPairs.has(pairKey)) {
                return;
            }
            processedPairs.add(pairKey);

            if (reverseFlow && reverseFlow.value > 0) {
                // 计算净流量
                var netValue = flow.value - reverseFlow.value;
                var absNetValue = Math.abs(netValue);
                if (absNetValue > 0.01) { // 忽略很小的净流量
                    var netSource = netValue > 0 ? fromIndex : toIndex;
                    var netTarget = netValue > 0 ? toIndex : fromIndex;
                    allLinks.push({
                        source: netSource,
                        target: netTarget,
                        value: absNetValue,
                        absValue: absNetValue, // 用于排序
                        lineStyle: {
                            color: '#52c41a', // 出度用绿色
                            width: Math.max(0.5, Math.min(5, 0.5 + (absNetValue / maxFlowValue) * 4.5)),
                            opacity: 0.85
                        },
                        symbol: ['none', 'arrow'], // 在目标端添加箭头
                        symbolSize: [0, 10],
                        label: {
                            show: false
                        }
                    });
                }
            } else {
                // 单向流动：从fromIndex出发（出度绿色），指向toIndex（入度红色）
                allLinks.push({
                    source: fromIndex,
                    target: toIndex,
                    value: flow.value,
                    absValue: Math.abs(flow.value), // 用于排序
                    lineStyle: {
                        color: '#52c41a', // 出度用绿色
                        width: Math.max(0.5, Math.min(5, 0.5 + (Math.abs(flow.value) / maxFlowValue) * 4.5)),
                        opacity: 0.85
                    },
                    symbol: ['none', 'arrow'], // 在目标端添加箭头
                    symbolSize: [0, 10], // 箭头大小
                    label: {
                        show: false
                    }
                });
            }
        }
    });

    // 根据流量绝对值排序，取前n条边（0表示显示全部）
    // 重要：如果选择了国家，这里的排序和限制应该只针对与该国家相关的边
    var links = allLinks;
    if (edgeLimit > 0 && allLinks.length > 0) {
        // 按流量绝对值排序（只针对当前allLinks中的边，这些边已经根据国家筛选过了）
        allLinks.sort(function (a, b) {
            return (b.absValue || Math.abs(b.value)) - (a.absValue || Math.abs(a.value));
        });
        // 取前n条（如果边数少于限制，则取全部）
        var limitCount = Math.min(edgeLimit, allLinks.length);
        var topLinks = allLinks.slice(0, limitCount);

        // var visibleNodes = new Set();
        // topLinks.forEach(function (link) {
        //     visibleNodes.add(link.source);
        //     visibleNodes.add(link.target);
        // });
        // // 只保留相关的节点
        // nodes = nodes.filter(function (node) {
        //     return visibleNodes.has(node.id);
        // });
        links = topLinks;
    }

    if (links.length === 0) {
        console.warn('没有创建任何边', {
            selectedCountry: selectedCountry,
            flowMap: flowMap,
            allLinks: allLinks,
            edgeLimit: edgeLimit
        });
    }

    // 更新标题
    $('#' + titleId).text('国家间投资关系网络图 - ' + year + ' (' + nodes.length + '个国家, ' + links.length + '条关系)');

    // 获取图表尺寸，用于计算节点位置
    // 优先使用ECharts的尺寸，如果不可用则使用DOM元素的实际尺寸
    var chartWidth = chartInstance.getWidth();
    var chartHeight = chartInstance.getHeight();

    // 如果ECharts尺寸不可用，从DOM元素获取
    if (!chartWidth || !chartHeight) {
        var chartElement = chartInstance.getDom();
        if (chartElement) {
            chartWidth = chartElement.offsetWidth || 800;
            chartHeight = chartElement.offsetHeight || 600;
        } else {
            chartWidth = 800;
            chartHeight = 600;
        }
    }

    var padding = 80; // 边距
    var availableWidth = chartWidth - padding * 2;
    var availableHeight = chartHeight - padding * 2;
    var centerX = chartWidth / 2;
    var centerY = chartHeight / 2;

    // 如果是环形布局，手动计算节点位置
    if (layoutType === 'circular') {
        // 根据可用空间计算合适的半径
        var radius = Math.min(availableWidth, availableHeight) / 2 * 0.8;
        var angleStep = (2 * Math.PI) / nodes.length;

        nodes.forEach(function (node, index) {
            var angle = index * angleStep;
            node.x = centerX + radius * Math.cos(angle);
            node.y = centerY + radius * Math.sin(angle);
            node.fixed = true; // 固定位置
        });
    } else if (layoutType === 'force') {
        // 对于力导向布局，设置初始位置让节点均匀分布
        // 计算网格布局参数
        var cols = Math.ceil(Math.sqrt(nodes.length));
        var rows = Math.ceil(nodes.length / cols);
        var cellWidth = availableWidth / cols;
        var cellHeight = availableHeight / rows;
        var startX = padding + cellWidth / 2;
        var startY = padding + cellHeight / 2;

        nodes.forEach(function (node, index) {
            var col = index % cols;
            var row = Math.floor(index / cols);
            // 设置初始位置，但允许力导向算法调整
            node.x = startX + col * cellWidth;
            node.y = startY + row * cellHeight;
            // 不固定位置，让力导向算法优化布局
            node.fixed = false;
        });
    }

    // 构建ECharts配置
    var option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(50, 50, 50, 0.9)',
            borderColor: '#333',
            borderWidth: 1,
            textStyle: {
                color: '#fff',
                fontSize: 12
            },
            formatter: function (params) {
                if (params.dataType === 'node') {
                    var node = params.data;
                    return '<div style="font-weight: bold; margin-bottom: 5px;">' + node.name + '</div>' +
                        '<div>总流量: <span style="color: #52c41a; font-weight: bold;">' + formatNumber(node.value) + '</span></div>';
                } else if (params.dataType === 'edge') {
                    var link = params.data;
                    var sourceName = nodes[link.source] ? nodes[link.source].name : '未知';
                    var targetName = nodes[link.target] ? nodes[link.target].name : '未知';
                    return '<div style="font-weight: bold; margin-bottom: 5px;">' + sourceName + ' → ' + targetName + '</div>' +
                        '<div>投资额: <span style="color: #52c41a; font-weight: bold;">' + formatNumber(link.value) + '</span></div>';
                }
                return '';
            }
        },
        legend: {
            data: [
                { name: '出度（投资流出）', itemStyle: { color: '#52c41a' } },
                { name: '入度（投资流入）', itemStyle: { color: '#ff4d4f' } }
            ],
            top: 10,
            textStyle: {
                fontSize: 12
            }
        },
        series: [{
            type: 'graph',
            layout: layoutType === 'circular' ? 'none' : layoutType,
            data: nodes,
            links: links,
            categories: [{ name: '国家' }],
            roam: true,
            label: {
                show: true,
                position: 'right',
                formatter: '{b}', // 只显示节点名称，不显示数值
                fontSize: 12,
                fontWeight: 'bold',
                color: '#333',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                padding: [4, 8],
                borderRadius: 4,
                borderColor: '#ddd',
                borderWidth: 1
            },
            labelLayout: {
                hideOverlap: true,
                moveOverlap: 'shiftX'
            },
            // 默认边样式（会被 link 上的 lineStyle 覆盖）
            lineStyle: {
                curveness: showBidirectional ? 0.3 : 0,
                width: 2,
                opacity: 0.7,
                type: 'solid'
            },
            edgeLabel: {
                show: false // 关闭边的标签显示，避免图表过于拥挤
            },
            emphasis: {
                focus: 'adjacency',
                scale: true,
                lineStyle: {
                    width: 5,
                    opacity: 1,
                    shadowBlur: 10,
                    shadowColor: 'rgba(0, 0, 0, 0.3)'
                },
                itemStyle: {
                    shadowBlur: 15,
                    shadowColor: 'rgba(0, 0, 0, 0.3)',
                    borderWidth: 3
                },
                label: {
                    fontSize: 14,
                    fontWeight: 'bold'
                }
            },
            force: layoutType === 'force' ? {
                // 根据节点数量和图表尺寸动态调整参数
                repulsion: Math.max(300, Math.min(1000, nodes.length * 25)), // 节点间的排斥力，使节点分散
                gravity: 0.15, // 重力，使节点向中心聚集，保持整体在可视区域内
                edgeLength: Math.max(80, Math.min(150, Math.min(availableWidth, availableHeight) / Math.sqrt(nodes.length))), // 边的理想长度
                layoutAnimation: true,
                friction: 0.6 // 摩擦力，使动画更平滑
            } : undefined
        }]
    };

    chartInstance.setOption(option, true);
}

// ========== 右侧列更新函数（双时间点对比模式） ==========

// 更新右侧列主图表
function updateMainChart2(data, level, year, chartType) {
    chartType = chartType || $('#chartType2').val() || 'bar';

    // 根据图表类型调用不同的更新函数
    if (chartType === 'map') {
        updateMapChart2(data, level, year, $('#country2Select').val());
        return;
    } else if (chartType === 'pie') {
        updatePieChartInMain2(data, level, year);
        return;
    }

    // 检查数据是否有效
    if (!data || !data.items || data.items.length === 0) {
        $('#mainChartTitle2').text('投资分布 - ' + year + ' (无数据)');
        mainChart2.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 16,
                    color: '#999'
                }
            }
        }, true);
        return;
    }

    var codeToFullNameMap = {};
    var selectedCountry = $('#country2Select').val() || '';
    var countryName = '';
    if (selectedCountry && mappings && mappings.countries) {
        countryName = mappings.countries[selectedCountry] || selectedCountry;
        $('#mainChartTitle2').text('投资分布 - ' + year + ' (' + countryName + ')');
    } else {
        $('#mainChartTitle2').text('投资分布 - ' + year);
    }

    var option = {
        tooltip: {
            trigger: 'axis',
            formatter: function (params) {
                if (!params || !Array.isArray(params) || params.length === 0 || !params[0]) {
                    return '';
                }
                var code = params[0].name;
                var fullName = codeToFullNameMap[code] || code;
                var result = fullName + '<br/>';
                params.forEach(function (item) {
                    if (item && item.seriesName && item.value !== undefined) {
                        result += item.seriesName + ': ' + formatNumber(item.value) + '<br/>';
                    }
                });
                return result;
            }
        },
        xAxis: {
            type: 'category',
            data: [],
            axisLabel: { rotate: 45 }
        },
        yAxis: {
            type: 'log',
            name: '投资额',
            logBase: 10,
            axisLabel: {
                formatter: function (value) {
                    if (value === 0 || value < 1) {
                        return '0';
                    } else if (value >= 1000) {
                        return (value / 1000).toFixed(0) + 'k';
                    } else {
                        return value.toString();
                    }
                }
            }
        },
        series: []
    };

    if (level === 'investor') {
        var investorMap = {};
        data.items.forEach(function (item) {
            if (!investorMap[item.investor]) {
                investorMap[item.investor] = 0;
            }
            investorMap[item.investor] += item.value;
        });

        var sorted = Object.keys(investorMap).sort(function (a, b) {
            return investorMap[b] - investorMap[a];
        }).slice(0, 15);

        if (sorted.length === 0) {
            $('#mainChartTitle2').text('投资分布 - ' + year + ' (无数据)');
            mainChart2.setOption({
                title: {
                    text: '暂无数据',
                    left: 'center',
                    top: 'middle',
                    textStyle: {
                        fontSize: 16,
                        color: '#999'
                    }
                }
            }, true);
            return;
        }

        option.xAxis.data = sorted.map(function (code) {
            var fullName = (mappings.countries[code] || code) + ' (' + code + ')';
            codeToFullNameMap[code] = fullName;
            return code;
        });

        option.series.push({
            name: '投资额',
            type: 'bar',
            data: sorted.map(function (code) {
                return investorMap[code] || 0;
            }),
            itemStyle: {
                color: '#4a90e2'
            }
        });
    } else if (level === 'destination') {
        var destMap = {};
        data.items.forEach(function (item) {
            if (!destMap[item.destination]) {
                destMap[item.destination] = 0;
            }
            destMap[item.destination] += item.value;
        });

        var sorted = Object.keys(destMap).sort(function (a, b) {
            return destMap[b] - destMap[a];
        }).slice(0, 15);

        if (sorted.length === 0) {
            $('#mainChartTitle2').text('投资分布 - ' + year + ' (无数据)');
            mainChart2.setOption({
                title: {
                    text: '暂无数据',
                    left: 'center',
                    top: 'middle',
                    textStyle: {
                        fontSize: 16,
                        color: '#999'
                    }
                }
            }, true);
            return;
        }

        option.xAxis.data = sorted.map(function (code) {
            var fullName = (mappings.countries[code] || code) + ' (' + code + ')';
            codeToFullNameMap[code] = fullName;
            return code;
        });

        option.series.push({
            name: '投资额',
            type: 'bar',
            data: sorted.map(function (code) {
                return destMap[code] || 0;
            }),
            itemStyle: {
                color: '#4a90e2'
            }
        });
    } else if (level === 'industry') {
        var indMap = {};
        data.items.forEach(function (item) {
            if (!indMap[item.industry]) {
                indMap[item.industry] = 0;
            }
            indMap[item.industry] += item.value;
        });

        var sorted = Object.keys(indMap).sort(function (a, b) {
            return indMap[b] - indMap[a];
        }).slice(0, 15);

        if (sorted.length === 0) {
            $('#mainChartTitle2').text('投资分布 - ' + year + ' (无数据)');
            mainChart2.setOption({
                title: {
                    text: '暂无数据',
                    left: 'center',
                    top: 'middle',
                    textStyle: {
                        fontSize: 16,
                        color: '#999'
                    }
                }
            }, true);
            return;
        }

        option.xAxis.data = sorted.map(function (code) {
            var fullName = (mappings.industries[code] || code) + ' (' + code + ')';
            codeToFullNameMap[code] = fullName;
            return code;
        });

        option.series.push({
            name: '投资额',
            type: 'bar',
            data: sorted.map(function (code) {
                return indMap[code] || 0;
            }),
            itemStyle: {
                color: '#4a90e2'
            }
        });
    }

    if (option.series.length > 0 && option.xAxis.data.length > 0) {
        mainChart2.setOption(option, true);
    } else {
        $('#mainChartTitle2').text('投资分布 - ' + year + ' (无数据)');
        mainChart2.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 16,
                    color: '#999'
                }
            }
        }, true);
    }
}

// 更新右侧列饼图
function updatePieChartInMain2(data, level, year) {
    $('#mainChartTitle2').text('投资分布 - ' + year);

    if (!data || !data.items || data.items.length === 0) {
        $('#mainChartTitle2').text('投资分布 - ' + year + ' (无数据)');
        mainChart2.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 16,
                    color: '#999'
                }
            }
        }, true);
        return;
    }

    var option = {
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} ({d}%)'
        },
        series: [{
            name: '投资分布',
            type: 'pie',
            radius: ['40%', '70%'],
            data: [],
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowOffsetX: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }]
    };

    var map = {};
    data.items.forEach(function (item) {
        var key = '';
        if (level === 'investor') {
            key = (mappings.countries[item.investor] || item.investor) + ' (' + item.investor + ')';
        } else if (level === 'destination') {
            key = (mappings.countries[item.destination] || item.destination) + ' (' + item.destination + ')';
        } else if (level === 'industry') {
            key = (mappings.industries[item.industry] || item.industry) + ' (' + item.industry + ')';
        } else {
            key = item.investor + ' -> ' + item.destination + ' (' + item.industry + ')';
        }

        if (!map[key]) {
            map[key] = 0;
        }
        map[key] += item.value;
    });

    var sorted = Object.keys(map).sort(function (a, b) {
        return map[b] - map[a];
    }).slice(0, 15);

    if (sorted.length === 0) {
        $('#mainChartTitle2').text('投资分布 - ' + year + ' (无数据)');
        mainChart2.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 16,
                    color: '#999'
                }
            }
        }, true);
        return;
    }

    option.series[0].data = sorted.map(function (key, index) {
        return {
            name: key,
            value: map[key] || 0,
            itemStyle: {
                color: getColorByName(key, index)
            }
        };
    });

    mainChart2.setOption(option, true);
}

// 更新右侧列地图图表（简化版，复用左侧逻辑）
function updateMapChart2(data, level, year, country) {
    // 使用mainChart2和mainChartTitle2
    var selectedCountry = $('#country2Select').val() || '';
    updateMapChart(data, level, year, selectedCountry, mainChart2, 'mainChartTitle2');
}

// 更新右侧列投资流向图表
function updateDetailChart2(data, level) {
    updateDetailChart(data, level, detailChart2, 'detailChartTitle2', 'year2');
}

// 更新右侧列整体视图
function updateOverallViewChart2(level, country, industry, year) {
    updateOverallViewChart(level, country, industry, year, 'statChartTitle2', statChart2);
}

// 更新右侧列网络关系图
function updateNetworkChart2(data, level, year) {
    updateNetworkChart(data, level, year, networkChart2, 'networkChartTitle2', 'networkLayout2', 'edgeLimit2', 'showBidirectional2');
}
