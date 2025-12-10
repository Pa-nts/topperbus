export interface Stop {
  tag: string;
  title: string;
  shortTitle?: string;
  lat: number;
  lon: number;
  stopId: string;
}

export interface Direction {
  tag: string;
  title: string;
  name: string;
  useForUI: boolean;
  stops: string[];
}

export interface PathPoint {
  lat: number;
  lon: number;
}

export interface Route {
  tag: string;
  title: string;
  color: string;
  oppositeColor: string;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  stops: Stop[];
  directions: Direction[];
  paths: PathPoint[][];
}

export interface VehicleLocation {
  id: string;
  routeTag: string;
  dirTag: string;
  lat: number;
  lon: number;
  heading: number;
  speedKmHr: number;
  secsSinceReport: number;
}

export interface Prediction {
  epochTime: number;
  seconds: number;
  minutes: number;
  isDeparture: boolean;
  affectedByLayover: boolean;
  dirTag: string;
  vehicle: string;
  block: string;
}

export interface PredictionDirection {
  title: string;
  predictions: Prediction[];
}

export interface StopPredictions {
  stopTag: string;
  stopTitle: string;
  routeTag: string;
  routeTitle: string;
  directions: PredictionDirection[];
}
