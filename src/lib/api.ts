import { Route, Stop, Direction, PathPoint, VehicleLocation, StopPredictions, Prediction, PredictionDirection } from '@/types/transit';

const API_BASE = 'https://retro.umoiq.com/service/publicXMLFeed';
const AGENCY = 'wku';

async function fetchXML(url: string): Promise<Document> {
  const response = await fetch(url);
  const text = await response.text();
  const parser = new DOMParser();
  return parser.parseFromString(text, 'text/xml');
}

export async function fetchRouteConfig(): Promise<Route[]> {
  const doc = await fetchXML(`${API_BASE}?command=routeConfig&a=${AGENCY}`);
  const routeElements = doc.querySelectorAll('route');
  
  const routes: Route[] = [];
  
  routeElements.forEach(routeEl => {
    const stops: Stop[] = [];
    const directions: Direction[] = [];
    const paths: PathPoint[][] = [];
    
    // Parse stops
    routeEl.querySelectorAll(':scope > stop').forEach(stopEl => {
      stops.push({
        tag: stopEl.getAttribute('tag') || '',
        title: stopEl.getAttribute('title') || '',
        shortTitle: stopEl.getAttribute('shortTitle') || undefined,
        lat: parseFloat(stopEl.getAttribute('lat') || '0'),
        lon: parseFloat(stopEl.getAttribute('lon') || '0'),
        stopId: stopEl.getAttribute('stopId') || '',
      });
    });
    
    // Parse directions
    routeEl.querySelectorAll('direction').forEach(dirEl => {
      const dirStops: string[] = [];
      dirEl.querySelectorAll('stop').forEach(stopEl => {
        dirStops.push(stopEl.getAttribute('tag') || '');
      });
      
      directions.push({
        tag: dirEl.getAttribute('tag') || '',
        title: dirEl.getAttribute('title') || '',
        name: dirEl.getAttribute('name') || '',
        useForUI: dirEl.getAttribute('useForUI') === 'true',
        stops: dirStops,
      });
    });
    
    // Parse paths
    routeEl.querySelectorAll('path').forEach(pathEl => {
      const points: PathPoint[] = [];
      pathEl.querySelectorAll('point').forEach(pointEl => {
        points.push({
          lat: parseFloat(pointEl.getAttribute('lat') || '0'),
          lon: parseFloat(pointEl.getAttribute('lon') || '0'),
        });
      });
      if (points.length > 0) {
        paths.push(points);
      }
    });
    
    routes.push({
      tag: routeEl.getAttribute('tag') || '',
      title: routeEl.getAttribute('title') || '',
      color: routeEl.getAttribute('color') || '000000',
      oppositeColor: routeEl.getAttribute('oppositeColor') || 'ffffff',
      latMin: parseFloat(routeEl.getAttribute('latMin') || '0'),
      latMax: parseFloat(routeEl.getAttribute('latMax') || '0'),
      lonMin: parseFloat(routeEl.getAttribute('lonMin') || '0'),
      lonMax: parseFloat(routeEl.getAttribute('lonMax') || '0'),
      stops,
      directions,
      paths,
    });
  });
  
  return routes;
}

export async function fetchVehicleLocations(routeTag?: string): Promise<VehicleLocation[]> {
  const url = routeTag 
    ? `${API_BASE}?command=vehicleLocations&a=${AGENCY}&r=${routeTag}&t=0`
    : `${API_BASE}?command=vehicleLocations&a=${AGENCY}&t=0`;
  
  const doc = await fetchXML(url);
  const vehicleElements = doc.querySelectorAll('vehicle');
  
  const vehicles: VehicleLocation[] = [];
  
  vehicleElements.forEach(vehicleEl => {
    vehicles.push({
      id: vehicleEl.getAttribute('id') || '',
      routeTag: vehicleEl.getAttribute('routeTag') || '',
      dirTag: vehicleEl.getAttribute('dirTag') || '',
      lat: parseFloat(vehicleEl.getAttribute('lat') || '0'),
      lon: parseFloat(vehicleEl.getAttribute('lon') || '0'),
      heading: parseFloat(vehicleEl.getAttribute('heading') || '0'),
      speedKmHr: parseFloat(vehicleEl.getAttribute('speedKmHr') || '0'),
      secsSinceReport: parseInt(vehicleEl.getAttribute('secsSinceReport') || '0', 10),
    });
  });
  
  return vehicles;
}

export async function fetchPredictions(stopTag: string, routeTag?: string): Promise<StopPredictions[]> {
  const url = routeTag
    ? `${API_BASE}?command=predictions&a=${AGENCY}&r=${routeTag}&s=${stopTag}`
    : `${API_BASE}?command=predictionsForMultiStops&a=${AGENCY}&stops=${stopTag}`;
  
  const doc = await fetchXML(url);
  const predictionsElements = doc.querySelectorAll('predictions');
  
  const predictions: StopPredictions[] = [];
  
  predictionsElements.forEach(predEl => {
    const directions: PredictionDirection[] = [];
    
    predEl.querySelectorAll('direction').forEach(dirEl => {
      const preds: Prediction[] = [];
      
      dirEl.querySelectorAll('prediction').forEach(pEl => {
        preds.push({
          epochTime: parseInt(pEl.getAttribute('epochTime') || '0', 10),
          seconds: parseInt(pEl.getAttribute('seconds') || '0', 10),
          minutes: parseInt(pEl.getAttribute('minutes') || '0', 10),
          isDeparture: pEl.getAttribute('isDeparture') === 'true',
          affectedByLayover: pEl.getAttribute('affectedByLayover') === 'true',
          dirTag: pEl.getAttribute('dirTag') || '',
          vehicle: pEl.getAttribute('vehicle') || '',
          block: pEl.getAttribute('block') || '',
        });
      });
      
      if (preds.length > 0) {
        directions.push({
          title: dirEl.getAttribute('title') || '',
          predictions: preds,
        });
      }
    });
    
    if (directions.length > 0) {
      predictions.push({
        stopTag: predEl.getAttribute('stopTag') || '',
        stopTitle: predEl.getAttribute('stopTitle') || '',
        routeTag: predEl.getAttribute('routeTag') || '',
        routeTitle: predEl.getAttribute('routeTitle') || '',
        directions,
      });
    }
  });
  
  return predictions;
}

export async function fetchAllPredictionsForStop(routes: Route[], stopTag: string): Promise<StopPredictions[]> {
  // Find all routes that have this stop
  const routesWithStop = routes.filter(route => 
    route.stops.some(stop => stop.tag === stopTag)
  );
  
  const allPredictions: StopPredictions[] = [];
  
  for (const route of routesWithStop) {
    const preds = await fetchPredictions(stopTag, route.tag);
    allPredictions.push(...preds);
  }
  
  return allPredictions;
}
