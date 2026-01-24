import { Command } from 'commander';
import ora from 'ora';
import pc from 'picocolors';

export const pdfCommand = new Command('pdf')
  .description('Generate PDF using pdf-server (requires @swibostyle/pdf-server)')
  .option('-t, --target <type>', 'Build target (print, pod)', 'print')
  .option('-s, --src <dir>', 'Source directory', './src')
  .option('-o, --output <file>', 'Output PDF file')
  .option('--server <url>', 'PDF server URL', 'http://localhost:3000')
  .action(async (options) => {
    const spinner = ora('Checking PDF server...').start();

    try {
      const target = options.target;

      // Validate target
      if (!['print', 'pod'].includes(target)) {
        spinner.fail(pc.red(`Invalid target for PDF: ${target}. Use 'print' or 'pod'.`));
        process.exit(1);
      }

      // Check if server is available
      try {
        const response = await fetch(`${options.server}/health`);
        if (!response.ok) {
          throw new Error('Server not responding');
        }
      } catch {
        spinner.fail(pc.red('PDF server is not available'));
        console.log();
        console.log(pc.yellow('To generate PDFs, you need to:'));
        console.log(pc.dim('  1. Install the PDF server: npm install @swibostyle/pdf-server'));
        console.log(pc.dim('  2. Start the server: npx swibostyle-pdf-server'));
        console.log(pc.dim('  3. Run this command again'));
        console.log();
        console.log(pc.dim('Note: @swibostyle/pdf-server is licensed under AGPL due to Vivliostyle dependency.'));
        process.exit(1);
      }

      spinner.text = `Generating PDF (${target})...`;

      // TODO: Implement PDF generation via server API
      // 1. Build EPUB with print/pod target
      // 2. Send to pdf-server
      // 3. Receive PDF

      spinner.info(pc.yellow('PDF generation is not yet fully implemented'));
      console.log(pc.dim('  Server connection successful, but PDF generation API is pending.'));
    } catch (error) {
      spinner.fail(pc.red('PDF generation failed'));
      console.error(pc.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });
