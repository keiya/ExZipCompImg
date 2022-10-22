import * as unpack from 'unpack-all';
import path from 'path';
import fs from 'fs';
import pLimit from 'p-limit';
import sharp from 'sharp';
import yargs from 'yargs';

let totalBeforeSize = 0
let totalAfterSize = 0
const extRegex = /\.[\w\d]+$/

interface UnpackSingleResult {
  err: any
  files: string[] | null
  text: string
  outDir: string
}

async function unpackSingle(targetFile: string, dstPath: string): Promise<UnpackSingleResult> {
  const targetDir = `${dstPath}/${path.basename(targetFile).replace(extRegex, '')}`
  return new Promise((resolve, reject) => {
    unpack.unpack(targetFile, {
      quiet: false,
      targetDir,
      copyTime: true,
      noDirectory: true,
    }, (err, files, text) => {
      if (err) {
        return reject(err)
      }
      resolve({ err, files, text, outDir: targetDir })
    })
  })
}

async function readdirRecursively(dir: string, files: string[] = []) {
  const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
  const dirs = [];
  for (const dirent of dirents) {
    if (dirent.isDirectory()) dirs.push(`${dir}/${dirent.name}`);
    if (dirent.isFile()) files.push(`${dir}/${dirent.name}`);
  }
  for (const d of dirs) {
    files = await readdirRecursively(d, files);
  }
  return Promise.resolve(files);
};

async function compressToWebp(originalFileName: string, nearLossless: boolean) {
  const webpFileName = `${originalFileName}.webp`
  await sharp(originalFileName)
    .resize(4096,4096, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({
      quality: 75,
      effort: 6,
      smartSubsample: true,
      nearLossless,
    })
    .toFile(webpFileName)
  const original = await fs.promises.stat(originalFileName)
  const webp = await fs.promises.stat(webpFileName)
  console.debug(`${originalFileName}\n  ${original.size} => ${webp.size}`)
  totalBeforeSize += original.size
  if (original.size <= webp.size) {
    // keep original file
    totalAfterSize += original.size
    await fs.promises.unlink(webpFileName)
    console.debug('  WebP file has been removed due to increased size')
  } else {
    // delete original file
    totalAfterSize += webp.size
    await fs.promises.unlink(originalFileName)
  }
}

async function processImagesInDir(targetDir: string) {
  const files = await readdirRecursively(targetDir)
  const promises: Promise<void>[] = []
  const limit = pLimit(2);
  files.forEach(fileName => {
    const extension = fileName.split(".").pop();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        promises.push(limit(() => compressToWebp(fileName, false)));
        break;
      case 'png':
        promises.push(limit(() => compressToWebp(fileName, true)));
        break;
      // otherwise, no process
      default:
        console.debug(`Ignoring ${fileName}`)
        break;
    }
  })
  return Promise.all(promises)
}

async function process(archiveFile: string, _dstPath: string | null, remove: boolean) {
  let dstPath = _dstPath
  if (!dstPath) {
    dstPath = path.dirname(archiveFile)
  }
  const unpackResult = await unpackSingle(archiveFile, dstPath)
  console.log(unpackResult)
  await processImagesInDir(unpackResult.outDir)
  console.log(`${totalBeforeSize} => ${totalAfterSize} (${totalAfterSize/totalBeforeSize})`)
  if (remove) {
    await fs.promises.unlink(archiveFile)
  }
}

const argv = yargs
  .command('$0 <archive file>', "Unzip the archive file and compress images.")
  .options({
    removearchive: {
      type: "boolean",
      describe: "Remove given archive after processed",
      demandOption: true,
      default: false,
      alias: "r",
    },
  })
  .parseAsync()
  .then((arg) => {
    console.log(arg)
    process((arg as any).archivefile, null, arg.removearchive);
  })