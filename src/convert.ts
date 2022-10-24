import * as unpack from 'unpack-all';
import path from 'path';
import fs from 'fs';
import pLimit from 'p-limit';
import sharp from 'sharp';

interface UnpackSingleResult {
  err?: any
  files?: string[] | null
  text?: string
  outDir: string
}

interface ArgOpt {
  removeArchive: boolean
  format: string
  outdir: string
  targetPath: string
  threads: number
}

const extRegex = /\.[\w\d]+$/

export default class Convert {
  private totalBeforeSize = 0
  private totalAfterSize = 0
  private removeArchive: boolean
  private format: string
  private targetPath: string
  private dstDir?: string
  private threads: number

  constructor(arg:Partial<ArgOpt>) {
    this.removeArchive = arg.removeArchive || false
    this.format = arg.format || 'avif'
    this.targetPath = (arg as any).targetPath
    this.dstDir = arg.outdir || undefined
    this.threads = arg.threads || 1
  }

  async unpackSingle(targetFile: string, dstPath: string): Promise<UnpackSingleResult> {
    const targetDir = `${dstPath}/${path.basename(targetFile).replace(extRegex, '')}`
    return new Promise((resolve, reject) => {
      if (fs.existsSync(targetDir)) {
        // already exists, skip extract
        resolve({ outDir: targetDir })
      }  
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

  async readdirRecursively(dir: string, files: string[] = []) {
    const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
    const dirs = [];
    for (const dirent of dirents) {
      if (dirent.isDirectory()) dirs.push(`${dir}/${dirent.name}`);
      if (dirent.isFile()) files.push(`${dir}/${dirent.name}`);
    }
    for (const d of dirs) {
      files = await this.readdirRecursively(d, files);
    }
    return Promise.resolve(files);
  };

  async convert(originalFileName: string) {
    let convertedFileName = ''
    const shrp = sharp(originalFileName, { failOn: 'none' })
      .resize(4096,4096, {
        fit: 'inside',
        withoutEnlargement: true,
      })
    if (this.format === 'avif') {
      convertedFileName = `${originalFileName}.avif`
      await shrp.avif({
          quality: 50,
          lossless: false,
          effort: 9,
          chromaSubsampling: '4:4:4',
        })
        .toFile(convertedFileName)
    } else if (this.format === 'webp') {
      convertedFileName = `${originalFileName}.webp`
      await shrp.webp({
          quality: 75,
          effort: 6,
          smartSubsample: true,
        })
        .toFile(convertedFileName)
    }
    const original = await fs.promises.stat(originalFileName)
    const converted = await fs.promises.stat(convertedFileName)
    console.debug(`${originalFileName}\n  ${original.size} => ${converted.size}`)
    this.totalBeforeSize += original.size
    if (original.size * 0.99 < converted.size) {
      // keep original file
      this.totalAfterSize += original.size
      await fs.promises.unlink(convertedFileName)
      console.debug('  Converted file has been removed due to inefficient conversion')
    } else {
      // delete original file
      this.totalAfterSize += converted.size
      await fs.promises.unlink(originalFileName)
    }
  }

  async processImagesInDir(targetDir: string) {
    const files = await this.readdirRecursively(targetDir)
    const promises: Promise<void>[] = []
    const limit = pLimit(this.threads);
    files.forEach(fileName => {
      const extension = fileName.split(".").pop();
      switch (extension) {
        case 'jpg':
        case 'jpeg':
          promises.push(limit(() => this.convert(fileName)));
          break;
        case 'png':
          promises.push(limit(() => this.convert(fileName)));
          break;
        // otherwise, no process
        default:
          console.debug(`Ignoring ${fileName}`)
          break;
      }
    })
    return Promise.all(promises)
  }

  async process() {
    let dstPath = this.dstDir
    if (!dstPath) {
      dstPath = path.dirname(this.targetPath)
    }
    let imagesDir = ''
    const lstat = await fs.promises.lstat(this.targetPath)
    if (lstat.isFile()) {
      // if targetPath is file, unarchive
      const unpackResult = await this.unpackSingle(this.targetPath, dstPath)
      imagesDir = unpackResult.outDir
    } else if (lstat.isDirectory()) {
      imagesDir = this.targetPath
    }
    console.debug(`Processing directory: ${imagesDir}`)
    await this.processImagesInDir(imagesDir)
    console.debug(`${this.totalBeforeSize} => ${this.totalAfterSize} (${this.totalAfterSize/this.totalBeforeSize})`)
    if (this.removeArchive) {
      // remove archive file (not directory)
      await fs.promises.rm(this.targetPath, { recursive: true, force: false })
    }
  }
}