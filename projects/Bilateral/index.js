// 全局变量
var myChart = null;
var wordCloudChart = null; // 词云图表实例
var pieChart = null; // 扇形图图表实例
var streamGraphChart = null; // 流图图表实例
var bilateralData = null; // 当前加载的sheet数据
var currentSheetName = null; // 当前加载的sheet名称
var availableYears = [];
var worldJsonData = null; // 保存worldZH.json数据
var countryNameMap = null; // 保存英文到中文的映射
var chineseToEnglishMap = null; // 保存中文到英文的映射
var countryCoordinatesCache = {}; // 缓存计算好的国家坐标
var dataCache = {}; // 缓存已加载的sheet数据
var CACHE_VERSION = '2.1'; // 缓存版本号，如果数据结构改变，更新此版本号（2.0: 使用新格式, 2.1: 添加预计算的countryTotals）
var currentDataMin = 0; // 当前数据的最小值
var currentDataMax = 0; // 当前数据的最大值

// 计算多边形的加权质心（考虑面积权重）
// 这个方法计算出的位置更接近ECharts地图标签的位置
function calculateWeightedCentroid(ring) {
    if (!ring || ring.length < 3) return null;

    var x = 0, y = 0, area = 0;

    // 计算多边形的加权质心
    for (var i = 0; i < ring.length - 1; i++) {
        var p1 = ring[i];
        var p2 = ring[i + 1];

        if (Array.isArray(p1) && Array.isArray(p2) && p1.length >= 2 && p2.length >= 2) {
            var x1 = parseFloat(p1[0]) || 0;
            var y1 = parseFloat(p1[1]) || 0;
            var x2 = parseFloat(p2[0]) || 0;
            var y2 = parseFloat(p2[1]) || 0;

            // 计算三角形的面积（相对于原点）
            var cross = x1 * y2 - x2 * y1;
            area += cross;

            // 累加加权坐标
            x += (x1 + x2) * cross;
            y += (y1 + y2) * cross;
        }
    }

    if (Math.abs(area) < 1e-10) {
        // 如果面积太小，使用简单的平均值
        var sumX = 0, sumY = 0, count = 0;
        for (var j = 0; j < ring.length; j++) {
            if (Array.isArray(ring[j]) && ring[j].length >= 2) {
                sumX += parseFloat(ring[j][0]) || 0;
                sumY += parseFloat(ring[j][1]) || 0;
                count++;
            }
        }
        if (count > 0) {
            return [sumX / count, sumY / count];
        }
        return null;
    }

    // 返回加权质心
    return [x / (3 * area), y / (3 * area)];
}

// 计算多边形的中心点（质心）
// 对于Polygon类型，coordinates结构是[[[lng, lat], [lng, lat], ...]]
// 第一个数组是外环，后续数组是内环（洞），我们只使用外环计算中心点
// 使用加权质心算法，使位置更接近ECharts地图标签的位置
function calculateCentroid(coordinates) {
    if (!coordinates || coordinates.length === 0) return null;

    var centroid = null;

    // 判断coordinates的嵌套层级
    if (Array.isArray(coordinates[0])) {
        if (Array.isArray(coordinates[0][0])) {
            if (Array.isArray(coordinates[0][0][0])) {
                // MultiPolygon: [[[[lng, lat], ...]]]
                // 遍历所有多边形，使用每个多边形的外环，选择面积最大的
                var maxArea = 0;
                for (var k = 0; k < coordinates.length; k++) {
                    if (coordinates[k] && coordinates[k][0] && Array.isArray(coordinates[k][0])) {
                        var outerRing = coordinates[k][0];
                        var tempCentroid = calculateWeightedCentroid(outerRing);
                        if (tempCentroid) {
                            // 简单估算面积（使用边界框）
                            var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                            for (var m = 0; m < outerRing.length; m++) {
                                if (Array.isArray(outerRing[m]) && outerRing[m].length >= 2) {
                                    var lon = parseFloat(outerRing[m][0]) || 0;
                                    var lat = parseFloat(outerRing[m][1]) || 0;
                                    if (lon < minX) minX = lon;
                                    if (lon > maxX) maxX = lon;
                                    if (lat < minY) minY = lat;
                                    if (lat > maxY) maxY = lat;
                                }
                            }
                            var area = (maxX - minX) * (maxY - minY);
                            if (area > maxArea) {
                                maxArea = area;
                                centroid = tempCentroid;
                            }
                        }
                    }
                }
            } else {
                // Polygon: [[[lng, lat], [lng, lat], ...]]
                // 只使用外环（第一个数组）计算中心点
                var outerRing = coordinates[0];
                centroid = calculateWeightedCentroid(outerRing);
            }
        } else {
            // 简单的坐标数组: [[lng, lat], [lng, lat], ...]
            centroid = calculateWeightedCentroid(coordinates);
        }
    } else {
        // 单个坐标点（不应该出现，但为了安全处理）
        if (coordinates.length >= 2) {
            return [parseFloat(coordinates[0]) || 0, parseFloat(coordinates[1]) || 0];
        }
    }

    return centroid;
}

// 从worldZH.json中根据中文名获取国家坐标
function getCountryCoordinatesFromWorldZH(chineseName) {
    if (!worldJsonData || !worldJsonData.features) return null;

    // 在缓存中查找
    if (countryCoordinatesCache[chineseName]) {
        return countryCoordinatesCache[chineseName];
    }

    // 遍历features查找匹配的国家
    // 首先尝试精确匹配
    for (var i = 0; i < worldJsonData.features.length; i++) {
        var feature = worldJsonData.features[i];
        if (feature.properties && feature.properties.name) {
            var featureName = feature.properties.name;

            // 精确匹配
            if (featureName === chineseName) {
                var geometry = feature.geometry;
                if (geometry && geometry.coordinates) {
                    var centroid = calculateCentroid(geometry.coordinates);
                    if (centroid) {
                        // 缓存结果
                        countryCoordinatesCache[chineseName] = centroid;
                        return centroid;
                    }
                }
            }
            // 部分匹配：如果feature名称包含中文名，或中文名包含feature名称
            else if (featureName.indexOf(chineseName) !== -1 || chineseName.indexOf(featureName) !== -1) {
                var geometry = feature.geometry;
                if (geometry && geometry.coordinates) {
                    var centroid = calculateCentroid(geometry.coordinates);
                    if (centroid) {
                        // 缓存结果
                        countryCoordinatesCache[chineseName] = centroid;
                        return centroid;
                    }
                }
            }
        }
    }

    return null;
}

// 根据归一化值（0-1）计算渐变色（类似 ECharts 美国地图示例的 colormap）
function getColorFromValue(normalizedValue) {
    // 确保值在0-1范围内
    normalizedValue = Math.max(0, Math.min(1, normalizedValue));

    // 渐变色：从黄色到红色的 colormap（类似 ECharts 美国地图示例）
    // 使用更丰富的颜色渐变，从浅黄到深红
    var colors = [
        { r: 255, g: 255, b: 204 }, // #ffffcc - 浅黄
        { r: 255, g: 237, b: 160 }, // #ffeda0
        { r: 254, g: 217, b: 118 }, // #fed976
        { r: 254, g: 178, b: 76 },  // #feb24c
        { r: 253, g: 141, b: 60 },  // #fd8d3c
        { r: 252, g: 78, b: 42 },   // #fc4e2a
        { r: 227, g: 26, b: 28 },   // #e31a1c
        { r: 189, g: 0, b: 38 },    // #bd0026
        { r: 128, g: 0, b: 38 }     // #800026 - 深红
    ];

    // 根据normalizedValue在颜色数组中选择颜色
    var segment = normalizedValue * (colors.length - 1);
    var index = Math.floor(segment);
    var fraction = segment - index;

    if (index >= colors.length - 1) {
        return 'rgb(' + colors[colors.length - 1].r + ',' +
            colors[colors.length - 1].g + ',' +
            colors[colors.length - 1].b + ')';
    }

    var color1 = colors[index];
    var color2 = colors[index + 1];

    var r = Math.round(color1.r + (color2.r - color1.r) * fraction);
    var g = Math.round(color1.g + (color2.g - color1.g) * fraction);
    var b = Math.round(color1.b + (color2.b - color1.b) * fraction);

    return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// 获取国家坐标的辅助函数
// 根据英文名，通过country-name-map-zh.json映射到中文名，再从worldZH.json获取坐标
function getCountryCoordinates(countryName) {
    if (!countryNameMap || !worldJsonData) return null;

    // 在缓存中查找（使用英文名作为key）
    if (countryCoordinatesCache[countryName]) {
        return countryCoordinatesCache[countryName];
    }

    // 从映射表中获取中文名
    var chineseName = countryNameMap[countryName];
    if (!chineseName) {
        // 如果映射表中没有，尝试直接使用英文名查找
        chineseName = countryName;
    }

    // 从worldZH.json中获取坐标
    var coords = getCountryCoordinatesFromWorldZH(chineseName);
    if (coords) {
        // 缓存结果（使用英文名作为key）
        countryCoordinatesCache[countryName] = coords;
        return coords;
    }

    return null;
}

// 从localStorage加载缓存的数据
function loadFromCache(sheetName) {
    try {
        var cacheKey = 'bilateral_data_' + sheetName + '_v' + CACHE_VERSION;
        var cached = localStorage.getItem(cacheKey);
        if (cached) {
            var data = JSON.parse(cached);
            // 检查缓存是否过期（7天）
            if (data.timestamp && (Date.now() - data.timestamp < 7 * 24 * 60 * 60 * 1000)) {
                return data.data;
            }
        }
    } catch (e) {
        console.log('读取缓存失败:', e);
    }
    return null;
}

// 保存数据到localStorage
function saveToCache(sheetName, data) {
    try {
        var cacheKey = 'bilateral_data_' + sheetName + '_v' + CACHE_VERSION;
        var cacheData = {
            timestamp: Date.now(),
            data: data
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (e) {
        console.log('保存缓存失败:', e);
        // 如果存储空间不足，清理旧缓存
        if (e.name === 'QuotaExceededError') {
            clearOldCache();
        }
    }
}

// 清理旧的缓存
function clearOldCache() {
    try {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.startsWith('bilateral_data_')) {
                keys.push(key);
            }
        }
        // 删除所有相关缓存
        keys.forEach(function (key) {
            localStorage.removeItem(key);
        });
        console.log('已清理旧缓存');
    } catch (e) {
        console.log('清理缓存失败:', e);
    }
}

// 预计算每个国家每年的总值（只统计正数）
function precomputeCountryTotals(data) {
    if (!data || !data.countries || !data.years) {
        return {};
    }

    var countryTotals = {}; // 格式: { countryName: { year: totalValue, ... }, ... }
    var countries = data.countries;
    var years = data.years;

    // 初始化所有国家的年份对象
    for (var i = 0; i < countries.length; i++) {
        var countryName = countries[i].c;
        countryTotals[countryName] = {};
        for (var j = 0; j < years.length; j++) {
            countryTotals[countryName][years[j]] = 0;
        }
    }

    // 计算每个国家每年的总值（只统计正数）
    for (var i = 0; i < countries.length; i++) {
        var countryData = countries[i];
        var countryName = countryData.c;
        var dataList = countryData.d || [];

        for (var j = 0; j < dataList.length; j++) {
            var rowData = dataList[j];
            var values = rowData.v || {};

            // 遍历所有年份，只累加正数值
            for (var k = 0; k < years.length; k++) {
                var year = years[k];
                var yearValue = parseFloat(values[year]) || 0;
                // 只统计正数
                if (yearValue > 0) {
                    countryTotals[countryName][year] += yearValue;
                }
            }
        }
    }

    return countryTotals;
}

// 加载指定sheet的数据（按需加载）
function loadSheetData(sheetName, callback) {
    // 如果已经加载过，直接使用缓存
    if (dataCache[sheetName]) {
        bilateralData = dataCache[sheetName];
        currentSheetName = sheetName;
        if (callback) callback();
        return;
    }

    // 先尝试从localStorage加载
    var cachedData = loadFromCache(sheetName);
    if (cachedData) {
        bilateralData = cachedData;
        currentSheetName = sheetName;
        dataCache[sheetName] = cachedData;
        // 如果缓存的数据没有预计算的总值，则计算
        if (!bilateralData.countryTotals) {
            bilateralData.countryTotals = precomputeCountryTotals(bilateralData);
            dataCache[sheetName] = bilateralData;
            saveToCache(sheetName, bilateralData);
        }
        if (callback) callback();
        return;
    }

    // 从服务器加载
    var url = 'data/sheets/' + sheetName + '.json';
    $.getJSON(url, function (data) {
        // 直接使用新格式
        bilateralData = data;
        currentSheetName = sheetName;

        // 预计算每个国家每年的总值
        bilateralData.countryTotals = precomputeCountryTotals(bilateralData);

        dataCache[sheetName] = bilateralData;

        // 保存到缓存
        saveToCache(sheetName, bilateralData);

        if (callback) callback();
    }).fail(function () {
        console.error('加载数据失败:', url);
        bilateralData = null;
        if (callback) callback();
    });
}


// 加载所有必要的数据
$.getJSON('js/country-name-map-zh.json', function (nameMap) {
    countryNameMap = nameMap;

    // 创建中文到英文的反向映射
    chineseToEnglishMap = {};
    for (var englishName in nameMap) {
        var chineseName = nameMap[englishName];
        chineseToEnglishMap[chineseName] = englishName;
    }

    // 加载世界地图数据
    $.getJSON('js/worldZH.json', function (worldJson) {
        worldJsonData = worldJson;
        echarts.registerMap('world', worldJson);

        // 初始化图表（默认加载第一个sheet）
        initChart();
    });
});

// 创建 option 的函数
function createOption(allData) {
    // 计算 visualMap 的范围
    var visualMapMin = currentDataMin;
    var visualMapMax = currentDataMax;

    // 创建一个 mapData 的映射表，方便根据名称快速查找值
    var mapDataMap = {};
    if (allData && allData.mapData) {
        for (var i = 0; i < allData.mapData.length; i++) {
            var item = allData.mapData[i];
            if (item.name && item.value != null) {
                mapDataMap[item.name] = item.value;
            }
        }
    }


    // 根据区域名称获取 visualMap 对应的颜色
    function getVisualMapColor(regionName) {
        // 从 mapData 中查找对应的值
        var value = mapDataMap[regionName];
        if (value == null || value === undefined) {
            // 如果没有找到数据，返回默认颜色（最小值对应的颜色）
            return getColorFromValue(0);
        }

        // 计算归一化值
        var normalizedValue = 0;
        if (visualMapMax > visualMapMin) {
            normalizedValue = (value - visualMapMin) / (visualMapMax - visualMapMin);
            normalizedValue = Math.max(0, Math.min(1, normalizedValue));
        }

        // 使用与 visualMap 相同的颜色映射函数
        return getColorFromValue(normalizedValue);
    }

    return {
        backgroundColor: 'transparent', // 地图背景颜色
        title: {
            text: '资金流入流出地图', // 地图标题设置
            subtext: "", // 地图小标题设置
            sublink: "", //小标题链接
            target: "blank", //'self' 当前窗口打开，'blank' 新窗口打开
            padding: [10, 0], // 标题内边距 5  [5, 10]  [5,10,5,10]
            left: "center", // 组件离容器左侧的距离,'left', 'center', 'right','20%'
            top: "3%", // 组件离容器上侧的距离,'top', 'middle', 'bottom','20%'
            right: "auto", // 组件离容器右侧的距离,'20%'
            bottom: "auto", // 组件离容器下侧的距离,'20%'
            textStyle: {
                color: "#333", //文字颜色
                fontStyle: "normal", // italic斜体  oblique倾斜
                fontWeight: "bold", // 文字粗细bold   bolder   lighter  100 | 200 | 300 | 400...
                fontFamily: "'Microsoft YaHei', 'PingFang SC', sans-serif", // 字体系列
                fontSize: 24, // 字体大小
            },
            subtextStyle: {
                color: "#666",
                fontSize: 14,
                fontWeight: "normal"
            }
        },
        legend: { // 右下角图例
            show: false, // 是否显示
            orient: 'vertical', // 图例排列方向
            top: 'bottom', // 位置
            left: 'right', // 位置
            data: ['国家', '线路'], // 数据
            textStyle: { // 文字设置
                color: '#333'
            }
        },
        visualMap: {
            type: 'continuous',
            min: visualMapMin,
            max: visualMapMax,
            left: '15%', // 左边距 5%
            right: '5%', // 右边距 5%，这样 visualMap 会占据中间 90% 的宽度，与地图等宽
            bottom: 20,
            orient: 'horizontal', // 横向显示
            calculable: true, // 是否显示拖拽用的手柄（手柄）
            inRange: {
                color: [
                    '#ffffcc',
                    '#ffeda0',
                    '#fed976',
                    '#feb24c',
                    '#fd8d3c',
                    '#fc4e2a',
                    '#e31a1c',
                    '#bd0026',
                    '#800026'
                ]
            },
            text: ['高', '低'],
            textStyle: {
                color: '#333',
                fontSize: 12
            },
            itemWidth: 20,
            itemHeight: 500, // 增加高度使其更明显
            realtime: true,
            // 格式化显示值
            formatter: function (value) {
                if (value == visualMapMin || value == visualMapMax) {
                    return "年度资金流量总额: " + value.toFixed(2);
                }
                if (value >= 1000000) {
                    return (value / 1000000).toFixed(2) + 'M';
                } else if (value >= 1000) {
                    return (value / 1000).toFixed(2) + 'K';
                }
                return value.toFixed(2);
            },
            // 手柄样式
            handleStyle: {
                borderColor: '#333',
                borderWidth: 2
            }
        },
        geo: {
            show: true,
            map: 'world',
            roam: true,
            zlevel: 0,             // 确保在 map 系列同一层
            // 完全透明底色，仅保留轮廓
            itemStyle: {
                areaColor: 'transparent',
                borderColor: '#d0d0d0',
                borderWidth: 1
            },
            // 禁用 geo 的强调态
            emphasis: { disabled: true }
        },
        tooltip: {
            trigger: 'item',
            formatter: function (params) {
                if (params.seriesType === 'map') {
                    // 对于地图系列，显示国家信息
                    var chineseName = params.name;
                    var value = params.value || 0;
                    var formattedValue = typeof value === 'number' ? value.toFixed(2) : value;

                    return '<div style="padding: 8px;">' +
                        '<div style="font-weight: bold; margin-bottom: 4px; color: #667eea;">' + chineseName + '</div>' +
                        '<div>总资金量: <span style="color: #F58158; font-weight: bold;">' + formattedValue + '</span></div>' +
                        '</div>';
                } else if (params.seriesType === 'effectScatter') {
                    // 对于散点图，显示详细信息
                    var data = params.data;
                    var chineseName = data.chineseName || data.name;
                    var englishName = data.name;
                    var year = data.year || '';
                    // data.value 是一个数组：[经度, 纬度, 数值]
                    // data.value[0] = 经度 (longitude)
                    // data.value[1] = 纬度 (latitude)  
                    // data.value[2] = 该国家在选定年份的总数值（所有关联国家的数值绝对值之和）
                    var value = data.value ? data.value[2] : 0;

                    // 格式化数值，保留2位小数
                    var formattedValue = typeof value === 'number' ? value.toFixed(2) : value;

                    return '<div style="padding: 8px;">' +
                        '<div style="font-weight: bold; margin-bottom: 4px; color: #667eea;">' + chineseName + '</div>' +
                        '<div style="margin-bottom: 4px;">英文名: <span style="color: #666;">' + englishName + '</span></div>' +
                        '<div style="margin-bottom: 4px;">年份: <span style="color: #666;">' + year + '</span></div>' +
                        '<div>总资金量: <span style="color: #F58158; font-weight: bold;">' + formattedValue + '</span></div>' +
                        '</div>';
                } else if (params.seriesType === 'lines') {
                    // 对于线条，显示连接信息
                    var data = params.data;
                    // 获取中文名
                    var fromChineseName = countryNameMap[data.fromName] || data.fromName;
                    var toChineseName = countryNameMap[data.toName] || data.toName;
                    var formattedValue = typeof data.value === 'number' ? data.value.toFixed(2) : data.value;

                    // 根据sheetName判断是流入还是流出
                    var flowType = '流入/流出值';
                    if (currentSheetName) {
                        if (currentSheetName.indexOf('inflow') !== -1 || currentSheetName.indexOf('instock') !== -1) {
                            flowType = '流入值';
                        } else if (currentSheetName.indexOf('outflow') !== -1 || currentSheetName.indexOf('outstock') !== -1) {
                            flowType = '流出值';
                        }
                    }

                    return '<div style="padding: 8px;">' +
                        '<div style="font-weight: bold; margin-bottom: 4px; color: #667eea;">连接线</div>' +
                        '<div style="margin-bottom: 4px;">从: <span style="color: #333; font-weight: bold;">' + fromChineseName + '</span></div>' +
                        '<div style="margin-bottom: 4px;">到: <span style="color: #333; font-weight: bold;">' + toChineseName + '</span></div>' +
                        '<div>' + flowType + ': <span style="color: #333; font-weight: bold;">' + formattedValue + '</span></div>' +
                        '</div>';
                }
                return params.name;
            },
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#667eea',
            borderWidth: 1,
            textStyle: {
                color: '#333',
                fontSize: 12
            },
            padding: [8, 12]
        },
        series: [{
            name: '国家数据',
            type: 'map',
            map: 'world',
            roam: true,
            zlevel: 1,             // map 层级高于 geo，保证接收 hover
            selectedMode: false,   // 不影响点击状态
            geoIndex: 0, // 使用 geo 组件作为坐标系
            itemStyle: {
                borderColor: '#d0d0d0',
                borderWidth: 1
            },
            emphasis: {
                focus: 'self',  // 仅高亮当前区域，不触发 visualMap 的整体重绘
                itemStyle: {
                    // 不覆盖 visualMap 填充色：不写或写 undefined
                    // areaColor: undefined,
                    borderColor: '#667eea',
                    borderWidth: 2,
                    shadowBlur: 8,
                    shadowColor: 'rgba(102,126,234,0.4)'
                },
                label: {
                    show: true,
                    color: '#333',
                    fontWeight: 'bold',
                    fontSize: 12
                }
            },
            // 常态标签
            label: { show: false },
            data: allData.mapData || []
        }, {
            name: '地点',
            type: 'effectScatter', // 特效散点图
            coordinateSystem: 'geo', // 'cartesian2d'使用二维的直角坐标系。'geo'使用地理坐标系
            zlevel: 3, // 所有图形的 zlevel 值。
            rippleEffect: { //涟漪特效相关配置。
                show: false, // 禁用涟漪特效，避免显示不需要的蓝点
                brushType: 'fill', //波纹的绘制方式，可选 'stroke' 和 'fill'。'fill' 填充模式让涟漪更明显
                period: 3, // 动画的时间（秒），数值越小动画越快
                scale: 3.5, // 动画中波纹的最大缩放比例，数值越大涟漪扩散范围越大
                color: new echarts.graphic.RadialGradient(0.5, 0.5, 0.5, [
                    { offset: 0, color: 'rgba(59, 130, 246, 1.0)' }, // 中心：更鲜艳的蓝色，完全不透明
                    { offset: 0.5, color: 'rgba(59, 130, 246, 0.6)' }, // 中间：保持一定可见度
                    { offset: 1, color: 'rgba(59, 130, 246, 0.2)' } // 边缘：更明显的边缘效果
                ])
            },
            label: {
                normal: {
                    show: false,                  //是否显示标签。
                    position: "inside",          //标签的位置。// 绝对的像素值[10, 10],// 相对的百分比['50%', '50%'].'top','left','right','bottom','inside','insideLeft','insideRight','insideTop','insideBottom','insideTopLeft','insideBottomLeft','insideTopRight','insideBottomRight'
                    offset: [30, 40],             //是否对文字进行偏移。默认不偏移。例如：[30, 40] 表示文字在横向上偏移 30，纵向上偏移 40。
                    formatter: '{b}: {c}',       //标签内容格式器。模板变量有 {a}、{b}、{c}，分别表示系列名，数据名，数据值。
                },
                emphasis: {
                    show: true,
                    position: 'bottom',  // 使用相对位置'bottom'，标签显示在点的下方
                    offset: [0, 5],      // 微调偏移：[x偏移, y偏移]，正y值向下移动
                    formatter: function (params) {
                        // 显示中文名
                        return params.data.chineseName || params.data.name || params.name;
                    },
                    textStyle: {
                        color: '#333',
                        fontSize: 12,
                        fontWeight: 'bold',
                    }
                }
            },
            symbolSize: 10, // 固定圆圈大小
            itemStyle: { // 图形样式，normal 是图形在默认状态下的样式；emphasis 是图形在高亮状态下的样式，比如在鼠标悬浮或者图例联动高亮时。
                normal: {
                    // 颜色将在数据中单独设置
                    shadowBlur: 10,
                    shadowColor: 'rgba(0, 0, 0, 0.2)'
                },
                emphasis: {
                    shadowBlur: 15,
                    shadowColor: 'rgba(0, 0, 0, 0.3)'
                }
            },
            data: allData.citys
        }, {
            name: '线路',
            type: 'lines',
            coordinateSystem: 'geo', // 'cartesian2d'使用二维的直角坐标系。'geo'使用地理坐标系
            zlevel: 2,
            // 移除 large: true，因为需要为每条线设置不同的颜色
            effect: {
                show: true,
                constantSpeed: 40, // 点移动的速度
                symbol: 'circle',  // 图形 'circle', 'rect', 'roundRect', 'triangle', 'diamond', 'pin', 'arrow'
                symbolSize: 4, // 标记的大小，可以设置成诸如 10 这样单一的数字，也可以用数组分开表示宽和高，例如 [20, 10] 表示标记宽为20，高为10。
                trailLength: 0.3 // 拖尾长度，颜色将在每条线的数据中单独设置
            },
            lineStyle: { // 线的颜色、宽度，样式设置（默认值，会被每条线的 lineStyle 覆盖）
                normal: {
                    width: 1, // 线的宽度
                    opacity: 0.6, // 线的透明度
                    curveness: 0.5, // 线的弯曲程度
                    shadowBlur: 5
                },
                emphasis: {
                    width: 2.5,
                    opacity: 0.9,
                    shadowBlur: 10
                }
            },
            data: (function () {
                // 先对线条按value值排序，大数值的排在前面，这样动画会先开始
                var sortedLines = allData.moveLines.slice().sort(function (a, b) {
                    return Math.abs(b.value) - Math.abs(a.value); // 降序排列，大数值在前
                });

                // 先计算所有线条的value范围，用于速度映射
                var minValue = Infinity;
                var maxValue = -Infinity;
                for (var i = 0; i < sortedLines.length; i++) {
                    var val = Math.abs(sortedLines[i].value);
                    if (val < minValue) minValue = val;
                    if (val > maxValue) maxValue = val;
                }

                // 如果所有值相同或没有数据，使用默认速度
                if (minValue === Infinity || maxValue === -Infinity || minValue === maxValue) {
                    minValue = 0;
                    maxValue = 1;
                }

                // 速度范围：最小速度50，最大速度80（value越大，速度越快）
                var minSpeed = 30;
                var maxSpeed = 100;

                return sortedLines.map(function (line) {
                    // 根据sheetName判断是流入还是流出，设置颜色：流入红色，流出绿色
                    var isInflow = false;
                    if (currentSheetName) {
                        isInflow = currentSheetName.indexOf('inflow') !== -1 || currentSheetName.indexOf('instock') !== -1;
                    }

                    var lineColor = isInflow
                        ? 'rgba(255, 80, 80, 0.6)'  // 红色（流入）
                        : 'rgba(12, 172, 12, 0.6)'; // 绿色（流出）

                    var effectColor = isInflow
                        ? 'rgba(255, 100, 100, 0.8)'  // 红色效果（流入）
                        : 'rgba(66, 225, 66, 0.8)'; // 绿色效果（流出）

                    // 根据value计算速度：value越大，速度越快
                    var absValue = Math.abs(line.value);
                    var normalizedValue = (absValue - minValue) / (maxValue - minValue);
                    normalizedValue = Math.max(0, Math.min(1, normalizedValue)); // 确保在0-1范围内
                    var speed = minSpeed + (maxSpeed - minSpeed) * normalizedValue;

                    return {
                        fromName: line.fromName,
                        toName: line.toName,
                        coords: line.coords,
                        value: line.value,
                        lineStyle: {
                            normal: {
                                color: lineColor,
                                width: 0.3,
                                opacity: 0.3,
                                curveness: 0.5,
                                shadowBlur: 5,
                                shadowColor: isInflow ? 'rgba(255, 80, 80, 0.3)' : 'rgba(12, 172, 12, 0.3)'
                            },
                            emphasis: {
                                color: isInflow ? 'rgba(255, 120, 120, 0.9)' : 'rgba(66, 225, 66, 0.9)',
                                width: 1.5,
                                opacity: 0.9,
                                shadowBlur: 10
                            }
                        },
                        effect: {
                            show: true,
                            constantSpeed: speed, // 根据value动态计算速度
                            symbol: 'circle',
                            symbolSize: 4,
                            trailLength: 0.3,
                            color: effectColor
                        }
                    };
                });
            })()
        }]
    };
}

// 根据搜索词获取英文国家名
function getCountryNameFromSearch(searchText) {
    if (!searchText || searchText.trim() === '') {
        return null; // 空字符串表示显示所有国家
    }

    searchText = searchText.trim();

    // 首先尝试作为英文名查找
    if (countryNameMap[searchText]) {
        return searchText; // 找到英文名
    }

    // 然后尝试作为中文名查找
    if (chineseToEnglishMap && chineseToEnglishMap[searchText]) {
        return chineseToEnglishMap[searchText]; // 返回对应的英文名
    }

    // 如果都没找到，尝试部分匹配
    for (var englishName in countryNameMap) {
        var chineseName = countryNameMap[englishName];
        // 检查英文名或中文名是否包含搜索词（不区分大小写）
        if (englishName.toLowerCase().indexOf(searchText.toLowerCase()) !== -1 ||
            chineseName.indexOf(searchText) !== -1) {
            return englishName;
        }
    }

    return null; // 未找到匹配的国家
}

// 从bilateral数据生成可视化数据
function generateVisualizationData(sheetName, year, filterCountryName) {
    if (!bilateralData || !sheetName || !year) {
        return { citys: [], moveLines: [] };
    }

    var citys = [];
    var moveLines = [];
    var countries = bilateralData.countries || [];
    var countryTotals = bilateralData.countryTotals || {}; // 使用预计算的总值
    var relatedTargetCountries = new Set(); // 存储连线的目标国家（用于过滤模式）

    // 根据 sheet 类型判断连线方向
    // inflow 或 instock: 其他国家到本国 (reportingCountry -> countryName)
    // outflow 或 outstock: 本国到其他国家 (countryName -> reportingCountry)
    var isInflowType = sheetName.indexOf('inflow') !== -1 || sheetName.indexOf('instock') !== -1;

    // 如果指定了过滤国家，直接找到该国家的数据
    var relatedCountries = [];
    if (filterCountryName) {
        // 直接遍历所有国家，找到该国家的数据
        for (var i = 0; i < countries.length; i++) {
            var countryData = countries[i];
            var countryName = countryData.c;
            if (countryName === filterCountryName) {
                relatedCountries = [countryData];
                break;
            }
        }
    }

    // 遍历相关国家的数据（如果有过滤，只遍历该国家；否则遍历所有国家）
    var countriesToProcess = filterCountryName ? relatedCountries : countries;

    for (var i = 0; i < countriesToProcess.length; i++) {
        var countryData = countriesToProcess[i];
        var countryName = countryData.c;
        relatedTargetCountries.add(countryName);
        var dataList = countryData.d || [];
        var countryCoords = getCountryCoordinates(countryName);
        if (!countryCoords) continue; // 如果没有坐标，跳过

        // 遍历该国家的所有报告国家数据，创建连线
        for (var j = 0; j < dataList.length; j++) {
            var rowData = dataList[j];
            var reportingCountry = rowData.r;
            var values = rowData.v || {};
            var yearValue = parseFloat(values[year]) || 0;

            // 只在数值为正数时创建连线
            if (yearValue > 0) {
                // 获取报告国家的坐标
                var reportingCoords = getCountryCoordinates(reportingCountry);
                if (reportingCoords) {
                    // 根据 sheet 类型设置连线方向
                    var fromName, toName, fromCoords, toCoords;
                    if (isInflowType) {
                        // inflow/instock: 从其他国家到本国
                        fromName = reportingCountry;
                        toName = countryName;
                        fromCoords = reportingCoords;
                        toCoords = countryCoords;
                    } else {
                        // outflow/outstock: 从本国到其他国家
                        fromName = countryName;
                        toName = reportingCountry;
                        fromCoords = countryCoords;
                        toCoords = reportingCoords;
                    }

                    // 创建连接线
                    moveLines.push({
                        fromName: fromName,
                        toName: toName,
                        coords: [fromCoords, toCoords],
                        value: yearValue, // 保存原始数值
                        absValue: yearValue // 绝对值用于计算线宽等（因为只统计正数，所以等于原值）
                    });

                    // 如果是过滤模式，记录连线的另一端国家，也需要显示
                    if (filterCountryName) {
                        // 记录连线的另一端（reportingCountry）
                        relatedTargetCountries.add(reportingCountry);
                    }
                }
            }
        }

    }

    // 将聚合后的国家数据转换为城市点
    // 计算所有国家在选定年份的数值最大值和最小值，用于颜色映射
    var maxValue = 0;
    var minValue = Infinity;
    for (var country in countryTotals) {
        if (countryTotals[country][year] > maxValue) {
            maxValue = countryTotals[country][year];
        }
        if (countryTotals[country][year] < minValue) {
            minValue = countryTotals[country][year];
        }
    }

    // 更新全局数据范围
    currentDataMin = minValue === Infinity ? 0 : minValue;
    currentDataMax = maxValue;

    // 根据每个国家在选定年份的数值计算颜色（固定圆圈大小）
    relatedTargetCountries.forEach(function (country) {

        var countryValue = countryTotals[country][year];

        var coords = getCountryCoordinates(country);
        if (coords) {
            // 计算颜色：根据数值在min-max范围内的位置，映射到渐变色
            var normalizedValue = 0;
            if (currentDataMax > currentDataMin) {
                normalizedValue = (countryValue - currentDataMin) / (currentDataMax - currentDataMin);
            }

            // 渐变色：从黄色到红色（类似 ECharts 美国地图示例的 colormap）
            var color = getColorFromValue(normalizedValue);

            // 获取中文名
            var chineseName = countryNameMap[country] || country;

            // 判断是否是搜索选定的国家
            var isSelectedCountry = (filterCountryName && country === filterCountryName);

            // 根据sheetName判断是流入还是流出，设置边框颜色与线条颜色相同
            var borderColor = 'transparent';
            var shadowColor = 'rgba(0, 0, 0, 0.2)';
            var emphasisShadowColor = 'rgba(0, 0, 0, 0.3)';
            var rippleColor = null; // 涟漪颜色，仅对被搜索的国家设置
            if (isSelectedCountry) {
                var isInflow = sheetName.indexOf('inflow') !== -1 || sheetName.indexOf('instock') !== -1;
                if (isInflow) {
                    // 流入：红色边框，与线条颜色相同
                    borderColor = 'rgba(255, 80, 80, 1)';  // 红色（流入）
                    shadowColor = 'rgba(255, 80, 80, 0.8)';
                    emphasisShadowColor = 'rgba(255, 80, 80, 1)';
                    // 涟漪颜色：红色渐变，与边框颜色一致
                    rippleColor = new echarts.graphic.RadialGradient(0.5, 0.5, 0.5, [
                        { offset: 0, color: 'rgba(255, 80, 80, 1.0)' },
                        { offset: 0.5, color: 'rgba(255, 80, 80, 0.6)' },
                        { offset: 1, color: 'rgba(255, 80, 80, 0.2)' }
                    ]);
                } else {
                    // 流出：绿色边框，与线条颜色相同
                    borderColor = 'rgba(12, 172, 12, 1)';  // 绿色（流出）
                    shadowColor = 'rgba(12, 172, 12, 0.8)';
                    emphasisShadowColor = 'rgba(12, 172, 12, 1)';
                    // 涟漪颜色：绿色渐变，与边框颜色一致
                    rippleColor = new echarts.graphic.RadialGradient(0.5, 0.5, 0.5, [
                        { offset: 0, color: 'rgba(12, 172, 12, 1.0)' },
                        { offset: 0.5, color: 'rgba(12, 172, 12, 0.6)' },
                        { offset: 1, color: 'rgba(12, 172, 12, 0.2)' }
                    ]);
                }
            }

            var cityData = {
                name: country, // 英文名
                chineseName: chineseName, // 中文名
                year: year, // 当前年份
                value: [coords[0], coords[1], countryValue], // value[2]存储该国家在选定年份的数值
                symbolSize: isSelectedCountry ? 15 : 10, // 被搜索的国家圆圈更大更显著
                itemStyle: {
                    normal: {
                        color: color,
                        // 被搜索的国家添加显著的边框和阴影，边框颜色与线条颜色相同
                        borderColor: borderColor,
                        borderWidth: isSelectedCountry ? 4 : 0,
                        shadowBlur: isSelectedCountry ? 25 : 10,
                        shadowColor: shadowColor
                    },
                    emphasis: {
                        // 被搜索的国家在鼠标悬停时进一步增强效果
                        borderColor: isSelectedCountry ? borderColor : undefined,
                        borderWidth: isSelectedCountry ? 5 : undefined,
                        shadowBlur: isSelectedCountry ? 30 : 15,
                        shadowColor: emphasisShadowColor
                    }
                }
            };

            // 对被搜索的国家启用涟漪效果，颜色与边框颜色一致
            if (isSelectedCountry && rippleColor) {
                cityData.rippleEffect = {
                    show: true,
                    brushType: 'fill',
                    period: 3,
                    scale: 3.5,
                    color: rippleColor
                };
            }

            citys.push(cityData);
        }
    });

    // 生成地图数据（用于 map 系列和 visualMap）
    var mapData = [];
    for (var country in countryTotals) {
        var countryValue = countryTotals[country][year];

        // 获取中文名
        var chineseName = countryNameMap[country] || country;

        mapData.push({
            name: chineseName, // 使用中文名，因为 worldZH.json 中使用的是中文名
            value: countryValue
        });
    }

    return { citys: citys, moveLines: moveLines, mapData: mapData };
}

// 获取所有可用年份（从当前加载的sheet数据）
function getAvailableYears() {
    if (!bilateralData || !bilateralData.years) return [];

    // 直接从新格式的 years 字段获取
    return bilateralData.years.slice().sort(function (a, b) { return a - b; });
}

// 更新年份选择器
function updateYearSelector() {
    availableYears = getAvailableYears();
    var yearSelect = document.getElementById('yearSelect');
    yearSelect.innerHTML = '';

    for (var i = 0; i < availableYears.length; i++) {
        var option = document.createElement('option');
        option.value = availableYears[i];
        option.textContent = availableYears[i];
        yearSelect.appendChild(option);
    }

    // 默认选择1995年
    if (availableYears.indexOf(1995) !== -1) {
        yearSelect.value = '1995';
    } else if (availableYears.length > 0) {
        yearSelect.value = availableYears[0].toString();
    }
}

// 存储当前的数据，用于高亮关联线
var currentChartData = null;
var originalLineData = null; // 存储原始线条数据
var playInterval = null; // 自动播放的定时器
var isPlaying = false; // 是否正在播放
var playSpeed = 1; // 播放速度（倍数）

// 更新图表
function updateChart() {
    if (!myChart) return;

    var sheetSelect = document.getElementById('sheetSelect');
    var yearSelect = document.getElementById('yearSelect');
    var countrySearch = document.getElementById('countrySearch');

    var selectedSheet = sheetSelect.value;
    var selectedYear = yearSelect.value;
    var searchText = countrySearch ? countrySearch.value.trim() : '';

    // 更新年份显示
    var yearDisplay = document.getElementById('yearDisplay');
    if (yearDisplay) {
        yearDisplay.textContent = selectedYear;
    }

    // 如果sheet改变了，需要重新加载数据
    if (selectedSheet !== currentSheetName) {
        loadSheetData(selectedSheet, function () {
            // 数据加载完成后，更新年份选择器
            updateYearSelector();
            // 然后更新图表
            updateChartInternal(selectedYear, searchText);
        });
        return;
    }

    // 如果数据还没加载，等待加载
    if (!bilateralData) {
        loadSheetData(selectedSheet, function () {
            updateYearSelector();
            updateChartInternal(selectedYear, searchText);
        });
        return;
    }

    updateChartInternal(selectedYear, searchText);
}

// 计算每个国家在选定年份的总数值（用于扇形图）
function calculateCountryValuesForPie(sheetName, year) {
    if (!bilateralData || !sheetName || !year) {
        return {};
    }

    var countryValueMap = {};
    var countryTotals = bilateralData.countryTotals || {};
    var countries = bilateralData.countries || [];

    // 使用预计算的总值（只统计正数）
    for (var i = 0; i < countries.length; i++) {
        var countryName = countries[i].c;
        var totalValue = (countryTotals[countryName] && countryTotals[countryName][year]) || 0;

        // 只保存有数据的国家
        if (totalValue > 0) {
            countryValueMap[countryName] = totalValue;
        }
    }

    return countryValueMap;
}

// 初始化扇形图
function initPieChart() {
    if (!pieChart) {
        pieChart = echarts.init(document.getElementById('pieChart'));
    }
}

// 初始化词云图
function initWordCloudChart() {
    if (!wordCloudChart) {
        wordCloudChart = echarts.init(document.getElementById('wordCloud'));
    }
}

// 初始化流图
function initStreamGraphChart() {
    if (!streamGraphChart) {
        streamGraphChart = echarts.init(document.getElementById('streamGraph'));
    }
}

// 更新词云图
function updateWordCloudChart(sheetName, year) {
    if (!wordCloudChart || !bilateralData || !sheetName || !year) {
        return;
    }

    // 使用预计算的总值（只统计正数）
    var countryValueMap = {};
    var countryTotals = bilateralData.countryTotals || {};
    var countries = bilateralData.countries || [];

    // 使用预计算的总值
    for (var i = 0; i < countries.length; i++) {
        var countryName = countries[i].c;
        var totalValue = (countryTotals[countryName] && countryTotals[countryName][year]) || 0;

        // 只保存有数据的国家
        if (totalValue > 0) {
            countryValueMap[countryName] = totalValue;
        }
    }

    // 转换为词云数据格式
    var wordCloudData = [];
    for (var country in countryValueMap) {
        var value = countryValueMap[country];
        var chineseName = countryNameMap[country] || country;

        wordCloudData.push({
            name: chineseName,
            value: value
        });
    }

    // 按数值从大到小排序
    wordCloudData.sort(function (a, b) {
        return b.value - a.value;
    });

    // 如果没有数据，显示空图表
    if (wordCloudData.length === 0) {
        wordCloudChart.setOption({
            series: [{
                type: 'wordCloud',
                data: []
            }]
        });
        return;
    }

    // 配置词云图选项
    var wordCloudOption = {
        backgroundColor: 'transparent',
        tooltip: {
            show: true,
            trigger: 'item',
            formatter: function (params) {
                return params.name + '<br/>' +
                    '总资金量: ' + params.value.toFixed(2);
            },
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#667eea',
            borderWidth: 1,
            textStyle: {
                color: '#333',
                fontSize: 12
            }
        },
        series: [{
            type: 'wordCloud',
            shape: 'circle', // 词云形状：'circle', 'cardioid', 'diamond', 'triangle-forward', 'triangle', 'pentagon', 'star'
            gridSize: 8, // 网格大小，数值越大，词之间的间距越大
            sizeRange: [12, 60], // 字体大小范围
            rotationRange: [-90, 90], // 旋转角度范围
            rotationStep: 45, // 旋转角度步长
            textStyle: {
                fontFamily: 'Microsoft YaHei, PingFang SC, Arial, sans-serif',
                fontWeight: 'bold',
                color: function (params) {
                    // 基于数据索引生成颜色，确保颜色稳定
                    var colors = [
                        'rgba(102, 126, 234, 0.9)',
                        'rgba(118, 75, 162, 0.9)',
                        'rgba(255, 129, 88, 0.9)',
                        'rgba(80, 200, 255, 0.9)',
                        'rgba(255, 200, 80, 0.9)',
                        'rgba(102, 234, 126, 0.9)',
                        'rgba(234, 102, 126, 0.9)',
                        'rgba(234, 200, 102, 0.9)'
                    ];
                    // 使用数据索引来选择颜色，确保相同的数据项总是使用相同的颜色
                    var index = params.dataIndex || 0;
                    return colors[index % colors.length];
                }
            },
            emphasis: {
                focus: 'self',
                textStyle: {
                    shadowBlur: 10,
                    shadowColor: 'rgba(102, 126, 234, 0.8)'
                }
            },
            data: wordCloudData
        }]
    };

    wordCloudChart.setOption(wordCloudOption, true);
}

// 计算指定国家的流入/流出国家占比
function calculateCountryFlowValues(sheetName, year, filterCountryName) {
    if (!bilateralData || !sheetName || !year || !filterCountryName) {
        return {};
    }

    var countryValueMap = {};
    var countries = bilateralData.countries || [];
    var isInflowType = sheetName.indexOf('inflow') !== -1 || sheetName.indexOf('instock') !== -1;

    // 找到指定国家的数据
    for (var i = 0; i < countries.length; i++) {
        var countryData = countries[i];
        var countryName = countryData.c;

        if (countryName === filterCountryName) {
            var dataList = countryData.d || [];

            // 遍历该国家的所有报告国家数据
            for (var j = 0; j < dataList.length; j++) {
                var rowData = dataList[j];
                var reportingCountry = rowData.r;
                var values = rowData.v || {};
                var yearValue = parseFloat(values[year]) || 0;

                // 只统计正数
                if (yearValue > 0) {
                    // 根据sheet类型确定显示的国家
                    // inflow/instock: 显示来源国（reportingCountry）
                    // outflow/outstock: 显示目标国（reportingCountry）
                    var displayCountry = reportingCountry;

                    if (!countryValueMap[displayCountry]) {
                        countryValueMap[displayCountry] = 0;
                    }
                    countryValueMap[displayCountry] += yearValue;
                }
            }
            break;
        }
    }

    return countryValueMap;
}

// 更新扇形图
function updatePieChart(sheetName, year, filterCountryName) {
    if (!pieChart || !bilateralData || !sheetName || !year) {
        return;
    }

    var countryValueMap = {};
    var chartTitle = '国家占比';

    var isInflowType = sheetName.indexOf('inflow') !== -1 || sheetName.indexOf('instock') !== -1;
    // 如果指定了搜索国家，显示该国家的流入/流出国家占比
    if (filterCountryName) {
        countryValueMap = calculateCountryFlowValues(sheetName, year, filterCountryName);

        // 根据sheet类型设置标题
        var searchedCountryName = countryNameMap[filterCountryName] || filterCountryName;
        chartTitle = isInflowType
            ? searchedCountryName + ' 资金流入来源国占比'
            : searchedCountryName + ' 资金流出目标国占比';
    } else {
        // 没有搜索国家时，显示所有国家的总占比
        countryValueMap = calculateCountryValuesForPie(sheetName, year);
        chartTitle = '国家资金流量占比情况（前10名）';
    }

    // 更新HTML中的pie-title元素
    var pieTitleElement = document.querySelector('.pie-title');
    if (pieTitleElement) {
        pieTitleElement.textContent = chartTitle;
    }

    // 计算总和
    var totalSum = 0;
    for (var country in countryValueMap) {
        totalSum += countryValueMap[country];
    }

    if (totalSum === 0) {
        // 如果没有数据，显示空图表
        pieChart.setOption({
            series: [{
                type: 'pie',
                data: []
            }]
        });
        return;
    }

    // 转换为扇形图数据格式，计算占比
    var pieData = [];
    for (var country in countryValueMap) {
        var value = countryValueMap[country];
        var percentage = (value / totalSum) * 100;
        var chineseName = countryNameMap[country] || country;

        pieData.push({
            name: chineseName,
            value: value,
            percentage: percentage
        });
    }

    // 按数值从大到小排序
    pieData.sort(function (a, b) {
        return b.value - a.value;
    });

    // 只取前10个国家
    pieData = pieData.slice(0, 10);

    // 保留所有国家的总和，用于计算真实占比
    // totalSum 已经在前面计算过了，包含所有国家的总和
    // 使用 totalSum 作为分母计算真实占比
    for (var i = 0; i < pieData.length; i++) {
        pieData[i].percentage = (pieData[i].value / totalSum) * 100;
    }

    // 配置扇形图选项
    var pieOption = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            formatter: function (params) {
                // 显示真实占比（基于所有国家的总和）
                var realPercentage = params.data.percentage || 0;
                return params.name + '<br/>' +
                    (isInflowType ? '流入资金量: ' : '流出资金量: ') + params.value.toFixed(2) + '<br/>' +
                    '占比: ' + realPercentage.toFixed(2) + '%';
            },
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#667eea',
            borderWidth: 1,
            textStyle: {
                color: '#333',
                fontSize: 12
            }
        },
        legend: {
            show: false // 不显示legend
        },
        series: [{
            name: chartTitle,
            type: 'pie',
            radius: ['20%', '70%'], // 内半径和外半径，形成环形
            center: ['50%', '50%'],
            roseType: 'area', // 玫瑰图类型：'area' 表示面积模式
            itemStyle: {
                borderRadius: 4,
                borderColor: 'transparent',
                borderWidth: 0,
                color: function (params) {
                    // 使用渐变色，根据数据索引生成不同颜色
                    var colors = [
                        new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(102, 126, 234, 0.9)' },
                            { offset: 1, color: 'rgba(102, 126, 234, 0.5)' }
                        ]),
                        new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(118, 75, 162, 0.9)' },
                            { offset: 1, color: 'rgba(118, 75, 162, 0.5)' }
                        ]),
                        new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(255, 129, 88, 0.9)' },
                            { offset: 1, color: 'rgba(255, 129, 88, 0.5)' }
                        ]),
                        new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(80, 200, 255, 0.9)' },
                            { offset: 1, color: 'rgba(80, 200, 255, 0.5)' }
                        ]),
                        new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(255, 200, 80, 0.9)' },
                            { offset: 1, color: 'rgba(255, 200, 80, 0.5)' }
                        ])
                    ];
                    return colors[params.dataIndex % colors.length];
                }
            },
            label: {
                show: true,
                formatter: function (params) {
                    // 显示真实占比（基于所有国家的总和）
                    // params.data.percentage 是相对于所有国家的真实占比
                    var realPercentage = params.data.percentage || 0;
                    if (realPercentage > 0) {
                        return params.name + '\n' + realPercentage.toFixed(2) + '%';
                    }
                    return '';
                },
                fontSize: 11,
                color: '#333',
                fontWeight: 'bold'
            },
            labelLine: {
                show: true,
                length: 15,
                length2: 10,
                lineStyle: {
                    color: '#999'
                }
            },
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowOffsetX: 0,
                    shadowColor: 'rgba(102, 126, 234, 0.5)'
                },
                label: {
                    fontSize: 13,
                    fontWeight: 'bold'
                }
            },
            data: pieData
        }]
    };

    pieChart.setOption(pieOption, true);
}

// 更新流图
function updateStreamGraphChart(sheetName, selectedYear) {
    if (!streamGraphChart || !bilateralData || !sheetName) {
        return;
    }

    // 获取所有可用年份
    var years = getAvailableYears();
    if (years.length === 0) {
        streamGraphChart.setOption({
            series: [{
                type: 'line',
                data: []
            }]
        });
        return;
    }

    // 获取用户选择的前n个国家数量，默认为10
    var topNInput = document.getElementById('streamGraphTopN');
    var topN = 10;
    if (topNInput) {
        var inputValue = parseInt(topNInput.value);
        if (!isNaN(inputValue) && inputValue > 0 && inputValue <= 50) {
            topN = inputValue;
        }
    }

    // 如果没有指定年份，使用当前选中的年份
    if (!selectedYear) {
        var yearSelect = document.getElementById('yearSelect');
        if (yearSelect) {
            selectedYear = yearSelect.value;
        }
    }

    // 根据当年数据获取前n个国家（使用预计算的总值）
    var countries = bilateralData.countries || [];
    var countryTotals = bilateralData.countryTotals || {};
    var countryYearValueMap = {};

    // 使用预计算的总值（只统计正数）
    for (var i = 0; i < countries.length; i++) {
        var countryName = countries[i].c;
        var yearValue = 0;

        // 只计算选定年份的数值
        if (selectedYear) {
            yearValue = (countryTotals[countryName] && countryTotals[countryName][selectedYear]) || 0;
        }

        if (yearValue > 0) {
            countryYearValueMap[countryName] = yearValue;
        }
    }

    // 排序并取前n名
    var topCountries = Object.keys(countryYearValueMap).sort(function (a, b) {
        return countryYearValueMap[b] - countryYearValueMap[a];
    }).slice(0, topN);

    // 为每个国家准备时间序列数据
    var seriesData = [];
    var colors = [
        '#667eea', '#764ba2', '#ff8158', '#50c8ff', '#ffc850',
        '#66ea7e', '#ea667e', '#eac866', '#9b59b6', '#3498db'
    ];

    for (var k = 0; k < topCountries.length; k++) {
        var country = topCountries[k];
        var chineseName = countryNameMap[country] || country;
        var countryData = null;

        // 找到该国家的数据
        for (var m = 0; m < countries.length; m++) {
            if (countries[m].c === country) {
                countryData = countries[m];
                break;
            }
        }

        if (!countryData) continue;

        var dataList = countryData.d || []; // d = data
        var yearValues = [];

        // 为每个年份计算该国家的总数值
        for (var n = 0; n < years.length; n++) {
            var year = years[n];
            var yearTotal = 0;

            for (var p = 0; p < dataList.length; p++) {
                var rowData = dataList[p];
                var values = rowData.v || {}; // v = values
                var yearValue = parseFloat(values[year]) || 0;
                if (yearValue > 0) {
                    yearTotal += yearValue;
                }
            }

            yearValues.push(yearTotal);
        }

        seriesData.push({
            name: chineseName,
            type: 'line',
            stack: 'total',
            smooth: true,
            areaStyle: {
                opacity: 0.6
            },
            lineStyle: {
                width: 2
            },
            itemStyle: {
                color: colors[k % colors.length]
            },
            data: yearValues
        });
    }

    // 配置流图选项
    var streamGraphOption = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross',
                label: {
                    backgroundColor: '#6a7985'
                }
            },
            formatter: function (params) {
                if (!params || params.length === 0) {
                    return '';
                }
                var result = params[0].name + '<br/>';
                for (var i = 0; i < params.length; i++) {
                    var param = params[i];
                    if (param && param.seriesName) {
                        var value = typeof param.value === 'number' ? param.value.toFixed(2) : param.value;
                        result += (param.marker || '') + param.seriesName + ': ' + value + '<br/>';
                    }
                }
                return result;
            },
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#667eea',
            borderWidth: 1,
            textStyle: {
                color: '#333',
                fontSize: 12
            }
        },
        legend: {
            data: seriesData.map(function (s) { return s.name; }),
            top: 10,
            textStyle: {
                color: '#333',
                fontSize: 11
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: years,
            axisLine: {
                lineStyle: {
                    color: '#999'
                }
            },
            axisLabel: {
                color: '#666',
                fontSize: 11
            }
        },
        yAxis: {
            type: 'value',
            axisLine: {
                lineStyle: {
                    color: '#999'
                }
            },
            axisLabel: {
                color: '#666',
                fontSize: 11
            },
            splitLine: {
                lineStyle: {
                    color: '#e0e0e0'
                }
            }
        },
        series: seriesData
    };

    streamGraphChart.setOption(streamGraphOption, true);
}


// 内部更新图表函数
function updateChartInternal(selectedYear, searchText) {
    if (!bilateralData) return;

    // 根据搜索词获取过滤的国家名
    var filterCountryName = getCountryNameFromSearch(searchText);

    var allData = generateVisualizationData(currentSheetName, selectedYear, filterCountryName);
    currentChartData = allData; // 保存当前数据，用于高亮功能

    var option = createOption(allData);
    // 保存原始线条数据（深拷贝，避免引用问题）
    // series[0] = map, series[1] = effectScatter, series[2] = lines
    if (option.series && option.series.length > 2 && option.series[2].data) {
        originalLineData = JSON.parse(JSON.stringify(option.series[2].data));
    } else {
        originalLineData = [];
    }

    // 使用 notMerge: true 完全替换数据，避免旧数据残留
    // 这会自动清除之前的高亮状态，同时ECharts会平滑过渡到新数据
    myChart.setOption(option, { notMerge: true, lazyUpdate: false });

    // 更新扇形图（传入搜索国家参数）
    updatePieChart(currentSheetName, selectedYear, filterCountryName);

    // 更新词云图
    updateWordCloudChart(currentSheetName, selectedYear);

    // 更新流图（传入年份参数）
    updateStreamGraphChart(currentSheetName, selectedYear);

    // 在图表渲染完成后，尝试从ECharts获取标签位置并更新坐标
    // 注意：这需要ECharts内部API，可能在不同版本中有所不同
    setTimeout(function () {
        try {
            // 尝试从geo组件获取区域信息
            var geoModel = myChart.getModel().getComponent('geo', 0);
            if (geoModel) {
                var regions = geoModel.get('regions') || [];
                // 如果ECharts提供了区域标签位置信息，可以在这里更新坐标
                // 但ECharts可能不会直接暴露这个信息，所以这里只是预留接口
            }
        } catch (e) {
            // 如果无法获取，使用计算出的加权质心（已经足够接近）
            console.log('无法从ECharts获取标签位置，使用计算的加权质心');
        }
    }, 100);
}

function initChart() {
    myChart = echarts.init(document.getElementById('main'));

    // 初始化扇形图
    initPieChart();

    // 初始化词云图
    initWordCloudChart();

    // 初始化流图
    initStreamGraphChart();

    // 设置默认值：1995年的inflow数据
    var sheetSelect = document.getElementById('sheetSelect');
    sheetSelect.value = 'inflow-M';

    // 加载默认sheet数据
    loadSheetData('inflow-M', function () {
        // 更新年份选择器
        updateYearSelector();

        // 初始化年份显示
        var yearSelect = document.getElementById('yearSelect');
        var yearDisplay = document.getElementById('yearDisplay');
        if (yearSelect && yearDisplay) {
            yearDisplay.textContent = yearSelect.value || '1995';
        }

        // 初始化图表
        updateChart();
    });

    // 绑定选择器变化事件
    sheetSelect.addEventListener('change', function () {
        // sheet改变时会触发数据重新加载，在updateChart中处理
        updateChart();
        // 如果正在播放，继续播放（不需要额外操作）
    });

    var yearSelect = document.getElementById('yearSelect');
    if (yearSelect) {
        yearSelect.addEventListener('change', function () {
            updateChart();
            // 如果正在播放，继续播放（不需要额外操作）
        });
    }

    // 绑定流图前n个国家输入框事件
    var streamGraphTopN = document.getElementById('streamGraphTopN');
    if (streamGraphTopN) {
        var topNTimeout = null;
        streamGraphTopN.addEventListener('input', function () {
            // 防抖处理，避免频繁更新
            clearTimeout(topNTimeout);
            topNTimeout = setTimeout(function () {
                var yearSelect = document.getElementById('yearSelect');
                var selectedYear = yearSelect ? yearSelect.value : null;
                updateStreamGraphChart(currentSheetName, selectedYear);
            }, 300);
        });
    }

    // 绑定国家搜索框事件
    var countrySearch = document.getElementById('countrySearch');
    if (countrySearch) {
        // 输入事件（实时搜索）
        var searchTimeout = null;
        countrySearch.addEventListener('input', function () {
            // 防抖处理，避免频繁更新
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(function () {
                updateChart();
            }, 300);
        });

        // 回车键搜索
        countrySearch.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                clearTimeout(searchTimeout);
                updateChart();
            }
        });
    }

    // 绑定自动播放控制
    var playPauseBtn = document.getElementById('playPauseBtn');
    var speedSlider = document.getElementById('speedSlider');
    var speedValue = document.getElementById('speedValue');

    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', function () {
            togglePlayPause();
        });
    }

    if (speedSlider && speedValue) {
        // 更新速度显示
        speedSlider.addEventListener('input', function () {
            playSpeed = parseFloat(speedSlider.value);
            speedValue.textContent = playSpeed + 'x';

            // 如果正在播放，重新设置定时器以应用新速度
            if (isPlaying) {
                stopAutoPlay();
                startAutoPlay();
            }
        });
    }


    // 鼠标悬停事件：高亮关联的线条
    myChart.on('mouseover', function (params) {
        if (params.seriesType === 'effectScatter' && params.data && params.data.name) {
            var countryName = params.data.name;
            highlightRelatedLines(countryName);
        }
    });

    // 鼠标移出事件：取消高亮
    myChart.on('mouseout', function (params) {
        if (params.seriesType === 'effectScatter') {
            unhighlightAllLines();
        }
    });

    // 重置按钮点击事件
    var resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            // 先清除所有数据，避免线条残留痕迹
            // 使用 notMerge: true 来完全替换数据，清除旧的渲染和动画效果
            myChart.setOption({
                series: [{
                    name: '地点',
                    data: []
                }, {
                    name: '线路',
                    data: []
                }]
            }, { notMerge: true, lazyUpdate: false });

            // 恢复地图视图到初始状态
            myChart.dispatchAction({ type: 'restore' });

            // 短暂延迟后重新加载当前数据，确保完全清除旧的动画效果
            setTimeout(function () {
                updateChart();
            }, 50);
        });
    }

    // 窗口大小调整事件：调整所有图表大小
    window.addEventListener('resize', function () {
        if (myChart) {
            myChart.resize();
        }
        if (pieChart) {
            pieChart.resize();
        }
        if (wordCloudChart) {
            wordCloudChart.resize();
        }
        if (streamGraphChart) {
            streamGraphChart.resize();
        }
    });
}

// 高亮与指定国家相关的所有线条
function highlightRelatedLines(countryName) {
    if (!currentChartData || !currentChartData.moveLines || !originalLineData) return;

    var updatedLineData = [];
    var hasRelatedLines = false;

    // 遍历所有线条，更新相关线条的样式
    for (var i = 0; i < originalLineData.length; i++) {
        var line = originalLineData[i];
        var isRelated = (line.fromName === countryName || line.toName === countryName);

        if (isRelated) {
            hasRelatedLines = true;
            // 创建高亮样式的线条数据
            var highlightedLine = JSON.parse(JSON.stringify(line));

            // 根据sheetName判断是流入还是流出
            var isInflow = false;
            if (currentSheetName) {
                isInflow = currentSheetName.indexOf('inflow') !== -1 || currentSheetName.indexOf('instock') !== -1;
            }

            // 更新为高亮样式
            var originalEmphasis = line.lineStyle && line.lineStyle.emphasis ? line.lineStyle.emphasis : {};
            highlightedLine.lineStyle = {
                normal: {
                    color: isInflow ? 'rgba(255, 200, 200, 1)' : 'rgba(200, 255, 200, 1)',
                    width: 1,
                    opacity: 1,
                    curveness: 0.5,
                    shadowBlur: 15,
                    shadowColor: isInflow ? 'rgba(255, 100, 100, 0.8)' : 'rgba(100, 255, 100, 0.8)'
                },
                emphasis: originalEmphasis
            };

            // 增强动画效果 - 高亮运动小球
            highlightedLine.effect = {
                show: true,
                constantSpeed: 80, // 加快速度，更明显
                symbol: 'circle',
                symbolSize: 10, // 增大小球尺寸（从4增加到10），更明显
                trailLength: 0.8, // 增加拖尾长度（从0.3增加到0.8）
                // 使用更亮的颜色，白色小球配彩色拖尾
                color: isInflow
                    ? new echarts.graphic.RadialGradient(0.5, 0.5, 0.5, [
                        { offset: 0, color: 'rgba(255, 255, 255, 1)' },
                        { offset: 0.5, color: 'rgba(255, 200, 200, 0.9)' },
                        { offset: 1, color: 'rgba(255, 100, 100, 0.6)' }
                    ])
                    : new echarts.graphic.RadialGradient(0.5, 0.5, 0.5, [
                        { offset: 0, color: 'rgba(255, 255, 255, 1)' },
                        { offset: 0.5, color: 'rgba(200, 255, 200, 0.9)' },
                        { offset: 1, color: 'rgba(100, 255, 100, 0.6)' }
                    ])
            };

            updatedLineData.push(highlightedLine);
        } else {
            // 非相关线条，降低透明度和隐藏运动小球
            var dimmedLine = JSON.parse(JSON.stringify(line));
            if (dimmedLine.lineStyle && dimmedLine.lineStyle.normal) {
                dimmedLine.lineStyle.normal.opacity = 0.1;
            }
            // 隐藏或降低运动小球的可见度
            if (dimmedLine.effect) {
                dimmedLine.effect.show = false; // 完全隐藏非相关线条的运动小球
            }
            updatedLineData.push(dimmedLine);
        }
    }

    // 更新图表
    if (hasRelatedLines) {
        myChart.setOption({
            series: [{
                name: '线路',
                data: updatedLineData
            }]
        }, { notMerge: false, lazyUpdate: false });
    }
}

// 取消所有线条的高亮
function unhighlightAllLines() {
    if (!originalLineData) return;

    // 恢复原始线条数据
    myChart.setOption({
        series: [{
            name: '线路',
            data: JSON.parse(JSON.stringify(originalLineData))
        }]
    }, { notMerge: false, lazyUpdate: false });
}

// 切换播放/暂停
function togglePlayPause() {
    if (isPlaying) {
        stopAutoPlay();
    } else {
        startAutoPlay();
    }
}

// 开始自动播放
function startAutoPlay() {
    if (!availableYears || availableYears.length === 0) return;

    isPlaying = true;
    var playBtn = document.getElementById('playPauseBtn');
    if (playBtn) {
        playBtn.textContent = '暂停';
        playBtn.classList.add('playing');
    }

    // 计算播放间隔（毫秒），基础间隔为1000ms，根据速度调整
    var baseInterval = 1000;
    var interval = baseInterval / playSpeed;

    playInterval = setInterval(function () {
        var yearSelect = document.getElementById('yearSelect');
        if (!yearSelect) {
            stopAutoPlay();
            return;
        }

        var currentYear = parseInt(yearSelect.value);
        var currentIndex = availableYears.indexOf(currentYear);

        // 移动到下一个年份
        if (currentIndex !== -1 && currentIndex < availableYears.length - 1) {
            // 还有下一个年份
            var nextYear = availableYears[currentIndex + 1];
            yearSelect.value = nextYear.toString();
            updateChart();
        } else {
            // 已经到最后一个年份，循环回到第一个
            yearSelect.value = availableYears[0].toString();
            updateChart();
        }
    }, interval);
}

// 停止自动播放
function stopAutoPlay() {
    isPlaying = false;

    if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
    }

    var playBtn = document.getElementById('playPauseBtn');
    if (playBtn) {
        playBtn.textContent = '播放';
        playBtn.classList.remove('playing');
    }
}