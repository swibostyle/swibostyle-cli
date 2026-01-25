#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"

EPUBCHECK_VERSION="${EPUBCHECK_VERSION:-5.1.0}"
EPUBCHECK_SHA256="${EPUBCHECK_SHA256:-74a59af8602bf59b1d04266a450d9cdcb5986e36d825adc403cde0d95e88c9e8}"

WORK_DIR=$(mktemp -d)
trap "rm -rf $WORK_DIR" EXIT

echo "Building JRE for epub-validator-linux-x64..."
echo "EPubCheck version: ${EPUBCHECK_VERSION}"
echo "Working directory: ${WORK_DIR}"

cd "$WORK_DIR"

# Download EPubCheck
echo "Downloading EPubCheck..."
curl -L -o epubcheck.zip \
  "https://github.com/w3c/epubcheck/releases/download/v${EPUBCHECK_VERSION}/epubcheck-${EPUBCHECK_VERSION}.zip"

# Verify checksum
echo "Verifying checksum..."
ACTUAL_SHA256=$(sha256sum epubcheck.zip | awk '{print $1}')
if [ "${ACTUAL_SHA256}" != "${EPUBCHECK_SHA256}" ]; then
  echo "ERROR: Checksum mismatch!"
  echo "Expected: ${EPUBCHECK_SHA256}"
  echo "Actual:   ${ACTUAL_SHA256}"
  exit 1
fi
echo "Checksum verified."

# Extract EPubCheck
echo "Extracting EPubCheck..."
unzip -q epubcheck.zip

# Create minimal JRE with jlink
echo "Creating minimal JRE with jlink..."
MODULES="java.base,java.xml,java.logging,java.desktop,java.naming,java.management,java.sql,jdk.crypto.ec"

jlink \
  --add-modules ${MODULES} \
  --strip-debug \
  --no-man-pages \
  --no-header-files \
  --compress=zip-6 \
  --output jre-linux-x64

echo "JRE size: $(du -sh jre-linux-x64 | cut -f1)"

# Test bundled JRE
echo "Testing bundled JRE..."
./jre-linux-x64/bin/java -version
./jre-linux-x64/bin/java -jar "epubcheck-${EPUBCHECK_VERSION}/epubcheck.jar" --version

# Copy to package directory
echo "Copying files to package..."
rm -rf "${PACKAGE_DIR}/jre" "${PACKAGE_DIR}/epubcheck.jar" "${PACKAGE_DIR}/lib"

cp -r jre-linux-x64 "${PACKAGE_DIR}/jre"
cp "epubcheck-${EPUBCHECK_VERSION}/epubcheck.jar" "${PACKAGE_DIR}/"
cp -r "epubcheck-${EPUBCHECK_VERSION}/lib" "${PACKAGE_DIR}/"

# Create version info
echo "${EPUBCHECK_VERSION}" > "${PACKAGE_DIR}/VERSION"
echo "${EPUBCHECK_SHA256}" > "${PACKAGE_DIR}/CHECKSUM"

echo "Build complete!"
echo "Package contents:"
ls -la "${PACKAGE_DIR}"
echo "Total size: $(du -sh "${PACKAGE_DIR}" | cut -f1)"
