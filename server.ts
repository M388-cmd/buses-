import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';

dotenv.config();

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = process.env.PORT || 3000;

  // Middleware to parse JSON
  app.use(express.json());

  // Helper function to get TMB credentials
  const getTmbCredentials = () => ({
    appId: process.env.TMB_APP_ID || '',
    appKey: process.env.TMB_APP_KEY || ''
  });

  // API routes FIRST
  app.get('/api/bus/parada/:stopId/info', async (req, res) => {
    const { stopId } = req.params;
    const { appId, appKey } = getTmbCredentials();
    
    if (!appId || !appKey) {
      return res.status(500).json({ error: 'Credenciales de TMB no configuradas.' });
    }

    try {
      const response = await fetch(`https://api.tmb.cat/v1/transit/parades/${stopId}/corresp?app_id=${appId}&app_key=${appKey}`);
      if (!response.ok) {
        return res.json({ connections: [] });
      }
      
      const data = await response.json() as any;
      const connections = data.features?.map((f: any) => ({
        line: f.properties.NOM_LINIA,
        color: f.properties.COLOR_LINIA,
        desc: f.properties.DESC_LINIA,
        type: f.properties.NOM_FAMILIA
      })) || [];
      
      const uniqueConns = Array.from(new Map(connections.map((c: any) => [c.line, c])).values());

      return res.json({ connections: uniqueConns });
    } catch (error) {
      console.error('Error fetching stop info:', error);
      return res.json({ connections: [] });
    }
  });

  app.get('/api/bus/parada/:stopId', async (req, res) => {
    const { stopId } = req.params;
    const { appId, appKey } = getTmbCredentials();
    
    if (!appId || !appKey) {
      return res.status(500).json({ error: 'Credenciales de la API de TMB no configuradas.' });
    }

    try {
      const response = await fetch(`https://api.tmb.cat/v1/ibus/stops/${stopId}?app_id=${appId}&app_key=${appKey}`);
      if (response.status === 404) {
        return res.status(404).json({ error: 'Parada no encontrada.' });
      }
      if (!response.ok) {
        throw new Error('Error al consultar itransit');
      }

      const data = await response.json() as any;
      let rawArrivals = [];
      if (data && data.data && data.data.ibus) {
        rawArrivals = data.data.ibus;
      } else if (Array.isArray(data)) {
        rawArrivals = data;
      }

      const cleanedData = rawArrivals.map((item: any) => ({
        line: item.line || 'N/A',
        destination: item.destination || item['text-ca'] || 'Destino desconocido',
        minutes: item['t-in-min'] != null ? item['t-in-min'] : null,
      }));

      return res.json(cleanedData);
    } catch (error) {
      console.error('Error fetching from TMB:', error);
      return res.status(500).json({ error: 'Error interno del servidor al contactar con TMB.' });
    }
  });

  // Routes for getting bus lines
  app.get('/api/bus/lines', async (req, res) => {
    const { appId, appKey } = getTmbCredentials();
    
    if (!appId || !appKey) {
      return res.status(500).json({ error: 'Credenciales de TMB no configuradas.' });
    }

    try {
      const response = await fetch(`https://api.tmb.cat/v1/transit/linies?app_id=${appId}&app_key=${appKey}`);
      if (!response.ok) throw new Error('Error fetching lines');
      
      const data = await response.json() as any;
      const features = data?.features || [];
      const lines = features
        .map((f: any) => f.properties)
        .filter((l: any) => l.CODI_FAMILIA === 1 || l.NOM_LINIA.toUpperCase().includes('BUS') || l.CODI_LINIA < 999)
        .sort((a: any, b: any) => a.NOM_LINIA.localeCompare(b.NOM_LINIA, undefined, {numeric: true}));
      
      const uniqueLines = Array.from(new Map(lines.map((l: any) => [l.CODI_LINIA, l])).values());
      
      return res.json(uniqueLines);
    } catch (error) {
      console.error('Error fetching lines:', error);
      return res.status(500).json({ error: 'Error interno obteniendo líneas.' });
    }
  });

  let cachedStops: any[] | null = null;
  let cachedStopsTime = 0;

  // Route for getting stops of a bus line
  app.get('/api/bus/stops/search', async (req, res) => {
    const query = (req.query.q as string || '').toLowerCase();
    const { appId, appKey } = getTmbCredentials();
    
    if (!appId || !appKey) {
      return res.status(500).json({ error: 'Credenciales de TMB no configuradas.' });
    }

    try {
      const now = Date.now();
      if (!cachedStops || now - cachedStopsTime > 24 * 60 * 60 * 1000) {
        const response = await fetch(`https://api.tmb.cat/v1/transit/parades?app_id=${appId}&app_key=${appKey}&fields=NOM_PARADA,CODI_PARADA`);
        if (!response.ok) throw new Error('Error fetching stops');
        
        const data = await response.json() as any;
        const features = data?.features || [];
        cachedStops = features.map((f: any) => f.properties);
        cachedStopsTime = now;
      }

      const allStops = cachedStops || [];
      
      let results = allStops;
      if (query) {
         results = allStops.filter((s: any) => 
           s.NOM_PARADA && s.NOM_PARADA.toLowerCase().includes(query) ||
           s.CODI_PARADA.toString().includes(query)
         );
      }
      
      const uniqueStops = Array.from(new Map(results.map((s: any) => [s.CODI_PARADA, s])).values());
      
      return res.json(uniqueStops.slice(0, 50));
    } catch (error) {
      console.error('Error searching stops:', error);
      return res.status(500).json({ error: 'Error interno buscando paradas.' });
    }
  });

  app.get('/api/bus/lines/:lineId/stops', async (req, res) => {
    const { lineId } = req.params;
    const { appId, appKey } = getTmbCredentials();
    
    if (!appId || !appKey) {
      return res.status(500).json({ error: 'Credenciales de TMB no configuradas.' });
    }

    try {
      const response = await fetch(`https://api.tmb.cat/v1/transit/linies/bus/${lineId}/parades?app_id=${appId}&app_key=${appKey}&fields=SENTIT,ORDRE,NOM_PARADA,CODI_PARADA`);
      if (!response.ok) throw new Error('Error fetching line stops');
      
      const data = await response.json() as any;
      const features = data?.features || [];
      const stops = features.map((f: any) => f.properties);
      
      return res.json(stops);
    } catch (error) {
      console.error('Error fetching stops:', error);
      return res.status(500).json({ error: 'Error interno obteniendo paradas.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
