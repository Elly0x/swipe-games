export default {
  async fetch(request) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const featuredRes = await fetch('https://store.steampowered.com/api/featuredcategories?cc=br&l=portuguese');
      const featured = await featuredRes.json();

      const newReleases = (featured.new_releases?.items || []).slice(0, 10);
      const topSellers = (featured.top_sellers?.items || []).slice(0, 6);
      const combined = [...newReleases, ...topSellers];

      const seen = new Set();
      const unique = combined.filter((g) => {
        if (seen.has(g.id)) return false;
        seen.add(g.id);
        return true;
      });

      const games = await Promise.all(
        unique.map(async (item) => {
          try {
            const detailRes = await fetch(
              `https://store.steampowered.com/api/appdetails?appids=${item.id}&l=portuguese&cc=br`
            );
            const detailJson = await detailRes.json();
            const detail = detailJson[item.id] && detailJson[item.id].data;
            return {
              id: String(item.id),
              name: item.name,
              released: (detail && detail.release_date && detail.release_date.date || '').slice(-4) || '—',
              rating: detail && detail.metacritic ? detail.metacritic.score / 20 : 4,
              genres: detail && detail.genres ? detail.genres.map((g) => g.description).slice(0, 3) : [],
              image: item.header_image || (detail && detail.header_image) || '',
            };
          } catch (e) {
            return {
              id: String(item.id),
              name: item.name,
              released: '—',
              rating: 4,
              genres: [],
              image: item.header_image || '',
            };
          }
        })
      );

      return new Response(JSON.stringify(games), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
