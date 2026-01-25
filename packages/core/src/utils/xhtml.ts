import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

/**
 * Convert HTML to well-formed XHTML
 */
export function convertToXhtml(html: string): string {
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
