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
  })
  .normalize('targetPath')
  .parseAsync()
  .then((arg) => {
    console.log(arg)
    const c = new Convert(arg)
    c.process()
  })