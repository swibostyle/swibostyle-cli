#!/usr/bin/env bun
/**
 * Post-build script to download EPubCheck JAR
 */

import { existsSync, mkdirSync, createWriteStream } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { createReadStream, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, "..");

const EPUBCHECK_VERSION = "5.1.0";
const EPUBCHECK_SHA256 = "74a59af8602bf59b1d04266a450d9cdcb5986e36d825adc403cde0d95e88c9e8";
const EPUBCHECK_URL = `https://github.com/w3c/epubcheck/releases/download/v${EPUBCHECK_VERSION}/epubcheck-${EPUBCHECK_VERSION}.zip`;

const BIN_DIR = resolve(PACKAGE_ROOT, "bin");
const JAR_PATH = resolve(BIN_DIR, "epubcheck.jar");
const ZIP_PATH = resolve(BIN_DIR, "epubcheck.zip");

async function downloadFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }
  const fileStream = createWriteStream(dest);
  // @ts-expect-error - Bun supports this
  await pipeline(response.body, fileStream);
}

async function verifyChecksum(filePath: string, expected: string): Promise<boolean> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  const actual = hash.digest("hex");
  return actual === expected;
}

async function main() {
  // Check if JAR already exists
  if (existsSync(JAR_PATH)) {
    console.log("EPubCheck JAR already exists, skipping download");
    return;
  }

  console.log(`Downloading EPubCheck ${EPUBCHECK_VERSION}...`);

  // Create bin directory
  if (!existsSync(BIN_DIR)) {
    mkdirSync(BIN_DIR, { recursive: true });
  }

  // Download ZIP
  await downloadFile(EPUBCHECK_URL, ZIP_PATH);

  // Verify checksum
  console.log("Verifying checksum...");
  const valid = await verifyChecksum(ZIP_PATH, EPUBCHECK_SHA256);
  if (!valid) {
    unlinkSync(ZIP_PATH);
    throw new Error("Checksum verification failed!");
  }

  // Extract JAR and lib directory
  console.log("Extracting epubcheck.jar and dependencies...");
  execSync(`unzip -o "${ZIP_PATH}" -d "${BIN_DIR}"`, {
    stdio: "inherit",
  });

  // Move files to correct location
  const extractedDir = resolve(BIN_DIR, `epubcheck-${EPUBCHECK_VERSION}`);
  execSync(`mv "${extractedDir}/epubcheck.jar" "${BIN_DIR}/"`, { stdio: "inherit" });
  execSync(`mv "${extractedDir}/lib" "${BIN_DIR}/"`, { stdio: "inherit" });
  execSync(`rm -rf "${extractedDir}"`, { stdio: "inherit" });

  // Clean up ZIP
  unlinkSync(ZIP_PATH);

  console.log("EPubCheck JAR downloaded successfully");
}

main().catch((error) => {
  console.error("Failed to download EPubCheck:", error);
  process.exit(1);
});
