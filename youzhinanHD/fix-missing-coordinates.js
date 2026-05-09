/**
 * 补录缺失经纬度数据脚本
 * 用于修复历史数据中没有经纬度的记录
 */
const db = require('./config/db');
const { geocodeAddress } = require('./routes/gaode');

async function fixMissingCoordinates() {
  console.log('开始补录缺失的经纬度数据...');
  
  const [rows] = await db.query(
    'SELECT id, province, city, district, address FROM info WHERE latitude IS NULL OR longitude IS NULL'
  );
  
  console.log(`找到 ${rows.length} 条需要补录的记录\n`);
  
  for (const row of rows) {
    console.log(`正在处理 [ID: ${row.id}] ${row.province}${row.city}${row.district}${row.address}`);
    
    try {
      const geoResult = await geocodeAddress(row.province, row.city, row.district, row.address);
      
      if (geoResult) {
        await db.query(
          'UPDATE info SET latitude = ?, longitude = ? WHERE id = ?',
          [geoResult.latitude, geoResult.longitude, row.id]
        );
        console.log(`  ✅ 补录成功: (${geoResult.latitude}, ${geoResult.longitude})\n`);
      } else {
        console.log(`  ❌ 未找到匹配的地理位置\n`);
      }
      
      // 避免请求过快被限制，等待1秒
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  ❌ 处理失败: ${error.message}\n`);
    }
  }
  
  console.log('\n补录完成！');
  process.exit(0);
}

fixMissingCoordinates();
