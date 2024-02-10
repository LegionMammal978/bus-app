const ugaBase = 'https://routes.uga.edu';
const accBase = 'https://bustracker.accgov.com/InfoPoint';

async function fetchJson(...args) {
  const response = await fetch(...args, { headers: { Accept: 'application/json' } });
  return await response.json();
}

async function getUgaData() {
  let customerId = null;
  const routes = new Map();
  const vehicles = new Map();
  const stops = new Map();
  for (const region of await fetchJson(`${ugaBase}/Regions`)) {
    for (const route of await fetchJson(`${ugaBase}/Region/${region.ID}/Routes`)) {
      if (customerId === null)
        customerId = route.CustomerID;
      else if (route.CustomerID !== customerId)
        throw new Error();
      routes.set(route.ID, route);
      const routeVehicles = await fetchJson(`${ugaBase}/Route/${route.ID}/Vehicles`);
      if (routeVehicles.length === 0)
        continue;
      for (const vehicle of routeVehicles)
        vehicles.set(vehicle.ID, vehicle);
      for (const pattern of route.Patterns)
        for (const stop of await fetchJson(`${ugaBase}/Route/${pattern.ID}/Direction/${route.ID}/Stops`))
          stops.set(stop.ID, stop);
    }
  }
  return { customerId, routes, vehicles, stops };
}

async function getAccData() {
  const allRoutes = new Map();
  for (const route of await fetchJson(`${accBase}/rest/Routes/GetVisibleRoutes`))
    allRoutes.set(route.RouteId, route);
  const routeIds = [...allRoutes.keys()].join(',');
  const routes = new Map();
  const vehicles = new Map();
  const stops = new Map();
  for (const vehicle of await fetchJson(`${accBase}/rest/Vehicles/GetAllVehiclesForRoutes?routeIDs=${routeIds}`)) {
    vehicles.set(vehicle.VehicleId, vehicle);
    if (!routes.has(vehicle.RouteId)) {
      const route = await fetchJson(`${accBase}/rest/RouteDetails/Get/${vehicle.RouteId}`);
      routes.set(vehicle.RouteId, route);
      for (const stop of route.Stops)
        stops.set(stop.StopId, stop);
    }
  }
  return { routes, vehicles, stops };
}

(async () => {
  const uga = await getUgaData();
  const acc = await getAccData();
  console.log(uga);
  console.log(acc);
})();
