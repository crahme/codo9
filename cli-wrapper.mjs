#!/usr/bin/env node
import { Command } from "commander";
import CloudOceanAPI from "./services/cloudoceanapi.mjs";
import "dotenv/config";


const program = new Command();

function toISO(date) {
  const d = new Date(date);
  if (isNaN(d)) throw new Error(`Invalid date provided: ${date}`);
  return d.toISOString();
}

program
  .name("cloudocean")
  .description("Fetch CDR data from CloudOcean API");

program
  .command("reads")
  .option("-m, --module <uuid>", "Module UUID")
  .option("-p, --point <uuid>", "Measuring Point UUID")
  .option("-s, --start <date>", "Start date (YYYY-MM-DD)")
  .option("-e, --end <date>", "End date (YYYY-MM-DD)")
  .action(async (options) => {
    const { module: moduleUuid, point: mpUuid, start, end } = options;

    // Manual required arguments check
    if (!moduleUuid || !mpUuid || !start || !end) {
      console.error("❌ All options -m, -p, -s, -e are required");
      process.exit(1);
    }

    let startISO, endISO;
    try {
      startISO = toISO(start);
      endISO = toISO(end);
    } catch (err) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }

    const api = new CloudOceanAPI();

    console.log("⏳ Fetching data...");
    try {
      const data = await api.getMeasuringPointCdr(moduleUuid, mpUuid, startISO, endISO);
      console.log("✅ Fetched data:", data);
    } catch (err) {
      console.error("❌ Failed to fetch data:", err.message);
    }
  });

program.parse(process.argv);
