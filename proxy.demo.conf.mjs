/** Solo demo: las imagenes del simulador no pasan por HttpClient. */
import realProxy from './proxy.conf.mjs';

export default [
  {
    context: ['/public/media'],
    target: 'http://localhost:3125',
    bypass: (_request, response) => {
      response.writeHead(302, { Location: '/mock-media.svg' });
      response.end();
      return false;
    },
  },
  ...realProxy,
];
