/**
 * Convert HTML to well-formed XHTML
 */
export function convertToXhtml(html: string): string {
  // Use DOMParser for parsing (works in both Node.js and browser)
  const { DOMParser, XMLSerializer } = require("@xmldom/xmldom");

  const parser = new DOMParser({
    errorHandler: {
      warning: () => {},
      error: () => {},
      fatalError: () => {},
    },
  });

  const doc = parser.parseFromString(html, "text/html");
  const serializer = new XMLSerializer();

  return serializer.serializeToString(doc);
}
