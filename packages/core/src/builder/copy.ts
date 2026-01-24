import type { BuildContext } from './context.js';
import { getBuildPaths } from './context.js';

/**
 * Copy source files to build directory
 */
export async function copy(ctx: BuildContext): Promise<void> {
  const { storage, paths, logger, onProgress } = ctx;
  const buildPaths = getBuildPaths(paths.build);

  const tasks: Array<{ src: string; dest: string; description: string }> = [];

  // Collect files to copy
  // 1. mimetype
  tasks.push({
    src: `${paths.src}/mimetype`,
    dest: `${paths.build}/mimetype`,
    description: 'mimetype',
  });

  // 2. META-INF
  if (await storage.exists(paths.metaInf)) {
    const metaFiles = await storage.readDir(paths.metaInf);
    for (const file of metaFiles) {
      tasks.push({
        src: `${paths.metaInf}/${file}`,
        dest: `${buildPaths.metaInf}/${file}`,
        description: `META-INF/${file}`,
      });
    }
  }

  // 3. Images
  if (await storage.exists(paths.images)) {
    const imageFiles = await storage.readDir(paths.images);
    const supportedExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp'];

    for (const file of imageFiles) {
      const ext = file.toLowerCase().slice(file.lastIndexOf('.'));
      if (supportedExtensions.includes(ext)) {
        tasks.push({
          src: `${paths.images}/${file}`,
          dest: `${buildPaths.images}/${file}`,
          description: `image/${file}`,
        });
      }
    }
  }

  logger?.debug('Copying %d files', tasks.length);
  onProgress?.({ phase: 'copy', current: 0, total: tasks.length, message: 'Starting copy' });

  // Execute copy tasks
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]!;
    logger?.debug('Copying: %s', task.description);
    onProgress?.({ phase: 'copy', current: i, total: tasks.length, message: task.description });

    await storage.copyFile(task.src, task.dest);
  }

  onProgress?.({ phase: 'copy', current: tasks.length, total: tasks.length, message: 'Copy complete' });
  logger?.info('Copied %d files', tasks.length);
}
