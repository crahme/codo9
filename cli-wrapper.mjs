import { Command } from "commander";
import CloudOceanAPI from "./services/cloudoceanapi.mjs";
import "dotenv/config";

const program = new Command();

program
  .name("cloudocean")
  .description("CLI to interact with CloudOcean API")
  .version("1.0.0");

// Define `reads` subcommand
const readsCmd = new Command("reads")
  .description("Fetch measuring point reads")
  .requiredOption("-m, --module <uuid>", "Module UUID")
  .requiredOption("-p, --point <uuid>", "Measuring Point UUID")
  .requiredOption("-s, --start <date>", "Start date (YYYY-MM-DD)")
  .requiredOption("-e, --end <date>", "End date (YYYY-MM-DD)")
  .action(async (opts) => {
    const api = new CloudOceanAPI();
    const data = await api.getMeasuringPointReads(
      opts.module,
      opts.point,
      opts.start,
      opts.end
    );
    console.log(JSON.stringify(data, null, 2));
  });

program.addCommand(readsCmd);

program.parse(process.argv);
