import type { Mod } from './types';
import archiver from 'archiver';
import decompress from 'decompress';
import fs from 'fs';
import { fullArchive } from 'node-7z-archive';
import path from 'path';
import { pipeline } from 'stream/promises';

// util function
const loadMods = async () => {
  // check if modlist.json exists in the parent directory
  const modlistPath = path.join(__dirname, '..', 'modlist.json');

  console.log(modlistPath);

  if (!fs.existsSync(modlistPath)) {
    console.log('modlist.json not found');
    return;
  }

  // load modlist.json
  const modlist = JSON.parse(fs.readFileSync(modlistPath, 'utf8'));

  // return mods array
  return modlist?.mods || [];
};
const downloadMod = async (mod: Mod) => {
  // check source
  if (mod.source === 'civfanatics') {
    // get download url
    const downloadUrl = mod.url + (mod.url.endsWith('/') ? '' : '/') + 'download';

    // get tmp path
    const tmpPath = path.join(__dirname, 'tmp', mod.name.replace(/[^a-zA-Z0-9]/g, ''));

    // create tmp folder if not exists
    if (!fs.existsSync(tmpPath)) {
      fs.mkdirSync(tmpPath);
    }

    // download mod
    const download = await fetch(downloadUrl);

    if (!download.ok) {
      throw new Error(`Failed to download mod from ${downloadUrl}: ${download.statusText}`);
    }

    // create write stream
    const fileStream = fs.createWriteStream(
      path.join(tmpPath, `${mod.name.replace(/[^a-zA-Z0-9]/g, '')}.${mod.assetType}`)
    );

    // check if download body exists
    if (!download.body) {
      throw new Error('Failed to get download body');
    }

    // pipe download to file
    await pipeline(download.body, fileStream);

    // return tmp path
    return tmpPath;
  }
};
const extractMod = async (mod: Mod, tmpPath: string) => {
  // get output path
  const outputPath = path.join(__dirname, '..', 'output');

  console.info(outputPath);

  console.info('mod.assetType', mod.assetType);

  // create output folder if not exists
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath);
  }

  if (mod.assetType === 'zip') {
    // extract mod
    await decompress(
      path.join(tmpPath, `${mod.name.replace(/[^a-zA-Z0-9]/g, '')}.${mod.assetType}`),
      outputPath,
      {
        filter: (file) => !file.path.endsWith('/'),
      }
    );
  } else if (mod.assetType === '7z') {
    await fullArchive(
      path.join(tmpPath, `${mod.name.replace(/[^a-zA-Z0-9]/g, '')}.${mod.assetType}`),
      outputPath
    );
  }
};
const zipOutput = async () => {
  // get output path
  const outputPath = path.join(__dirname, '..', 'output');

  // get zip path
  const zipPath = path.join(__dirname, '..', 'output.zip');

  // create zip file
  const output = fs.createWriteStream(zipPath);

  // create archive
  const archive = archiver('zip', { zlib: { level: 9 } });

  // pipe archive to output
  archive.pipe(output);

  // add output to archive
  archive.glob(`**/*`, { cwd: outputPath });

  // finalize archive
  archive.finalize();
};

// main function
const main = async () => {
  // load mods
  const mods = await loadMods();

  // download mods
  for (const mod of mods) {
    console.log(`Trying to download ${mod.name}...`);
    try {
      const tmpPath = await downloadMod(mod);
      if (!tmpPath) {
        throw new Error('Failed to download mod');
      }
      console.log(`Downloaded ${mod.name} successfully!`);
      console.log(`Trying to extract ${mod.name}...`);
      await extractMod(mod, tmpPath);
      console.log(`Extracted ${mod.name} successfully!`);
    } catch (error) {
      console.error(error);
    }
  }

  // zip output
  console.log(`Trying to zip output...`);
  try {
    await zipOutput();
    console.log(`Zipped output successfully!`);
  } catch (error) {
    console.error(error);
  }
};

// run main function
main();
