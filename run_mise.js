// run_mise.js
import miseModule from 'mise';

async function main() {
  try {
    // Access the settings object directly
    const { settings } = miseModule.default ?? miseModule;

    // Add the setting
    settings.add('idiomatic_version_file_enable_tools', 'node');

    console.log('✅ Setting added successfully!');
  } catch (err) {
    console.error('❌ Error adding setting:', err);
  }
}

main();

