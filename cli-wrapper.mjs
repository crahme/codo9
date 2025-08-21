#!/usr/bin/env node

// cli-wrapper.mjs
import {Command} from "commander";
import { listCdr } from "./services/cloudoceanapi.mjs"; // adjust path if needed

const  program  = new Command();

program
  .name("cloudocean")
  .description("CLI wrapper for CloudOcean API")
  .version("1.0.0");

program
  .command("reads")
  .description("Fetch CDR data from CloudOcean API")
  .option("-m, --module <uuid>", "Module UUID")
  .option("-p, --point <uuid>", "Measuring Point UUID")
  .option("-s, --start <date>", "Start date (YYYY-MM-DD)")
  .option("-e, --end <date>", "End date (YYYY-MM-DD)")
  .action(async (options) => {
    if (!options.module || !options.point || !options.start || !options.end) {
      console.error("❌ Missing required options. Use -m, -p, -s, -e.");
      process.exit(1);
    }

    try {
      console.log("⏳ Fetching data...");
      const data = await listCdr(
        options.module,
        options.point,
        {
          start: options.start,
          end: options.end,
        }
      );

      console.log("✅ Data received:");
      console.log(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("❌ Failed to fetch data:", err.message);
    }
  });

program.parse(process.argv);
