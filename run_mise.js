// run_mise.js
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    const configPath = path.resolve(process.cwd(), '.mise.json');
    let config = {};

    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    config.settings = config.settings || {};
    config.settings.idiomatic_version_file_enable_tools = 'node';

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log('✅ Setting added successfully!');
  } catch (err) {
    console.error('❌ Error adding setting:', err);
  }
}

main();
