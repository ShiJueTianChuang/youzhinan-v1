// 省份城市数据生成工具 - 智能识别字段
export function generateProvinceCityDataSmart(allData) {
  console.log('=== 生成省份城市数据（智能识别字段） ===');
  console.log('输入数据长度:', Array.isArray(allData) ? allData.length : 0);

  const provinceCityData = {};
  const orderedProvinces = []; // 记录省份出现顺序
  const dataArray = Array.isArray(allData) ? allData : [];
  
  const customProvinceOrder = [
    '北京市', '上海市', '重庆市', '天津市',
    '广东省', '江苏省', '浙江省', '山东省', '河南省', '安徽省',
    '福建省', '江西省', '湖南省', '湖北省', '河北省', '山西省',
    '辽宁省', '吉林省', '黑龙江省', '四川省', '贵州省', '云南省',
    '陕西省', '甘肃省', '青海省', '海南省',
    '内蒙古自治区', '广西壮族自治区', '宁夏回族自治区',
    '西藏自治区', '新疆维吾尔自治区',
    '台湾省', '香港特别行政区', '澳门特别行政区'
  ];

  // 智能识别省份和城市字段
  let provinceField = null;
  let cityField = null;
  
  if (dataArray.length > 0) {
    const firstItem = dataArray[0];
    const keys = Object.keys(firstItem);
    console.log('第一个数据项的所有键名:', keys);
    console.log('第一个数据项完整内容:', JSON.stringify(firstItem).substring(0, 800));
    
    // 省份字段匹配模式 - 扩展更多可能的字段名
    const provincePatterns = [
      /^province$/i, /^province.*name$/i, /^province_name$/i, /^prov$/i, /^省$/i,
      /^Province$/i, /^Prov$/i, /^PROVINCE$/i, /^prov_name$/i, /^provname$/i
    ];

    // 城市字段匹配模式 - 扩展更多可能的字段名
    const cityPatterns = [
      /^city$/i, /^city.*name$/i, /^city_name$/i, /^市$/i, /^cities$/i,
      /^City$/i, /^CITY$/i, /^cityname$/i, /^City_Name$/i, /^cityName$/i
    ];
    
    // 智能识别省份字段
    for (const key of keys) {
      const value = firstItem[key];
      if (typeof value === 'string' && value.length > 0 && value.length < 20) {
        for (const pattern of provincePatterns) {
          if (pattern.test(key)) {
            provinceField = key;
            console.log(`✅ 自动识别到省份字段: "${key}" = "${value}"`);
            break;
          }
        }
      }
      if (provinceField) break;
    }
    
    // 智能识别城市字段
    for (const key of keys) {
      const value = firstItem[key];
      if (typeof value === 'string' && value.length > 0 && value.length < 20) {
        for (const pattern of cityPatterns) {
          if (pattern.test(key)) {
            cityField = key;
            console.log(`✅ 自动识别到城市字段: "${key}" = "${value}"`);
            break;
          }
        }
      }
      if (cityField) break;
    }
    
    // 如果自动识别失败，使用通用匹配逻辑
    if (!provinceField || !cityField) {
      console.log('⚠️ 自动识别字段失败，使用通用匹配逻辑');
      for (const key of keys) {
        const value = firstItem[key];
        if (typeof value === 'string' && value.length > 0 && value.length < 20) {
          if (!provinceField && (key.toLowerCase().includes('prov') || key.includes('省'))) {
            provinceField = key;
            console.log(`✅ 通过通用逻辑识别到省份字段: "${key}" = "${value}"`);
          }
          if (!cityField && (key.toLowerCase().includes('city') || key.includes('市'))) {
            cityField = key;
            console.log(`✅ 通过通用逻辑识别到城市字段: "${key}" = "${value}"`);
          }
        }
      }
    }
    
    console.log('最终使用的字段:', { provinceField, cityField });
  }
  
  // 遍历数据并提取省份城市
  let processedCount = 0;
  let successCount = 0;
  let failCount = 0;
  
  dataArray.forEach((item, index) => {
    processedCount++;
    
    // 检查item是否为对象
    if (typeof item !== 'object' || item === null) {
      console.warn(`⚠️ 无效的数据项[${index}]:`, item);
      return;
    }
    
    // 使用识别到的字段提取数据
    const province = provinceField ? item[provinceField] : '';
    const city = cityField ? item[cityField] : '';
    
    // 检查省份和城市是否有效
    if (province && city && typeof province === 'string' && typeof city === 'string') {
      const cleanProvince = province.trim();
      const cleanCity = city.trim();
      
      if (cleanProvince && cleanCity) {
        // 添加省份和城市
        if (!provinceCityData[cleanProvince]) {
          provinceCityData[cleanProvince] = [];
          orderedProvinces.push(cleanProvince); // 保持后端返回的数据顺序
        }
        if (!provinceCityData[cleanProvince].includes(cleanCity)) {
          provinceCityData[cleanProvince].push(cleanCity);
          successCount++;
          
          // 输出前3个成功的样本
          if (successCount <= 3) {
            console.log(`✅ 成功提取[${index}]: ${cleanProvince} - ${cleanCity}`);
          }
        }
      }
    } else {
      failCount++;
      // 输出前3个失败的样本
      if (failCount <= 3) {
        console.warn(`⚠️ 提取失败[${index}]: province="${province}", city="${city}"`);
        console.warn(`当前字段:`, { provinceField, cityField });
        console.warn(`数据项:`, item);
      }
    }
  });
  
  console.log('=== 省份城市数据生成统计 ===');
  console.log('处理数据项总数:', processedCount);
  console.log('成功提取的省份城市对:', successCount);
  console.log('提取失败数量:', failCount);
  console.log('使用的字段:', { provinceField, cityField });

  // 记录结果
  const provinces = Object.keys(provinceCityData);
  console.log('生成的省份数量:', provinces.length);
  console.log('生成的省份列表:', provinces);

  // 调试：如果省份数量为0，打印更多信息
  if (provinces.length === 0 && dataArray.length > 0) {
    console.error('❌ 未能提取任何省份数据');
    console.error('识别到的字段:', { provinceField, cityField });
    console.error('第一个数据项:', dataArray[0]);
  }

  // 按照自定义顺序排序省份
  const sortedOrderedProvinces = [...orderedProvinces].sort((a, b) => {
    const indexA = customProvinceOrder.indexOf(a);
    const indexB = customProvinceOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  // 返回省份城市数据和识别到的字段名
  return {
    provinceCityData,
    orderedProvinces: sortedOrderedProvinces,
    provinceField,
    cityField
  };
}