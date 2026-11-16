export function GET() {
  return Response.json({
    id: '/contagem', name: 'Contagem Rincão', short_name: 'Contagem',
    description: 'Contagem de passeios e entrada de visitantes. Requer internet.',
    start_url: '/contagem', scope: '/contagem', display: 'standalone',
    background_color: '#F4F7FB', theme_color: '#133A62', lang: 'pt-BR',
    icons: [192, 512].map(size => ({src: `/contagem/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any'})),
  }, {headers: {'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600'}});
}
