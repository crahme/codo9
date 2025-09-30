import pkg from 'mise';
const { Mise } = pkg;

async function main() {
  // Create a new Mise instance
  

  try {
    // Add the setting
    await mise.settings.add('idiomatic_version_file_enable_tools', 'node');
    console.log('Setting added successfully!');
  } catch (err) {
    console.error('Error adding setting:', err);
  }
}

main();
