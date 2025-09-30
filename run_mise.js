import { addSetting } from 'mise';

async function main() {
  try {
    await addSetting('idiomatic_version_file_enable_tools', 'node');
    console.log('Setting added successfully!');
  } catch (err) {
    console.error('Error adding setting:', err);
  }
}

main();
