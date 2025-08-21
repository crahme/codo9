#!/usr/bin/env node
import CloudOceanAPI from "./services/cloudoceanapi.mjs";
import { Command } from "commander";
const program = new Command();

const api = new CloudOceanAPI();

program
  .name("cloudocean")
  .description("CLI tool to interact with Cloud Ocean API (like curl/Postman)")
  .version("1.0.0");

program
  .command("cdr")
  .description("Fetch CDR data for a measuring point")
  .requiredOption("-m, --module <uuid>", "Module UUID")
  .requiredOption("-p, --point <uuid>", "Measuring point UUID")
  .requiredOption("-s, --start <date>", "Start date (YYYY-MM-DD)")
  .requiredOption("-e, --end <date>", "End date (YYYY-MM-DD)")
  .action(async (opts) => {
    const data = await api.getMeasuringPointCdr(
      opts.module,
      opts.point,
      opts.start,
      opts.end
    );
    console.log(JSON.stringify(data, null, 2));
  });

program
  .command("reads")
  .description("Fetch reads for a measuring point")
  .requiredOption("-m, --module <uuid>", "Module UUID")
  .requiredOption("-p, --point <uuid>", "Measuring point UUID")
  .requiredOption("-s, --start <date>", "Start date (YYYY-MM-DD)")
  .requiredOption("-e, --end <date>", "End date (YYYY-MM-DD)")
  .action(async (opts) => {
    const data = await api.getMeasuringPointReads(
      opts.module,
      opts.point,
      opts.start,
      opts.end
    );
    console.log(JSON.stringify(data, null, 2));
  });

program
  .command("device-info")
  .description("Fetch device info")
  .requiredOption("-d, --device <id>", "Device ID")
  .action(async (opts) => {
    const data = await api.getDeviceInfo(opts.device);
    console.log(JSON.stringify(data, null, 2));
  });

program.parseAsync(process.argv);
