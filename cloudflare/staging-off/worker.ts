const worker = {
  fetch(_request: Request): Response {
    return new Response('Ambiente de staging desativado.\n', {
      status: 410,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  },
};

export default worker;
