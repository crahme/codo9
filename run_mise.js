// run_mise.js
import Mise from 'mise';

async function main() {
  try {
    // Create a Mise instance
    const mise = new Mise();

    // Add the setting
    mise.settings.add('idiomatic_version_file_enable_tools', 'node');

    console.log('✅ Setting added successfully!');
  } catch (err) {
    console.error('❌ Error adding setting:', err);
  }
}

// Run the main function
main();
