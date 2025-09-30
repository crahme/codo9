// run_mise.js
import mise from 'mise';

async function main() {
  try {
    await mise.settings.add('idiomatic_version_file_enable_tools', 'node');
    console.log('Setting added successfully!');
  } catch (err) {
    console.error(err);
  }
}

main();
