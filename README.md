Extract Zip & Compress Images
=============================

This script extracts the specified ZIP/RAR/7z etc. archive (files supported by unar "The Unarchiver") containing images, then convert these images to WebP. It also downsizes excess size images.

## Prepare
```
brew install unar
npm run build
```

## Run
```
node dist/index.js '/path/to/zip-file'
```

### Option
- `-r`: remove Zip after processed