export type ServerApiTransport = (request: Request) => Promise<Response>;

// The Workers build replaces this module; browsers and Bun retain HTTP transport.
export function getServerApiTransport(): ServerApiTransport | null {
  return null;
}
