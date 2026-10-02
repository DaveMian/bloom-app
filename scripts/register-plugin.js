const fs = require('fs');
const path = require('path');

const configPath = path.resolve(__dirname, '..', 'ios', 'App', 'App', 'capacitor.config.json');

if (fs.existsSync(configPath)) {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);
    config.packageClassList = config.packageClassList || [];
    if (!config.packageClassList.includes('BloomNativePlugin')) {
      config.packageClassList.push('BloomNativePlugin');
      fs.writeFileSync(configPath, JSON.stringify(config, null, '\t') + '\n', 'utf8');
      console.log('Successfully registered BloomNativePlugin in ios/App/App/capacitor.config.json');
    } else {
      console.log('BloomNativePlugin already registered in ios/App/App/capacitor.config.json');
    }
  } catch (err) {
    console.error('Failed to update capacitor.config.json:', err);
    process.exit(1);
  }
} else {
  console.warn('capacitor.config.json not found at:', configPath);
}
