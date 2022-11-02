import yargs from 'yargs';
import Convert from './convert';


yargs
  .command('$0 <targetPath>', "Target Zip archive file or directory to compress images")
  .options({
    removeArchive: {
      type: "boolean",
      describe: "Remove given archive after processed",
      demandOption: true,
      default: false,
      alias: "r",
    },
    effort: {
      type: "number",
      describe: "Compression effort",
      demandOption: false,
      default: 4,
      alias: "e",
    },
    format: {
      type: "string",
      describe: "Specify format",
      demandOption: false,
      default: 'avif',
      alias: "f",
    },
    outdir: {
      type: "string",
      describe: "Destination directory",
      demandOption: false,
      alias: "o",
    },
    threads: {
      type: "number",
      describe: "Parallel conversion",
      demandOption: false,
      default: 1,
      alias: "t",
    },
  })
  .normalize('targetPath')
  .parseAsync()
  .then((arg) => {
    const c = new Convert(arg)
    c.process()
  })