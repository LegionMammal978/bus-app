const ugaBase = 'https://routes.uga.edu';
const accBase = 'https://bustracker.accgov.com/InfoPoint';

export function geoDistanceFt(pos1, pos2) {
  const degree = Math.PI / 180;
  const radiusFt = 20902259;
  const [lat1, lon1] = pos1;
  const [lat2, lon2] = pos2;
  const sinLat = Math.sin((lat2 - lat1) / 2 * degree);
  const cosLat = Math.cos(lat1 * degree) + Math.cos(lat2 * degree);
  const sinLon = Math.sin((lon2 - lon1) / 2 * degree);
  const sum = sinLat * sinLat + cosLat * sinLon * sinLon;
  return 2 * radiusFt * Math.asin(Math.sqrt(sum));
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  return await response.json();
}

export async function getUgaData() {
  let customerId = null;
  const routes = new Map();
  const vehicles = new Map();
  const stops = new Map();
  for (const region of await fetchJson(`${ugaBase}/Regions`)) {
    for (const route of await fetchJson(`${ugaBase}/Region/${region.ID}/Routes`)) {
      if (!route.ArrivalsEnabled)
        continue;
      if (customerId === null)
        customerId = route.CustomerID;
      else if (route.CustomerID !== customerId)
        throw new Error();
      const routeVehicles = await fetchJson(`${ugaBase}/Route/${route.ID}/Vehicles`);
      if (routeVehicles.length === 0)
        continue;
      for (const vehicle of routeVehicles) {
        vehicles.set(vehicle.ID, {
          kind: 'uga',
          id: vehicle.ID,
          name: vehicle.Name,
          //routeId: vehicle.RouteId,
          routeId: vehicle.PatternId,
          pos: [vehicle.Latitude, vehicle.Longitude],
        });
      }
      for (const pattern of route.Patterns) {
        const stopIds = [];
        for (const stop of await fetchJson(`${ugaBase}/Route/${pattern.ID}/Direction/${route.ID}/Stops`)) {
          stopIds.push(stop.ID);
          if (!stops.has(stop.ID)) {
            stops.set(stop.ID, {
              kind: 'uga',
              id: stop.ID,
              name: stop.Name.trim(),
              pos: [stop.Latitude, stop.Longitude],
            });
          }
        }
        let name = route.DisplayName.trim();
        if (pattern.Direction !== 'Loop')
          name += ` (${pattern.Direction})`;
        routes.set(pattern.ID, {
          kind: 'uga',
          id: pattern.ID,
          name,
          label: route.ShortName,
          fgColor: route.TextColor,
          bgColor: route.Color,
          stopIds,
        });
      }
    }
  }
  return { customerId, routes, vehicles, stops };
}

export async function getAccData() {
  const allRoutes = new Map();
  for (const route of await fetchJson(`${accBase}/rest/Routes/GetVisibleRoutes`))
    allRoutes.set(route.RouteId, route);
  const routeIds = [...allRoutes.keys()].join(',');
  const routes = new Map();
  const vehicles = new Map();
  const stops = new Map();
  for (const vehicle of await fetchJson(`${accBase}/rest/Vehicles/GetAllVehiclesForRoutes?routeIDs=${routeIds}`)) {
    vehicles.set(vehicle.VehicleId, {
      kind: 'acc',
      id: vehicle.VehicleId,
      name: vehicle.Name,
      routeId: vehicle.RouteId,
      pos: [vehicle.Latitude, vehicle.Longitude],
    });
    if (!routes.has(vehicle.RouteId)) {
      const route = await fetchJson(`${accBase}/rest/RouteDetails/Get/${vehicle.RouteId}`);
      routes.set(route.RouteId, {
        kind: 'acc',
        id: vehicle.RouteId,
        name: route.LongName.trim(),
        label: route.RouteAbbreviation,
        fgColor: '#' + route.TextColor,
        bgColor: '#' + route.Color,
        stopIds: route.RouteStops.map(stop => stop.StopId),
      });
      for (const stop of route.Stops) {
        if (!stops.has(stop.stopId)) {
          stops.set(stop.StopId, {
            kind: 'acc',
            id: stop.StopId,
            name: stop.Description.trim(),
            pos: [stop.Latitude, stop.Longitude],
          });
        }
      }
    }
  }
  return { routes, vehicles, stops };
}

export async function getArrivals(uga, acc, stop, minOffsetSec) {
  const arrivals = [];
  if (stop.kind === 'uga') {
    const timeBase = Date.now();
    for (const routeArrivals of await fetchJson(`${ugaBase}/Stop/${stop.id}/Arrivals?customerId=${uga.customerId}`)) {
      const routeId = routeArrivals.routeId;
      for (const arrival of routeArrivals.Arrivals) {
        if (arrival.SecondsToArrival < minOffsetSec)
          continue;
        arrivals.push({
          route: uga.routes.get(arrival.RouteID),
          vehicle: uga.vehicles.get(arrival.VehicleID),
          stop,
          date: new Date(timeBase + 1000 * arrival.SecondsToArrival),
        });
      }
    }
  } else if (stop.kind === 'acc') {
    // todo!
  }
  return arrivals;
}
